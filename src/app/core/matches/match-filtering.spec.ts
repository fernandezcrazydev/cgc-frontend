import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  MatchFilterState,
  filterGroupMatches,
  filterPersonalMatches,
  sortMatches,
} from './match-filtering';
import { Match, MatchParticipant, TeamSide, TeamSummary } from './models';

/**
 * Partidas mínimas construidas a mano: estas funciones son permanentes (sobreviven al
 * backend como forma de los query params), así que sus tests no deben depender de la semilla,
 * que es desechable.
 */
function participant(over: Partial<MatchParticipant> & { id: string; team: TeamSide }): MatchParticipant {
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
      kills: 1,
      deaths: 1,
      assists: 1,
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

function team(side: TeamSide, won: boolean, participants: MatchParticipant[]): TeamSummary {
  return {
    side,
    won,
    totalKills: 10,
    totalDeaths: 10,
    totalAssists: 20,
    totalGold: 50000,
    totalDamage: 50000,
    dragons: 1,
    barons: 0,
    towers: 5,
    participants,
  };
}

function match(over: {
  id: string;
  groupId?: string;
  decidedAt?: string;
  durationSeconds?: number;
  winningTeam?: TeamSide;
  blue: MatchParticipant[];
  red: MatchParticipant[];
  userParticipant?: MatchParticipant;
}): Match {
  const winningTeam = over.winningTeam ?? 'blue';
  const user = over.userParticipant;
  return {
    id: over.id,
    groupId: over.groupId ?? 'g1',
    group: {
      id: over.groupId ?? 'g1',
      name: 'LAN Challenger',
      tag: 'LAN',
      initials: 'LC',
      color1: '#000',
      color2: '#111',
    },
    source: 'manual',
    durationSeconds: over.durationSeconds ?? 1800,
    decidedAt: over.decidedAt ?? '2026-06-23T21:00:00Z',
    winningTeam,
    blueTeam: team('blue', winningTeam === 'blue', over.blue),
    redTeam: team('red', winningTeam === 'red', over.red),
    userParticipant: user,
    userOutcome: user ? (user.team === winningTeam ? 'win' : 'loss') : undefined,
  };
}

const withFilters = (over: Partial<MatchFilterState>): MatchFilterState => ({
  ...EMPTY_FILTERS,
  ...over,
});

const me = participant({ id: 'me', team: 'blue', riotId: 'N1ghtfang#LAN', role: 'MID', championId: 103 });
const rival = participant({ id: 'rival', team: 'red', riotId: 'Pyro#LAN', role: 'TOP', championId: 86 });

const played = match({ id: 'm1', blue: [me], red: [rival], userParticipant: me });
const notPlayed = match({
  id: 'm2',
  winningTeam: 'red',
  blue: [participant({ id: 'x', team: 'blue', role: 'ADC', championId: 222 })],
  red: [participant({ id: 'y', team: 'red' })],
});

describe('filterPersonalMatches', () => {
  it('mide rol y campeón contra TU participante, no contra los diez', () => {
    // El rival jugó TOP con Garen; filtrar por eso no debe devolver la partida.
    expect(filterPersonalMatches([played], withFilters({ role: 'TOP' }))).toEqual([]);
    expect(filterPersonalMatches([played], withFilters({ championId: 86 }))).toEqual([]);

    expect(filterPersonalMatches([played], withFilters({ role: 'MID' }))).toEqual([played]);
    expect(filterPersonalMatches([played], withFilters({ championId: 103 }))).toEqual([played]);
  });

  it('filtra por grupo y por resultado', () => {
    expect(filterPersonalMatches([played], withFilters({ groupId: 'otro' }))).toEqual([]);
    expect(filterPersonalMatches([played], withFilters({ outcome: 'win' }))).toEqual([played]);
    expect(filterPersonalMatches([played], withFilters({ outcome: 'loss' }))).toEqual([]);
  });

  it('la búsqueda libre mira jugador, campeón y grupo', () => {
    expect(filterPersonalMatches([played], withFilters({ searchQuery: 'pyro' }))).toEqual([played]);
    expect(filterPersonalMatches([played], withFilters({ searchQuery: 'challenger' }))).toEqual([played]);
    expect(filterPersonalMatches([played], withFilters({ searchQuery: 'nada' }))).toEqual([]);
  });
});

describe('filterGroupMatches', () => {
  it('mide el campeón contra los diez participantes, no contra ti', () => {
    // Aquí sí: es el registro colectivo. El rival jugó Garen (86) y la partida cuenta.
    expect(filterGroupMatches([played], withFilters({ championId: 86 }))).toEqual([played]);
    expect(filterGroupMatches([played], withFilters({ championId: 222 }))).toEqual([]);
  });

  it('ignora el filtro de posición: contra los diez no descarta nada', () => {
    // Un 5v5 completo cubre siempre las cinco posiciones, así que medir `role` contra los diez
    // participantes devuelve la lista entera para cualquier valor. Por eso la vista de grupo ya
    // no pinta ese control: estuvo ahí, con su chip de «filtro puesto», sin efecto ninguno.
    const list = [played, notPlayed];
    for (const role of ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'] as const) {
      expect(filterGroupMatches(list, withFilters({ role }))).toEqual(list);
    }
  });

  it('filtra por bando ganador en vez de por tu resultado', () => {
    const list = [played, notPlayed];
    expect(filterGroupMatches(list, withFilters({ winningSide: 'blue' }))).toEqual([played]);
    expect(filterGroupMatches(list, withFilters({ winningSide: 'red' }))).toEqual([notPlayed]);
  });

  it('el filtro de participación separa las tuyas de las del resto del grupo', () => {
    // El bug que se corrigió en su día: el filtro de resultado dejaba pasar SIEMPRE las
    // partidas ajenas, así que «victorias» enseñaba tus victorias más todo lo demás.
    const list = [played, notPlayed];

    expect(filterGroupMatches(list, withFilters({ participation: 'all' }))).toHaveLength(2);
    expect(filterGroupMatches(list, withFilters({ participation: 'mine' }))).toEqual([played]);
    expect(filterGroupMatches(list, withFilters({ participation: 'others' }))).toEqual([notPlayed]);
  });

  it('«otras» y «mis partidas» son complementarios: ninguna se cuela en las dos', () => {
    const list = [played, notPlayed];
    const mine = filterGroupMatches(list, withFilters({ participation: 'mine' }));
    const others = filterGroupMatches(list, withFilters({ participation: 'others' }));

    expect(mine.length + others.length).toBe(list.length);
    expect(mine.some((m) => others.includes(m))).toBe(false);
  });
});

describe('sortMatches', () => {
  const older = match({ id: 'old', decidedAt: '2026-06-01T10:00:00Z', durationSeconds: 3000, blue: [], red: [] });
  const newer = match({ id: 'new', decidedAt: '2026-06-20T10:00:00Z', durationSeconds: 900, blue: [], red: [] });

  it('ordena por fecha en los dos sentidos', () => {
    expect(sortMatches([older, newer], 'date-desc').map((m) => m.id)).toEqual(['new', 'old']);
    expect(sortMatches([older, newer], 'date-asc').map((m) => m.id)).toEqual(['old', 'new']);
  });

  it('ordena por duración', () => {
    expect(sortMatches([newer, older], 'duration-desc').map((m) => m.id)).toEqual(['old', 'new']);
  });

  it('no muta la lista que recibe', () => {
    const list = [older, newer];
    sortMatches(list, 'date-desc');
    expect(list.map((m) => m.id)).toEqual(['old', 'new']);
  });
});
