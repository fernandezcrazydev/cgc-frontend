import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfButton, NfModal, NfSkeleton, NfWindow } from '../../../../ui';
import { Session } from '../../../../core/auth';
import {
  GroupBridge,
  GroupDetailStore,
  GroupInvitationResponse,
  GroupInvitationsStore,
  GroupMemberResponse,
  JoinRequestsStore,
  bannerColors,
  groupRoleLabel,
} from '../../../../core/groups';
import { LeaguesStore } from '../../../../core/leagues';
import { LobbiesStore, LobbyResponse } from '../../../../core/lobbies';
import { GroupStore } from '../../../../core/group-store';
import { RankEntry, mapLeaderboardEntries } from '../../../../core/group-ranking';
import {
  duelsFor,
  hubCommentsFor,
  SeasonChoice,
  leagueSeriesFor,
  triviaFor,
} from '../../../../core/group-hub';
import { SHOWCASE_MEDAL_IDS, medalBoardsFor } from '../../../../core/group-medals';
import { ToastService } from '../../../../core/toast';
import { GroupActionsService } from '../../group-actions/group-actions.service';
import { errorMessage } from '../../../../core/http';
import { HubCommentsComponent } from '../group-hub/hub-comments.component';
import { HubDuelsComponent } from '../group-hub/hub-duels.component';
import { HubLiveRoomComponent } from '../group-hub/hub-live-room.component';
import { HubLpChartComponent, LeagueSeasonChange } from '../group-hub/hub-lp-chart.component';
import { HubRosterPanelComponent, RosterAction } from '../group-hub/hub-roster-panel.component';
import { HubTriviaComponent } from '../group-hub/hub-trivia.component';
import { HubTrophyCaseComponent } from '../group-hub/hub-trophy-case.component';

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
  templateUrl: './grupo-detalle.html',
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
  /**
   * Qué temporada se está mirando de cada liga. Vacío = la más reciente de cada una.
   *
   * Es por liga y no del grupo porque **la «temporada del grupo» no existe**: cada modalidad lleva
   * su propia cuenta y sus propias fechas (`FlujoJuego.md` §3.1, §3.2), y con 6, 3 y 2 meses de
   * duración en un año caben ~2 de Competitivo frente a ~6 de Caos.
   */
  readonly leagueSeasons = signal<SeasonChoice>({});

  protected pickSeason(change: LeagueSeasonChange): void {
    this.leagueSeasons.update((current) => ({ ...current, [change.modality]: change.seasonId }));
  }

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

  readonly lpSeries = computed(() => leagueSeriesFor(this.routeId(), this.leagueSeasons()));
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
