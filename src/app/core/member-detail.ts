/**
 * Deterministic per-member "expanded card" data for the group roster. When a
 * member row is clicked, the detail panel shows their top champions, role tags
 * and three head-to-head highlights (best duo, favourite victim, worst
 * nightmare) drawn from real roster mates. Seeded by the member tag so a given
 * member always renders the same details until the backend lands.
 */
import { Member, REAL_CHAMPION_IDS } from './lobby';
import { hash, seeded } from './group-ranking';

/** A head-to-head highlight against another player. */
export interface MemberMatchup {
  /** Riot-style tag of the opponent/teammate, e.g. "Pix3lQueen#EUW". */
  tag: string;
  initials: string;
  /** Hue (0-360) for the avatar gradient. */
  hue: number;
  wins: number;
  games: number;
  /** Win-rate percentage, rounded. */
  wr: number;
}

/** Everything shown in a member's expanded detail panel. */
export interface MemberDetail {
  /**
   * Top champions. BACKEND NOTE: ids reales de ddragon elegidos de
   * `REAL_CHAMPION_IDS` (ver `core/lobby.ts`) mientras no exista el endpoint
   * de estadísticas; la vista resuelve `id → ChampionSummary` con
   * `GameDataStore.championById()`.
   */
  championIds: number[];
  /** Role tags, e.g. ['FLEX'] or ['MID', 'ADC']. */
  roles: string[];
  /** Teammate this member wins with the most. */
  bestDuo: MemberMatchup;
  /** Opponent this member beats the most. */
  favoriteVictim: MemberMatchup;
  /** Opponent that beats this member the most. */
  worstNightmare: MemberMatchup;
}

const ROLE_POOL = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];

/** Synthetic opponents used when a roster is too small for real matchups. */
const FALLBACK_FOES: Member[] = [
  { name: 'SoloQ_Demon', tag: 'SoloQ_Demon#KR', initials: 'SO', role: 'MID', owner: false, hue: 282 },
  { name: 'D4rkFl4me', tag: 'D4rkFl4me#CITY', initials: 'D4', role: 'ADC', owner: false, hue: 12 },
  { name: 'V0idWalker', tag: 'V0idWalker#666', initials: 'V0', role: 'TOP', owner: false, hue: 198 },
];

/** Pick `n` distinct items from `arr` using the seeded generator. */
function pickDistinct<T>(rnd: () => number, arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

/** Build a single matchup against `foe`; `flavor` skews the win-rate. */
function matchup(rnd: () => number, foe: Member, flavor: 'high' | 'low'): MemberMatchup {
  const games = 3 + Math.floor(rnd() * 4); // 3–6, like the screenshot
  const ratio = flavor === 'high' ? 0.7 + rnd() * 0.3 : rnd() * 0.4;
  const wins = Math.min(games, Math.round(games * ratio));
  return {
    tag: foe.tag,
    initials: foe.initials,
    hue: foe.hue,
    wins,
    games,
    wr: Math.round((wins / games) * 100),
  };
}

/** Build an OP.GG profile URL for a "Name#TAG" Riot tag. */
export function opggUrl(tag: string): string {
  const [name, line = ''] = tag.split('#');
  const region = (line || 'euw').toLowerCase();
  return `https://www.op.gg/summoners/${region}/${encodeURIComponent(name)}-${encodeURIComponent(line)}`;
}
