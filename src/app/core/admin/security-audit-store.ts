import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PageResponse } from '../http';
import { SecurityAuditApi } from './security-audit-api';
import {
  SecurityAuditClient,
  SecurityAuditEvent,
  SecurityAuditFilters,
  SecurityAuditSummary,
} from './security-audit-models';

/** Estado de una carga, como en `Session`. */
export type SecurityAuditStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * El log de seguridad para el panel de admin.
 *
 * Las tres lecturas (resumen, ranking y listado) se piden **a la vez** y comparten filtros: son
 * tres vistas del mismo periodo y enseñarlas desincronizadas —el resumen de ayer junto al
 * listado de hoy— llevaría a conclusiones falsas justo mientras se investiga algo.
 *
 * Un fallo parcial no vacía lo demás: si el ranking cae pero el listado llega, se pinta el
 * listado. Con un log, la mitad de la información sigue siendo información.
 */
@Injectable({ providedIn: 'root' })
export class SecurityAuditStore {
  private readonly api = inject(SecurityAuditApi);

  static readonly PAGE_SIZE = 25;
  /** Suficiente para ver la forma de un ranking sin convertirlo en un segundo listado. */
  static readonly TOP_CLIENTS = 15;
  /** Ventana del pulso que pinta el directorio de admin. La misma que abre esta pantalla. */
  static readonly PULSE_HOURS = 24;

  private readonly _status = signal<SecurityAuditStatus>('idle');
  private readonly _page = signal<PageResponse<SecurityAuditEvent> | null>(null);
  private readonly _summary = signal<SecurityAuditSummary | null>(null);
  private readonly _clients = signal<SecurityAuditClient[] | null>(null);
  private readonly _filters = signal<SecurityAuditFilters>({});
  private readonly _lastError = signal<unknown>(null);

  readonly status = this._status.asReadonly();
  readonly page = this._page.asReadonly();
  readonly summary = this._summary.asReadonly();
  readonly clients = this._clients.asReadonly();
  readonly filters = this._filters.asReadonly();
  /** El primer fallo de la última carga, para que la vista lo traduzca. Null si no hubo. */
  readonly lastError = this._lastError.asReadonly();

  /**
   * Cargando de verdad. `idle` cuenta: la vista se construye antes de que arranque la primera
   * petición, y sin esto parpadearía un «no hay nada» falso antes del primer esqueleto.
   */
  readonly loading = computed(() => this._status() === 'loading' || this._status() === 'idle');

  /** Evita que dos cargas solapadas se pisen: gana siempre la última pedida. */
  private requestId = 0;

  /* ---- Pulso de 24 h (el pie de la tarjeta del directorio de admin) ----
     Vive aparte del resto del store a propósito: el directorio y esta pantalla se abren por
     separado y con periodos distintos, así que un filtro puesto aquí no debe cambiar el número
     que pinta la tarjeta, ni al revés. */

  private readonly _pulse = signal<SecurityAuditSummary | null>(null);
  private readonly _pulseStatus = signal<SecurityAuditStatus>('idle');
  private pulseInFlight: Promise<void> | null = null;

  /** El resumen de las últimas `PULSE_HOURS` horas, o null mientras no se sepa. */
  readonly pulse = this._pulse.asReadonly();
  readonly pulseStatus = this._pulseStatus.asReadonly();

  /**
   * Intentos que el servidor rechazó en la ventana: login fallido y acceso denegado juntos.
   * Son dos tipos distintos en el log, pero para «¿tengo que entrar a mirar?» significan lo
   * mismo, y separarlos en una línea de pie solo obligaría a sumarlos con la vista.
   *
   * `null` mientras no haya resumen: un 0 antes de tiempo se lee como «no ha pasado nada».
   */
  readonly pulseRejected = computed<number | null>(() => {
    const summary = this._pulse();
    if (!summary) return null;
    return summary.byKind
      .filter((k) => k.kind === 'LOGIN_FAILURE' || k.kind === 'ACCESS_DENIED')
      .reduce((total, k) => total + k.events, 0);
  });

  /**
   * Carga las tres lecturas para `pageIndex` (0-based) con los filtros actuales.
   *
   * No lanza: deja el estado en `error` y que la vista lo pinte. Es una pantalla de solo
   * lectura y con tres peticiones a la vez, así que propagar la primera que falle escondería
   * las otras dos, que puede que sí hayan traído algo.
   */
  async load(pageIndex = 0): Promise<void> {
    const id = ++this.requestId;
    this._status.set('loading');

    const filters = this._filters();
    const [page, summary, clients] = await Promise.allSettled([
      firstValueFrom(this.api.list(filters, pageIndex, SecurityAuditStore.PAGE_SIZE)),
      firstValueFrom(this.api.summary(filters)),
      firstValueFrom(this.api.topClients(filters, SecurityAuditStore.TOP_CLIENTS)),
    ]);

    // La respuesta de una carga que ya no es la vigente se descarta entera: escribirla
    // machacaría lo que pidió el filtro nuevo con datos del viejo.
    if (id !== this.requestId) return;

    this._page.set(page.status === 'fulfilled' ? page.value : null);
    this._summary.set(summary.status === 'fulfilled' ? summary.value : null);
    this._clients.set(clients.status === 'fulfilled' ? clients.value : null);

    // El primero que falle, si falla alguno. Basta con uno: los tres comparten filtros, así que
    // un 400 por una IP mal escrita los tumba a la vez y con el mismo motivo — repetir el toast
    // tres veces solo serviría para taparlo.
    const fallos = [page, summary, clients].filter((r) => r.status === 'rejected');
    this._lastError.set(fallos.length ? (fallos[0] as PromiseRejectedResult).reason : null);
    this._status.set(fallos.length === 3 ? 'error' : 'ready');
  }

  /** Cambia filtros y recarga desde la primera página: un filtro nuevo invalida el offset. */
  async applyFilters(filters: SecurityAuditFilters): Promise<void> {
    this._filters.set(filters);
    await this.load(0);
  }

  /** Vuelve a pedir lo mismo, para el botón de reintentar. */
  async retry(): Promise<void> {
    await this.load(this._page()?.page ?? 0);
  }

  /**
   * Refresca el pulso de las últimas 24 h. Deduplica la petición en vuelo y se puede volver a
   * llamar al reentrar en la ruta: el log crece solo, así que el número de hace diez minutos
   * ya no es el de ahora.
   *
   * No lanza, igual que el contador de feedback sin triar: es el pie de una tarjeta que
   * funciona sin él, y un toast por un número que no ha cargado es ruido sobre algo que el
   * admin no puede arreglar.
   */
  refreshPulse(): Promise<void> {
    return (this.pulseInFlight ??= this.fetchPulse());
  }

  private async fetchPulse(): Promise<void> {
    this._pulseStatus.set('loading');
    try {
      // Solo `from`, como en la pantalla del log: dejar `to` abierto evita que un evento
      // llegado mientras se mira caiga fuera de la ventana por un segundo. Es una ventana de
      // consulta, no un dato de dominio, así que el reloj del cliente basta.
      const from = new Date(Date.now() - SecurityAuditStore.PULSE_HOURS * 3600_000).toISOString();
      this._pulse.set(await firstValueFrom(this.api.summary({ from })));
      this._pulseStatus.set('ready');
    } catch {
      this._pulseStatus.set('error');
    } finally {
      this.pulseInFlight = null;
    }
  }
}
