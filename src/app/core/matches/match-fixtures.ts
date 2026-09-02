/**
 * Constructores de partidas para las pruebas.
 *
 * Solo lo usan los `*.spec.ts`: ningún código de producción lo importa, así que no entra en el
 * bundle. Vive aquí y no dentro de un spec porque tres pruebas distintas —el cruce, la vista
 * del historial cruzado y el perfil— necesitan exactamente las mismas partidas mínimas, y
 * tener el mismo constructor copiado tres veces garantiza que dos de las copias se queden
 * atrás en cuanto el modelo cambie.
 *
 * Son partidas escritas a mano y no la semilla a propósito: lo que estas pruebas afirman es que
 * las derivaciones dicen la verdad, y sobre datos generados no se distingue un cálculo correcto
 * de uno que devuelve cualquier cosa.
 */
import { Match, MatchParticipant, TeamSide, TeamSummary } from './models';

export function participantFixture(
  over: Partial<MatchParticipant> & { id: string; team: TeamSide },
): MatchParticipant {
  return {
    userId: null,
    riotId: 'Jugador#LAN',
    isGuest: false,
    role: 'MID',
    championId: 1,
    championName: 'Campeón',
    championLevel: 18,
    wasAutofill: false,
    lpDelta: 0,
    stats: {
      kills: 2,
      deaths: 2,
      assists: 2,
      cs: 100,
      csPerMin: 5,
      gold: 10000,
      totalDamageToChampions: 10000,
      damageSharePercentage: 20,
      damageTaken: 10000,
      visionScore: 10,
      wardsPlaced: 5,
      wardsKilled: 1,
      items: [],
      spells: [4, 12],
    },
    ...over,
  };
}

export function teamFixture(
  side: TeamSide,
  won: boolean,
  participants: MatchParticipant[],
): TeamSummary {
  return {
    side,
    won,
    totalKills: 20,
    totalDeaths: 20,
    totalAssists: 40,
    totalGold: 50000,
    totalDamage: 50000,
    dragons: 1,
    barons: 0,
    towers: 5,
    participants,
  };
}

export function matchFixture(over: {
  id: string;
  groupId?: string;
  groupName?: string;
  decidedAt?: string;
  durationSeconds?: number;
  winningTeam?: TeamSide;
  blue: MatchParticipant[];
  red: MatchParticipant[];
  userParticipant?: MatchParticipant;
}): Match {
  const winningTeam = over.winningTeam ?? 'blue';
  const user = over.userParticipant;
  const groupId = over.groupId ?? 'g1';

  return {
    id: over.id,
    groupId,
    group: {
      id: groupId,
      name: over.groupName ?? 'LAN Challenger',
      tag: 'LAN',
      initials: 'LC',
      color1: '#000',
      color2: '#111',
    },
    source: 'manual',
    durationSeconds: over.durationSeconds ?? 1800,
    decidedAt: over.decidedAt ?? '2026-06-23T21:00:00Z',
    winningTeam,
    blueTeam: teamFixture('blue', winningTeam === 'blue', over.blue),
    redTeam: teamFixture('red', winningTeam === 'red', over.red),
    userParticipant: user,
    userOutcome: user ? (user.team === winningTeam ? 'win' : 'loss') : undefined,
  };
}
