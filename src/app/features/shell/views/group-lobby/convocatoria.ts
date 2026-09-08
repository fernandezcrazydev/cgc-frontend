import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfBadge, NfButton, NfSkeleton, NfWindow } from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupsStore } from '../../../../core/groups';
import { LobbyDetailStore, LobbySlotResponse, LobbyStatus } from '../../../../core/lobbies';
import { NotificationsStore } from '../../../../core/notifications';
import { errorMessage } from '../../../../core/http';
import { ToastService } from '../../../../core/toast';
import { hueFromId } from '../../../../shared/avatar-bg';

/**
 * Una convocatoria: la llamada a jugar (`FlujoJuego.md` §4.2).
 *
 * Mientras recoge horas enseña sus franjas y quién puede a cada una; una vez confirmada,
 * lo que importa deja de ser la hora y pasa a ser **la sala**, así que arriba aparece la
 * tarjeta que lleva a ella.
 *
 * Sale de la mitad real de `grupo-sala.ts`, que servía dos cosas en la misma ruta —esta
 * convocatoria y una sala inventada en el navegador— con una bifurcación en medio. La
 * mitad inventada se borró; esta es la que hablaba con el servidor.
 *
 * BACKEND NOTE: hoy una convocatoria rinde exactamente una sala, así que la tarjeta usa
 * el id de la convocatoria como id de sala. Cuando el backend cree filas de sala y tandas
 * (`FlujoJuego.md` §17.1) aquí irán varias y solo cambia de dónde sale ese id.
 */
@Component({
  selector: 'app-convocatoria',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfBadge, NfButton, NfSkeleton, NfWindow],
  styleUrl: './convocatoria.scss',
  templateUrl: './convocatoria.html',
})
export class Convocatoria {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(Session);
  private readonly groups = inject(GroupsStore);
  private readonly notifs = inject(NotificationsStore);
  private readonly toasts = inject(ToastService);

  readonly detail = inject(LobbyDetailStore);
  readonly lobby = this.detail.lobby;
  readonly slots = this.detail.slots;

  readonly confirmCancel = signal(false);

  private readonly groupId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  private readonly lobbyId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('lobbyId'))),
    { initialValue: this.route.snapshot.paramMap.get('lobbyId') },
  );

  /** `idle` cuenta como cargando: el efecto que pide el dato aún no ha disparado. */
  readonly loading = computed(
    () => this.detail.status() === 'loading' || this.detail.status() === 'idle',
  );

  /** Instante de la franja confirmada, para la cabecera. */
  readonly confirmedStartsAt = computed(() => this.detail.confirmedSlot()?.startsAt ?? '');

  readonly starters = computed(() => this.detail.confirmedSlot()?.starters ?? []);
  readonly bench = computed(() => this.detail.confirmedSlot()?.bench ?? []);

  /** ¿Estoy en la convocatoria, en cualquiera de sus franjas? */
  readonly amInLobby = computed(() => {
    const me = this.session.user()?.userId;
    if (!me) return false;
    return this.slots().some((slot) =>
      [...slot.starters, ...slot.bench].some((p) => p.userId === me),
    );
  });

  isMe(userId: string): boolean {
    return this.session.user()?.userId === userId;
  }

  tintOf(userId: string): number {
    return hueFromId(userId);
  }

  /** ¿Estoy apuntado a esta franja? Da igual si de titular o de suplente. */
  amIn(slot: LobbySlotResponse): boolean {
    return [...slot.starters, ...slot.bench].some((p) => this.isMe(p.userId));
  }

  /**
   * Etiqueta del botón de la franja para lector de pantalla y tooltip: hay uno idéntico
   * por hora, así que "Apuntarse" a secas no dice a cuál, y el estado "✓ Apuntado" no
   * dice que al pulsarlo te quitas.
   */
  slotCtaLabel(slot: LobbySlotResponse): string {
    const when = this.formatKickoff(slot.startsAt);
    return this.amIn(slot) ? `Quitarme de ${when}` : `Apuntarme a ${when}`;
  }

  fillPercent(slot: LobbySlotResponse, capacity: number): number {
    return Math.min(100, Math.round((slot.starters.length / capacity) * 100));
  }

  statusLabel(status: LobbyStatus): string {
    if (status === 'CANCELLED') return 'Cancelada';
    if (status === 'CONFIRMED') return 'Hora confirmada';
    return 'Abierta';
  }

  statusColor(status: LobbyStatus): 'success' | 'danger' | 'warning' {
    if (status === 'CANCELLED') return 'danger';
    if (status === 'CONFIRMED') return 'success';
    return 'warning';
  }

  /** ISO-8601 → "jue 7 ago, 22:00" en la zona de quien mira. */
  formatKickoff(iso: string): string {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /** Un solo botón por franja: si estoy, me quito; si no, me apunto. */
  async toggleSlot(slot: LobbySlotResponse): Promise<void> {
    const wasIn = this.amIn(slot);
    try {
      if (wasIn) await this.detail.withdraw(slot.id);
      else await this.detail.signUp(slot.id);
    } catch (error) {
      this.toasts.error(errorMessage(error));
      // El 404 de franja y el 409 de convocatoria cerrada significan que lo que hay en
      // pantalla ya no es cierto: recargar es más útil que dejar al usuario mirando un
      // botón que no funciona.
      void this.detail.refresh();
    }
  }

  async doCancel(): Promise<void> {
    try {
      await this.detail.cancel();
      this.confirmCancel.set(false);
      this.toasts.success('Convocatoria cancelada.');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  retry(): void {
    const id = this.lobbyId();
    if (id) void this.detail.load(id);
  }

  constructor() {
    // Mantiene la cabecera y la barra lateral en sintonía con el grupo al entrar por
    // enlace directo.
    effect(() => {
      const id = this.groupId();
      if (id) this.groups.select(id);
    });

    effect(() => {
      const id = this.lobbyId();
      if (id) void this.detail.load(id);
    });

    // Aviso en vivo: cuando otro se apunta, esta pantalla se actualiza sola. El evento
    // solo trae ids, así que lo que hace es un refetch —y `refresh()` no vacía lo que ya
    // está pintado, para que la lista no parpadee cada vez que alguien pulsa "puedo".
    effect(() => {
      const nudge = this.notifs.lastNudge();
      if (nudge?.event !== 'lobby') return;
      if (nudge.data['lobbyId'] !== this.detail.showingId) return;
      void this.detail.refresh();
    });

    this.destroyRef.onDestroy(() => this.detail.clear());
  }
}
