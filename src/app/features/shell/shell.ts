import { Component, DestroyRef, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { NAV } from '../../core/lobby';
import { Auth, Session } from '../../core/auth';
import { GroupStore } from '../../core/group-store';
import { InvitationsStore } from '../../core/groups';
import { MatchStore, MatchRoom } from '../../core/match-store';
import { NotificationsStore, NotificationView, notificationView } from '../../core/notifications';
import { ToastService } from '../../core/toast';
import { NfButton, NfSegmented, NfSkeleton, NfToastHost, NfWindow } from '../../ui';
import { ThemeService, THEMES } from '../../core/theme';
import { FeedbackDialog } from '../feedback/feedback-dialog';

/**
 * Sale perso app shell — desktop sidebar + sticky header + mobile bottom nav,
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
    NfSegmented,
    NfSkeleton,
    NfToastHost,
    FeedbackDialog,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly nav = NAV;
  /** El usuario real de la BD. El authGuard garantiza que ya está cargado. */
  readonly session = inject(Session);
  private readonly auth = inject(Auth);
  readonly groups = inject(GroupStore);
  private readonly matches = inject(MatchStore);
  /** Campana real: bandeja durable + stream SSE en vivo (reemplaza el mock legacy). */
  readonly notifs = inject(NotificationsStore);
  /** Invitaciones pendientes: fuente de verdad de "¿este invite sigue vivo?". */
  readonly invitations = inject(InvitationsStore);
  private readonly toasts = inject(ToastService);

  /** Vista de presentación de la bandeja: título/mensaje/tiempo en español por notificación. */
  readonly notifViews = computed(() => this.notifs.notifications().map((n) => notificationView(n)));

  /** Selector de tema (skin global): vive en el header, junto a feedback y campana. */
  readonly theme = inject(ThemeService);
  readonly themeOptions = THEMES.map((t) => ({ value: t.id, label: t.label }));

  /**
   * The selected group's open room still waiting for players, if any. Surfaced as
   * a pending-room banner so members can jump in without hunting for the notification.
   */
  readonly pendingRoom = computed<MatchRoom | null>(() => {
    const g = this.groups.selected();
    return g ? this.matches.waitingOf(g.id)[0] ?? null : null;
  });

  /** Jump into the pending room's lobby (also closes the mobile group sheet). */
  openPendingRoom(room: MatchRoom): void {
    this.showGroupSheet.set(false);
    this.router.navigate(['/app', 'grupos', room.groupId, 'partidas', room.id]);
  }

  readonly mobileLeft = NAV.slice(0, 2);
  readonly mobileRight = NAV.slice(2);

  readonly isMobile = signal(false);
  readonly pageTitle = signal('Inicio');
  readonly confirmLogout = signal(false);

  // ── Groups (sidebar dropdown + mobile sheet) ──────────────────────
  readonly groupsExpanded = signal(true);
  readonly showGroupSheet = signal(false);

  toggleGroups(): void {
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
      this.toasts.success(
        accept ? `Te uniste a ${invite.groupName}` : `Invitación a ${invite.groupName} rechazada`,
      );
      // BACKEND NOTE: al aceptar, el grupo aparecería en /me/groups; la lista de grupos de
      // la barra lateral sigue en mock, así que aún no se refresca aquí.
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
    // Campana real: cargar la bandeja durable y abrir el stream en vivo. El authGuard ya
    // garantiza sesión, así que hay token para el SSE. Las invitaciones pendientes dan el
    // "¿sigue vivo este invite?" al pintar las acciones.
    void this.notifs.ensureLoaded();
    this.notifs.connect();
    void this.invitations.ensureLoaded();

    // Una invitación nueva llega por SSE como notificación; recargar las pendientes para
    // que sus acciones (aceptar/rechazar) se habiliten al instante.
    effect(() => {
      const latest = this.notifs.lastArrived();
      if (latest?.type === 'INVITED_TO_GROUP') void this.invitations.reload();
    });

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
    // No dejar bandeja, stream abierto ni invitaciones del usuario anterior en memoria.
    this.notifs.clear();
    this.invitations.clear();
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
