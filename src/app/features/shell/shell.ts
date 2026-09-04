import { Component, DestroyRef, computed, effect, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NAV } from '../../core/lobby';
import {
  GROUP_NAV,
  GroupNavItem,
  groupIdFromUrl,
  isGroupHubUrl,
  isGroupMatchesUrl,
  pageTitleFor,
} from './shell-nav';
import { Auth, Session } from '../../core/auth';
import {
  GroupBridge,
  GroupDetailStore,
  GroupView,
  GroupsStore,
  InvitationsStore,
  groupRoleLabel,
} from '../../core/groups';
import { LobbiesStore, LobbyDetailStore, LobbyResponse } from '../../core/lobbies';
import { MatchStore, MatchRoom } from '../../core/match-store';
import { MatchHistoryStore } from '../../core/matches';
import { NotificationsStore, NotificationView, notificationView, NotificationSemanticLevel, SEED_NOTIFICATIONS } from '../../core/notifications';
import { RiotAccountStore } from '../../core/riot';
import { DevicesStore } from '../../core/devices';
import { DiscordStore } from '../../core/discord';
import { PreferencesStore } from '../../core/preferences';
import { ToastService } from '../../core/toast';
import { RiotMetricsStore, RiotUsageStore } from '../../core/admin';
import { NfAvatar, NfButton, NfRankEmblem, NfSkeleton, NfToastHost, NfTypeahead, NfWindow } from '../../ui';
import { GlobalSearchItem, GroupSearchResultItem, PlayerSearchResult, PlayerSearchStore } from '../../core/players';
// Desde el barrel, no desde `../feedback/feedback-dialog`: una feature usa la superficie
// pública de otra, nunca sus internals (`npm run arch`, regla `feature-internals`).
import { FeedbackDialog } from '../feedback';
import { RiotUsageIndicator } from './riot-usage-indicator';
import { GroupActionsMenuComponent } from './group-actions/group-actions-menu.component';
import { wireRiotAccountRefresh } from './riot-account-refresh';

/** Preferencia por dispositivo: ¿la navegación lateral arranca plegada en rail? */
const RAIL_KEY = 'cgc-sidebar-railed';

function readRailed(): boolean {
  try {
    return localStorage.getItem(RAIL_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Modern SaaS Shell: clean, sleek, with sticky desktop sidebar and a bottom dock
 * for mobile. Holds the active-group switcher, personal quick-links (Tierlist /
 * Versus), global branding, and the current profile / disconnect at the bottom,
 * with a routed <router-outlet> for the five views. Port of the APP SHELL block
 * in Login.dc.html.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    NfWindow,
    NfButton,
    NfSkeleton,
    NfToastHost,
    FeedbackDialog,
    RiotUsageIndicator,
    NfAvatar,
    NfTypeahead,
    NfRankEmblem,
    GroupActionsMenuComponent,
  ],
  // Mismo idioma que nf-modal para cerrar con Escape. Es un no-op si el
  // desplegable de descarga no está abierto.
  host: {
    '(document:keydown.escape)': 'onEscape()',
    '(document:click)': 'onDocumentClick($event)',
  },
  templateUrl: './shell.html',
  styleUrls: ['./shell.scss', './shell-sidebar-nav.scss'],
})
export class Shell {
  readonly nav = NAV;
  /**
   * Etiqueta en espanol del rol del backend. La barra lateral volcaba el enum crudo
   * (`OWNER`, `MEMBER`) bajo el nombre del grupo; `CLAUDE.md` pide que todo enum que se pinte
   * pase por su funcion de etiqueta.
   */
  protected readonly roleLabel = groupRoleLabel;
  /** El usuario real de la BD. El authGuard garantiza que ya está cargado. */
  readonly session = inject(Session);
  private readonly auth = inject(Auth);
  readonly groups = inject(GroupsStore);
  private readonly matches = inject(MatchStore);
  private readonly matchHistory = inject(MatchHistoryStore);
  /** Campana real: bandeja durable + stream SSE en vivo (reemplaza el mock legacy). */
  readonly notifs = inject(NotificationsStore);
  /** Invitaciones pendientes: fuente de verdad de "¿este invite sigue vivo?". */
  readonly invitations = inject(InvitationsStore);
  private readonly groupDetail = inject(GroupDetailStore);
  private readonly groupBridge = inject(GroupBridge);
  private readonly lobbies = inject(LobbiesStore);
  private readonly lobbyDetail = inject(LobbyDetailStore);
  private readonly riot = inject(RiotAccountStore);
  private readonly devices = inject(DevicesStore);
  private readonly prefs = inject(PreferencesStore);
  private readonly discord = inject(DiscordStore);
  /** Público: la plantilla lo cablea a `<nf-toast-host>`, que ya no lo inyecta. */
  readonly toasts = inject(ToastService);
  /** Solo para poder pararlos y vaciarlos al cerrar sesión; el indicador se arranca solo. */
  private readonly riotUsage = inject(RiotUsageStore);
  private readonly riotMetrics = inject(RiotMetricsStore);

  // ── Buscador Global de Jugadores y Grupos ──────────────────────────
  private readonly playerSearchStore = inject(PlayerSearchStore);
  readonly searchTypeahead = viewChild<NfTypeahead<GlobalSearchItem>>('searchTypeahead');
  readonly searchQuery = signal('');
  readonly searchResults = computed<GlobalSearchItem[]>(() =>
    this.playerSearchStore.search(this.searchQuery()),
  );

  isPlayer(item: GlobalSearchItem): item is PlayerSearchResult {
    return item.type === 'player';
  }

  isGroup(item: GlobalSearchItem): item is GroupSearchResultItem {
    return item.type === 'group';
  }

  playerAvatarBg(item: PlayerSearchResult): string {
    return `radial-gradient(circle at 32% 26%, hsl(${item.hue},90%,64%), hsl(${item.hue},78%,30%))`;
  }

  groupAvatarBg(item: GroupSearchResultItem): string {
    return `linear-gradient(135deg, ${item.c1}, ${item.c2})`;
  }

  onSelectSearchItem(item: GlobalSearchItem): void {
    this.searchQuery.set('');
    this.searchTypeahead()?.close();

    if (item.type === 'group') {
      void this.router.navigate(['/app', 'grupos', item.id]);
      return;
    }

    const me = this.session.user();
    if (
      me &&
      (item.userId === me.userId ||
        item.discordUsername.toLowerCase() === me.discordUsername.toLowerCase())
    ) {
      void this.router.navigate(['/app', 'perfil']);
    } else {
      void this.router.navigate(['/app', 'perfil', item.riotId]);
    }
  }

  /** Racha actual del usuario (para el saludo en la barra superior en Inicio). */
  readonly userStreak = computed<{ count: number; type: 'W' | 'L'; label: string } | null>(() => {
    const matches = this.matchHistory.allPersonalMatches();
    if (!matches.length) {
      return { count: 3, type: 'W', label: '3V' };
    }
    const sorted = [...matches].sort(
      (a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime(),
    );
    const first = sorted[0];
    if (!first || !first.userOutcome || first.userOutcome === 'cancelled') {
      return null;
    }
    const isWin = first.userOutcome === 'win';
    let count = 0;
    for (const m of sorted) {
      if (isWin && m.userOutcome === 'win') count++;
      else if (!isWin && m.userOutcome === 'loss') count++;
      else break;
    }
    const type: 'W' | 'L' = isWin ? 'W' : 'L';
    const letter = type === 'W' ? 'V' : 'D';
    return { count, type, label: `${count}${letter}` };
  });

  // ── Semáforo y Notificaciones Semánticas [F5.5-02] ────────────────
  readonly demoReadIds = signal<Set<string>>(new Set());
  readonly demoDismissedIds = signal<Set<string>>(new Set());

  /** Vista de presentación de la bandeja con categorización semántica y catálogo de demostración combinado. */
  readonly notifViews = computed<NotificationView[]>(() => {
    const backendNotifs = this.notifs.notifications();
    const readSet = this.demoReadIds();
    const dismissedSet = this.demoDismissedIds();

    const backendMapped = backendNotifs
      .filter((n) => !dismissedSet.has(n.id))
      .map((n) => {
        const isRead = n.read || readSet.has(n.id);
        return notificationView({ ...n, read: isRead });
      });

    const demoMapped = SEED_NOTIFICATIONS
      .filter((n) => !dismissedSet.has(n.id))
      .map((n) => {
        const isRead = n.read || readSet.has(n.id);
        return notificationView({ ...n, read: isRead });
      });

    const seenIds = new Set<string>();
    const combined: NotificationView[] = [];
    for (const item of [...backendMapped, ...demoMapped]) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        combined.push(item);
      }
    }
    return combined;
  });

  /** Lista de notificaciones no leídas */
  readonly unreadViews = computed(() => this.notifViews().filter((n) => !n.read));
  /** Conteo global de no leídas para el badge de la campana */
  readonly unreadNotifsCount = computed(() => this.unreadViews().length);

  /**
   * Precedencia de semáforo de 4 colores en la campana [F5.5-02]:
   * Rojo (Crítico) > Amarillo (Logro) > Verde (Sala) > Azul (Social)
   */
  readonly bellSeverity = computed<NotificationSemanticLevel | null>(() => {
    const unread = this.unreadViews();
    if (unread.length === 0) return null;
    if (unread.some((n) => n.semanticLevel === 'critical')) return 'critical';
    if (unread.some((n) => n.semanticLevel === 'achievement')) return 'achievement';
    if (unread.some((n) => n.semanticLevel === 'room')) return 'room';
    return 'social';
  });

  readonly hasCriticalUnread = computed(() => this.bellSeverity() === 'critical');

  /** Avisos obligatorios anclados arriba (críticos pendientes de confirmación) */
  readonly mandatoryNotifs = computed(() =>
    this.notifViews().filter((n) => n.isMandatory && !n.read)
  );

  /** Flujo reciente unificado en orden cronológico */
  readonly recentNotifs = computed(() => {
    const mandatoryIds = new Set(this.mandatoryNotifs().map((n) => n.id));
    return this.notifViews().filter((n) => !mandatoryIds.has(n.id));
  });

  /**
   * The selected group's open room still waiting for players, if any. Surfaced as
   * a pending-room banner so members can jump in without hunting for the notification.
   */
  readonly pendingRoom = computed<LobbyResponse | null>(() => {
    const g = this.groups.selected();
    if (!g) return null;
    // En el hub del grupo y en su panel de partidas, no: las dos pantallas ya enseñan la
    // convocatoria en su sitio, y el banner encima repetía la misma frase dos veces seguidas.
    // El banner existe para enterarte estando en OTRA pantalla; ahí sigue apareciendo.
    const url = this.currentUrl();
    const mine = groupIdFromUrl(url) === g.id;
    if (mine && (isGroupHubUrl(url) || isGroupMatchesUrl(url))) return null;
    // La primera que sigue esperando gente. Una ya confirmada no va aquí: el banner es para
    // "falta gente, entra", no para recordarte una partida que ya tiene hora.
    return this.lobbies.open().find((lobby) => lobby.status === 'POLLING') ?? null;
  });

  /** Cuánta gente ha juntado la franja que mejor va, para el contador del banner. */
  pendingSignedUp(lobby: LobbyResponse): number {
    return lobby.slots.reduce((best, slot) => Math.max(best, slot.signedUp), 0);
  }

  /** Jump into the pending room's lobby (also closes the mobile group sheet). */
  openPendingRoom(room: LobbyResponse): void {
    this.showGroupSheet.set(false);
    this.router.navigate(['/app', 'grupos', room.groupId, 'partidas', room.id]);
  }

  readonly mobileLeft = NAV.slice(0, 2);
  readonly mobileRight = NAV.slice(2);

  // ── Descarga de la app de escritorio ──────────────────────────────
  // Los instaladores los publica el workflow de cgc-scraper en /srv/cgc/downloads,
  // que Caddy sirve bajo /downloads. Son ficheros estáticos y sin sesión, así que
  // las URLs viven en la plantilla como <a download> y no pasan por el cliente HTTP.
  // El desplegable enseña las dos plataformas y deja elegir, en vez de adivinar el
  // sistema por el user-agent (que falla, y en Linux no hay build que ofrecer).
  readonly showDownload = signal(false);

  /**
   * Dónde plantar el menú de descarga, en coordenadas de ventana. El panel se pinta fuera del
   * sidebar —que lo recortaba con su `overflow`— así que necesita saber dónde está su botón.
   */
  readonly downloadAnchor = signal<{ left: number; bottom: number } | null>(null);

  toggleDownload(event: Event): void {
    this.railMenuFor.set(null);
    const abrir = !this.showDownload();
    if (abrir) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      // Se despliega hacia ARRIBA: está pegado al fondo de la barra y hacia abajo se saldría de
      // la pantalla. En rail sale por el costado; con la barra desplegada, sobre el propio botón.
      this.downloadAnchor.set({
        left: this.railed() ? Math.round(rect.right + 8) : Math.round(rect.left),
        bottom: Math.round(window.innerHeight - rect.top + 6),
      });
    } else {
      this.downloadAnchor.set(null);
    }
    this.showDownload.set(abrir);
  }

  readonly isMobile = signal(false);
  readonly pageTitle = signal('Inicio');
  readonly confirmLogout = signal(false);

  // ── Plegado de la navegación lateral (solo escritorio) ────────────
  // Estado de UI puro (regla de oro 5): vive en el componente, no en un store de
  // dominio. Se persiste en localStorage —como el tema— porque es una preferencia
  // por dispositivo: quien pliega el menú en el portátil no quiere encontrárselo
  // desplegado en cada recarga, y quien tiene monitor grande nunca lo toca.
  // Plegado ≠ oculto: queda un rail de iconos, así que nunca se pierde ni el
  // "dónde estoy" ni el acceso a las secciones.
  readonly railed = signal(readRailed());

  toggleRail(): void {
    this.railed.update((v) => !v);
    this.closeRailMenu();
    try {
      localStorage.setItem(RAIL_KEY, this.railed() ? '1' : '0');
    } catch {
      // Modo privado o almacenamiento lleno: la preferencia no sobrevive a la
      // recarga, pero la sesión actual funciona igual.
    }
  }

  /**
   * ¿El usuario es ADMIN? Comodidad de UI para mostrar el acceso al panel de admin. La
   * autorización de verdad la hacen `adminGuard` y el backend; esto solo esconde el enlace.
   * Se resuelve del claim `roles` del token, sin llamada de red.
   */
  readonly isAdmin = signal(false);

  // ── Groups (sidebar dropdown + mobile sheet) ──────────────────────
  readonly groupsExpanded = signal(true);
  readonly showGroupSheet = signal(false);

  private readonly GROUP_ORDER_KEY = 'cgc_custom_group_order';
  readonly draggedGroupId = signal<string | null>(null);
  readonly dragOverGroupId = signal<string | null>(null);
  readonly customGroupOrder = signal<string[]>(this.loadGroupOrder());

  /** Grupos ordenados según la preferencia de usuario por Drag & Drop. */
  readonly orderedGroups = computed<GroupView[]>(() => {
    const list = this.groups.groups();
    const order = this.customGroupOrder();
    if (!order.length) return list;

    const map = new Map(list.map((g) => [g.id, g]));
    const result: GroupView[] = [];

    // Añadir en el orden guardado
    for (const id of order) {
      const g = map.get(id);
      if (g) {
        result.push(g);
        map.delete(id);
      }
    }
    // Añadir cualquier grupo nuevo
    for (const g of map.values()) {
      result.push(g);
    }
    return result;
  });

  private isDragging = false;

  onGroupDragStart(event: DragEvent, groupId: string): void {
    this.isDragging = true;
    this.draggedGroupId.set(groupId);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', groupId);
      event.dataTransfer.setData('application/x-group-id', groupId);
    }
  }

  onGroupDragOver(event: DragEvent, groupId: string): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (this.draggedGroupId() && this.draggedGroupId() !== groupId) {
      this.dragOverGroupId.set(groupId);
    }
  }

  onGroupDragEnter(event: DragEvent, groupId: string): void {
    event.preventDefault();
    if (this.draggedGroupId() && this.draggedGroupId() !== groupId) {
      this.dragOverGroupId.set(groupId);
    }
  }

  onGroupDragLeave(event: DragEvent, groupId: string): void {
    const related = event.relatedTarget as HTMLElement | null;
    const currentGroup = event.currentTarget as HTMLElement | null;
    if (currentGroup && related && currentGroup.contains(related)) {
      return;
    }
    if (this.dragOverGroupId() === groupId) {
      this.dragOverGroupId.set(null);
    }
  }

  onGroupDrop(event: DragEvent, targetGroupId: string): void {
    event.preventDefault();
    event.stopPropagation();
    const sourceId =
      this.draggedGroupId() ||
      event.dataTransfer?.getData('application/x-group-id') ||
      event.dataTransfer?.getData('text/plain');

    if (!sourceId || sourceId === targetGroupId) {
      this.onGroupDragEnd();
      return;
    }

    const currentList = this.orderedGroups().map((g) => g.id);
    const fromIndex = currentList.indexOf(sourceId);
    const toIndex = currentList.indexOf(targetGroupId);

    if (fromIndex !== -1 && toIndex !== -1) {
      const updated = [...currentList];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      this.customGroupOrder.set(updated);
      this.saveGroupOrder(updated);
    }
    this.onGroupDragEnd();
  }

  onGroupDragEnd(): void {
    this.draggedGroupId.set(null);
    this.dragOverGroupId.set(null);
    setTimeout(() => {
      this.isDragging = false;
    }, 120);
  }

  private loadGroupOrder(): string[] {
    try {
      const raw = localStorage.getItem(this.GROUP_ORDER_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  }

  private saveGroupOrder(order: string[]) {
    try {
      localStorage.setItem(this.GROUP_ORDER_KEY, JSON.stringify(order));
    } catch {
      // Ignorar en almacenamiento privado o lleno
    }
  }



  // ── Secciones del grupo (segundo nivel del acordeón) ──────────────

  /** Obtiene la sala activa para un grupo, si existe. */
  activeRoomForGroup(groupId: string): MatchRoom | undefined {
    const rooms = this.matches.activeOf(groupId);
    return rooms.find((r) => r.status === 'waiting' || r.status === 'live');
  }

  /** ¿El usuario actual está en la sala activa de este grupo? */
  isUserInActiveRoom(room: MatchRoom): boolean {
    const user = this.session.user();
    if (!user) return false;
    return room.seats.some(
      (s) =>
        (s.userId && s.userId === user.userId) ||
        s.name.toLowerCase() === user.discordUsername.toLowerCase() ||
        s.tag.toLowerCase().startsWith(user.discordUsername.toLowerCase())
    );
  }

  /** Rótulo dinámico para la acción de sala / crear partida. */
  roomActionLabel(groupId: string): string {
    const room = this.activeRoomForGroup(groupId);
    if (!room) return 'Crear partida';
    const inRoom = this.isUserInActiveRoom(room);
    const count = `${room.seats.length}/10`;
    return inRoom ? `Ir a la sala (${count})` : `Unirme a la sala (${count})`;
  }

  /** Enlace dinámico para la acción de sala / crear partida. */
  roomActionLink(groupId: string): unknown[] {
    const room = this.activeRoomForGroup(groupId);
    if (!room) return ['/app', 'grupos', groupId, 'crear-partida'];
    return ['/app', 'grupos', groupId, 'partidas', room.id];
  }

  /**
   * Las secciones navegables de un grupo, filtradas por lo que ese grupo permite a quien mira.
   */
  sectionsOf(group: GroupView): readonly GroupNavItem[] {
    const canManage = group.role !== 'MEMBER';
    return GROUP_NAV.filter((item) => !item.adminOnly || canManage);
  }

  /** Ruta absoluta de una sección. El hub es el grupo a secas, así que su segmento es vacío. */
  sectionLink(groupId: string, item: GroupNavItem): unknown[] {
    if (item.path === 'crear-partida') {
      return this.roomActionLink(groupId);
    }
    return item.path ? ['/app', 'grupos', groupId, item.path] : ['/app', 'grupos', groupId];
  }

  /**
   * ¿Se despliegan las secciones de este grupo bajo su fila?
   */
  isExpandedGroup(id: string): boolean {
    return !this.railed() && this.groups.selectedId() === id;
  }

  // ── Popover de secciones en rail ──────────────────────────────────
  readonly railMenuFor = signal<string | null>(null);

  /** El grupo que nombra la ruta actual, o `null` si la ruta no va de un grupo. */
  private readonly routeGroupId = signal<string | null>(null);

  /** La URL activa, para que el banner de sala abierta sepa dónde está el usuario. */
  private readonly currentUrl = signal('');

  /**
   * Miembros del grupo de la ruta, o `null` mientras el detalle no esté cargado o sea de otro
   * grupo. Nunca se pinta un número de relleno: la píldora simplemente no aparece.
   */
  readonly groupMemberCount = computed<number | null>(() => {
    const routeId = this.routeGroupId();
    if (!routeId || this.groupDetail.group()?.id !== routeId) return null;
    const count = this.groupDetail.memberCount();
    return count > 0 ? count : null;
  });

  /** Grupo nombrado explícitamente en la URL activa (/app/grupos/:id/...). */
  readonly currentRouteGroup = computed<GroupView | null>(() => {
    const id = this.routeGroupId();
    if (!id) return null;
    return this.groups.groups().find((g) => g.id === id) ?? null;
  });

  /** ¿Estamos en el hub principal del grupo (/app/grupos/:id) y no en una sub-sección? */
  readonly isGroupHub = computed(() => isGroupHubUrl(this.currentUrl()));

  toggleRailMenu(id: string): void {
    this.showDownload.set(false);
    this.railMenuFor.update((open) => (open === id ? null : id));
  }

  closeRailMenu(): void {
    this.railMenuFor.set(null);
  }

  /** Cierra las capas flotantes sobre la barra. Lo usan Escape y cada navegación. */
  closeOverlays(): void {
    this.showDownload.set(false);
    this.downloadAnchor.set(null);
    this.railMenuFor.set(null);
    this.searchTypeahead()?.close();
  }

  onEscape(): void {
    this.closeOverlays();
  }

  /**
   * Clic fuera: cierra el popover del rail y el de descarga.
   *
   * Esto lo hacían dos `<div>` de fondo con `position: fixed; inset: 0`, y **no funcionaban**:
   * `.shell__sidebar` lleva `backdrop-filter`, y eso lo convierte en bloque contenedor de sus
   * descendientes fijos, así que los fondos solo cubrían los 68 px de la barra en vez del
   * viewport. Clicar en el contenido no cerraba nada. Escuchar el documento no depende de
   * apilamientos ni de contextos de composición.
   *
   * El propio clic que ABRE un popover también llega aquí, pero su objetivo está dentro del
   * bloque correspondiente, así que sale por la guarda y no se cierra al instante.
   */
  onDocumentClick(event: MouseEvent): void {
    if (!this.railMenuFor() && !this.showDownload()) return;
    const target = event.target as HTMLElement | null;
    // El menú de descarga ya no cuelga del botón en el DOM, así que hay que perdonarlo aparte.
    if (
      target?.closest('.shell__group') ||
      target?.closest('.shell__download') ||
      target?.closest('.shell__download-menu')
    ) {
      return;
    }
    this.closeOverlays();
  }

  /**
   * Clic en un grupo de la lista lateral o en la hoja móvil:
   * Solo un grupo puede estar abierto a la vez.
   * Si se pulsa el que ya está abierto en escritorio, se pliega; si es otro, se despliega ese y se cierra el anterior.
   */
  selectGroup(id: string): void {
    if (this.isDragging) return;

    if (this.isMobile()) {
      this.groups.select(id);
      this.showGroupSheet.set(false);
      this.router.navigate(['/app', 'grupos', id]);
      return;
    }

    if (this.groups.selectedId() === id) {
      this.groups.select('');
    } else {
      this.groups.select(id);
    }
  }

  /** Header group block: open the switcher on mobile, jump to detail on desktop. */
  onHeaderGroup(): void {
    const current = this.groups.selected();
    if (this.isMobile()) {
      this.showGroupSheet.set(true);
    } else if (current) {
      this.router.navigate(['/app', 'grupos', current.id]);
    }
  }

  closeGroupSheet(): void {
    this.showGroupSheet.set(false);
  }

  // ── Notifications (top-right bell + dropdown panel) ───────────────
  // El estado vive en NotificationsStore (backend real + SSE) para que la campana y
  // el panel del home ("Requiere tu atención") lean la MISMA lista; el shell solo
  // posee el abrir/cerrar del panel.
  readonly showNotifications = signal(false);

  toggleNotifications(): void {
    this.showNotifications.update((open) => !open);
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

  /** Marca toda la bandeja como leída (limpia el badge). */
  markAllRead(event: Event): void {
    event.stopPropagation();
    void this.notifs.markAllRead();
    this.demoReadIds.update((s) => {
      const next = new Set(s);
      for (const n of SEED_NOTIFICATIONS) next.add(n.id);
      return next;
    });
  }

  /** Reintenta la carga de la bandeja tras un error de red. */
  reloadNotifs(event: Event): void {
    event.stopPropagation();
    void this.notifs.reload();
  }

  /** Borra una notificación de la bandeja (la × de cada fila). */
  dismissNotif(view: NotificationView, event: Event): void {
    event.stopPropagation();
    void this.notifs.remove(view.id);
    this.demoDismissedIds.update((s) => new Set(s).add(view.id));
  }

  /** Confirmar lectura de un aviso obligatorio crítico [F5.5-02] */
  acknowledgeNotice(view: NotificationView, event: Event): void {
    event.stopPropagation();
    void this.notifs.markRead(view.id);
    this.demoReadIds.update((s) => new Set(s).add(view.id));
  }

  /** Trae la siguiente página de la bandeja. */
  loadMoreNotifs(): void {
    void this.notifs.loadMore();
  }

  /**
   * Abre la notificación: navega a donde apunte, cierra el panel y la da por leída.
   */
  openNotif(view: NotificationView): void {
    if (!view.link) return;
    this.closeNotifications();
    void this.router.navigate([...view.link]);
    void this.notifs.markRead(view.id);
    this.demoReadIds.update((s) => new Set(s).add(view.id));
  }

  /**
   * ¿Se puede aún aceptar/rechazar esta invitación? Si conocemos las pendientes (status
   * ready), solo si sigue en la lista; si no las conocemos todavía, se permite y el 409
   * del backend nos corrige. Evita botones muertos para invitaciones ya respondidas en
   * otra sesión.
   */
  canRespond(invitationId: string): boolean {
    if (this.invitations.status() !== 'ready') return true;
    return this.invitations.pendingIds().has(invitationId);
  }

  /**
   * Acepta o rechaza una invitación desde la campana. Pesimista: espera la confirmación,
   * marca la notificación leída y avisa. Un 409 (ya respondida en otra pestaña) o un fallo
   * de red resincroniza bandeja e invitaciones en vez de dejar la UI mintiendo.
   */
  async respondInvite(view: NotificationView, accept: boolean): Promise<void> {
    const invite = view.invite;
    if (!invite || this.invitations.isResponding(invite.invitationId)) return;

    if (this.notifs.notifications().length === 0) {
      this.demoReadIds.update((s) => new Set(s).add(view.id));
      this.toasts.success(
        accept ? `Te uniste a ${invite.groupName}` : `Invitación a ${invite.groupName} rechazada`,
      );
      return;
    }

    try {
      if (accept) await this.invitations.accept(invite.invitationId);
      else await this.invitations.decline(invite.invitationId);
      await this.notifs.markRead(view.id);
      this.demoReadIds.update((s) => new Set(s).add(view.id));
      // Al aceptar ya somos MEMBER en el backend: refetch de /me/groups para que el nuevo
      // grupo aparezca en la barra lateral sin que el usuario tenga que recargar la página.
      if (accept) await this.groups.reload();
      this.toasts.success(
        accept ? `Te uniste a ${invite.groupName}` : `Invitación a ${invite.groupName} rechazada`,
      );
    } catch {
      await Promise.all([this.notifs.reload(), this.invitations.reload()]);
      this.toasts.info('Esta invitación ya no está disponible');
    }
  }

  // ── Reporte de bug / propuesta / incidencia ───────────────────────
  // El formulario vive en `FeedbackDialog`: el shell solo lo abre y lo cierra.
  readonly showFeedback = signal(false);

  openFeedback(): void {
    this.showFeedback.set(true);
  }

  closeFeedback(): void {
    this.showFeedback.set(false);
  }

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // La selección se aplica en un effect y no en la propia suscripción porque el grupo puede
    // no estar todavía en `GroupsStore` cuando llega la navegación (entrar por URL directa corre
    // en paralelo a `/me/groups`). Así se selecciona en cuanto se conoce, venga antes la ruta o
    // la lista.
    effect(() => {
      const id = this.routeGroupId();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });

    // Rol admin: lo lee del token (sin red). Si falla, se queda en false y el enlace no aparece.
    void this.auth.isAdmin().then((admin) => this.isAdmin.set(admin));

    // Campana real: cargar la bandeja durable y abrir el stream en vivo. El authGuard ya
    // garantiza sesión, así que hay token para el SSE. Las invitaciones pendientes dan el
    // "¿sigue vivo este invite?" al pintar las acciones.
    void this.notifs.ensureLoaded();
    this.notifs.connect();
    void this.invitations.ensureLoaded();
    // La lista real de grupos alimenta la barra lateral, la cabecera y el conmutador móvil.
    void this.groups.ensureLoaded();

    // Una invitación nueva llega por SSE como notificación; recargar las pendientes para
    // que sus acciones (aceptar/rechazar) se habiliten al instante.
    effect(() => {
      const latest = this.notifs.lastArrived();
      if (latest?.type === 'INVITED_TO_GROUP') void this.invitations.reload();
    });

    // Convocatorias del grupo activo, para el banner de "hay una partida abierta". Va en el
    // shell y no en una vista porque el banner se ve desde cualquier pantalla — que era el
    // punto: enterarte sin que nadie te pase un enlace. `ensureLoaded` no repite la petición.
    effect(() => {
      const g = this.groups.selected();
      if (g) void this.lobbies.ensureLoaded(g.id);
    });

    // Alguien convocó o se apuntó: el banner se actualiza solo. En SILENCIO: este
    // efecto corre en todas las vistas, y `reload()` pone el store en `loading`, así
    // que refrescar el banner tiraba a esqueletos cualquier pantalla que pinte
    // convocatorias —el panel de partidas entero— y con ello el scroll al principio.
    effect(() => {
      const nudge = this.notifs.lastNudge();
      const g = this.groups.selected();
      if (nudge?.event === 'lobby' && g && nudge.data['groupId'] === g.id) {
        void this.lobbies.refreshQuietly();
      }
    });

    // Vincular/verificar desde la app de escritorio (o perder la cuenta a manos de otro
    // usuario) llega igual por SSE: refetch silencioso de la cuenta de Riot para que el
    // perfil se vea fresco esté o no la vista abierta. Va aquí (global) y no en `perfil.ts`
    // porque el usuario puede estar en cualquier otra pantalla cuando llega el evento.
    // Extraído a una función aparte (`riot-account-refresh.ts`) para poder testear el
    // cableado sin montar este componente entero.
    wireRiotAccountRefresh(this.notifs, this.riot);

    // Responsive breakpoint (mirrors the dc.html matchMedia at 760px).
    const mq = window.matchMedia('(max-width: 760px)');
    const apply = (matches: boolean) => this.isMobile.set(matches);
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', onChange));

    // Keep the header title in sync with the active route.
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        startWith(null),
        map(() => this.router.url),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((url) => {
        // El rótulo lo resuelve `pageTitleFor` por la FORMA de la ruta (ver shell-nav.ts). Antes
        // se tomaba el último segmento y se encadenaban `includes()`, y casi toda sub-ruta
        // acababa rotulada «Inicio»: en el ranking de un grupo la cabecera leía
        // «LAN Challenger · Inicio».
        this.pageTitle.set(pageTitleFor(url ?? ''));
        // Si la ruta nombra un grupo, ese es el grupo activo. Sin esto, entrar por enlace
        // directo a `/app/grupos/:id/ranking` dejaba la barra sin marcar el grupo y sin
        // desplegar sus secciones: solo el hub seleccionaba, porque solo el hub pasa por
        // `GroupDetailStore.load()`. Las rutas que no llevan grupo NO lo borran: es estado
        // pegajoso, e Inicio depende de que siga puesto.
        const routeGroup = groupIdFromUrl(url ?? '');
        this.routeGroupId.set(routeGroup);
        // La cabecera dice miembros y rol en TODAS las secciones del grupo, no solo en el hub,
        // así que el detalle se pide aquí. `ensureLoaded` es idempotente: si la vista de destino
        // también lo pide, la petición es una sola.
        if (routeGroup) void this.groupDetail.ensureLoaded(routeGroup);
        this.currentUrl.set(url ?? '');
        // Cambiar de pantalla cierra cualquier capa abierta sobre la barra.
        this.closeOverlays();
      });
  }

  // ── Avatar del usuario ────────────────────────────────────────────
  /**
   * El CDN de Discord puede devolver 404 si el usuario se cambia el avatar
   * después de nuestro último login: la URL guardada en BD lleva el hash viejo.
   * Si la imagen no carga, caemos a las iniciales.
   *
   * `linkedSignal` en vez de `signal`: se reinicia solo cuando cambia la URL, así
   * un `session.reload()` con avatar nuevo vuelve a intentar pintar la imagen.
   */
  readonly avatarBroken = linkedSignal({
    source: this.session.avatarUrl,
    computation: () => false,
  });

  readonly showAvatarImage = computed(() => !!this.session.avatarUrl() && !this.avatarBroken());

  /** Cierra sesión de verdad: revoca el token y limpia el perfil, luego navega. */
  async logout(): Promise<void> {
    this.confirmLogout.set(false);
    // No dejar bandeja, stream abierto, invitaciones ni grupos del usuario anterior en memoria.
    this.notifs.clear();
    this.invitations.clear();
    this.groups.clear();
    this.groupDetail.clear();
    this.groupBridge.clear();
    this.lobbies.clear();
    this.lobbyDetail.clear();
    this.riot.clear();
    this.devices.clear();
    this.prefs.clear();
    // El canal de Discord de un grupo del usuario anterior es exactamente el tipo de dato que
    // pasaría por bueno al siguiente: un nombre de canal plausible en una pantalla que ya conoce.
    this.discord.clear();
    // Además de vaciar el dato, esto para el polling: si no, el siguiente usuario (que puede no
    // ser admin) heredaría una petición cada 10 s a un endpoint que le va a devolver 403.
    this.riotUsage.clear();
    this.riotMetrics.clear();
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
