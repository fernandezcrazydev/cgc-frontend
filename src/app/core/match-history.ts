/**
 * Mock match-history data for the "Historial" view — a LoL-style record of the
 * matches the current user has played. Each entry carries the champion played,
 * date/time, the group the match was disputed in, the final KDA, CS (minions),
 * gold and the item build. Real data will come from the backend later.
 */
import { CHAMPIONS, GROUPS } from './lobby';

/** A single item slot in the build (6 per match; `null` = empty slot). */
export interface ItemSlot {
  name: string;
  /** Hue for the placeholder icon gradient until real item art lands. */
  hue: number;
}

export interface MatchRecord {
  /** Stable id used in the URL (`/app/historial/:id`). */
  id: string;
  champion: string;
  /** Two-letter placeholder for the champion icon. */
  initials: string;
  /** Champion icon gradient stops. */
  c1: string;
  c2: string;
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
  /** Exactly six slots; trailing slots may be `null` (unfinished build). */
  items: (ItemSlot | null)[];
}

/** Placeholder item catalog — generic names + a hue for the icon tint. */
const ITEMS = {
  edge:    { name: 'Hoja Infinita',  hue: 30 },
  night:   { name: 'Filo Nocturno',  hue: 280 },
  aegis:   { name: 'Égida Solar',    hue: 48 },
  abyss:   { name: 'Cetro Abisal',   hue: 200 },
  boots:   { name: 'Botas Veloces',  hue: 150 },
  hydra:   { name: 'Hidra Voraz',    hue: 0 },
  tome:    { name: 'Tomo Arcano',    hue: 220 },
  banshee: { name: 'Velo de Banshee', hue: 260 },
  thorn:   { name: 'Maza Espinada',  hue: 100 },
  crit:    { name: 'Daga Filo',      hue: 16 },
} satisfies Record<string, ItemSlot>;

const champ = (name: string) => CHAMPIONS.find((c) => c.name === name)!;
const groupName = (id: string) => GROUPS.find((g) => g.id === id)?.name ?? 'GRUPO';

interface Seed {
  id: string;
  champion: string;
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
  items: (ItemSlot | null)[];
}

const SEED: Seed[] = [
  { id: 'lan-2895', champion: 'Vex',     win: true,  mode: '5v5 · LAN',  date: '23 JUN · 21:45', durationMin: 32, groupId: 'lan-challenger', k: 12, d: 3, a: 8,  cs: 241, gold: 15820, items: [ITEMS.night, ITEMS.edge, ITEMS.boots, ITEMS.crit, ITEMS.hydra, null] },
  { id: 'lan-2891', champion: 'Aurelia', win: false, mode: '5v5 · LAN',  date: '23 JUN · 20:58', durationMin: 28, groupId: 'lan-challenger', k: 4,  d: 7, a: 11, cs: 198, gold: 11240, items: [ITEMS.tome, ITEMS.abyss, ITEMS.boots, ITEMS.banshee, null, null] },
  { id: 'scrim-204', champion: 'Orion',  win: true,  mode: '5v5 · SCRIM', date: '22 JUN · 23:10', durationMin: 41, groupId: 'scrim-squad',   k: 9,  d: 5, a: 6,  cs: 312, gold: 17430, items: [ITEMS.edge, ITEMS.crit, ITEMS.boots, ITEMS.hydra, ITEMS.banshee, ITEMS.thorn] },
  { id: 'lan-2884', champion: 'Drake',   win: false, mode: '5v5 · LAN',  date: '22 JUN · 21:02', durationMin: 35, groupId: 'lan-challenger', k: 1,  d: 9, a: 14, cs: 142, gold: 10980, items: [ITEMS.aegis, ITEMS.thorn, ITEMS.boots, ITEMS.banshee, null, null] },
  { id: 'owl-118',  champion: 'Nyx',     win: true,  mode: '5v5 · CASUAL', date: '21 JUN · 01:34', durationMin: 26, groupId: 'night-owls',    k: 2,  d: 4, a: 21, cs: 64,  gold: 9120,  items: [ITEMS.tome, ITEMS.aegis, ITEMS.boots, ITEMS.banshee, null, null] },
  { id: 'flex-77',  champion: 'Zephyr',  win: true,  mode: '5v5 · FLEX',  date: '20 JUN · 22:19', durationMin: 38, groupId: 'arcane-five',    k: 15, d: 6, a: 9,  cs: 226, gold: 16240, items: [ITEMS.night, ITEMS.hydra, ITEMS.boots, ITEMS.edge, ITEMS.crit, ITEMS.thorn] },
];

export const MATCH_HISTORY: MatchRecord[] = SEED.map((s) => {
  const c = champ(s.champion);
  return {
    id: s.id,
    champion: s.champion,
    initials: c.initials,
    c1: c.c1,
    c2: c.c2,
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
  };
});

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
