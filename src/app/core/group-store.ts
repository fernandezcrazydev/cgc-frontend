import { Injectable, computed, signal } from '@angular/core';
import { GROUPS, Group } from './lobby';

/**
 * Shared "active group" state for the app shell. The selected group drives the
 * header banner (desktop + mobile) and is highlighted in the sidebar dropdown
 * and the mobile group sheet. Seeded with the first group so the banner is
 * visible from the first paint.
 */
@Injectable({ providedIn: 'root' })
export class GroupStore {
  readonly groups = signal<Group[]>(GROUPS);

  private readonly _selectedId = signal<string | null>(GROUPS[0]?.id ?? null);
  readonly selectedId = this._selectedId.asReadonly();

  /** The currently active group, or null when none is selected. */
  readonly selected = computed(
    () => this.groups().find((g) => g.id === this._selectedId()) ?? null,
  );

  select(id: string): void {
    this._selectedId.set(id);
  }

  byId(id: string): Group | undefined {
    return this.groups().find((g) => g.id === id);
  }
}
