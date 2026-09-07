import { describe, expect, it } from 'vitest';
import { normalizeLobby, normalizeSlot } from './lobby-normalizer';
import { LobbyParticipantResponse, LobbyResponse, LobbySlotResponse } from './models';

function makeUser(id: number): LobbyParticipantResponse {
  return {
    userId: `u-${id}`,
    discordUsername: `Player${id}`,
    avatarUrl: null,
    joinedAt: new Date(Date.now() - id * 60000).toISOString(),
    isActive: true,
  };
}

function makeUsers(count: number, start = 1): LobbyParticipantResponse[] {
  return Array.from({ length: count }, (_, i) => makeUser(start + i));
}

describe('lobby-normalizer', () => {
  it('keeps single room under capacity intact', () => {
    const slot: LobbySlotResponse = {
      id: 'slot-1',
      startsAt: new Date().toISOString(),
      signedUp: 7,
      starters: makeUsers(7),
      bench: [],
    };
    const norm = normalizeSlot(slot, 10, false, false);
    expect(norm.starters.length).toBe(7);
    expect(norm.secondaryStarters).toBeUndefined();
    expect(norm.bench.length).toBe(0);
  });

  it('partitions 12 users into 10 starters and 2 bench', () => {
    const slot: LobbySlotResponse = {
      id: 'slot-1',
      startsAt: new Date().toISOString(),
      signedUp: 12,
      starters: makeUsers(10),
      bench: makeUsers(2, 11),
    };
    const norm = normalizeSlot(slot, 10, false, false);
    expect(norm.starters.length).toBe(10);
    expect(norm.secondaryStarters).toBeUndefined();
    expect(norm.bench.length).toBe(2);
  });

  it('partitions 22 users in ROOMS into 2 contiguous rooms (Sala 1 & Sala 2) + 2 bench (FIFO)', () => {
    const slot: LobbySlotResponse = {
      id: 'slot-pru3',
      startsAt: new Date().toISOString(),
      signedUp: 22,
      starters: makeUsers(10),
      bench: makeUsers(12, 11), // 12 in bench originally
    };
    const norm = normalizeSlot(slot, 10, false, false);
    expect(norm.starters.length).toBe(10);
    expect(norm.secondaryStarters?.length).toBe(10);
    expect(norm.bench.length).toBe(2);
    expect(norm.roomName).toBe('Sala 1');
    expect(norm.secondaryRoomName).toBe('Sala 2');
  });

  it('partitions 23 users in PARTY into Sala A & Sala B with rotation debt on bench', () => {
    const slot: LobbySlotResponse = {
      id: 'slot-party',
      startsAt: new Date().toISOString(),
      signedUp: 23,
      starters: makeUsers(10),
      bench: makeUsers(13, 11),
    };
    const norm = normalizeSlot(slot, 10, true, false);
    expect(norm.starters.length).toBe(10);
    expect(norm.secondaryStarters?.length).toBe(10);
    expect(norm.bench.length).toBe(3);
    expect(norm.roomName).toBe('Sala A');
    expect(norm.secondaryRoomName).toBe('Sala B');
    expect(norm.partyRound).toBe(1);
    expect(norm.bench[0].rotationDebt).toBe(1);
  });

  it('partitions 27 users in PARTY into Sala A (10) & Sala B (10) + 7 waiting with rotation debt', () => {
    const slot: LobbySlotResponse = {
      id: 'slot-party-27',
      startsAt: new Date().toISOString(),
      signedUp: 27,
      starters: makeUsers(10),
      bench: makeUsers(17, 11),
    };
    const norm = normalizeSlot(slot, 10, true, false);
    expect(norm.signedUp).toBe(27);
    expect(norm.starters.length).toBe(10);
    expect(norm.secondaryStarters?.length).toBe(10);
    expect(norm.bench.length).toBe(7);
    expect(norm.roomName).toBe('Sala A');
    expect(norm.secondaryRoomName).toBe('Sala B');
    expect(norm.partyRound).toBe(1);
    expect(norm.bench.every((p) => p.rotationDebt === 1)).toBe(true);
  });

  it('preserves all users in starters pool when PARTY_POOL', () => {
    const slot: LobbySlotResponse = {
      id: 'slot-pool',
      startsAt: new Date().toISOString(),
      signedUp: 14,
      starters: makeUsers(14),
      bench: [],
    };
    const norm = normalizeSlot(slot, 10, true, true);
    expect(norm.starters.length).toBe(14);
    expect(norm.secondaryStarters).toBeUndefined();
    expect(norm.bench.length).toBe(0);
  });

  it('normalizes entire lobby object and detects party distribution', () => {
    const lobby: LobbyResponse = {
      id: 'lb-party',
      groupId: 'g-1',
      code: 'PRTY-01',
      mode: 'OPEN',
      status: 'LIVE',
      capacity: 10,
      note: 'Viernes de party en rotacion',
      openedBy: makeUser(1),
      confirmedSlotId: 's-1',
      createdAt: new Date().toISOString(),
      slots: [
        {
          id: 's-1',
          startsAt: new Date().toISOString(),
          signedUp: 23,
          starters: makeUsers(10),
          bench: makeUsers(13, 11),
        },
      ],
    };
    const norm = normalizeLobby(lobby);
    expect(norm.distribution).toBe('PARTY');
    expect(norm.subType).toBe('PARTY_ROUNDS');
    expect(norm.slots[0].secondaryStarters?.length).toBe(10);
    expect(norm.slots[0].bench.length).toBe(3);
    expect(norm.slots[0].roomName).toBe('Sala A');
    expect(norm.slots[0].secondaryRoomName).toBe('Sala B');
  });

  /**
   * Hasta el 2026-09-07 el normalizador leia el texto de la nota para adivinar la
   * modalidad y el reparto. Con la descripcion libre de mil caracteres eso pasaba de
   * heuristica inofensiva a fallo real, y se retiro.
   */
  it('la descripcion no decide ni el reparto ni la modalidad', () => {
    const lobby: LobbyResponse = {
      id: 'lb-texto',
      groupId: 'g-1',
      code: 'WX4K',
      mode: 'OPEN',
      status: 'POLLING',
      capacity: 10,
      note: 'Venimos con ganas de caos y de party competitivo, nada de rotacion',
      openedBy: makeUser(1),
      confirmedSlotId: null,
      createdAt: new Date().toISOString(),
      slots: [],
    };

    const norm = normalizeLobby(lobby);

    expect(norm.distribution).toBe('ROOMS');
    expect(norm.modality).toBe('BALANCED');
  });

  it('la descripcion se devuelve tal cual, sin reescribir', () => {
    const note = 'Traed micro (FIFO) y 10 titulares + 12 suplentes';
    const lobby: LobbyResponse = {
      id: 'lb-nota',
      groupId: 'g-1',
      code: 'WX4K',
      mode: 'OPEN',
      status: 'POLLING',
      capacity: 10,
      note,
      openedBy: makeUser(1),
      confirmedSlotId: null,
      createdAt: new Date().toISOString(),
      slots: [],
    };

    expect(normalizeLobby(lobby).note).toBe(note);
  });
});
