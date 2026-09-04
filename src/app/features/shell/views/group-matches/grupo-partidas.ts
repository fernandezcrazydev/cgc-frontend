import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfModal, NfSkeleton } from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge } from '../../../../core/groups';
import { GameDataStore } from '../../../../core/game-data';
import { LobbiesStore, LobbyResponse, LobbySlotResponse } from '../../../../core/lobbies';
import { NotificationsStore } from '../../../../core/notifications';
import { ToastService } from '../../../../core/toast';
import { errorMessage } from '../../../../core/http';
import { LiveRoomDeckComponent } from './live-room-deck.component';
import { ScheduleStanding } from './schedule-card.component';
import {
  ScheduleAction,
  ScheduleEntry,
  SchedulePanelComponent,
} from './schedule-panel.component';
import { AvailabilityChange, AvailabilityModalComponent } from './availability-modal.component';
import { ScheduleDraft, ScheduleModalComponent } from './schedule-modal.component';

/**
 * Cuánto antes de la hora una convocatoria confirmada pasa a ser «la sala en
 * directo» (§5.5.6). Media hora es el margen acordado para que la gente se vaya
 * juntando sin que la columna se adelante días.
 */
const LIVE_WINDOW_MS = 30 * 60 * 1000;

/** Cada cuánto se vuelve a mirar el reloj para cruzar esa frontera sola. */
const CLOCK_TICK_MS = 30 * 1000;

/**
 * Panel de convocatorias y partidas activas (`Roadmap.md` §5.5.6): a la izquierda lo
 * que se juega ahora, a la derecha lo que viene.
 *
 * Una sola fuente de datos, las convocatorias reales del backend (`LobbiesStore`).
 * Antes esta pantalla pintaba además las salas del asistente de creación, en una
 * segunda lista visualmente idéntica: dos cosas distintas con la misma cara, que es
 * justo lo que §5.5.6 venía a arreglar.
 *
 * La columna izquierda se convierte en sala en directo sola, media hora antes de la
 * hora confirmada. No hay ningún estado nuevo en el servidor detrás de eso: es leer
 * el reloj contra `startsAt`, y por eso el reloj es una señal que late.
 */
@Component({
  selector: 'app-grupo-partidas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    NfButton,
    NfModal,
    NfSkeleton,
    AvailabilityModalComponent,
    LiveRoomDeckComponent,
    ScheduleModalComponent,
    SchedulePanelComponent,
  ],
  template: `
    <div class="view gm">
      @switch (bridge.status()) {
        @case ('loading') {
          <ng-container [ngTemplateOutlet]="skeleton" />
        }
        @case ('idle') {
          <ng-container [ngTemplateOutlet]="skeleton" />
        }
        @case ('error') {
          <div class="view__head">
            <h1 class="view__title">No hemos podido cargar el grupo</h1>
            <p class="view__lead">La conexión ha fallado. Vuelve a intentarlo en un momento.</p>
          </div>
          <button nfButton variant="secondary" size="md" (click)="retryGroup()">Reintentar</button>
        }
        @default {
          @if (group(); as g) {
            <div class="gm-deck">
              <div class="gm-live">
                <app-live-room-deck
                  [lobby]="liveLobby()"
                  [slot]="liveSlot()"
                  [groupId]="g.id"
                  [kickoff]="liveKickoff()"
                  [loading]="lobbiesLoading()"
                  [canJoin]="canJoinLive()"
                  [joining]="joiningLive()"
                  (join)="joinLive()"
                />

                <!-- Las dos acciones van debajo de la sala y no en una cabecera: es
                     donde se mira después de comprobar que no hay partida a la que
                     apuntarse, que es justo cuando se quiere convocar una. -->
                <div class="gm-actions">
                  <a
                    class="gm-action"
                    [routerLink]="['/app', 'grupos', g.id, 'crear-partida']"
                  >
                    <span class="gm-action__glyph" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M12 5.5v13M5.5 12h13" />
                      </svg>
                    </span>
                    <span class="gm-action__text">
                      <span class="gm-action__title">Crear partida</span>
                      <span class="gm-action__sub">Monta la sala ahora y reparte los diez</span>
                    </span>
                  </a>

                  <button type="button" class="gm-action" (click)="scheduling.set(true)">
                    <span class="gm-action__glyph" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
                        <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
                      </svg>
                    </span>
                    <span class="gm-action__text">
                      <span class="gm-action__title">Agendar fecha</span>
                      <span class="gm-action__sub">Propón horas y que el grupo diga cuándo puede</span>
                    </span>
                  </button>
                </div>
              </div>

              <app-schedule-panel
                [entries]="scheduled()"
                [loading]="lobbiesLoading()"
                [failed]="lobbiesFailed()"
                (signUp)="signUp($event)"
                (withdraw)="withdraw($event)"
                (openAvailability)="availabilityFor.set($event)"
                (retry)="reloadLobbies()"
              />
            </div>

            @if (scheduling()) {
              <nf-modal title="Agendar una custom" width="600px" (closed)="scheduling.set(false)">
                <app-schedule-modal
                  [pending]="lobbies.creating()"
                  (create)="publish(g.id, $event)"
                />
              </nf-modal>
            }

            @if (availabilityFor(); as lb) {
              <nf-modal title="¿A qué horas puedes?" width="520px" (closed)="availabilityFor.set(null)">
                <app-availability-modal
                  [lobby]="lb"
                  [myUserId]="myUserId()"
                  [pending]="lobbies.savingAvailability()"
                  (apply)="saveAvailability(lb.id, $event)"
                />
              </nf-modal>
            }
          } @else {
            <div class="view__head">
              <div class="view__eyebrow nf-mono">Error 404</div>
              <h1 class="view__title">Grupo no encontrado</h1>
              <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
            </div>
            <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">
              Volver a grupos
            </button>
          }
        }
      }
    </div>

    <ng-template #skeleton>
      <div class="gm-deck">
        <nf-skeleton width="100%" height="420px" radius="12px" />
        <nf-skeleton width="100%" height="420px" radius="12px" />
      </div>
    </ng-template>
  `,
  styleUrl: './grupo-partidas.scss',
})
export class GrupoPartidas {
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(Session);
  private readonly groups = inject(GroupStore);
  private readonly gameData = inject(GameDataStore);
  private readonly notifs = inject(NotificationsStore);
  private readonly toasts = inject(ToastService);
  readonly lobbies = inject(LobbiesStore);
  /** Trae identidad y roster reales al store mock; sin esto, un F5 aquí daba «grupo no encontrado». */
  readonly bridge = inject(GroupBridge);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? (this.groups.byId(id) ?? null) : null;
  });

  readonly lobbiesLoading = computed(
    () => this.lobbies.isLoading() || this.gameData.status() === 'loading',
  );
  readonly lobbiesFailed = computed(() => this.lobbies.status() === 'error');

  /**
   * El reloj, como señal. Sin esto la frontera de los treinta minutos solo se
   * cruzaría al recargar la página, y quien dejara la pestaña abierta nunca vería
   * aparecer su sala.
   */
  private readonly now = signal(Date.now());

  /** El id del usuario, para saber en qué convocatorias está metido. */
  readonly myUserId = computed(() => this.session.user()?.userId ?? null);

  /* ---- Ventanas ----
     Estado de interfaz, así que vive en la vista y no en el store (`CLAUDE.md`). */

  /** Está abierta la ventana de agendar. */
  readonly scheduling = signal(false);
  /** La convocatoria cuya disponibilidad se está editando, si hay alguna. */
  readonly availabilityFor = signal<LobbyResponse | null>(null);

  /* ---- La sala en directo ---- */

  /**
   * La convocatoria que ya se juega o está a punto: confirmada y a menos de media
   * hora de su hora. Si hay varias —raro pero posible—, manda la más cercana.
   */
  readonly liveLobby = computed<LobbyResponse | null>(() => {
    const now = this.now();
    const candidates = this.lobbies
      .open()
      .filter((lobby) => {
        const slot = confirmedSlotOf(lobby);
        return slot ? startsWithin(slot, now, LIVE_WINDOW_MS) : false;
      })
      .sort((a, b) => startMsOf(a) - startMsOf(b));
    return candidates[0] ?? null;
  });

  readonly liveSlot = computed<LobbySlotResponse | null>(() => {
    const lobby = this.liveLobby();
    return lobby ? confirmedSlotOf(lobby) : null;
  });

  readonly liveKickoff = computed(() => {
    const slot = this.liveSlot();
    return slot ? formatKickoff(slot.startsAt) : '';
  });

  /**
   * Los huecos de la sala en directo dejan apuntarse cuando quien mira no está ya
   * dentro —ni de titular ni en el banquillo—. Al pulsarlos NO se ocupa ese hueco:
   * la plaza la reparte el servidor por orden de llegada, así que se cae en la
   * primera libre.
   */
  readonly canJoinLive = computed(() => {
    const lobby = this.liveLobby();
    const slot = this.liveSlot();
    if (!lobby || !slot) return false;
    if (slot.starters.length >= lobby.capacity) return false;
    return standingOf(lobby, this.myUserId()).kind === 'out';
  });

  readonly joiningLive = computed(() => {
    const slot = this.liveSlot();
    return slot ? this.lobbies.isActing(slot.id) : false;
  });

  /* ---- Las que vienen ---- */

  /**
   * Todo lo que no es la sala en directo, de lo más cercano a lo más lejano: la
   * columna responde a «qué viene ahora», así que lo de mañana va antes que lo del
   * sábado.
   */
  readonly scheduled = computed<ScheduleEntry[]>(() => {
    const live = this.liveLobby();
    const myId = this.myUserId();

    return this.lobbies
      .open()
      .filter((lobby) => lobby.id !== live?.id)
      .sort((a, b) => startMsOf(a) - startMsOf(b))
      .map((lobby) => {
        const slot = representativeSlotOf(lobby);
        return {
          lobby,
          slot,
          standing: standingOf(lobby, myId),
          when: whenTextOf(lobby),
          acting: slot ? this.lobbies.isActing(slot.id) : false,
        };
      });
  });

  constructor() {
    this.gameData.ensureLoaded();

    // Mantiene la cabecera y la barra lateral del shell en sintonía al entrar por URL.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });

    // Identidad y roster reales: entrar por URL directa no puede caer en el 404 del mock.
    effect(() => {
      const id = this.id();
      if (id) void this.bridge.ensure(id);
    });

    // `ensureLoaded` no repite la petición al volver a la vista.
    effect(() => {
      const id = this.id();
      if (id) void this.lobbies.ensureLoaded(id);
    });

    // Alguien convocó o se apuntó: la lista se actualiza sola. En silencio, porque el
    // aviso llega mientras el usuario está mirando otra cosa de la misma pantalla, y
    // caerla a esqueletos por un cambio ajeno le tira el scroll al principio.
    effect(() => {
      const nudge = this.notifs.lastNudge();
      if (nudge?.event !== 'lobby') return;
      if (nudge.data['groupId'] !== this.id()) return;
      void this.lobbies.refreshQuietly();
    });

    const clock = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }

  /* ---- Acciones ---- */

  retryGroup(): void {
    const id = this.id();
    if (id) void this.bridge.ensure(id);
  }

  reloadLobbies(): void {
    void this.lobbies.reload();
  }

  /** Convoca una partida con las horas del modal. Pesimista: cierra al confirmar. */
  async publish(groupId: string, draft: ScheduleDraft): Promise<void> {
    try {
      await this.lobbies.create(groupId, {
        // El servidor los quiere en ISO; el modal los junta en hora local.
        slotStartTimes: draft.slotStartTimes.map((value) => new Date(value).toISOString()),
        note: draft.note,
      });
      this.scheduling.set(false);
      this.toasts.success('Convocada. Ya puede apuntarse el grupo.');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  /** Guarda de una vez a qué horas puede alguien. */
  async saveAvailability(lobbyId: string, change: AvailabilityChange): Promise<void> {
    try {
      await this.lobbies.setAvailability(lobbyId, change.join, change.leave);
      this.availabilityFor.set(null);
      this.toasts.success('Guardado. Te avisamos cuando alguna hora junte a los diez.');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  /** Apuntarse a la sala en directo desde un hueco libre. */
  async joinLive(): Promise<void> {
    const lobby = this.liveLobby();
    const slot = this.liveSlot();
    if (!lobby || !slot) return;
    await this.signUp({ lobbyId: lobby.id, slotId: slot.id });
  }

  async signUp(action: ScheduleAction): Promise<void> {
    // El aviso depende de si la partida ya tiene hora: prometer «te avisamos si se
    // confirma» sobre una que ya está confirmada es decir algo que no va a pasar.
    const confirmed =
      this.lobbies.open().find((l) => l.id === action.lobbyId)?.status === 'CONFIRMED';
    try {
      await this.lobbies.signUp(action.lobbyId, action.slotId);
      this.toasts.success(
        confirmed ? 'Apuntado. Nos vemos a esa hora.' : 'Apuntado. Te avisamos si se confirma.',
      );
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async withdraw(action: ScheduleAction): Promise<void> {
    try {
      await this.lobbies.withdraw(action.lobbyId, action.slotId);
      this.toasts.success('Te hemos borrado de esa convocatoria.');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }
}

/* ── Presentación pura ──────────────────────────────────────────────
   Fuera de la clase porque no dependen de nada del componente y así son
   directamente comprobables desde el spec. */

function confirmedSlotOf(lobby: LobbyResponse): LobbySlotResponse | null {
  return lobby.slots.find((slot) => slot.id === lobby.confirmedSlotId) ?? null;
}

/**
 * La franja que representa a una convocatoria: la confirmada si la hay y, si no, la
 * que más gente ha juntado, que es la que va camino de confirmarse.
 */
function representativeSlotOf(lobby: LobbyResponse): LobbySlotResponse | null {
  const confirmed = confirmedSlotOf(lobby);
  if (confirmed) return confirmed;
  return (
    [...lobby.slots].sort((a, b) => b.signedUp - a.signedUp || a.startsAt.localeCompare(b.startsAt))[0] ??
    null
  );
}

function startMsOf(lobby: LobbyResponse): number {
  const slot = representativeSlotOf(lobby);
  const ms = slot ? Date.parse(slot.startsAt) : Number.NaN;
  // Sin hora válida se va al final: una convocatoria rota no puede colarse la primera.
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
}

function startsWithin(slot: LobbySlotResponse, now: number, window: number): boolean {
  const start = Date.parse(slot.startsAt);
  if (Number.isNaN(start)) return false;
  // Ya empezada también cuenta: una partida en marcha es lo más «en directo» que hay.
  return start - now <= window;
}

/** Dónde queda el usuario: titular, suplente o fuera. El puesto lo reparte el servidor. */
function standingOf(lobby: LobbyResponse, myUserId: string | null): ScheduleStanding {
  if (!myUserId) return { kind: 'out' };
  for (const slot of lobby.slots) {
    const starter = slot.starters.findIndex((p) => p.userId === myUserId);
    if (starter >= 0) return { kind: 'starter', position: starter + 1, slot };
    const bench = slot.bench.findIndex((p) => p.userId === myUserId);
    if (bench >= 0) return { kind: 'bench', position: bench + 1, slot };
  }
  return { kind: 'out' };
}

/**
 * Qué se enseña como «cuándo»: la hora ya cuadrada si está confirmada y, si no,
 * cuántas horas hay sobre la mesa. Son dos preguntas distintas y merecen dos frases.
 */
function whenTextOf(lobby: LobbyResponse): string {
  const confirmed = confirmedSlotOf(lobby);
  if (confirmed) return formatKickoff(confirmed.startsAt);
  const count = lobby.slots.length;
  return count === 1 ? '1 hora propuesta' : `${count} horas propuestas`;
}

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
