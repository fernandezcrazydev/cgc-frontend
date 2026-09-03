import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfBadgeColor, NfButton, NfSkeleton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { MatchStore, MatchRoom } from '../../../core/match-store';
import { LobbiesStore, LobbyResponse } from '../../../core/lobbies';
import { GroupBridge } from '../../../core/groups';
import { NotificationsStore } from '../../../core/notifications';

/**
 * Active matches of a group: every open room still filling up plus every live
 * 5v5 in progress. Lets the captain (or any member) jump straight into a
 * specific room or match. Finished matches live in the group history instead.
 */
@Component({
  selector: 'app-grupo-partidas',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfSkeleton, NfWindow],
  styleUrl: './grupo-partidas.scss',
  template: `
    <div class="view">
      @if (loadingGroup()) {
        <div aria-busy="true">
          <nf-skeleton width="240px" height="30px" />
          <nf-skeleton width="100%" height="120px" radius="14px" />
        </div>
      } @else if (group(); as g) {
        <div class="cp-head">
          <div class="cp-head__titles">
            <h1 class="view__title">Partidas activas</h1>
          </div>
          <a class="view-back cp-back" [routerLink]="['/app', 'grupos', g.id]">
            <span class="view-back__arrow">←</span> Volver al grupo
          </a>
        </div>

        <p class="view__intro">Salas abiertas esperando jugadores y partidas en curso de {{ g.name }}.</p>

        <!-- Convocatorias reales del backend. Van primero porque son las que esperan una acción. -->
        @if (lobbies.isLoading()) {
          <div class="cards" aria-busy="true">
            <nf-window title="Convocatorias" bodyPadding="16px">
              <nf-skeleton width="60%" height="16px" />
              <nf-skeleton width="40%" height="12px" />
            </nf-window>
          </div>
        } @else if (lobbies.status() === 'error') {
          <nf-window title="Convocatorias" bodyPadding="16px">
            <p class="empty-state__hint">No se pudieron cargar las convocatorias.</p>
            <button nfButton variant="secondary" size="sm" (click)="reloadLobbies()">Reintentar</button>
          </nf-window>
        } @else if (lobbies.open().length) {
          <div class="cards">
            @for (lb of lobbies.open(); track lb.id) {
              <nf-window
                [title]="'Sala ' + lb.code"
                bodyPadding="16px"
              >
                <div class="pm-head">
                  <div
                    class="pm-avatar"
                    [style.background]="'radial-gradient(circle at 32% 26%, ' + g.c1 + ', ' + g.c2 + ')'"
                  ></div>
                  <div>
                    <div class="pm-mode">
                      {{ lb.status === 'CONFIRMED' ? 'Partida confirmada' : 'Convocatoria abierta' }}
                    </div>
                    <div class="pm-players nf-mono">
                      {{ lobbyWhen(lb) }} · Convocó {{ lb.openedBy.discordUsername ?? '—' }}
                    </div>
                  </div>
                </div>
                <div class="pm-foot">
                  <nf-badge [color]="lb.status === 'CONFIRMED' ? 'success' : 'warning'" [dot]="true">
                    {{ lobbySignedUp(lb) }}/{{ lb.capacity }}
                  </nf-badge>
                  <button
                    nfButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/app', 'grupos', g.id, 'partidas', lb.id]"
                  >{{ lb.status === 'CONFIRMED' ? 'Ver partida' : 'Decir cuándo puedo' }}</button>
                </div>
              </nf-window>
            }
          </div>
        }

        @if (rooms().length) {
          <div class="cards">
            @for (r of rooms(); track r.id) {
              <nf-window [title]="'Sala ' + r.code" bodyPadding="16px">
                <div class="pm-head">
                  <div
                    class="pm-avatar"
                    [style.background]="'radial-gradient(circle at 32% 26%, ' + g.c1 + ', ' + g.c2 + ')'"
                  ></div>
                  <div>
                    <div class="pm-mode">{{ modeLabel(r) }}</div>
                    <div class="pm-players nf-mono">{{ r.seats.length }}/{{ r.capacity }} jugadores · abrió {{ r.openedBy }}</div>
                  </div>
                </div>
                <div class="pm-foot">
                  <nf-badge [color]="statusColor(r)" [dot]="true">{{ statusLabel(r) }}</nf-badge>
                  <button
                    nfButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/app', 'grupos', g.id, 'partidas', r.id]"
                  >{{ ctaLabel(r) }}</button>
                </div>
              </nf-window>
            }
          </div>
        } @else if (nothingActive()) {
          <!-- Vacío solo cuando NO hay NADA: ni convocatorias ni salas del wizard. Mirar solo
               las salas del mock hacía que saliera "no hay partidas activas" justo debajo de
               una convocatoria que acababas de crear. -->
          <nf-window title="Partidas activas" bodyPadding="0">
            <div class="cp-pad">
              <div class="empty-state">
                <div class="empty-state__icon">◎</div>
                <div class="empty-state__text">No hay partidas activas</div>
                <p class="empty-state__hint">
                  No hay ninguna sala abierta ni partida en curso ahora mismo. Crea una partida
                  para empezar a jugar con tu grupo.
                </p>
                <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">
                  Crear partida</button>
              </div>
            </div>
          </nf-window>
        }
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← Volver a grupos</button>
      }
    </div>
  `,
})
export class GrupoPartidas {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  private readonly matchStore = inject(MatchStore);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  readonly rooms = computed<MatchRoom[]>(() => {
    const g = this.group();
    return g ? this.matchStore.activeOf(g.id) : [];
  });

  modeLabel(r: MatchRoom): string {
    if (r.status === 'drafting') return 'Configurando · 5v5';
    return r.mode === 'open' ? 'Sala abierta · 5v5' : 'Partida manual · 5v5';
  }

  statusLabel(r: MatchRoom): string {
    return r.status === 'live' ? 'En curso' : r.status === 'drafting' ? 'Configurando' : 'Pendiente';
  }

  statusColor(r: MatchRoom): NfBadgeColor {
    return r.status === 'live' ? 'success' : r.status === 'drafting' ? 'tertiary' : 'warning';
  }

  ctaLabel(r: MatchRoom): string {
    return r.status === 'live' ? 'Ver partida' : r.status === 'drafting' ? 'Ver en directo' : 'Ver sala';
  }

  // ── Convocatorias reales ──────────────────────────────────────────
  readonly lobbies = inject(LobbiesStore);
  private readonly notifs = inject(NotificationsStore);
  /** Trae identidad y roster reales al store mock; sin esto, un F5 aquí daba "Grupo no encontrado". */
  readonly bridge = inject(GroupBridge);

  /**
   * El grupo todavía viaja. Cubre `idle` porque entrar por URL directa monta esta vista antes de
   * que el efecto dispare, y pintar el 404 en ese hueco es acusar de inexistente a un grupo que
   * simplemente no ha llegado.
   */
  readonly loadingGroup = computed(
    () => this.bridge.status() === 'loading' || this.bridge.status() === 'idle',
  );

  /**
   * No hay absolutamente nada que enseñar. Cuenta las dos fuentes —las convocatorias reales y
   * las salas del wizard—, y espera a que las convocatorias hayan cargado: decir "no hay nada"
   * mientras aún viajan es afirmar algo que no se sabe.
   */
  readonly nothingActive = computed(
    () => !this.rooms().length && !this.lobbies.open().length && !this.lobbies.isLoading(),
  );

  /**
   * Qué se enseña como "cuándo": la hora ya cuadrada si está confirmada, y si no, cuántas horas
   * hay sobre la mesa. Son dos preguntas distintas y merecen dos frases distintas.
   */
  lobbyWhen(lobby: LobbyResponse): string {
    const confirmed = lobby.slots.find((slot) => slot.id === lobby.confirmedSlotId);
    if (confirmed) return this.formatKickoff(confirmed.startsAt).toUpperCase();
    const count = lobby.slots.length;
    return `${count} HORA${count === 1 ? '' : 'S'} PROPUESTA${count === 1 ? '' : 'S'}`;
  }

  /**
   * El contador de la tarjeta. Con varias franjas vivas no hay un único número, así que se
   * enseña el de la franja que más gente ha juntado: es la que va camino de confirmarse.
   */
  lobbySignedUp(lobby: LobbyResponse): number {
    const confirmed = lobby.slots.find((slot) => slot.id === lobby.confirmedSlotId);
    if (confirmed) return confirmed.signedUp;
    return lobby.slots.reduce((best, slot) => Math.max(best, slot.signedUp), 0);
  }

  private formatKickoff(iso: string): string {
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

  reloadLobbies(): void {
    void this.lobbies.reload();
  }

  constructor() {
    // Keep the shell header/sidebar in sync with the active group on deep-link.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });

    // Identidad + roster reales, para que entrar por URL directa no caiga en el 404 del mock.
    effect(() => {
      const id = this.id();
      if (id) void this.bridge.ensure(id);
    });

    // Convocatorias del grupo. `ensureLoaded` no repite la petición al volver a la vista.
    effect(() => {
      const id = this.id();
      if (id) void this.lobbies.ensureLoaded(id);
    });

    // Alguien se apuntó o convocó: la lista se actualiza sola sin recargar la página.
    effect(() => {
      const nudge = this.notifs.lastNudge();
      if (nudge?.event !== 'lobby') return;
      if (nudge.data['groupId'] !== this.id()) return;
      void this.lobbies.reload();
    });
  }
}
