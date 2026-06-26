import { Injectable, computed, signal } from '@angular/core';
import { Member } from './lobby';

/** How the room was assembled (mirrors the create-match wizard modes). */
export type RoomMode = 'open' | 'manual';

/**
 * Lifecycle of a match room:
 * - `waiting`: published and pending players (an open room still filling up).
 * - `live`: the 5v5 is configured and in progress.
 * Finished matches drop out of the store and live in the history instead.
 */
export type RoomStatus = 'waiting' | 'live';

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
}

const CAPACITY = 10;

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
 * Shared store of active match rooms across the app. Open rooms created from the
 * "sala abierta" wizard persist here so they show up in the group's active-match
 * list and as a pending-room banner in the shell while they fill up.
 */
@Injectable({ providedIn: 'root' })
export class MatchStore {
  private readonly rooms = signal<MatchRoom[]>(seedRooms());

  byId(id: string): MatchRoom | undefined {
    return this.rooms().find((r) => r.id === id);
  }

  /** All active rooms (waiting + live) for a group, newest first. */
  activeOf(groupId: string): MatchRoom[] {
    return this.rooms()
      .filter((r) => r.groupId === groupId)
      .sort((a, b) => b.createdAt - a.createdAt);
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
