import { Component, DestroyRef, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NAV } from '../../core/lobby';
import { Auth, Session } from '../../core/auth';
import { GroupBridge, GroupDetailStore, GroupsStore, InvitationsStore } from '../../core/groups';
import { LobbiesStore, LobbyDetailStore, LobbyResponse } from '../../core/lobbies';
import { MatchStore, MatchRoom } from '../../core/match-store';
import { NotificationsStore, NotificationView, notificationView } from '../../core/notifications';
import { RiotAccountStore } from '../../core/riot';
import { DevicesStore } from '../../core/devices';
import { DiscordStore } from '../../core/discord';
import { PreferencesStore } from '../../core/preferences';
import { ToastService } from '../../core/toast';
import { RiotMetricsStore, RiotUsageStore } from '../../core/admin';
import { NfButton, NfSkeleton, NfToastHost, NfWindow } from '../../ui';
import { FeedbackDialog } from '../feedback/feedback-dialog';
import { RiotUsageIndicator } from './riot-usage-indicator';
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
 * Sale Custom app shell — desktop sidebar + sticky header + mobile bottom nav,
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
  ],
  // Mismo idioma que nf-modal para cerrar con Escape. Es un no-op si el
  // desplegable de descarga no está abierto.
  host: {
    '(document:keydown.escape)': 'showDownload.set(false)',
  },
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly nav = NAV;
  /** El usuario real de la BD. El authGuard garantiza que ya está cargado. */
  readonly session = inject(Session);
  private readonly auth = inject(Auth);
  readonly groups = inject(GroupsStore);
  private readonly matches = inject(MatchStore);
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
  private readonly toasts = inject(ToastService);
  /** Solo para poder pararlos y vaciarlos al cerrar sesión; el indicador se arranca solo. */
  private readonly riotUsage = inject(RiotUsageStore);
  private readonly riotMetrics = inject(RiotMetricsStore);

  /** Vista de presentación de la bandeja: título/mensaje/tiempo en español por notificación. */
  readonly notifViews = computed(() => this.notifs.notifications().map((n) => notificationView(n)));

  /**
   * The selected group's open room still waiting for players, if any. Surfaced as
   * a pending-room banner so members can jump in without hunting for the notification.
   */
  readonly pendingRoom = computed<LobbyResponse | null>(() => {
    const g = this.groups.selected();
    if (!g) return null;
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

  toggleDownload(): void {
    this.showDownload.update((v) => !v);
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

  /**
   * ¿Se ve la lista de grupos bajo la entrada "Grupos"? En rail va siempre abierta:
   * los avatares SON la lista (no hay etiqueta que plegar), y un plegable de 68px
   * de ancho sin texto no comunica nada.
   */
  readonly groupsOpen = computed(() => this.railed() || this.groupsExpanded());

  /**
   * Clic en la entrada "Grupos". Desplegada, pliega/despliega la lista; en rail no
   * hay nada que plegar, así que navega a la gestión de grupos en vez de dejar un
   * control muerto.
   */
  onGroupsNav(): void {
    if (this.railed()) {
      void this.router.navigate(['/app', 'grupos']);
      return;
    }
    this.groupsExpanded.update((v) => !v);
  }

  /** Sidebar item / sheet entry: mark active AND open its detail view. */
  selectGroup(id: string): void {
    this.groups.select(id);
    this.showGroupSheet.set(false);
    this.router.navigate(['/app', 'grupos', id]);
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

  /** Marca toda la bandeja como leída (limpia el badge). No hay borrado en el backend. */
  markAllRead(event: Event): void {
    event.stopPropagation();
    void this.notifs.markAllRead();
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
  }

  /** Trae la siguiente página de la bandeja. */
  loadMoreNotifs(): void {
    void this.notifs.loadMore();
  }

  /**
   * Abre la notificación: navega a donde apunte, cierra el panel y la da por leída. Genérico
   * a propósito (lee `view.link`, no el `type`): el siguiente tipo que lleve a algún sitio solo
   * tiene que rellenar el enlace en `notificationView`, sin tocar la campana.
   *
   * Navega sin esperar al `markRead`: es una escritura de comodidad —optimista y con rollback
   * dentro del store, nunca rechaza—, y una red lenta no debe retrasar el clic. Una ya leída
   * la descarta el propio store.
   */
  openNotif(view: NotificationView): void {
    if (!view.link) return;
    this.closeNotifications();
    void this.router.navigate([...view.link]);
    void this.notifs.markRead(view.id);
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
    try {
      if (accept) await this.invitations.accept(invite.invitationId);
      else await this.invitations.decline(invite.invitationId);
      await this.notifs.markRead(view.id);
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

    // Alguien convocó o se apuntó: el banner se actualiza solo.
    effect(() => {
      const nudge = this.notifs.lastNudge();
      const g = this.groups.selected();
      if (nudge?.event === 'lobby' && g && nudge.data['groupId'] === g.id) {
        void this.lobbies.reload();
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
        const seg = url.split('/').filter(Boolean).pop() ?? 'inicio';
        const item = this.nav.find((n) => n.path === seg);
        // A group detail route (/app/grupos/:id) still belongs to the "Grupos" section.
        const title = item?.title ?? (this.groups.byId(seg) ? 'Grupos' : 'Inicio');
        this.pageTitle.set(title);
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
