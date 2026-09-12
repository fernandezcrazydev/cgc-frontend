import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminActionsApi,
  RiotAccountRefreshReport,
  RiotUsageStore,
  SecurityAuditStore,
} from '../../../../core/admin';
import { FeedbackAdminStore } from '../../../../core/feedback';
import { errorMessage } from '../../../../core/http';
import { ToastService } from '../../../../core/toast';
import { NfButton, NfSkeleton } from '../../../../ui';

/**
 * Directorio de administración (solo ADMIN, protegido por `adminGuard`), en dos zonas:
 *
 * - **Herramientas**: enlaces a otras vistas de admin. Rejilla de tarjetas.
 * - **Operaciones**: acciones que se ejecutan contra el servidor desde aquí. Lista.
 *
 * La separación es el punto de la pantalla: antes las cuatro compartían tarjeta, así que
 * un enlace y un POST se veían exactamente igual. Añadir una herramienta es otro `<a>` en
 * la plantilla, con su icono; añadir una operación, otra fila en `.adm-ops`.
 *
 * **Cada herramienta lleva su pulso** bajo una línea: cuántos reportes esperan, cuánta cuota
 * de Riot queda y cuántos intentos rechazó la puerta en 24 h. Sin eso el directorio obliga a
 * abrir las tres pantallas para descubrir que no pasa nada en ninguna. El precio es que la
 * ruta hace tres lecturas más al entrar, así que las tres son **independientes**: cada pie
 * carga, falla y se pinta por su cuenta, y ninguna puede tumbar la pantalla — el directorio
 * sigue siendo navegable con las tres caídas.
 */
@Component({
  selector: 'app-admin-directory',
  standalone: true,
  imports: [RouterLink, NfButton, NfSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminDirectory {
  private readonly api = inject(AdminActionsApi);
  private readonly toasts = inject(ToastService);

  /** Públicos: la plantilla lee de ellos los tres pulsos de las tarjetas. */
  readonly feedback = inject(FeedbackAdminStore);
  readonly riot = inject(RiotUsageStore);
  readonly security = inject(SecurityAuditStore);

  /** La ventana del pulso de seguridad, para no repetir el 24 en la plantilla. */
  readonly securityWindowHours = SecurityAuditStore.PULSE_HOURS;

  /**
   * Ya se sabe el número, aunque haya un refresco en vuelo: se sigue pintando el que había.
   * Volver a esta pantalla no debe vaciar el pie y volver a llenarlo.
   */
  readonly pendingKnown = computed(() => this.feedback.pendingCount() !== null);

  /** Primera carga: todavía no hay número y la petición está en camino. */
  readonly pendingLoading = computed(
    () => this.feedback.pendingCount() === null && this.feedback.pendingStatus() !== 'error',
  );

  /**
   * Los tres pies siguen la misma regla y en este orden: si hay dato se pinta el dato (aunque
   * esté refrescándose), si no lo hay y la lectura falló se dice que falló, y si no lo hay
   * todavía va el esqueleto. Nunca un 0 provisional: se lee como «no ha pasado nada».
   */
  readonly riotKnown = computed(() => this.riot.usage() !== null);
  readonly riotLoading = computed(() => this.riot.usage() === null && this.riot.status() !== 'error');

  /**
   * El pie de esta tarjeta dice "estado + números" en una línea, como sus dos hermanas, en vez
   * de una barra con la jerga del backend encima ("Ventana de 120 s" / "62/100"). La barra
   * sigue estando en la cabecera y dentro de la propia vista de métricas, que es donde el uso
   * se vigila; aquí solo hace falta saber si hay que entrar.
   */
  readonly riotStateLabel = computed(() => {
    switch (this.riot.level()) {
      case 'danger':
        return 'Cuota al límite';
      case 'warn':
        return 'Cuota apretada';
      default:
        return 'Cuota holgada';
    }
  });

  /**
   * "62 de 100 en 2 min". El periodo lo dice el servidor (`windowSeconds`), pero se pinta en
   * minutos cuando es exacto: "120 s" es como lo cuenta la API, no como lo cuenta una persona.
   */
  readonly riotUsageLabel = computed(() => {
    const usage = this.riot.usage();
    if (!usage) return '';
    const seconds = usage.windowSeconds;
    const window = seconds >= 60 && seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
    return `${usage.used} de ${usage.limit} en ${window}`;
  });

  readonly securityKnown = computed(() => this.security.pulse() !== null);
  readonly securityLoading = computed(
    () => this.security.pulse() === null && this.security.pulseStatus() !== 'error',
  );
  readonly securityTotal = computed(() => this.security.pulse()?.totalEvents ?? 0);

  readonly refreshPending = signal(false);
  readonly refreshResult = signal<RiotAccountRefreshReport | null>(null);

  constructor() {
    // Se piden al entrar en la ruta, no una vez por sesión: otro admin puede haber triado
    // mientras tanto, y el log de seguridad crece solo. Los stores deduplican lo que esté
    // en vuelo. `riot.refresh()` es una lectura suelta: el polling de la cabecera es de la
    // cabecera, y pararlo al salir de aquí la dejaría congelada.
    void this.feedback.refreshPendingCount();
    void this.riot.refresh();
    void this.security.refreshPulse();
  }

  /**
   * Una sola frase para la fila y para el toast, para que no puedan contar cosas distintas.
   *
   * Se nombran los dos hechos por separado porque fallan por separado, y `anchored` se dice
   * aparte de `seedsUpdated` porque no son lo mismo: un unranked refresca bien y no ancla. Los
   * saltos solo se mencionan si los hay — son lo normal cuando queda poca cuota, no una alarma.
   */
  readonly refreshSummary = computed(() => {
    const r = this.refreshResult();
    if (!r) return null;
    const parts = [
      `${r.iconsUpdated}/${r.total} iconos`,
      `${r.seedsUpdated}/${r.total} rangos (${r.anchored} con elo)`,
    ];
    if (r.failed) parts.push(`${r.failed} fallidas`);
    if (r.skipped) parts.push(`${r.skipped} sin cuota, para esta noche`);
    return parts.join(' · ');
  });

  /** No reentrante: el botón se deshabilita mientras la petición está en vuelo. */
  async refreshRiotAccounts(): Promise<void> {
    if (this.refreshPending()) return;
    this.refreshPending.set(true);
    try {
      this.refreshResult.set(await firstValueFrom(this.api.refreshRiotAccounts()));
      this.toasts.success(this.refreshSummary() ?? 'Cuentas refrescadas');
      // El barrido acaba de gastar cuota: el pie de la tarjeta de métricas ya no dice la verdad.
      void this.riot.refresh();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.refreshPending.set(false);
    }
  }
}
