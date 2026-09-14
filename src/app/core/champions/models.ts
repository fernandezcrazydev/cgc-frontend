import { Lane } from '../matches/models';

export type TierRank = 'S+' | 'S' | 'A' | 'B' | 'C';

/** Un jugador del grupo con ese campeón. */
export interface ChampionPlayerStats {
  riotId: string;
  displayName: string;
  avatarUrl: string | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  kdaRatio: string;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
}

/** Una fila de la Tierlist. */
export interface ChampionRow {
  championId: number;
  role: Lane;
  tier: TierRank;
  tierWeight: number;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  pickrate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kdaRatio: string;
  kdaNum: number;
  avgDamagePerMin: number;
  laneWinrate: number;
  avgGoldAt14: number;
  avgCsAt14: number;
  avgGoldPerMin: number;
  avgCsPerMin: number;
  avgVisionScore: number;
  avgDamageShare: number;
  specialist: ChampionPlayerStats | null;
}

export interface ChampionBoard {
  totalMatches: number;
  rows: ChampionRow[];
}

/** Un campeón con el que se ha coincidido, y cómo fue. */
export interface ChampionPairing {
  championId: number;
  games: number;
  wins: number;
  winrate: number; // desde el punto de vista del campeón de la ficha
}

export interface ChampionItemStats {
  itemId: number;
  games: number; // en cuántas de las partidas del campeón apareció
  wins: number;
  winrate: number;
}

export interface ChampionRunePage {
  primaryTreeId: number;
  secondaryTreeId: number;
  keystoneId: number;
  primaryRuneIds: number[]; // las tres menores del árbol primario
  secondaryRuneIds: number[]; // las dos del secundario
  statShardIds: number[]; // los tres fragmentos
  games: number;
  wins: number;
  winrate: number;
}

/** La respuesta de la ficha. */
export interface ChampionStats extends ChampionRow {
  scope: 'group' | 'global';
  firstBloodRate: number;
  firstTowerRate: number;
  banRate: number;
  /** Los tres huecos no-definitiva, de primero a último. */
  skillOrder: ('Q' | 'W' | 'E')[];
  specialists: ChampionPlayerStats[];
  synergies: ChampionPairing[];
  counters: ChampionPairing[];
  items: ChampionItemStats[];
  runePage: ChampionRunePage | null;
}
