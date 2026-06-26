/**
 * Deterministic mock data for the personal "Perfil de jugador" view. Unlike the
 * per-group stats, everything here is AGGREGATED across every group the user
 * belongs to — a cross-group career card. Seeded by the user tag (+ group id /
 * opponent tag) so the profile always renders the same numbers until the backend
 * lands. The disclaimer in the view makes the cross-group scope explicit: for
 * exact per-group figures the user must open that group's Estadísticas.
 */
import { Champion, CHAMPIONS, Group, GroupRole, Member } from './lobby';
import { hash, seeded } from './group-ranking';

/** A group's contribution to the aggregate, from the user's point of view. */
export interface ProfileGroupRecord {
  id: string;
  name: string;
  initials: string;
  c1: string;
  c2: string;
  role: GroupRole;
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
}

/** A head-to-head highlight against another real player (user's perspective). */
export interface ProfileMatchup {
  name: string;
  tag: string;
  initials: string;
  /** Hue (0-360) for the avatar gradient. */
  hue: number;
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage from the user's perspective, rounded. */
  wr: number;
}

/** A most-played champion across all groups. */
export interface ProfileChampion {
  champion: Champion;
  games: number;
  wins: number;
  /** Win-rate percentage, rounded. */
  wr: number;
}

/** The full aggregated career card shown on the profile screen. */
export interface PlayerProfile {
  name: string;
  tag: string;
  region: string;
  initials: string;
  hue: number;
  /** Mono "member since" stamp, e.g. "MAR 2024". */
  memberSince: string;

  // ── Global record (all groups) ──────────────────────────────────
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  hoursPlayed: number;
  pentas: number;
  mainRole: string;

  // ── Streaks + recent form ───────────────────────────────────────
  currentStreak: number;
  streakType: 'W' | 'L';
  bestStreak: number;
  /** Last ~12 results, oldest → newest. */
  recentForm: ('W' | 'L')[];

  // ── Head-to-head highlights ─────────────────────────────────────
  /** Teammate you win the most alongside ("con la que más ganas"). */
  bestAlly: ProfileMatchup | null;
  /** Opponent who beats you the most ("contra la que más pierdes"). */
  nemesis: ProfileMatchup | null;
  /** Opponent you beat the most ("a la que más ganas"). */
  favoriteVictim: ProfileMatchup | null;

  // ── Breakdowns ──────────────────────────────────────────────────
  topChampions: ProfileChampion[];
  groupCount: number;
  groups: ProfileGroupRecord[];
}

const ROLE_POOL = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT', 'FLEX'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** "N1ghtfang#LAN" → "LAN". */
function regionFromTag(tag: string): string {
  return tag.split('#')[1]?.toUpperCase() || 'LAN';
}

/** Pick `n` distinct items from `arr` using the seeded generator. */
function pickDistinct<T>(rnd: () => number, arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

/** Build a head-to-head record vs `foe`, seeded so it's stable per opponent. */
function matchup(userTag: string, foe: Member, facet: 'ally' | 'enemy'): ProfileMatchup {
  const rnd = seeded(hash(userTag + '::' + facet + '::' + foe.tag));
  const games = 6 + Math.floor(rnd() * 19); // 6–24 customs shared
  const wr = rnd();
  const wins = Math.round(games * wr);
  const losses = Math.max(0, games - wins);
  return {
    name: foe.name,
    tag: foe.tag,
    initials: foe.initials,
    hue: foe.hue,
    games,
    wins,
    losses,
    wr: games ? Math.round((wins / games) * 100) : 0,
  };
}

/**
 * Aggregate the current user's career across every group they belong to.
 * `rosterOf` returns a group's live roster (used to source real teammates and
 * rivals for the head-to-head highlights).
 */
export function buildPlayerProfile(
  user: { name: string; tag: string; initials: string; region: string },
  groups: readonly Group[],
  rosterOf: (id: string) => readonly Member[],
): PlayerProfile {
  const rnd = seeded(hash(user.tag + '::profile'));

  // Per-group records → the aggregate totals.
  const groupRecords: ProfileGroupRecord[] = groups.map((g) => {
    const grnd = seeded(hash(user.tag + '::' + g.id));
    const games = 14 + Math.floor(grnd() * 52);
    const wr = 0.4 + grnd() * 0.32;
    const wins = Math.round(games * wr);
    const losses = Math.max(0, games - wins);
    return {
      id: g.id,
      name: g.name,
      initials: g.initials,
      c1: g.c1,
      c2: g.c2,
      role: g.role,
      games,
      wins,
      losses,
      wr: games ? Math.round((wins / games) * 100) : 0,
    };
  });

  const games = groupRecords.reduce((s, r) => s + r.games, 0);
  const wins = groupRecords.reduce((s, r) => s + r.wins, 0);
  const losses = Math.max(0, games - wins);
  const wr = games ? Math.round((wins / games) * 100) : 0;

  // Global KDA / career counters.
  const kills = +(4 + rnd() * 6).toFixed(1);
  const deaths = +(3 + rnd() * 4).toFixed(1);
  const assists = +(6 + rnd() * 9).toFixed(1);
  const kda = +((kills + assists) / Math.max(1, deaths)).toFixed(1);
  const hoursPlayed = Math.round((games * 32) / 60);
  const pentas = Math.floor(rnd() * 6);
  const mainRole = ROLE_POOL[Math.floor(rnd() * ROLE_POOL.length)];

  // Recent form: walk a W/L history that lands near the win-rate.
  const recentForm: ('W' | 'L')[] = [];
  for (let i = 0; i < 12; i++) recentForm.push(rnd() < wr / 100 ? 'W' : 'L');
  // Current streak = trailing run of identical results.
  const last = recentForm[recentForm.length - 1] ?? 'W';
  let currentStreak = 0;
  for (let i = recentForm.length - 1; i >= 0 && recentForm[i] === last; i--) currentStreak++;
  const bestStreak = Math.max(currentStreak, 3 + Math.floor(rnd() * 7));

  const memberSince = `${MONTHS[Math.floor(rnd() * 12)]} ${2023 + Math.floor(rnd() * 3)}`;

  // Real teammates / rivals: dedupe everyone across the user's rosters.
  const seen = new Set<string>();
  const others: Member[] = [];
  for (const g of groups) {
    for (const m of rosterOf(g.id)) {
      if (m.tag === user.tag || seen.has(m.tag)) continue;
      seen.add(m.tag);
      others.push(m);
    }
  }

  const allyRecords = others.map((m) => matchup(user.tag, m, 'ally'));
  const enemyRecords = others.map((m) => matchup(user.tag, m, 'enemy'));

  const bestAlly = allyRecords.length
    ? [...allyRecords].sort((a, b) => b.wr - a.wr || b.games - a.games)[0]
    : null;
  const nemesis = enemyRecords.length
    ? [...enemyRecords].sort((a, b) => a.wr - b.wr || b.games - a.games)[0]
    : null;
  const favoriteVictim = enemyRecords.length
    ? [...enemyRecords].sort((a, b) => b.wr - a.wr || b.games - a.games)[0]
    : null;

  // Most-played champions across all groups.
  const champs = pickDistinct(rnd, CHAMPIONS, 5);
  const topChampions: ProfileChampion[] = champs
    .map((champion) => {
      const cgames = 12 + Math.floor(rnd() * 60);
      const cwr = 0.38 + rnd() * 0.4;
      const cwins = Math.round(cgames * cwr);
      return {
        champion,
        games: cgames,
        wins: cwins,
        wr: Math.round((cwins / cgames) * 100),
      };
    })
    .sort((a, b) => b.games - a.games);

  return {
    name: user.name,
    tag: user.tag,
    region: user.region || regionFromTag(user.tag),
    initials: user.initials,
    hue: 320,
    memberSince,
    games,
    wins,
    losses,
    wr,
    kills,
    deaths,
    assists,
    kda,
    hoursPlayed,
    pentas,
    mainRole,
    currentStreak,
    streakType: last,
    bestStreak,
    recentForm,
    bestAlly,
    nemesis,
    favoriteVictim,
    topChampions,
    groupCount: groups.length,
    groups: groupRecords,
  };
}
