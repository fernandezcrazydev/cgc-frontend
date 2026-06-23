import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import {
  CURRENT_USER,
  NAV,
  NOTIF_GLYPH,
  NOTIFICATIONS,
  Notification,
  NotificationKind,
} from '../../core/lobby';
import { NfButton, NfWindow } from '../../ui';

/**
 * NEXUS//FORGE app shell — desktop sidebar + sticky header + mobile bottom nav,
 * with a routed <router-outlet> for the five views. Port of the APP SHELL block
 * in Login.dc.html.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NfWindow, NfButton],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  readonly nav = NAV;
  readonly user = CURRENT_USER;

  readonly mobileLeft = NAV.slice(0, 2);
  readonly mobileRight = NAV.slice(2);

  readonly isMobile = signal(false);
  readonly pageTitle = signal('Inicio');
  readonly confirmLogout = signal(false);

  // ── Notifications (top-right bell + dropdown panel) ───────────────
  readonly notifications = signal<Notification[]>(NOTIFICATIONS);
  readonly showNotifications = signal(false);
  readonly unreadCount = computed(() => this.notifications().filter((n) => n.unread).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  glyphFor(kind: NotificationKind): string {
    return NOTIF_GLYPH[kind];
  }

  /** Opening the panel marks everything as read (clears the badge). */
  toggleNotifications(): void {
    const willOpen = !this.showNotifications();
    this.showNotifications.set(willOpen);
    if (willOpen) {
      this.notifications.update((list) => list.map((n) => ({ ...n, unread: false })));
    }
  }

  closeNotifications(): void {
    this.showNotifications.set(false);
  }

  clearNotifications(event: Event): void {
    event.stopPropagation();
    this.notifications.set([]);
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
        this.pageTitle.set(item?.title ?? 'Inicio');
      });
  }

  logout(): void {
    this.confirmLogout.set(false);
    this.router.navigateByUrl('/');
  }
}
