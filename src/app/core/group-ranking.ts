/**
 * Leaderboard data for the per-group "Ranking" view. Members are ranked by
 * rating (desc). Each entry carries the win/loss record, peak rating, LoL rank,
 * lane, champion, streak sparkline, and trophy data. Deterministic so
 * a given group always renders the same board until the backend lands.
 */
import { NfLane } from '../ui/lane-icon/nf-lane-icon';
import { REAL_CHAMPION_IDS } from './lobby';
import { opggUrl } from './member-detail';

/** Roster name pool — kept in sync (by convention) with grupo-detalle's roster. */
const NAME_POOL = [
  { name: 'Pix3lQueen', tag: 'EUW' },
  { name: 'Cr1msonByte', tag: 'PSOE' },
  { name: 'D4rkFl4me', tag: 'CITY' },
  { name: 'V0idWalker', tag: '666' },
  { name: 'NeonRift', tag: 'DRWHO' },
  { name: 'GlitchKid', tag: 'EUW' },
  { name: 'St0rmcaller', tag: 'LANA' },
  { name: 'HexHunter', tag: 'NA' },
  { name: 'AshenWolf', tag: 'EUW' },
  { name: 'LumeCore', tag: 'KR' },
  { name: 'Zer0Cool', tag: 'BR' },
  { name: 'ByteSiren', tag: 'EUW' },
];

const LANES: readonly NfLane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];

export type LolTier = 'CHALLENGER' | 'GRANDMASTER' | 'MASTER' | 'DIAMOND' | 'EMERALD' | 'PLATINUM' | 'GOLD';

export interface LolRankInfo {
  tier: LolTier;
  queue: 'SoloQ' | 'Flex';
  label: string;
  color: string;
}

export interface RankEntry {
  rank: number;
  name: string;
  tag: string;
  initials: string;
  hue: number;
  avatar?: string;
  rating: number;
  formattedLp: string;
  peak: number;
  wins: number;
  losses: number;
  totalGames: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  /** Recent rating points (oldest → newest) for the trend sparkline. */
  spark: number[];
  /** Overall direction of the spark, for the line color. */
  trend: 'up' | 'down';
  /** LoL lane role. */
  lane: NfLane;
  /** LoL highest rank (SoloQ or Flex). */
  lolRank: LolRankInfo;
  /** Average LP gained/lost. */
  avgLpGain: number;
  avgLpLoss: number;
  /** Circular golden badge score value. */
  scoreBadge: number;
  /** Most played champion ID for the secondary icon. */
  mainChampionId: number;
  /** Trophy image for top 3 (Trofeo1, Trofeo2, Trofeo3). */
  trophyImg?: string;
  /** Direct link to OP.GG. */
  opggUrl: string;
}

/** Tiny seeded PRNG (mulberry32) so the board is stable across renders. */
export function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a stable 32-bit seed. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const TIER_CONFIGS: { tier: LolTier; queue: 'SoloQ' | 'Flex'; label: string; color: string }[] = [
  { tier: 'CHALLENGER', queue: 'SoloQ', label: 'SoloQ: Challenger', color: '#f4c053' },
  { tier: 'GRANDMASTER', queue: 'SoloQ', label: 'SoloQ: Grandmaster', color: '#e43e3e' },
  { tier: 'MASTER', queue: 'SoloQ', label: 'SoloQ: Master', color: '#b469ff' },
  { tier: 'DIAMOND', queue: 'SoloQ', label: 'SoloQ: Diamond I', color: '#5aa9e6' },
  { tier: 'DIAMOND', queue: 'Flex', label: 'Flex: Diamond II', color: '#5aa9e6' },
  { tier: 'EMERALD', queue: 'SoloQ', label: 'SoloQ: Emerald I', color: '#00b894' },
  { tier: 'PLATINUM', queue: 'SoloQ', label: 'SoloQ: Platinum I', color: '#00cec9' },
  { tier: 'GOLD', queue: 'SoloQ', label: 'SoloQ: Gold I', color: '#e1b12c' },
];

/** Build a leaderboard of `count` members for a group, ranked by rating desc. */
export function rankingFor(groupId: string, count: number): RankEntry[] {
  const rnd = seeded(hash(groupId));

  const rawEntries = Array.from({ length: count }, (_, i) => {
    const pick = NAME_POOL[i % NAME_POOL.length];
    const games = 15 + Math.floor(rnd() * 45);
    const wins = Math.round(games * (0.42 + rnd() * 0.4));
    const losses = Math.max(0, games - wins);
    const rating = 1800 + Math.floor(rnd() * 1100);
    const peak = rating + Math.floor(rnd() * 180);

    // Walk a short rating history ending near the current rating.
    const spark: number[] = [];
    let v = rating - 40 + Math.floor(rnd() * 80);
    for (let s = 0; s < 8; s++) {
      v += Math.floor((rnd() - 0.45) * 36);
      spark.push(v);
    }
    spark[spark.length - 1] = rating;

    const lane = LANES[Math.floor(rnd() * LANES.length)];
    const champId = REAL_CHAMPION_IDS[Math.floor(rnd() * REAL_CHAMPION_IDS.length)];
    const avgGain = 18 + Math.floor(rnd() * 9);
    const avgLoss = 14 + Math.floor(rnd() * 8);

    return {
      name: pick.name,
      tag: pick.tag,
      initials: pick.name.slice(0, 2).toUpperCase(),
      hue: (i * 47) % 360,
      rating,
      peak,
      wins,
      losses,
      totalGames: wins + losses,
      wr: games ? Math.round((wins / games) * 100) : 0,
      spark,
      trend: spark[spark.length - 1] >= spark[0] ? ('up' as const) : ('down' as const),
      lane,
      avgLpGain: avgGain,
      avgLpLoss: avgLoss,
      scoreBadge: 0, // filled after sorting
      mainChampionId: champId,
      opggUrl: opggUrl(`${pick.name}#${pick.tag}`),
    };
  });

  // Sort descending by rating
  const sorted = rawEntries.sort((a, b) => b.rating - a.rating);

  return sorted.map((e, i) => {
    const rank = i + 1;
    const tierConfig = TIER_CONFIGS[Math.min(i, TIER_CONFIGS.length - 1)];
    const trophyImg = rank <= 3 ? `/assets/trofeos/Trofeo${rank}.png` : undefined;
    const scoreBadge = Math.max(70, 99 - i * 3);
    const formattedLp = `${e.rating.toLocaleString('es-ES')} LP`;

    return {
      ...e,
      rank,
      formattedLp,
      lolRank: tierConfig,
      scoreBadge,
      trophyImg,
    };
  });
}

/** Map a spark series to an SVG polyline `points` string within `w`×`h`. */
export function sparkPoints(spark: number[], w = 120, h = 32): string {
  if (spark.length < 2) return '';
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (w - pad * 2) / (spark.length - 1);
  return spark
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
