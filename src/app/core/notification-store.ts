import { Injectable, computed, inject, signal } from '@angular/core';
import { Group, NOTIFICATIONS, Notification } from './lobby';
import { GroupStore } from './group-store';

/**
 * Shared, app-wide notification state. Lifted out of the shell so the header
 * bell AND the home "Requiere tu atención" panel read/write the SAME list:
 * accepting an invite (or dismissing a request) in one place updates the other.
 *
 * BACKEND NOTE: today this is an in-memory seed (NOTIFICATIONS). In production
 * the list streams from the server (and accept/decline hit real endpoints); only
 * the data source changes — the method shapes stay.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly groups = inject(GroupStore);

  readonly notifications = signal<Notification[]>(NOTIFICATIONS);

  readonly unreadCount = computed(() => this.notifications().filter((n) => n.unread).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  /**
   * Items that need a yes/no from the user — group invites, match invites and
   * group join requests. The home panel surfaces exactly these; informational
   * kinds (`result`, `system`) stay in the bell's history only.
   */
  readonly actionable = computed(() =>
    this.notifications().filter((n) => n.kind === 'invite' || n.kind === 'join'),
  );

  /** Mark everything as read (clears the bell badge). */
  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, unread: false })));
  }

  /** Drop every notification (the bell's "limpiar"). */
  clear(): void {
    this.notifications.set([]);
  }

  /** Remove a single notification once it's been answered. */
  dismiss(id: number): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  /**
   * Accept a group invitation: join the group (via the GroupStore) and drop the
   * notification. Returns the joined group so the caller can toast / navigate,
   * or null when the notification carries no invite payload.
   */
  acceptGroupInvite(n: Notification): Group | null {
    if (!n.groupInvite) return null;
    const group = this.groups.joinFromInvite(n.groupInvite);
    this.dismiss(n.id);
    return group;
  }
}
