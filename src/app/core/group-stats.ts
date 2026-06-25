/**
 * Deterministic mock data for the per-group "Estadísticas" view. Everything is
 * seeded by the group id + the active scope (NOCHE / TEMPORADA / HISTÓRICO) so a
 * given group always renders the same numbers until the backend lands. The data
 * is derived from a single per-member base-stats pass and then projected into
 * the three surfaces the screen shows:
 *   - summaryFor()      → the RESUMEN dashboard highlights
 *   - leaderboardsFor() → the reusable "stat card" mini-leaderboards
 *   - awardsFor()       → the PREMIOS trophy wall ("para reírse")
 *   - playerStatsFor()  → the JUGADORES per-member deep dive
 */
import { Champion, CHAMPIONS, Member } from './lobby';
import { hash, seeded } from './group-ranking';

/** Time window every widget is scaled to. */
export type StatScope = 'noche' | 'temporada' | 'historico';

export const SCOPE_OPTIONS: { id: StatScope; label: string }[] = [
  { id: 'noche', label: 'NOCHE' },
  { id: 'temporada', label: 'TEMPORADA' },
  { id: 'historico', label: 'HISTÓRICO' },
];

/** Rough game-count band per scope, so totals feel right at each zoom level. */
const SCOPE_GAMES: Record<StatScope, [number, number]> = {
  noche: [3, 6],
  temporada: [18, 44],
  historico: [70, 160],
};

/** Per-member aggregate stats for one scope. The single source of truth. */
export interface MemberStats {
  member: Member;
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  /** Average kills / deaths / assists per game. */
  kills: number;
  deaths: number;
  assists: number;
  /** (kills + assists) / deaths, one decimal. */
  kda: number;
  csPerMin: number;
  goldPerMin: number;
  /** Average damage to champions per game, in thousands. */
  dmgK: number;
  visionScore: number;
  wardsPlaced: number;
  /** Average crowd-control time applied, in seconds. */
  ccTime: number;
  doubles: number;
  triples: number;
  quadras: number;
  pentas: number;
  /** This member's unofficial "main". */
  mainChampion: Champion;
  mainChampWr: number;
  /** Longest current win streak within the scope. */
  streak: number;
  /** Recent form points for the trend sparkline. */
  spark: number[];
  trend: 'up' | 'down';
  /** Composite performance index (0-100) used to pick the MVP. */
  rating: number;
}

/** Pick a stable item from `arr` for `seed`. */
function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Build the per-member base stats for a group at a given scope. */
export function statsFor(groupId: string, roster: readonly Member[], scope: StatScope): MemberStats[] {
  const [lo, hi] = SCOPE_GAMES[scope];

  return roster.map((member) => {
    const rnd = seeded(hash(member.tag + '::' + scope + '::' + groupId));

    const games = lo + Math.floor(rnd() * (hi - lo + 1));
    const wr = 0.32 + rnd() * 0.46;
    const wins = Math.round(games * wr);
    const losses = Math.max(0, games - wins);

    const kills = +(2 + rnd() * 9).toFixed(1);
    const deaths = +(2 + rnd() * 6).toFixed(1);
    const assists = +(4 + rnd() * 12).toFixed(1);
    const kda = +((kills + assists) / Math.max(1, deaths)).toFixed(1);

    const csPerMin = +(4 + rnd() * 5).toFixed(1);
    const goldPerMin = Math.round(280 + rnd() * 220);
    const dmgK = +(8 + rnd() * 28).toFixed(1);
    const visionScore = Math.round(12 + rnd() * 58);
    const wardsPlaced = Math.round(8 + rnd() * 60);
    const ccTime = Math.round(6 + rnd() * 54);

    // Multikills scale with game volume; pentas stay rare.
    const doubles = Math.round(games * (0.4 + rnd() * 1.1));
    const triples = Math.round(games * (0.05 + rnd() * 0.3));
    const quadras = Math.floor(rnd() * Math.max(1, games * 0.12));
    const pentas = rnd() < 0.35 ? Math.floor(rnd() * Math.max(1, games * 0.04)) : 0;

    const mainChampion = pick(rnd, CHAMPIONS);
    const mainChampWr = Math.round(45 + rnd() * 45);

    const streak = Math.floor(rnd() * Math.min(8, wins + 1));

    // Walk a short form history ending near the win-rate, like the ranking spark.
    const base = Math.round(wr * 100);
    const spark: number[] = [];
    let v = base - 18 + Math.floor(rnd() * 36);
    for (let s = 0; s < 8; s++) {
      v += Math.floor((rnd() - 0.45) * 26);
      spark.push(v);
    }
    spark[spark.length - 1] = base;

    // Composite rating: win-rate, KDA and damage all contribute.
    const rating = Math.round(
      Math.min(100, wr * 55 + Math.min(kda, 6) * 5 + Math.min(dmgK, 40) * 0.45),
    );

    return {
      member,
      games,
      wins,
      losses,
      wr: Math.round(wr * 100),
      kills,
      deaths,
      assists,
      kda,
      csPerMin,
      goldPerMin,
      dmgK,
      visionScore,
      wardsPlaced,
      ccTime,
      doubles,
      triples,
      quadras,
      pentas,
      mainChampion,
      mainChampWr,
      streak,
      spark,
      trend: spark[spark.length - 1] >= spark[0] ? ('up' as const) : ('down' as const),
      rating,
    };
  });
}

// ===================== RESUMEN =====================

export interface StatSummary {
  mvp: { stats: MemberStats; blurb: string };
  bestCombo: { a: Member; b: Member; wr: number; wins: number; games: number };
  hotStreak: { member: Member; streak: number };
  totals: { games: number; hours: number; kills: number; pentas: number };
}

/** Build the RESUMEN dashboard highlights from the base stats. */
export function summaryFor(stats: readonly MemberStats[], scope: StatScope): StatSummary | null {
  if (!stats.length) return null;

  const byRating = [...stats].sort((a, b) => b.rating - a.rating);
  const mvp = byRating[0];

  // Best combo: top two members by rating "play well together".
  const rnd = seeded(hash(mvp.member.tag + scope + 'combo'));
  const a = byRating[0];
  const b = byRating[1] ?? byRating[0];
  const comboGames = 4 + Math.floor(rnd() * 12);
  const comboWins = Math.round(comboGames * (0.62 + rnd() * 0.3));

  const streaker = [...stats].sort((x, y) => y.streak - x.streak)[0];

  // Totals: games is the median-ish (sessions are shared), kills sum the avgs.
  const totalGames = Math.round(stats.reduce((s, x) => s + x.games, 0) / stats.length);
  const totalKills = Math.round(stats.reduce((s, x) => s + x.kills, 0));
  const totalPentas = stats.reduce((s, x) => s + x.pentas, 0);

  return {
    mvp: {
      stats: mvp,
      blurb: `${mvp.kda} KDA · ${mvp.wr}% WR · ${mvp.dmgK}k daño/partida`,
    },
    bestCombo: {
      a: a.member,
      b: b.member,
      wr: Math.round((comboWins / comboGames) * 100),
      wins: comboWins,
      games: comboGames,
    },
    hotStreak: { member: streaker.member, streak: streaker.streak },
    totals: {
      games: totalGames,
      hours: Math.round((totalGames * 32) / 60),
      kills: totalKills,
      pentas: totalPentas,
    },
  };
}

// ===================== STAT CARDS (mini-leaderboards) =====================

export type StatAccent = 'cyan' | 'pink' | 'yellow';

export interface StatLeaderRow {
  rank: number;
  member: Member;
  /** Formatted headline value, e.g. "68%" or "7.4". */
  value: string;
  /** Secondary line, e.g. "17V 8D" or "Ahri". */
  sub: string;
}

export interface StatLeaderboard {
  id: string;
  title: string;
  glyph: string;
  accent: StatAccent;
  /** Sorted + ranked, leader first. */
  rows: StatLeaderRow[];
  /** True when the leader also gets a trend sparkline (win-rate card only). */
  spark?: number[];
  trend?: 'up' | 'down';
}

/** One metric definition projected into a leaderboard. */
interface Metric {
  id: string;
  title: string;
  glyph: string;
  accent: StatAccent;
  value: (s: MemberStats) => number;
  format: (s: MemberStats) => string;
  sub: (s: MemberStats) => string;
  withSpark?: boolean;
}

const METRICS: Metric[] = [
  {
    id: 'winrate',
    title: 'WIN RATE',
    glyph: '🏆',
    accent: 'pink',
    value: (s) => s.wr,
    format: (s) => `${s.wr}%`,
    sub: (s) => `${s.wins}V ${s.losses}D`,
    withSpark: true,
  },
  {
    id: 'kda',
    title: 'KDA MEDIO',
    glyph: '⚔️',
    accent: 'cyan',
    value: (s) => s.kda,
    format: (s) => `${s.kda}`,
    sub: (s) => `${s.kills} / ${s.deaths} / ${s.assists}`,
  },
  {
    id: 'main',
    title: 'WIN RATE POR MAIN',
    glyph: '★',
    accent: 'yellow',
    value: (s) => s.mainChampWr,
    format: (s) => `${s.mainChampWr}%`,
    sub: (s) => s.mainChampion.name,
  },
  {
    id: 'damage',
    title: 'DAÑO A CAMPEONES',
    glyph: '🔥',
    accent: 'pink',
    value: (s) => s.dmgK,
    format: (s) => `${s.dmgK}k`,
    sub: (s) => `por partida`,
  },
  {
    id: 'cs',
    title: 'CS POR MINUTO',
    glyph: '🌾',
    accent: 'cyan',
    value: (s) => s.csPerMin,
    format: (s) => `${s.csPerMin}`,
    sub: (s) => `${s.goldPerMin} oro/min`,
  },
  {
    id: 'vision',
    title: 'PUNTUACIÓN DE VISIÓN',
    glyph: '👁',
    accent: 'yellow',
    value: (s) => s.visionScore,
    format: (s) => `${s.visionScore}`,
    sub: (s) => `${s.wardsPlaced} wards`,
  },
];

/** Build the reusable stat-card leaderboards from the base stats. */
export function leaderboardsFor(stats: readonly MemberStats[], top = 4): StatLeaderboard[] {
  return METRICS.map((m) => {
    const ranked = [...stats].sort((a, b) => m.value(b) - m.value(a)).slice(0, top);
    const leader = ranked[0];
    return {
      id: m.id,
      title: m.title,
      glyph: m.glyph,
      accent: m.accent,
      rows: ranked.map((s, i) => ({
        rank: i + 1,
        member: s.member,
        value: m.format(s),
        sub: m.sub(s),
      })),
      spark: m.withSpark && leader ? leader.spark : undefined,
      trend: m.withSpark && leader ? leader.trend : undefined,
    };
  });
}

// ===================== PREMIOS (trophy wall) =====================

export type AwardColor = 'pink' | 'cyan' | 'yellow' | 'green' | 'purple' | 'red';

export interface StatAward {
  id: string;
  glyph: string;
  title: string;
  color: AwardColor;
  member: Member;
  /** The number that justifies the award. */
  value: string;
  blurb: string;
}

/** Return the member that maximizes `score`. */
function leaderBy(stats: readonly MemberStats[], score: (s: MemberStats) => number): MemberStats {
  return [...stats].sort((a, b) => score(b) - score(a))[0];
}

/** Build the PREMIOS trophy wall ("métricas para reírse"). */
export function awardsFor(stats: readonly MemberStats[]): StatAward[] {
  if (!stats.length) return [];

  const farmer = leaderBy(stats, (s) => s.csPerMin - s.kda * 0.6);
  const silentCarry = leaderBy(stats, (s) => s.dmgK - s.deaths * 1.5);
  const wardSimp = leaderBy(stats, (s) => s.visionScore + s.wardsPlaced * 0.4);
  const pentaHunter = leaderBy(stats, (s) => s.pentas * 100 + s.quadras * 10 + s.triples);
  const ccLord = leaderBy(stats, (s) => s.ccTime);
  const feeder = leaderBy(stats, (s) => s.deaths - s.kda);

  return [
    {
      id: 'farmer',
      glyph: '🌾',
      title: 'EL GRANJERO',
      color: 'green',
      member: farmer.member,
      value: `${farmer.csPerMin} cs/min`,
      blurb: 'Mucho minion, poca sangre.',
    },
    {
      id: 'silent-carry',
      glyph: '🥷',
      title: 'CARRY SILENCIOSO',
      color: 'pink',
      member: silentCarry.member,
      value: `${silentCarry.dmgK}k daño`,
      blurb: `Solo ${silentCarry.deaths} muertes de media.`,
    },
    {
      id: 'ward-simp',
      glyph: '👁',
      title: 'WARD SIMP',
      color: 'cyan',
      member: wardSimp.member,
      value: `${wardSimp.wardsPlaced} wards`,
      blurb: `Visión ${wardSimp.visionScore}, el más cotilla.`,
    },
    {
      id: 'penta-hunter',
      glyph: '🎯',
      title: 'PENTA HUNTER',
      color: 'yellow',
      member: pentaHunter.member,
      value: `${pentaHunter.pentas}P · ${pentaHunter.quadras}Q`,
      blurb: 'Cazador de multikills.',
    },
    {
      id: 'cc-lord',
      glyph: '🧊',
      title: 'SEÑOR DEL CC',
      color: 'purple',
      member: ccLord.member,
      value: `${ccLord.ccTime}s CC`,
      blurb: 'Nadie se mueve cuando él juega.',
    },
    {
      id: 'feeder',
      glyph: '💀',
      title: 'EL DONANTE',
      color: 'red',
      member: feeder.member,
      value: `${feeder.deaths} muertes`,
      blurb: 'Reparte oro al enemigo con cariño.',
    },
  ];
}

// ===================== JUGADORES (per-member tiles) =====================

export interface PlayerTile {
  label: string;
  value: string;
  accent?: StatAccent;
}

/** The stat tiles shown in a player's expanded JUGADORES panel. */
export function playerTiles(s: MemberStats): PlayerTile[] {
  return [
    { label: 'Partidas', value: `${s.games}`, accent: 'cyan' },
    { label: 'Win rate', value: `${s.wr}%`, accent: 'pink' },
    { label: 'KDA', value: `${s.kda}`, accent: 'cyan' },
    { label: 'K / D / A', value: `${s.kills} / ${s.deaths} / ${s.assists}` },
    { label: 'CS/min', value: `${s.csPerMin}` },
    { label: 'Oro/min', value: `${s.goldPerMin}` },
    { label: 'Daño/part.', value: `${s.dmgK}k`, accent: 'pink' },
    { label: 'Visión', value: `${s.visionScore}` },
    { label: 'Pentas', value: `${s.pentas}`, accent: 'yellow' },
    { label: 'Racha', value: `${s.streak}W`, accent: 'yellow' },
  ];
}
