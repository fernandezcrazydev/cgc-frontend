import { Injectable, computed, signal } from '@angular/core';
import { Member } from './lobby';

/** How the room was assembled (mirrors the create-match wizard modes). */
export type RoomMode = 'open' | 'manual';

/**
 * Lifecycle of a match room:
 * - `drafting`: the admin is configuring it in the create-match wizard. The
 *   in-progress config (`draft`) streams here so other members can follow live.
 * - `waiting`: published and pending players (an open room still filling up).
 * - `live`: the 5v5 is configured and in progress.
 * Finished matches drop out of the store and live in the history instead.
 */
export type RoomStatus = 'drafting' | 'waiting' | 'live';

/** A player's chosen lines in the live draft (display-ready). */
export interface DraftLine {
  tag: string;
  name: string;
  initials: string;
  hue: number;
  /** Short role labels, e.g. ['MID', 'ADC']. */
  roles: string[];
}

/** A relationship rule in the live draft (display-ready, resolved to names). */
export interface DraftRule {
  kind: 'together' | 'versus' | 'lane';
  aNames: string[];
  bNames: string[];
}

/** A reserved champion in the live draft (display-ready). */
export interface DraftReserve {
  tag: string;
  name: string;
  champ: string;
  champInitials: string;
  champC1: string;
  champC2: string;
}

/** Raw step-3 rule (admin-side shape), kept so the wizard can resume losslessly. */
export interface DraftRawRule {
  id: number;
  kind: 'together' | 'versus' | 'lane';
  a: string[];
  b: string[];
}

/**
 * Raw editor state (the wizard's signals, by tag/key — NOT resolved for display).
 * Only the admin's wizard reads this, to rehydrate when resuming an abandoned
 * draft. The follower view ignores it and uses the display-ready fields instead.
 */
export interface DraftRaw {
  step: number;
  selectedTags: string[];
  /** tag -> explicit line role keys (TOP/JUNGLA/MID/ADC/SUPPORT); absent = profile. */
  lineRoles: Record<string, string[]>;
  rules: DraftRawRule[];
  /** tag -> reserved champion name. */
  reserved: Record<string, string>;
}

/**
 * The wizard config as it's being built, streamed into the room.
 *
 * Two faces, on purpose:
 * - The top-level fields (participants/lines/rules/reserved) are DISPLAY-READY
 *   (names + short labels resolved) so the spectator/follower view needs zero
 *   business logic to render the live config.
 * - `raw` carries the unresolved editor state so the admin's wizard can REHYDRATE
 *   and resume an abandoned draft exactly where it was left.
 *
 * BACKEND NOTE: in production this snapshot is what gets pushed over the realtime
 * channel (WebSocket) on every admin change; followers subscribe and re-render.
 */
export interface DraftSnapshot {
  /** Which wizard step (1-5) the admin is on. */
  step: number;
  participants: Member[];
  lines: DraftLine[];
  rules: DraftRule[];
  reserved: DraftReserve[];
  raw: DraftRaw;
}

/** One assigned seat in a launched match's lineup (display-ready). */
export interface RoomTeamSlot {
  roleKey: string;
  roleLabel: string;
  member: Member;
  /** Internal elo at launch time. */
  elo: number;
  /** Reserved champion, or null. */
  champ: { name: string; initials: string; c1: string; c2: string } | null;
  /**
   * A GUEST is someone who played but isn't in the group (resolved from an import
   * conflict). They're a GHOST: shown for an accurate lineup but counting for
   * NOTHING — no MMR, no group stats, no winrate, no favourite-victim, nada.
   * BACKEND must exclude guests from every calculation.
   */
  guest?: boolean;
}

/** The Blue-vs-Red lineup produced by matchmaking, frozen onto a live room. */
export interface RoomTeams {
  blue: RoomTeamSlot[];
  red: RoomTeamSlot[];
}

/** Per-player internal-MMR change from a decided match. */
export interface MmrChange {
  tag: string;
  name: string;
  /** Signed delta (winners positive, losers negative). */
  delta: number;
}

/**
 * The outcome of a defined match.
 *
 * WHO CAN SET IT (BACKEND must enforce — identity is server-side):
 * - `manual`: ADMIN ONLY, one tap behind a confirm dialog. Carries only lineup
 *   data (players / lanes / champ intentions), NO real per-player stats.
 * - `import`: ANY participant, via the desktop scraper "export". The data is the
 *   same for everyone and not manipulable, so anyone can upload it. It brings
 *   REAL per-player stats and is the SOURCE OF TRUTH (overwrites a manual result).
 *
 * UNDO: a mistaken result can be reverted to "undecided" (clearResult).
 *
 * IMPORT ↔ HISTORY (see ImportConflict): conflicts are resolved IN THE SALA, before
 * the result is set. Only a CONFLICT-FREE import enters the history. Once a match
 * is in the history it is IMMUTABLE — it can only be DELETED (so it counts neither
 * for nor against anyone). A manually-decided match can later be enriched with real
 * data by any player's desktop export, but only if that import has no conflicts.
 */
export interface MatchResult {
  winner: 'blue' | 'red' | 'cancelled';
  source: 'manual' | 'import';
  /** Empty for a cancelled match; guests always get a 0 delta and don't count. */
  mmr: MmrChange[];
  decidedAt: number;
}

/** A discrepancy between the imported match data and the configured lineup. */
export type ImportConflictKind = 'unknown-player' | 'wrong-position';

/**
 * One conflict the admin must resolve in the sala before the import is accepted:
 * - `unknown-player`: someone in the JSON wasn't in the room. Resolve by swapping
 *   them in for a room player; if they're not in the group either, they come in as
 *   a GUEST ghost (see RoomTeamSlot.guest).
 * - `wrong-position`: a room player played a different role than they were assigned.
 *   Resolve by accepting the real position (re-map their lane).
 * BACKEND NOTE: the recalculations (MMR, stats) must honour the resolved lineup,
 * not the originally-configured one.
 */
export interface ImportConflict {
  id: string;
  kind: ImportConflictKind;
  /** Human-readable description shown in the resolution panel. */
  detail: string;
  /** Tag from the JSON (unknown-player) or the room player involved. */
  subjectTag: string;
  subjectName: string;
  /** wrong-position only: the assigned vs actually-played role labels. */
  expectedRole?: string;
  actualRole?: string;
  /** How the admin chose to fix it (null until resolved). */
  resolution: 'replace' | 'guest' | 'accept-position' | null;
}

/** A match room / lobby tied to a group. */
export interface MatchRoom {
  /** Stable id used in the URL (`/app/grupos/:id/partidas/:roomId`). */
  id: string;
  groupId: string;
  /** Short human code shown in the lobby title, e.g. "WX4K". */
  code: string;
  mode: RoomMode;
  status: RoomStatus;
  /** Seats a full 5v5 needs (always 10 for now). */
  capacity: number;
  /** Seats taken so far; seat 0 is the captain who opened the room. */
  seats: Member[];
  /** Display name of whoever opened the room. */
  openedBy: string;
  createdAt: number;
  /** Live wizard config while `status === 'drafting'`. */
  draft?: DraftSnapshot;
  /** Frozen Blue/Red lineup once `status === 'live'` (from the wizard's matchmaking). */
  teams?: RoomTeams;
  /** Outcome once the match has been decided (manual or import). */
  result?: MatchResult;
}

const CAPACITY = 10;

/**
 * How long an abandoned `drafting` room survives before it's auto-discarded.
 * Policy: if the admin walks away mid-configuration, the draft is KEPT so they
 * (or another admin) can resume it; only after 24h with no activity is it pruned.
 * BACKEND NOTE: the real expiry is server-side (a TTL / scheduled job). Here it's
 * enforced client-side on read so stale drafts disappear from the UI.
 */
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/** Random uppercase code (e.g. "A3F2") used in lobby titles. */
function makeCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

/** Build a plausible seed seat from a pool name (EUW, mirrors the group roster). */
function seedSeat(name: string, i: number, owner = false): Member {
  return {
    name,
    tag: `${name}#EUW`,
    initials: name.slice(0, 2).toUpperCase(),
    role: owner ? 'CAPITÁN · ABRIÓ LA SALA' : 'APUNTADO',
    owner,
    hue: (i * 47) % 360,
  };
}

/** Mock rooms so the feature is visible on first paint (scrim-squad, as requested). */
function seedRooms(): MatchRoom[] {
  const pool = ['Pix3lQueen', 'Cr1msonByte', 'D4rkFl4me', 'V0idWalker', 'NeonRift',
    'GlitchKid', 'St0rmcaller', 'HexHunter', 'AshenWolf', 'LumeCore'];
  const now = Date.now();
  return [
    {
      id: 'scrim-squad-wx4k',
      groupId: 'scrim-squad',
      code: 'WX4K',
      mode: 'open',
      status: 'waiting',
      capacity: CAPACITY,
      seats: pool.slice(0, 6).map((n, i) => seedSeat(n, i, i === 0)),
      openedBy: 'Pix3lQueen',
      createdAt: now - 4 * 60_000,
    },
    {
      id: 'scrim-squad-a3f2',
      groupId: 'scrim-squad',
      code: 'A3F2',
      mode: 'open',
      status: 'live',
      capacity: CAPACITY,
      seats: pool.map((n, i) => seedSeat(n, i, i === 0)),
      openedBy: 'St0rmcaller',
      createdAt: now - 35 * 60_000,
    },
  ];
}

/**
 * Shared, app-wide store of match rooms. A room has three lifecycle phases (see
 * RoomStatus): `drafting` (admin configuring, others follow live) → `waiting`
 * (open room filling up) or straight to `live` (5v5 in progress). Rooms here
 * drive the group's active-match list, the lobby/sala detail, the live follower
 * view and the pending-room banner in the shell.
 *
 * Sources that WRITE here:
 * - create-match wizard (manual): startDraft → syncDraft (live) → promoteToLive.
 * - create-match wizard (open):   openRoom → addSeat/removeSeat → (promote later).
 *
 * BACKEND NOTE: today everything is in-memory signals (single browser instance,
 * no cross-user sync). To make followers see another user's draft in real time,
 * back these methods with a realtime channel (WebSocket): writes broadcast, reads
 * subscribe. The method shapes are designed so only the data source changes.
 */
@Injectable({ providedIn: 'root' })
export class MatchStore {
  private readonly rooms = signal<MatchRoom[]>(seedRooms());

  /** A drafting room is "expired" once abandoned for longer than the TTL. */
  private isExpired(r: MatchRoom): boolean {
    return r.status === 'drafting' && Date.now() - r.createdAt > DRAFT_TTL_MS;
  }

  byId(id: string): MatchRoom | undefined {
    const r = this.rooms().find((x) => x.id === id);
    // Hide drafts past the 24h TTL (treated as gone until the backend prunes them).
    return r && !this.isExpired(r) ? r : undefined;
  }

  /** All active rooms for a group, newest first (expired drafts excluded). */
  activeOf(groupId: string): MatchRoom[] {
    return this.rooms()
      .filter((r) => r.groupId === groupId && !this.isExpired(r))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /** Physically drop drafts past the TTL. BACKEND NOTE: a scheduled job owns this. */
  pruneStaleDrafts(): void {
    this.rooms.update((list) => list.filter((r) => !this.isExpired(r)));
  }

  /** Rooms still pending players (waiting + not yet full) for a group. */
  waitingOf(groupId: string): MatchRoom[] {
    return this.activeOf(groupId).filter(
      (r) => r.status === 'waiting' && r.seats.length < r.capacity,
    );
  }

  /**
   * Open (or resume) an open room for a group. Idempotent: if the captain already
   * has a waiting open room here, that one is returned instead of creating a copy.
   * Seat 0 is the captain who opened it.
   */
  openRoom(groupId: string, captain: Member): MatchRoom {
    const existing = this.waitingOf(groupId).find(
      (r) => r.mode === 'open' && r.openedBy === captain.name,
    );
    if (existing) return existing;
    const room: MatchRoom = {
      id: `${groupId}-${makeCode().toLowerCase()}`,
      groupId,
      code: makeCode(),
      mode: 'open',
      status: 'waiting',
      capacity: CAPACITY,
      seats: [{ ...captain, role: 'CAPITÁN · ABRIÓ LA SALA' }],
      openedBy: captain.name,
      createdAt: Date.now(),
    };
    this.rooms.update((list) => [...list, room]);
    return room;
  }

  /**
   * Start (or resume) a manual draft room. Created the moment the admin opens the
   * create-match wizard so the group can follow the configuration live.
   *
   * Idempotent per captain: if this captain already has a (non-expired) drafting
   * room here, it's returned untouched — so an admin who walked away and comes
   * back gets the SAME room, and the wizard rehydrates from its `draft.raw`. The
   * draft is only discarded by an explicit cancel, by launch (promoteToLive), or
   * by the 24h TTL. Seat 0 is the captain.
   */
  startDraft(groupId: string, captain: Member): MatchRoom {
    const existing = this.activeOf(groupId).find(
      (r) => r.status === 'drafting' && r.openedBy === captain?.name,
    );
    if (existing) return existing;
    const room: MatchRoom = {
      id: `${groupId}-${makeCode().toLowerCase()}`,
      groupId,
      code: makeCode(),
      mode: 'manual',
      status: 'drafting',
      capacity: CAPACITY,
      seats: captain ? [{ ...captain }] : [],
      openedBy: captain?.name ?? '',
      createdAt: Date.now(),
      draft: {
        step: 1,
        participants: [],
        lines: [],
        rules: [],
        reserved: [],
        raw: { step: 1, selectedTags: [], lineRoles: {}, rules: [], reserved: {} },
      },
    };
    this.rooms.update((list) => [...list, room]);
    return room;
  }

  /** Stream the wizard's current config into a drafting room (the admin's writes). */
  syncDraft(roomId: string, snapshot: DraftSnapshot): void {
    this.rooms.update((list) =>
      list.map((r) =>
        r.id === roomId && r.status === 'drafting'
          ? { ...r, draft: snapshot, seats: snapshot.participants }
          : r,
      ),
    );
  }

  /**
   * Promote a drafting room to a live match (on "lanzar"), freezing the generated
   * Blue/Red lineup onto it. Returns the room.
   */
  promoteToLive(roomId: string, teams?: RoomTeams): MatchRoom | undefined {
    let promoted: MatchRoom | undefined;
    this.rooms.update((list) =>
      list.map((r) => {
        if (r.id !== roomId) return r;
        promoted = { ...r, status: 'live', seats: r.draft?.participants ?? r.seats, teams };
        return promoted;
      }),
    );
    return promoted;
  }

  /**
   * Record a match outcome (manual or import). Import is the source of truth, so
   * it overwrites a manual result. BACKEND NOTE: this is where the result would
   * be persisted, fan out the MMR updates and append a history record.
   */
  setResult(roomId: string, result: MatchResult): void {
    this.rooms.update((list) =>
      list.map((r) => {
        if (r.id !== roomId) return r;
        // Don't let a manual result clobber an existing import (import wins).
        if (r.result?.source === 'import' && result.source === 'manual') return r;
        return { ...r, result };
      }),
    );
  }

  /** Clear the result so the same room can host the next match (rematch). */
  clearResult(roomId: string): void {
    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, result: undefined } : r)),
    );
  }

  /** Replace the lineup for the next match in the same room (rematch / rebalance). */
  setTeams(roomId: string, teams: RoomTeams): void {
    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, teams, result: undefined } : r)),
    );
  }

  /** Seat a member in a room (no-op when full or already seated). */
  addSeat(roomId: string, member: Member): void {
    this.rooms.update((list) =>
      list.map((r) => {
        if (r.id !== roomId) return r;
        if (r.seats.length >= r.capacity || r.seats.some((s) => s.tag === member.tag)) return r;
        return { ...r, seats: [...r.seats, member] };
      }),
    );
  }

  /** Free a seat by tag (the captain's seat 0 can't be vacated). */
  removeSeat(roomId: string, tag: string): void {
    this.rooms.update((list) =>
      list.map((r) =>
        r.id === roomId ? { ...r, seats: r.seats.filter((s) => s.owner || s.tag !== tag) } : r,
      ),
    );
  }

  /** Discard a room entirely (e.g. the captain cancels the open room). */
  remove(roomId: string): void {
    this.rooms.update((list) => list.filter((r) => r.id !== roomId));
  }
}
