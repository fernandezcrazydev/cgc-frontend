import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import {
  GroupInvitePayload,
  NAV,
  NOTIF_GLYPH,
  Notification,
  NotificationKind,
} from '../../core/lobby';
import { Auth, Session } from '../../core/auth';
import { GroupStore } from '../../core/group-store';
import { MatchStore, MatchRoom } from '../../core/match-store';
import { NotificationStore } from '../../core/notification-store';
import { ToastService } from '../../core/toast';
import { NfBadge, NfButton, NfSegmented, NfToastHost, NfWindow } from '../../ui';
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
    NfBadge,
    NfSegmented,
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
  readonly notifs = inject(NotificationStore);
  private readonly toasts = inject(ToastService);

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
  // State lives in NotificationStore so the bell and the home "Requiere tu
  // atención" panel stay in sync; the shell only owns the panel's open/close.
  readonly showNotifications = signal(false);

  glyphFor(kind: NotificationKind): string {
    return NOTIF_GLYPH[kind];
  }

  /** Opening the panel marks everything as read (clears the badge). */
  toggleNotifications(): void {
    const willOpen = !this.showNotifications();
    this.showNotifications.set(willOpen);
    if (willOpen) this.notifs.markAllRead();
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

  clearNotifications(event: Event): void {
    event.stopPropagation();
    this.notifs.clear();
  }

  // ── Group invitation review modal ─────────────────────────────────
  readonly reviewInvite = signal<GroupInvitePayload | null>(null);
  /** Id of the notification that opened the review modal, removed on response. */
  private reviewNotifId: number | null = null;

  /** Click a notification: group invites open the review modal; the rest are no-ops for now. */
  onNotificationClick(n: Notification): void {
    if (!n.groupInvite) return;
    this.reviewNotifId = n.id;
    this.reviewInvite.set(n.groupInvite);
    this.showNotifications.set(false);
  }

  closeInviteReview(): void {
    this.reviewInvite.set(null);
    this.reviewNotifId = null;
  }

  acceptInvite(): void {
    const invite = this.reviewInvite();
    if (!invite) return;
    const group = this.groups.joinFromInvite(invite);
    this.dismissReviewNotif();
    this.closeInviteReview();
    this.toasts.success(`Invitación aceptada · Te uniste a ${group.name}`);
    this.router.navigate(['/app', 'grupos', group.id]);
  }

  declineInvite(): void {
    const invite = this.reviewInvite();
    this.dismissReviewNotif();
    this.closeInviteReview();
    this.toasts.info(`Invitación a ${invite?.groupName ?? 'grupo'} rechazada`);
  }

  /** Drop the notification that triggered the review once it's been answered. */
  private dismissReviewNotif(): void {
    const id = this.reviewNotifId;
    if (id != null) this.notifs.dismiss(id);
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
    await this.auth.logout();
    await this.router.navigateByUrl('/');
  }
}
