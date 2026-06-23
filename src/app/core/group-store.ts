import { Injectable, computed, signal } from '@angular/core';
import { GROUPS, Group } from './lobby';

/** Fields the user supplies when creating a group; the rest is derived. */
export interface NewGroupInput {
  name: string;
  /** Server region, e.g. "EUW" / "BR" / "NA". */
  region: string;
}

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

  /**
   * Create a new group from user input, derive the avatar/initials, banner
   * colors and a unique slug id, append it to the list and select it.
   * Returns the created group so callers can navigate to its detail page.
   */
  add(input: NewGroupInput): Group {
    const name = input.name.trim();
    const region = input.region.trim().toUpperCase() || 'LAN';
    const group: Group = {
      id: this.uniqueId(name),
      name,
      // No tag field in the form anymore; the region doubles as the card subtitle.
      tag: `${region} · PERSONALIZADO`,
      initials: this.initialsOf(name),
      // The creator is always the owner of the group they create.
      role: 'OWNER',
      members: 1,
      ...this.banner(),
    };
    this.groups.update((list) => [...list, group]);
    this._selectedId.set(group.id);
    return group;
  }

  /** Two-letter avatar from the group name (first letters of the first words). */
  private initialsOf(name: string): string {
    const words = name.split(/\s+/).filter(Boolean);
    const letters = (words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2));
    return letters.toUpperCase() || 'GR';
  }

  /** URL-safe slug, suffixed with a counter if it collides with an existing id. */
  private uniqueId(name: string): string {
    const base =
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'grupo';
    let id = base;
    let n = 2;
    while (this.byId(id)) id = `${base}-${n++}`;
    return id;
  }

  /** Random hue for the banner gradient, matching the seed-group palette. */
  private banner(): Pick<Group, 'c1' | 'c2'> {
    const hue = Math.floor(Math.random() * 360);
    return { c1: `hsl(${hue},90%,62%)`, c2: `hsl(${(hue + 18) % 360},78%,32%)` };
  }
}
