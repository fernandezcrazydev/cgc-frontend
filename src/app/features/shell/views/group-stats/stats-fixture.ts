/**
 * Fixture compartido de las specs de esta carpeta. **Solo lo importan ficheros `.spec.ts`.**
 *
 * Construye un `GroupStats` con la forma exacta que manda el backend y lo pasa por las derivaciones
 * de verdad (`playersOf`, `duosOf`…), en vez de fabricar a mano las vistas ya calculadas. Así una
 * spec de componente falla también si lo que se rompe es la derivación, que es la mitad del dominio
 * que más se puede equivocar en silencio: un divisor cambiado no rompe ningún tipo.
 */
import { GroupStats, StatsPlayer } from '../../../../core/group-stats';

/** Un jugador con todo a cero, para escribir en cada caso solo lo que ese caso mide. */
export function player(userId: string, name: string, over: Partial<StatsPlayer> = {}): StatsPlayer {
  return {
    userId,
    riotId: `${name}#EUW`,
    discordUsername: name,
    avatarUrl: null,
    games: 10,
    wins: 6,
    losses: 4,
    gamesWithStats: 10,
    seconds: 18000,
    kills: 70,
    deaths: 40,
    assists: 90,
    cs: 2000,
    gold: 120000,
    damageToChampions: 200000,
    damageTaken: 180000,
    damageMitigated: 90000,
    healed: 30000,
    visionScore: 400,
    wardsPlaced: 120,
    wardsKilled: 40,
    timeCcingOthers: 300,
    doubles: 6,
    triples: 2,
    quadras: 1,
    pentas: 0,
    towers: 8,
    dragons: 14,
    barons: 5,
    firstBloods: 2,
    deathlessGames: 1,
    mvps: 2,
    currentStreak: 2,
    bestStreak: 4,
    worstStreak: -3,
    mainChampionId: 64,
    mainChampionGames: 6,
    mainChampionWins: 4,
    rating: 1500,
    ratingRank: 3,
    ...over,
  };
}

/** Cinco jugadores con cifras distintas entre sí, para que un orden mal hecho se note. */
export const PLAYERS: StatsPlayer[] = [
  player('u-1', 'EduUC', { rating: 1720, ratingRank: 1, kills: 110, cs: 2600, visionScore: 300 }),
  player('u-2', 'Adri', { rating: 1610, ratingRank: 2, kills: 90, cs: 2300, visionScore: 340 }),
  player('u-3', 'Victor', { rating: 1500, ratingRank: 3, kills: 70, cs: 2000, visionScore: 400 }),
  player('u-4', 'DaniG', { rating: 1420, ratingRank: 4, kills: 50, cs: 1700, visionScore: 460 }),
  player('u-5', 'Pau', { rating: 1310, ratingRank: 5, kills: 30, cs: 1400, visionScore: 520 }),
];

export function groupStats(over: Partial<GroupStats> = {}): GroupStats {
  return {
    matches: 10,
    matchesWithStats: 10,
    totalSeconds: 18000,
    totalKills: 350,
    side: { games: 10, blueWins: 6, redWins: 4 },
    objectives: [
      { objective: 'FIRST_BLOOD', games: 10, wins: 6 },
      { objective: 'FIRST_TOWER', games: 10, wins: 8 },
      { objective: 'FIRST_DRAGON', games: 9, wins: 6 },
      { objective: 'FIRST_BARON', games: 7, wins: 6 },
      { objective: 'GRUBS', games: 8, wins: 5 },
      { objective: 'HERALD', games: 6, wins: 4 },
    ],
    champions: [
      { championId: 64, picks: 8, wins: 6, bans: 2 },
      { championId: 157, picks: 5, wins: 2, bans: 7 },
      { championId: 222, picks: 1, wins: 1, bans: 0 },
    ],
    // Aliados y rivales sobre las mismas personas: es lo que la tabla usa para el dúo y la némesis.
    duos: [
      { a: 'u-1', b: 'u-2', allies: true, games: 6, wins: 5 },
      { a: 'u-1', b: 'u-3', allies: true, games: 4, wins: 1 },
      { a: 'u-2', b: 'u-3', allies: true, games: 5, wins: 2 },
      { a: 'u-1', b: 'u-4', allies: false, games: 5, wins: 1 },
      { a: 'u-4', b: 'u-1', allies: false, games: 5, wins: 4 },
      { a: 'u-2', b: 'u-5', allies: false, games: 4, wins: 3 },
      { a: 'u-5', b: 'u-2', allies: false, games: 4, wins: 1 },
    ],
    lanes: [
      { lane: 'MID', games: 8, decisive: 7, goldLead: 9600 },
      { lane: 'JUNGLA', games: 7, decisive: 5, goldLead: 5600 },
      { lane: 'TOP', games: 9, decisive: 5, goldLead: 14400 },
      { lane: 'ADC', games: 6, decisive: 4, goldLead: 4200 },
      { lane: 'SUPPORT', games: 6, decisive: 3, goldLead: 1800 },
    ],
    records: [
      { id: 'MOST_KILLS', matchId: 'm-1', userId: 'u-1', championId: 64, value: 19 },
      { id: 'LONGEST_GAME', matchId: 'm-2', userId: null, championId: null, value: 2400 },
    ],
    players: PLAYERS,
    ...over,
  };
}
