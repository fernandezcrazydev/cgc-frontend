/**
 * Mock match-history data for the "Historial" view — a LoL-style record of the
 * matches the current user has played. Each entry carries the champion played,
 * date/time, the group the match was disputed in, the final KDA, CS (minions),
 * gold and the item build. Real data will come from the backend later.
 */
import { GROUPS, REAL_CHAMPION_IDS } from './lobby';

export interface MatchRecord {
  /** Stable id used in the URL (`/app/historial/:id`). */
  id: string;
  /**
   * BACKEND NOTE: id real de ddragon (no el nombre): la vista resuelve
   * `id → ChampionSummary` con `GameDataStore.championById()` y pinta su
   * `iconUrl`/nombre real; hasta entonces cae a iniciales.
   */
  championId: number;
  win: boolean;
  mode: string;
  /** Pre-formatted "DD MES · HH:MM" for display. */
  date: string;
  /** Match length in minutes (drives CS/min and the duration chip). */
  durationMin: number;
  groupId: string;
  groupName: string;
  kills: number;
  deaths: number;
  assists: number;
  /** Minions farmed. */
  cs: number;
  /** Total gold earned. */
  gold: number;
  /**
   * Exactly six slots; trailing slots may be `null` (unfinished build). Nombre
   * genérico del objeto — placeholder puro (categoría "Placeholder" del
   * CLAUDE.md): el objeto real y su `iconUrl` llegarán con el endpoint de
   * historial (ver §"Payload" del plan del módulo), que embeberá el objeto
   * completo de una partida concreta. Hasta entonces la vista solo puede
   * enseñar el nombre + un tinte derivado del propio nombre (no hay id ni
   * catálogo de objetos en el store: `GameDataApi.items()` es un buscador
   * paginado, no una resolución por id).
   */
  items: (string | null)[];
}

const groupName = (id: string) => GROUPS.find((g) => g.id === id)?.name ?? 'GRUPO';

interface Seed {
  id: string;
  championId: number;
  win: boolean;
  mode: string;
  date: string;
  durationMin: number;
  groupId: string;
  k: number;
  d: number;
  a: number;
  cs: number;
  gold: number;
  items: (string | null)[];
}

const SEED: Seed[] = [
  { id: 'lan-2895', championId: REAL_CHAMPION_IDS[0], win: true,  mode: '5v5 · LAN',  date: '23 JUN · 21:45', durationMin: 32, groupId: 'lan-challenger', k: 12, d: 3, a: 8,  cs: 241, gold: 15820, items: ['Filo Nocturno', 'Hoja Infinita', 'Botas Veloces', 'Daga Filo', 'Hidra Voraz', null] },
  { id: 'lan-2891', championId: REAL_CHAMPION_IDS[1], win: false, mode: '5v5 · LAN',  date: '23 JUN · 20:58', durationMin: 28, groupId: 'lan-challenger', k: 4,  d: 7, a: 11, cs: 198, gold: 11240, items: ['Tomo Arcano', 'Cetro Abisal', 'Botas Veloces', 'Velo de Banshee', null, null] },
  { id: 'scrim-204', championId: REAL_CHAMPION_IDS[2], win: true,  mode: '5v5 · SCRIM', date: '22 JUN · 23:10', durationMin: 41, groupId: 'scrim-squad',   k: 9,  d: 5, a: 6,  cs: 312, gold: 17430, items: ['Hoja Infinita', 'Daga Filo', 'Botas Veloces', 'Hidra Voraz', 'Velo de Banshee', 'Maza Espinada'] },
  { id: 'lan-2884', championId: REAL_CHAMPION_IDS[3], win: false, mode: '5v5 · LAN',  date: '22 JUN · 21:02', durationMin: 35, groupId: 'lan-challenger', k: 1,  d: 9, a: 14, cs: 142, gold: 10980, items: ['Égida Solar', 'Maza Espinada', 'Botas Veloces', 'Velo de Banshee', null, null] },
  { id: 'owl-118',  championId: REAL_CHAMPION_IDS[4], win: true,  mode: '5v5 · CASUAL', date: '21 JUN · 01:34', durationMin: 26, groupId: 'night-owls',    k: 2,  d: 4, a: 21, cs: 64,  gold: 9120,  items: ['Tomo Arcano', 'Égida Solar', 'Botas Veloces', 'Velo de Banshee', null, null] },
  { id: 'flex-77',  championId: REAL_CHAMPION_IDS[5], win: true,  mode: '5v5 · FLEX',  date: '20 JUN · 22:19', durationMin: 38, groupId: 'arcane-five',    k: 15, d: 6, a: 9,  cs: 226, gold: 16240, items: ['Filo Nocturno', 'Hidra Voraz', 'Botas Veloces', 'Hoja Infinita', 'Daga Filo', 'Maza Espinada'] },
];

export const MATCH_HISTORY: MatchRecord[] = SEED.map((s) => ({
  id: s.id,
  championId: s.championId,
  win: s.win,
  mode: s.mode,
  date: s.date,
  durationMin: s.durationMin,
  groupId: s.groupId,
  groupName: groupName(s.groupId),
  kills: s.k,
  deaths: s.d,
  assists: s.a,
  cs: s.cs,
  gold: s.gold,
  items: s.items,
}));

export function matchById(id: string): MatchRecord | undefined {
  return MATCH_HISTORY.find((m) => m.id === id);
}

/** Matches disputed within a given group, newest first (seed order). */
export function matchesByGroup(groupId: string): MatchRecord[] {
  return MATCH_HISTORY.filter((m) => m.groupId === groupId);
}

/** KDA ratio as "x.xx", treating 0 deaths as a perfect game. */
export function kdaRatio(m: MatchRecord): string {
  const ratio = m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths;
  return ratio.toFixed(2);
}

/** "15.8k" style short gold; CS/min when minutes are known. */
export function shortGold(gold: number): string {
  return (gold / 1000).toFixed(1) + 'k';
}
