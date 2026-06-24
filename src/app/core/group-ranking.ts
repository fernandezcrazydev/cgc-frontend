/**
 * Mock leaderboard data for the per-group "Ranking" view. Members are ranked by
 * rating (desc). Each entry carries the win/loss record, peak rating and a short
 * rating-history series that drives the inline trend sparkline. Deterministic so
 * a given group always renders the same board until the backend lands.
 */

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

export interface RankEntry {
  rank: number;
  name: string;
  tag: string;
  initials: string;
  hue: number;
  rating: number;
  peak: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  /** Recent rating points (oldest → newest) for the trend sparkline. */
  spark: number[];
  /** Overall direction of the spark, for the line color. */
  trend: 'up' | 'down';
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

/** Build a leaderboard of `count` members for a group, ranked by rating desc. */
export function rankingFor(groupId: string, count: number): RankEntry[] {
  const rnd = seeded(hash(groupId));

  const entries = Array.from({ length: count }, (_, i) => {
    const pick = NAME_POOL[i % NAME_POOL.length];
    const games = 5 + Math.floor(rnd() * 25);
    const wins = Math.round(games * (0.35 + rnd() * 0.5));
    const losses = Math.max(0, games - wins);
    const rating = 480 + Math.floor(rnd() * 320);
    const peak = rating + Math.floor(rnd() * 130);

    // Walk a short rating history ending near the current rating.
    const spark: number[] = [];
    let v = rating - 30 + Math.floor(rnd() * 60);
    for (let s = 0; s < 8; s++) {
      v += Math.floor((rnd() - 0.45) * 36);
      spark.push(v);
    }
    spark[spark.length - 1] = rating;

    return {
      name: pick.name,
      tag: pick.tag,
      initials: pick.name.slice(0, 2).toUpperCase(),
      hue: (i * 47) % 360,
      rating,
      peak,
      wins,
      losses,
      wr: games ? Math.round((wins / games) * 100) : 0,
      spark,
      trend: spark[spark.length - 1] >= spark[0] ? ('up' as const) : ('down' as const),
    };
  });

  return entries
    .sort((a, b) => b.rating - a.rating)
    .map((e, i) => ({ ...e, rank: i + 1 }));
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
