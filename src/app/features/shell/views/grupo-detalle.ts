import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfButton, NfModal, NfSkeleton, NfWindow } from '../../../ui';
import { Session } from '../../../core/auth';
import {
  GroupBridge,
  GroupDetailStore,
  GroupInvitationResponse,
  GroupInvitationsStore,
  GroupMemberResponse,
  JoinRequestsStore,
  bannerColors,
  groupRoleLabel,
} from '../../../core/groups';
import { LeaguesStore } from '../../../core/leagues';
import { LobbiesStore, LobbyResponse } from '../../../core/lobbies';
import { GroupStore } from '../../../core/group-store';
import { RankEntry, mapLeaderboardEntries } from '../../../core/group-ranking';
import {
  duelsFor,
  hubCommentsFor,
  hubSeasonsFor,
  lpSeriesFor,
  triviaFor,
} from '../../../core/group-hub';
import { SHOWCASE_MEDAL_IDS, medalBoardsFor } from '../../../core/group-medals';
import { ToastService } from '../../../core/toast';
import { GroupActionsService } from '../group-actions/group-actions.service';
import { errorMessage } from '../../../core/http';
import { HubCommentsComponent } from './group-hub/hub-comments.component';
import { HubDuelsComponent } from './group-hub/hub-duels.component';
import { HubLiveRoomComponent } from './group-hub/hub-live-room.component';
import { HubLpChartComponent } from './group-hub/hub-lp-chart.component';
import { HubRosterPanelComponent, RosterAction } from './group-hub/hub-roster-panel.component';
import { HubTriviaComponent } from './group-hub/hub-trivia.component';
import { HubTrophyCaseComponent } from './group-hub/hub-trophy-case.component';

/** Secciones del grupo que enlaza la barra bajo la cabecera. */
interface HubSection {
  path: string;
  label: string;
  /** Solo para quien gestiona el grupo (owner o admin). */
  adminOnly?: boolean;
}

const SECTIONS: HubSection[] = [
  { path: 'ranking', label: 'Clasificación' },
  { path: 'tierlist', label: 'Tierlist' },
  { path: 'estadisticas', label: 'Estadísticas' },
  { path: 'historial', label: 'Historial' },
  { path: 'perfil', label: 'Perfil' },
  { path: 'discord', label: 'Discord', adminOnly: true },
];

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  styleUrl: './grupo-detalle.scss',
  imports: [
    RouterLink,
    NfAvatar,
    NfButton,
    NfModal,
    NfSkeleton,
    NfWindow,
    HubCommentsComponent,
    HubDuelsComponent,
    HubLiveRoomComponent,
    HubLpChartComponent,
    HubRosterPanelComponent,
    HubTriviaComponent,
    HubTrophyCaseComponent,
  ],
  template: `
    @switch (store.status()) {
      @case ('loading') {
        <div class="view" aria-busy="true">
          <nf-skeleton width="100%" height="42px" radius="10px" />
          <div class="gd-hub">
            <div class="gd-hub__main">
              <nf-skeleton width="100%" height="240px" radius="12px" />
              <nf-skeleton width="100%" height="180px" radius="12px" />
            </div>
            <nf-skeleton width="100%" height="520px" radius="12px" />
          </div>
        </div>
      }
      @case ('error') {
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">⚠</div>
            <div class="empty-state__text nf-mono">Error al cargar</div>
            <p class="empty-state__hint">No se pudo cargar el grupo.</p>
            <button nfButton variant="secondary" size="md" (click)="reload()">Reintentar</button>
          </div>
        </div>
      }
      @case ('not-found') {
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <div class="empty-state__text nf-mono">Grupo no encontrado</div>
            <p class="empty-state__hint">Este grupo no existe o ya no eres miembro.</p>
            <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos']">← Todos los grupos</button>
          </div>
        </div>
      }
      @default {
        @if (store.group(); as g) {
          <div class="view">
            <!-- Barra de secciones del grupo (§5.5.4). Repite la navegación de la barra lateral a
                 propósito: el hub es el punto de entrada del grupo y desde aquí se salta a sus
                 secciones sin cruzar la pantalla. El botón de Discord solo existe para quien
                 gestiona el grupo. -->
            <nav class="gd-sections" aria-label="Secciones del grupo">
              @for (section of visibleSections(); track section.path) {
                <a class="gd-sections__link" [routerLink]="['/app', 'grupos', g.id, section.path]">
                  {{ section.label }}
                </a>
              }
            </nav>

            <div class="gd-hub">
              <div class="gd-hub__main">
                <div class="gd-hub__row">
                  <app-hub-lp-chart
                    class="gd-hub__chart"
                    [series]="lpSeries()"
                    [seasons]="seasons()"
                    [seasonId]="seasonId()"
                    [loading]="hubLoading()"
                    (seasonChange)="seasonId.set($event)"
                  />
                  <app-hub-trophy-case
                    class="gd-hub__trophies"
                    [trophies]="trophies()"
                    [groupId]="g.id"
                    [loading]="hubLoading()"
                  />
                </div>

                <app-hub-live-room
                  [lobby]="liveLobby()"
                  [groupId]="g.id"
                  [loading]="lobbies.isLoading()"
                />

                <app-hub-comments [comments]="comments()" [groupId]="g.id" [loading]="hubLoading()" />

                <div class="gd-hub__twins">
                  <app-hub-duels [duels]="duels()" [loading]="hubLoading()" />
                  <app-hub-trivia [items]="trivia()" [loading]="hubLoading()" />
                </div>
              </div>

              <aside class="gd-hub__side">
                <app-hub-roster-panel
                  [groupId]="g.id"
                  [members]="members()"
                  [memberCount]="store.memberCount()"
                  [pageSize]="store.membersPageSize()"
                  [page]="store.membersPage()"
                  [membersLoading]="store.membersLoading()"
                  [currentUserId]="myUserId()"
                  [canManage]="store.canManage()"
                  [isOwner]="store.isOwner()"
                  [myRole]="store.myRole()"
                  [acting]="store.acting()"
                  [pendingRequests]="joinRequests.pendingGroupRequestsCount()"
                  [pendingInvites]="groupInvitations.invitations().length"
                  [ranking]="topTen()"
                  [rankingLoading]="leagues.isLoading()"
                  [rankingError]="leagues.status() === 'error'"
                  [myStanding]="myStanding()"
                  (action)="onRosterAction($event)"
                  (pageChange)="goToMembersPage($event)"
                  (requestsOpen)="showRequests.set(true)"
                  (invitesOpen)="openInvitesList()"
                />
              </aside>
            </div>
          </div>
        }
      }
    }

    @if (kick(); as m) {
      <div class="modal-overlay" (click)="kick.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="Expulsar" bodyPadding="24px">
            <p class="gd-confirm">¿Expulsar a <strong>{{ m.discordUsername }}</strong> del grupo?</p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.isActing(m.userId)" (click)="kick.set(null)">Cancelar</button>
              <button nfButton variant="danger" size="md" [disabled]="store.isActing(m.userId)" (click)="doKick(m)">Expulsar</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
    @if (transferTo(); as m) {
      <div class="modal-overlay" (click)="transferTo.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="Transferir propiedad" bodyPadding="24px">
            <p class="gd-confirm">
              ¿Transferir la <strong>propiedad</strong> a <strong>{{ m.discordUsername }}</strong>?
              Pasarás a ser admin.
            </p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.isActing(m.userId)" (click)="transferTo.set(null)">Cancelar</button>
              <button nfButton variant="primary" size="md" [disabled]="store.isActing(m.userId)" (click)="doTransfer(m)">Transferir ♛</button>
            </div>
          </nf-window>
        </div>
      </div>
    }

    <!-- Solicitudes de ingreso: viven en su propia capa, abiertas desde el pie del roster. -->
    @if (showRequests()) {
      <nf-modal title="Solicitudes de ingreso" width="520px" (closed)="showRequests.set(false)">
        <div class="gd-members">
          @for (req of joinRequests.groupRequests(); track req.id) {
            <div class="gd-member">
              <nf-avatar
                [src]="req.userAvatarUrl ?? null"
                [fallback]="req.username"
                [tint]="tintOf(req.userId)"
                [size]="38"
                shape="square"
              />
              <div class="gd-member__meta">
                <div class="gd-member__name nf-mono">{{ req.username }}</div>
                <div class="gd-member__role nf-mono">Solicitud de ingreso pendiente</div>
              </div>
              <div class="gd-member__actions">
                <button
                  nfButton
                  variant="primary"
                  size="sm"
                  [disabled]="joinRequests.pending()"
                  (click)="acceptRequest(req.id)"
                >Aceptar</button>
                <button
                  nfButton
                  variant="danger"
                  size="sm"
                  [disabled]="joinRequests.pending()"
                  (click)="declineRequest(req.id)"
                >Rechazar</button>
              </div>
            </div>
          } @empty {
            <div class="gd-invites-empty">
              <div class="gd-invites-empty__text nf-mono">Sin solicitudes de ingreso pendientes</div>
              <p class="empty-state__hint">Los jugadores que encuentren este grupo por #TAG podrán solicitar unirse.</p>
            </div>
          }
        </div>
      </nf-modal>
    }

    <!-- Invitaciones enviadas y pendientes de respuesta. -->
    @if (showInvites()) {
      <nf-modal title="Invitaciones enviadas" width="520px" (closed)="showInvites.set(false)">
        @switch (groupInvitations.status()) {
          @case ('loading') {
            <div class="gd-members" aria-busy="true">
              @for (s of [0, 1, 2]; track s) {
                <div class="gd-member">
                  <nf-skeleton width="38px" height="38px" radius="11px" />
                  <div class="gd-member__meta">
                    <nf-skeleton width="140px" height="13px" />
                    <nf-skeleton width="80px" height="11px" />
                  </div>
                </div>
              }
            </div>
          }
          @case ('error') {
            <div class="gd-invites-empty">
              <div class="gd-invites-empty__text nf-mono">Error al cargar invitaciones</div>
              <button nfButton variant="secondary" size="sm" (click)="reloadInvites()">Reintentar</button>
            </div>
          }
          @default {
            @if (groupInvitations.invitations().length) {
              <div class="gd-members">
                @for (inv of groupInvitations.invitations(); track inv.id) {
                  <div class="gd-member">
                    <nf-avatar
                      [src]="inv.avatarUrl ?? null"
                      [fallback]="inv.discordUsername ?? '?'"
                      [tint]="tintOf(inv.inviteeUserId)"
                      [size]="38"
                      shape="square"
                    />
                    <div class="gd-member__meta">
                      <div class="gd-member__name nf-mono">{{ inv.discordUsername ?? '—' }}</div>
                      <div class="gd-member__role nf-mono">Invitación pendiente</div>
                    </div>
                    <div class="gd-member__actions">
                      <button
                        nfButton
                        variant="danger"
                        size="sm"
                        [disabled]="groupInvitations.isCancelling(inv.id)"
                        (click)="cancelInvite(inv)"
                      >Cancelar</button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="gd-invites-empty">
                <div class="gd-invites-empty__text nf-mono">Sin invitaciones pendientes</div>
                <button nfButton variant="secondary" size="sm" (click)="openInvite()">Invitar a alguien</button>
              </div>
            }
          }
        }
      </nf-modal>
    }
  `,
})
export class GrupoDetalle {
  /** Etiqueta en español del rol del backend (OWNER -> Capitán). */
  protected readonly roleLabel = groupRoleLabel;
  readonly store = inject(GroupDetailStore);
  /** Clasificación del grupo: de aquí sale el top 10 y «tu puesto». Es el MISMO store que usa el ranking. */
  readonly leagues = inject(LeaguesStore);
  /** Convocatorias abiertas: son lo que reclama acción hoy en este grupo. */
  readonly lobbies = inject(LobbiesStore);
  readonly groupInvitations = inject(GroupInvitationsStore);
  readonly joinRequests = inject(JoinRequestsStore);
  private readonly session = inject(Session);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly bridge = inject(GroupBridge);
  /** El menú de gestión del grupo vive en la cabecera del shell; aquí solo se le pide abrir. */
  private readonly groupActions = inject(GroupActionsService);
  /** Roster completo del grupo, sembrado por el puente: es lo que alimenta la maqueta del hub. */
  private readonly groupStore = inject(GroupStore);
  private readonly destroyRef = inject(DestroyRef);

  /** Id del grupo desde la ruta. */
  private readonly routeId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  /**
   * La página visible del roster, TAL CUAL la manda el backend. No se reordena aquí: con
   * paginación en servidor, ordenar la página en cliente la descolocaría respecto al orden
   * global (owner, admins y miembros, y por antigüedad dentro de cada rango) y la misma persona
   * podría aparecer en dos páginas distintas.
   */
  readonly members = computed(() => this.store.roster());

  readonly myUserId = computed(() => this.session.user()?.userId ?? null);

  // ── Secciones y gestión ─────────────────────────────────────────────
  /** Discord solo lo ve quien gestiona el grupo (§5.5.4). */
  readonly visibleSections = computed(() =>
    SECTIONS.filter((s) => !s.adminOnly || this.store.canManage()),
  );

  // ── Clasificación ───────────────────────────────────────────────────
  /** Podio y página cargada, sin duplicados y por puesto: el top 10 de la columna lateral. */
  readonly topTen = computed<RankEntry[]>(() => {
    const seen = new Set<string>();
    const merged = [...this.leagues.podium(), ...this.leagues.rows()].filter((e) => {
      if (seen.has(e.userId)) return false;
      seen.add(e.userId);
      return true;
    });
    return mapLeaderboardEntries(merged)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 10);
  });

  /**
   * Tu fila en la clasificación, o `null` si todavía no puntúas.
   *
   * Se busca en el podio y en la página cargada, que es lo que el contrato actual entrega. En un
   * grupo grande puedes caer fuera de esa página: entonces devuelve `null` y el pie de la columna
   * no dice nada personal en vez de inventar un puesto. El caso lo cierra `GET .../leaderboard/me`
   * (§2.2).
   */
  readonly myStanding = computed<RankEntry | null>(() => {
    const me = this.myUserId();
    if (!me) return null;
    const entry =
      this.leagues.podium().find((e) => e.userId === me) ??
      this.leagues.rows().find((e) => e.userId === me);
    return entry ? mapLeaderboardEntries([entry])[0] : null;
  });

  // ── Sala en directo ─────────────────────────────────────────────────
  /** Convocatorias que siguen esperando gente. Una ya confirmada no reclama nada. */
  readonly openLobbies = computed<LobbyResponse[]>(() =>
    this.lobbies.open().filter((lobby) => lobby.status === 'POLLING'),
  );

  /** La sala que domina la cabecera y la tarjeta de directo: la más llena de las abiertas. */
  readonly liveLobby = computed<LobbyResponse | null>(() => {
    const open = this.openLobbies();
    if (!open.length) return null;
    return [...open].sort((a, b) => this.signedUp(b) - this.signedUp(a))[0];
  });

  /** Cuánta gente ha juntado la franja que mejor va. Mismo criterio que el banner del shell. */
  signedUp(lobby: LobbyResponse): number {
    return lobby.slots.reduce((best, slot) => Math.max(best, slot.signedUp), 0);
  }

  // ── Maqueta del hub (placeholder de `core/group-hub.ts`) ─────────────
  /** Temporada elegida en la gráfica de LP. Estado de interfaz. */
  readonly seasonId = signal('current');

  /** El roster del hub no llega con el detalle, sino con el puente: mientras viaja, esqueletos. */
  readonly hubLoading = computed(
    () => this.bridge.status() === 'loading' || this.bridge.status() === 'idle',
  );

  private readonly hubRoster = computed(() => {
    const id = this.routeId();
    // La lectura del roster mock depende del estado del puente: sin esta dependencia explícita
    // el hub se quedaría con la foto vacía del primer render.
    this.bridge.status();
    return id ? this.groupStore.rosterOf(id) : [];
  });

  readonly seasons = computed(() => hubSeasonsFor(this.routeId()));
  readonly lpSeries = computed(() => lpSeriesFor(this.routeId(), this.seasonId()));
  /**
   * Los cuatro hitos de la vitrina salen del catálogo de medallas del Hall of Fame
   * (§5.5.5), no de una lista propia: al pulsar uno se abre exactamente esa medalla.
   * Se ordenan como `SHOWCASE_MEDAL_IDS`, que es el orden acordado de la vitrina.
   */
  readonly trophies = computed(() => {
    const boards = medalBoardsFor(this.routeId(), this.hubRoster(), 'temporada', this.myTag());
    return SHOWCASE_MEDAL_IDS.map((id) => boards.find((b) => b.medal.id === id)).filter(
      (b) => b !== undefined,
    );
  });

  /** El tag del usuario dentro de este roster, para que la vitrina sepa si la medalla es suya. */
  private readonly myTag = computed(() => {
    const myId = this.myUserId();
    if (!myId) return null;
    return this.hubRoster().find((m) => m.userId === myId)?.tag ?? null;
  });
  readonly comments = computed(() => hubCommentsFor(this.routeId(), this.hubRoster()));
  readonly duels = computed(() => duelsFor(this.routeId(), this.hubRoster()));
  readonly trivia = computed(() => triviaFor(this.routeId(), this.hubRoster()));

  // ── Diálogos de confirmación / estado local de interfaz ─────────────
  readonly kick = signal<GroupMemberResponse | null>(null);
  readonly transferTo = signal<GroupMemberResponse | null>(null);
  readonly showRequests = signal(false);
  readonly showInvites = signal(false);

  /** Acción de gestión llegada del menú de tres puntos de una fila del roster. */
  onRosterAction(action: RosterAction): void {
    switch (action.kind) {
      case 'promote':
        void this.promote(action.member);
        return;
      case 'demote':
        void this.demote(action.member);
        return;
      case 'transfer':
        this.transferTo.set(action.member);
        return;
      case 'kick':
        this.kick.set(action.member);
        return;
    }
  }

  openInvitesList(): void {
    this.showInvites.set(true);
    void this.groupInvitations.reload();
  }

  async acceptRequest(requestId: string): Promise<void> {
    const groupId = this.routeId();
    if (!groupId) return;
    await this.joinRequests.acceptJoinRequest(groupId, requestId);
    void this.store.reloadRoster();
    void this.bridge.reload(groupId);
  }

  async declineRequest(requestId: string): Promise<void> {
    const groupId = this.routeId();
    if (!groupId) return;
    await this.joinRequests.declineJoinRequest(groupId, requestId);
  }

  /** Salta de página en el roster. `<nf-pagination>` es 1-based; el backend, 0-based. */
  goToMembersPage(page: number): void {
    void this.store.goToMembersPage(page - 1);
  }

  /** Invitaciones ya cargadas para este grupo, para no repetir la petición en cada tick. */
  private invitesLoadedFor: string | null = null;

  constructor() {
    // Carga (y recarga al cambiar de :id), cancelando lo obsoleto dentro del store.
    // `ensureLoaded` y no `load`: la cabecera del shell ya pide este mismo grupo al entrar en
    // cualquiera de sus secciones, y el store deduplica la petición en vuelo.
    effect(() => {
      const id = this.routeId();
      if (id) void this.store.ensureLoaded(id);
    });

    // Datos del hub. Todas son idempotentes y se recargan al cambiar de :id.
    // `ensureLoaded` de ligas puede fallar (hoy el backend da 500 en un grupo sin liga, ver
    // Roadmap §1.1.g): la columna de clasificación tiene su propia rama de error y el resto del
    // hub no se entera.
    effect(() => {
      const id = this.routeId();
      if (!id) return;
      // `untracked` no es adorno: `ensureLoaded` LEE los signals de estado del store (`status`,
      // `groupId`) para decidir si hace falta la petición. Sin aislarlo, esos signals entran como
      // dependencias del efecto, y entonces cada cambio de estado lo vuelve a disparar: cargar →
      // error → reintentar → error, en bucle. Lo único que debe reabrir estas cargas es cambiar
      // de :id.
      untracked(() => {
        void this.leagues.ensureLoaded(id);
        void this.lobbies.ensureLoaded(id);
        void this.joinRequests.loadGroupRequests(id);
      });
    });

    // Puente identidad + roster → store mock: alimenta al hub (trofeos, muro, duelos y trivia) y
    // a los sub-views placeholder de matchmaking. Es `reload` y no `ensure` a propósito: entrar
    // en el hub es el momento natural de refrescarlo, porque el roster pudo cambiar sin que este
    // cliente hiciera nada.
    effect(() => {
      const id = this.routeId();
      if (id) void this.bridge.reload(id);
    });

    // Invitaciones pendientes del grupo: solo owner/admin las ve, y su contador vive en el pie del
    // roster. Se cargan una vez por grupo; al cambiar de :id el guard interno del store descarta
    // lo obsoleto. No las pedimos para miembros normales (el endpoint es admin-only → 403).
    effect(() => {
      const g = this.store.group();
      const canManage = this.store.canManage();
      if (g && canManage && this.invitesLoadedFor !== g.id) {
        this.invitesLoadedFor = g.id;
        void this.groupInvitations.load(g.id);
      }
    });

    this.destroyRef.onDestroy(() => this.groupInvitations.clear());
  }

  reload(): void {
    const id = this.routeId();
    if (id) void this.store.load(id);
  }

  // ── Presentación ────────────────────────────────────────────────────
  /** Tinte del avatar de reserva, derivado del id. Presentación, no dato de dominio. */
  tintOf(seed: string): readonly [string, string] {
    const { c1, c2 } = bannerColors(seed);
    return [c1, c2];
  }

  // ── Acciones de miembro ─────────────────────────────────────────────
  async promote(m: GroupMemberResponse): Promise<void> {
    await this.run(() => this.store.changeRole(m.userId, 'ADMIN'), `${m.discordUsername} ahora es ADMIN`);
  }
  async demote(m: GroupMemberResponse): Promise<void> {
    await this.run(() => this.store.changeRole(m.userId, 'MEMBER'), `${m.discordUsername} ahora es MIEMBRO`);
  }
  async doKick(m: GroupMemberResponse): Promise<void> {
    this.kick.set(null);
    await this.run(() => this.store.removeMember(m.userId), `${m.discordUsername} fue expulsado`);
  }
  async doTransfer(m: GroupMemberResponse): Promise<void> {
    this.transferTo.set(null);
    await this.run(() => this.store.transferOwnership(m.userId), `${m.discordUsername} es el nuevo owner`);
  }


  /** Envuelve una acción de gestión: toast de éxito, o resync + mensaje ante conflicto. */
  private async run(action: () => Promise<void>, ok: string): Promise<void> {
    try {
      await action();
      this.toasts.success(ok);
      // El roster cambió: que el puente del hub y del wizard no se quede con la foto anterior.
      const id = this.routeId();
      if (id) void this.bridge.reload(id);
    } catch {
      await this.store.reloadRoster();
      this.toasts.error('No se pudo completar la acción. Se ha actualizado el grupo.');
    }
  }

  /** Abre el invitador, que ahora vive en la cabecera del shell. */
  openInvite(): void {
    this.showInvites.set(false);
    this.groupActions.openInvite();
  }

  // ── Invitados (cancelar) ────────────────────────────────────────────
  reloadInvites(): void {
    void this.groupInvitations.reload();
  }

  async cancelInvite(inv: GroupInvitationResponse): Promise<void> {
    if (this.groupInvitations.isCancelling(inv.id)) return;
    try {
      await this.groupInvitations.cancel(inv.id);
      this.toasts.success(`Invitación de ${inv.discordUsername ?? 'el usuario'} cancelada`);
    } catch (e) {
      await this.groupInvitations.reload();
      this.toasts.error(errorMessage(e));
    }
  }
}
