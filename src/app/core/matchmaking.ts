/**
 * Internal matchmaking — the "black box" that turns 10 players into a balanced
 * Blue-vs-Red 5v5. Shared by the create-match wizard (initial split) and the sala
 * (Vía 2 rebalance / Vía 3 after swapping players), so both produce identical
 * results from the same inputs.
 *
 * Algorithm (kept simple/deterministic on purpose; the real backend engine can
 * replace it):
 *  1. Seeded shuffle (so "rebalancear" explores a different valid layout).
 *  2. Assign every player a role, 2 per role, respecting their allowed roles —
 *     a bipartite matching (Kuhn's). Empty `roles` means "any role".
 *  3. Brute-force all 2^5 ways to split the 5 role-pairs into teams; pick the one
 *     that satisfies the most relationship rules, breaking ties toward the most
 *     balanced elo.
 *
 * It works purely with tags/keys/elo — callers map the result back to their own
 * richer player/champion data.
 */

import { hash, seeded } from './group-ranking';

/** The five playable role keys (match member-detail / the wizard's lineRolesList). */
export const MATCH_ROLES = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'] as const;

/** Stable internal elo (480-800) for a player tag — shared so sala == wizard. */
export function internalElo(tag: string): number {
  return 480 + Math.floor(seeded(hash(tag))() * 321);
}

export interface MatchmakePlayer {
  tag: string;
  /** Allowed role keys. Empty = the player can take any role. */
  roles: string[];
  /** Internal elo, used to balance the two teams. */
  elo: number;
}

/** Step-3 relationship rule (same-team A / opposite A-vs-B / lane duel). */
export interface MatchmakeRule {
  kind: 'together' | 'versus' | 'lane';
  a: string[];
  b: string[];
}

export interface MatchmakeSlot {
  tag: string;
  roleKey: string;
  team: 'blue' | 'red';
}

export interface MatchmakeResult {
  /** 10 assigned slots, ordered by role then team. */
  slots: MatchmakeSlot[];
  /** Relationship rules satisfied, out of the total. */
  satisfied: number;
  total: number;
}

/** Tiny seeded RNG (mulberry32) so a given seed always yields the same split. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Assign each player a role (2 per role) via bipartite matching, or null if impossible. */
function assignRoles(players: MatchmakePlayer[]): Map<string, string> | null {
  const slots: string[] = [];
  for (const r of MATCH_ROLES) slots.push(r, r);
  const slotToPlayer: number[] = new Array(slots.length).fill(-1);
  const allowed = (p: MatchmakePlayer): readonly string[] => (p.roles.length ? p.roles : MATCH_ROLES);

  const tryAssign = (pi: number, seen: boolean[]): boolean => {
    for (let s = 0; s < slots.length; s++) {
      if (seen[s] || !allowed(players[pi]).includes(slots[s])) continue;
      seen[s] = true;
      if (slotToPlayer[s] === -1 || tryAssign(slotToPlayer[s], seen)) {
        slotToPlayer[s] = pi;
        return true;
      }
    }
    return false;
  };

  for (let pi = 0; pi < players.length; pi++) tryAssign(pi, new Array(slots.length).fill(false));

  const map = new Map<string, string>();
  slots.forEach((role, s) => {
    const pi = slotToPlayer[s];
    if (pi >= 0) map.set(players[pi].tag, role);
  });
  return map.size === players.length ? map : null;
}

/** How many relationship rules a given team assignment satisfies. */
function scoreRules(rules: MatchmakeRule[], teamOf: Map<string, 'blue' | 'red'>): number {
  let score = 0;
  for (const r of rules) {
    if (r.kind === 'together') {
      if (new Set(r.a.map((t) => teamOf.get(t))).size === 1) score++;
    } else {
      const ta = new Set(r.a.map((t) => teamOf.get(t)));
      const tb = new Set(r.b.map((t) => teamOf.get(t)));
      if (ta.size === 1 && tb.size === 1 && [...ta][0] !== [...tb][0]) score++;
    }
  }
  return score;
}

/**
 * Produce a balanced Blue-vs-Red split for exactly 10 players. Returns null when
 * the role constraints can't be satisfied (the caller should have validated this).
 */
export function matchmake(
  players: MatchmakePlayer[],
  rules: MatchmakeRule[],
  seed: number,
): MatchmakeResult | null {
  if (players.length !== MATCH_ROLES.length * 2) return null; // 5v5 only

  const rng = mulberry32(Math.imul(seed || 1, 0x9e3779b1));
  const order = [...players];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const roleMap = assignRoles(order);
  if (!roleMap) return null;

  const pairByRole = new Map<string, string[]>();
  for (const p of players) {
    const role = roleMap.get(p.tag) as string;
    pairByRole.set(role, [...(pairByRole.get(role) ?? []), p.tag]);
  }
  const eloOf = new Map(players.map((p) => [p.tag, p.elo]));

  let best: Map<string, 'blue' | 'red'> | null = null;
  let bestScore = -1;
  let bestDiff = Infinity;
  for (let mask = 0; mask < 32; mask++) {
    const teamOf = new Map<string, 'blue' | 'red'>();
    let blueElo = 0;
    let redElo = 0;
    MATCH_ROLES.forEach((role, i) => {
      const pair = pairByRole.get(role) ?? [];
      const firstBlue = (mask >> i) & 1;
      if (pair[0]) {
        teamOf.set(pair[0], firstBlue ? 'blue' : 'red');
        firstBlue ? (blueElo += eloOf.get(pair[0]) ?? 0) : (redElo += eloOf.get(pair[0]) ?? 0);
      }
      if (pair[1]) {
        teamOf.set(pair[1], firstBlue ? 'red' : 'blue');
        firstBlue ? (redElo += eloOf.get(pair[1]) ?? 0) : (blueElo += eloOf.get(pair[1]) ?? 0);
      }
    });
    const score = scoreRules(rules, teamOf);
    const diff = Math.abs(blueElo - redElo);
    if (score > bestScore || (score === bestScore && diff < bestDiff)) {
      bestScore = score;
      bestDiff = diff;
      best = teamOf;
    }
  }
  if (!best) return null;

  const slots: MatchmakeSlot[] = [];
  for (const role of MATCH_ROLES) {
    for (const tag of pairByRole.get(role) ?? []) {
      slots.push({ tag, roleKey: role, team: best.get(tag) as 'blue' | 'red' });
    }
  }
  return { slots, satisfied: bestScore, total: rules.length };
}
