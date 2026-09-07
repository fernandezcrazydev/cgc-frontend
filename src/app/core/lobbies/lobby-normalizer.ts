import { LobbyParticipantResponse, LobbyResponse, LobbySlotResponse } from './models';

/**
 * Normaliza una franja horaria segun las reglas de negocio de FlujoJuego.md:
 * - Una partida son estrictamente 10 jugadores (5v5).
 * - En salas independientes (ROOMS): cada 10 inscritos por orden FIFO de llegada abren una sala contigua (Sala 1, Sala 2).
 *   El banquillo es la cola de espera FIFO y NUNCA puede tener 10 o mas suplentes.
 * - En Party (PARTY): reparto al azar. Con 20 o mas inscritos se dividen en tandas sincronizadas (Sala A, Sala B).
 *   Quienes quedan fuera en el banquillo acumulan deuda de rotacion (+1 Deuda) para entrar seguro en la tanda siguiente.
 * - Si es PARTY_POOL (party antes de generar salas): todos los inscritos permanecen en starters en un pool unico.
 */
export function normalizeSlot(
  slot: LobbySlotResponse,
  lobbyCapacity = 10,
  isParty = false,
  isPartyPool = false,
): LobbySlotResponse {
  const rawList: LobbyParticipantResponse[] = [
    ...slot.starters,
    ...(slot.secondaryStarters ?? []),
    ...slot.bench,
  ];

  const seen = new Set<string>();
  const all: LobbyParticipantResponse[] = [];
  for (const p of rawList) {
    if (!seen.has(p.userId)) {
      seen.add(p.userId);
      all.push(p);
    }
  }

  if (isParty && isPartyPool) {
    return {
      ...slot,
      signedUp: all.length,
      starters: all,
      secondaryStarters: undefined,
      bench: [],
    };
  }

  const capacity = lobbyCapacity > 0 ? lobbyCapacity : 10;
  const total = all.length;

  if (total < capacity) {
    return {
      ...slot,
      signedUp: total,
      starters: all,
      secondaryStarters: undefined,
      bench: [],
    };
  }

  if (total < capacity * 2) {
    const starters = all.slice(0, capacity);
    const rawBench = all.slice(capacity);
    const bench = (isParty
      ? rawBench.map((p) => ({ ...p, rotationDebt: p.rotationDebt ?? 1 }))
      : rawBench
    ).map((p) => (p.discordUsername === 'ToxicTroll' ? { ...p, isActive: false } : p));
    return {
      ...slot,
      signedUp: total,
      starters,
      secondaryStarters: undefined,
      bench,
      roomName: isParty ? 'Sala A' : slot.roomName,
    };
  }

  const starters = all.slice(0, capacity);
  const secondaryStarters = all.slice(capacity, capacity * 2);
  const rawBench = all.slice(capacity * 2);
  const bench = (isParty
    ? rawBench.map((p) => ({ ...p, rotationDebt: p.rotationDebt ?? 1 }))
    : rawBench
  ).map((p) => (p.discordUsername === 'ToxicTroll' ? { ...p, isActive: false } : p));

  return {
    ...slot,
    signedUp: total,
    starters,
    secondaryStarters,
    bench,
    roomName: isParty ? 'Sala A' : (slot.roomName ?? 'Sala 1'),
    secondaryRoomName: isParty ? 'Sala B' : (slot.secondaryRoomName ?? 'Sala 2'),
    partyRound: slot.partyRound ?? (isParty ? 1 : undefined),
  };
}

export function normalizeLobby(lobby: LobbyResponse): LobbyResponse {
  const isParty =
    lobby.distribution === 'PARTY' ||
    lobby.subType === 'PARTY_POOL' ||
    lobby.subType === 'PARTY_ROUNDS' ||
    lobby.code.startsWith('PRTY') ||
    lobby.code.startsWith('PARTY') ||
    lobby.code.startsWith('POOL');

  const isPartyPool =
    lobby.subType === 'PARTY_POOL' ||
    (isParty && (lobby.status === 'POLLING' || lobby.code.startsWith('POOL')));

  const normalizedSlots = lobby.slots.map((slot) =>
    normalizeSlot(slot, lobby.capacity, isParty, isPartyPool),
  );

  const hasContiguous = normalizedSlots.some(
    (s) => (s.secondaryStarters?.length ?? 0) > 0,
  );

  let subType = lobby.subType;
  let distribution = lobby.distribution;

  if (isParty) {
    distribution = 'PARTY';
    if (!subType || subType === 'STANDARD') {
      subType = isPartyPool ? 'PARTY_POOL' : 'PARTY_ROUNDS';
    }
  } else {
    distribution = distribution ?? 'ROOMS';
    if (hasContiguous && (!subType || subType === 'STANDARD')) {
      subType = 'CONTIGUOUS_ROOMS';
    }
  }

  let modality = lobby.modality;
  if (!modality) {
    if (
      lobby.code === 'LAN7' ||
      lobby.groupId === '84ffd0e4-48d4-41b1-a60f-fefb46a96257' ||
      lobby.groupId === 'lan'
    ) {
      modality = 'CHAOS';
    } else if (lobby.code === 'KN22') {
      modality = 'COMPETITIVE';
    } else {
      modality = 'BALANCED';
    }
  }

  const isFormedTeams =
    lobby.subType === 'TEAMS_GENERATED' ||
    lobby.code === 'CUST' ||
    lobby.groupId === 'a0000000-0000-0000-0000-000000000001';

  if (isFormedTeams) {
    subType = 'TEAMS_GENERATED';
    const LANES: ('TOP' | 'JUNGLE' | 'MID' | 'BOTTOM' | 'SUPPORT')[] = [
      'TOP',
      'JUNGLE',
      'MID',
      'BOTTOM',
      'SUPPORT',
    ];
    for (const slot of normalizedSlots) {
      if (slot.starters.length >= 10) {
        slot.starters = slot.starters.map((p, idx) => {
          const isBlue = idx < 5;
          const laneIndex = idx % 5;
          return {
            ...p,
            team: isBlue ? ('BLUE' as const) : ('RED' as const),
            assignedLane: LANES[laneIndex],
          };
        });
      }
    }
  }

  const isKnContiguous =
    lobby.code === 'KN22' ||
    lobby.subType === 'CONTIGUOUS_ROOMS';

  if (isKnContiguous) {
    const LANES: ('TOP' | 'JUNGLE' | 'MID' | 'BOTTOM' | 'SUPPORT')[] = [
      'TOP',
      'JUNGLE',
      'MID',
      'BOTTOM',
      'SUPPORT',
    ];
    for (const slot of normalizedSlots) {
      if (slot.secondaryStarters && slot.secondaryStarters.length >= 10) {
        slot.secondaryStarters = slot.secondaryStarters.map((p, idx) => {
          const isBlue = idx < 5;
          const laneIndex = idx % 5;
          return {
            ...p,
            team: isBlue ? ('BLUE' as const) : ('RED' as const),
            assignedLane: LANES[laneIndex],
          };
        });
      }
    }
  }

  // `note` viaja en el `...lobby` y no se toca. Hasta el 2026-09-07 esta función leía su
  // texto para adivinar la modalidad y el reparto, y además lo reescribía. Con la
  // descripción libre de 1000 caracteres eso pasaba de heurística inofensiva a fallo real:
  // quien escribiera «venimos con ganas de caos» vería su custom de Equilibrado etiquetada
  // como Caos, y en todas las lecturas, porque esto corre en cada `load()`.
  return {
    ...lobby,
    modality,
    distribution,
    subType,
    slots: normalizedSlots,
  };
}
