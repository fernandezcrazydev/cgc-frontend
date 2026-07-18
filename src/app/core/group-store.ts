import { Injectable, computed, signal } from '@angular/core';
import { CURRENT_USER, GROUPS, Group, Member } from './lobby';

/** Deterministic name pool used to seed mock rosters for the seed groups. */
const MEMBER_POOL = [
  'Pix3lQueen', 'Cr1msonByte', 'D4rkFl4me', 'V0idWalker', 'NeonRift',
  'GlitchKid', 'St0rmcaller', 'HexHunter', 'AshenWolf', 'LumeCore',
  'Zer0Cool', 'ByteSiren',
];

const ROSTER_ROLES = ['CAPITÁN', 'TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT', 'SUPLENTE'];

/** "EUW · COMPETITIVO" → "EUW". Falls back to LAN when the tag has no region. */
function regionFromTag(tag: string): string {
  return tag.split('·')[0].trim().toUpperCase() || 'LAN';
}

/** Build a deterministic mock roster of `count` members for a seed group. */
function seedRoster(group: Group): Member[] {
  const region = regionFromTag(group.tag);
  return Array.from({ length: group.members }, (_, i) => {
    const name = MEMBER_POOL[i % MEMBER_POOL.length];
    return {
      name,
      tag: `${name}#${region}`,
      initials: name.slice(0, 2).toUpperCase(),
      role: i === 0 ? 'CAPITÁN · ' + group.role : ROSTER_ROLES[i % ROSTER_ROLES.length],
      owner: i === 0,
      hue: (i * 47) % 360,
    };
  });
}

/** The member entry for the current user as the owner of a freshly made group. */
function ownerMember(): Member {
  return {
    name: CURRENT_USER.name,
    tag: CURRENT_USER.tag,
    initials: CURRENT_USER.initials,
    role: 'CAPITÁN · OWNER',
    owner: true,
    hue: 320,
  };
}

/** Result of attempting to invite a tag to a group. */
export type InviteResult = { ok: true } | { ok: false; reason: 'invalid' | 'already-member' | 'already-pending' };

/** Accepts "Nombre#REGION" with a 2-16 char name and a 2-5 char region. */
const TAG_RE = /^.{2,16}#[A-Za-z0-9]{2,5}$/;

/** Fields the user supplies when creating a group; the rest is derived. */
export interface NewGroupInput {
  name: string;
  /** Server region, e.g. "EUW" / "BR" / "NA". */
  region: string;
  /** Optional group photo as a data URL. */
  avatar?: string | null;
}

/** Fields the user can change when editing an existing group. */
export interface EditGroupInput {
  name: string;
  region: string;
  avatar?: string | null;
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

  /** Live roster per group id (source of truth for membership). */
  private readonly rosters = signal<Record<string, Member[]>>(
    Object.fromEntries(GROUPS.map((g) => [g.id, seedRoster(g)])),
  );

  /** Pending outgoing invites per group id, stored as Riot-style tags. */
  private readonly pendingInvites = signal<Record<string, string[]>>({});

  /**
   * Perks pinned on each member, per group: `{ groupId: { memberTag: perkId[] } }`.
   * Owner/admin-curated gamestyle labels (see core/perks.ts). Empty until set.
   */
  private readonly perks = signal<Record<string, Record<string, string[]>>>({});

  select(id: string): void {
    this._selectedId.set(id);
  }

  byId(id: string): Group | undefined {
    return this.groups().find((g) => g.id === id);
  }

  /**
   * PUENTE TEMPORAL mock↔real. Registra la IDENTIDAD de un grupo real (por su UUID) para que
   * los sub-views placeholder de matchmaking (crear-partida, sala, partidas, ranking, stats,
   * historial) —que aún leen de este store mock— resuelvan su cabecera al navegar desde el
   * detalle real. Solo identidad + roster vacío: los datos de matchmaking siguen siendo mock
   * (vacíos) hasta que ese dominio migre al backend, momento en que este puente se borra.
   */
  ensureStub(group: Group): void {
    if (this.byId(group.id)) return;
    this.groups.update((list) => [...list, group]);
    this.rosters.update((map) => ({ ...map, [group.id]: [] }));
  }

  /** Reactive read of a group's members; empty array for unknown ids. */
  rosterOf(id: string): Member[] {
    return this.rosters()[id] ?? [];
  }

  /** Reactive read of a group's pending invite tags. */
  pendingOf(id: string): string[] {
    return this.pendingInvites()[id] ?? [];
  }

  /**
   * Invite a tag to a group. Validates the "Nombre#REGION" shape and rejects
   * tags that already belong to a member or already have a pending invite
   * (both case-insensitive). On success the tag is appended to the pending list
   * — the person becomes a real member only once they accept (backend pending).
   */
  inviteMember(id: string, rawTag: string): InviteResult {
    const tag = rawTag.trim();
    if (!TAG_RE.test(tag)) return { ok: false, reason: 'invalid' };
    const norm = tag.toLowerCase();
    if (this.rosterOf(id).some((m) => m.tag.toLowerCase() === norm)) {
      return { ok: false, reason: 'already-member' };
    }
    if (this.pendingOf(id).some((t) => t.toLowerCase() === norm)) {
      return { ok: false, reason: 'already-pending' };
    }
    this.pendingInvites.update((map) => ({ ...map, [id]: [...(map[id] ?? []), tag] }));
    return { ok: true };
  }

  /** Revoke a pending invite. */
  cancelInvite(id: string, tag: string): void {
    this.pendingInvites.update((map) => ({
      ...map,
      [id]: (map[id] ?? []).filter((t) => t !== tag),
    }));
  }

  /** Reactive read of a member's perk ids in a group; empty when none set. */
  perksOf(groupId: string, tag: string): string[] {
    return this.perks()[groupId]?.[tag] ?? [];
  }

  /**
   * Toggle a single perk on a member. The caller (UI) gates this behind the
   * owner/admin check; BACKEND NOTE: identity/authorization is revalidated
   * server-side once it exists — this is only for UX.
   */
  togglePerk(groupId: string, tag: string, perkId: string): void {
    this.perks.update((map) => {
      const forGroup = map[groupId] ?? {};
      const current = forGroup[tag] ?? [];
      const next = current.includes(perkId)
        ? current.filter((p) => p !== perkId)
        : [...current, perkId];
      return { ...map, [groupId]: { ...forGroup, [tag]: next } };
    });
  }

  /**
   * Remove a member from a group by name and keep the group's `members` count in
   * sync. Owners cannot be removed (the UI never offers it).
   */
  removeMember(id: string, name: string): void {
    this.rosters.update((map) => {
      const next = (map[id] ?? []).filter((m) => m.owner || m.name !== name);
      return { ...map, [id]: next };
    });
    this.syncCount(id);
  }

  /**
   * Promote or demote a member's administrator status by name. The owner is
   * never affected (the UI never offers it for the owner).
   */
  setAdmin(id: string, name: string, admin: boolean): void {
    this.rosters.update((map) => ({
      ...map,
      [id]: (map[id] ?? []).map((m) => (!m.owner && m.name === name ? { ...m, admin } : m)),
    }));
  }

  /** Force a group's `members` count to match its roster length. */
  private syncCount(id: string): void {
    const count = this.rosterOf(id).length;
    this.groups.update((list) => list.map((g) => (g.id === id ? { ...g, members: count } : g)));
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
      // No tag field in the form anymore; the region is the card subtitle.
      tag: region,
      initials: this.initialsOf(name),
      // The creator is always the owner of the group they create.
      role: 'OWNER',
      members: 1,
      ...this.banner(),
      avatar: input.avatar ?? undefined,
    };
    this.groups.update((list) => [...list, group]);
    // A brand-new group starts with just its creator on the roster.
    this.rosters.update((map) => ({ ...map, [group.id]: [ownerMember()] }));
    this._selectedId.set(group.id);
    return group;
  }

  /**
   * Update an existing group's editable fields (name, region subtitle and
   * photo). Returns the updated group, or undefined if the id is unknown.
   * Passing `avatar: null` clears the photo back to the initials fallback.
   */
  update(id: string, input: EditGroupInput): Group | undefined {
    const name = input.name.trim();
    const region = input.region.trim().toUpperCase() || 'LAN';
    let updated: Group | undefined;
    this.groups.update((list) =>
      list.map((g) => {
        if (g.id !== id) return g;
        updated = {
          ...g,
          name,
          tag: region,
          initials: this.initialsOf(name),
          avatar: input.avatar === null ? undefined : input.avatar ?? g.avatar,
        };
        return updated;
      }),
    );
    return updated;
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
