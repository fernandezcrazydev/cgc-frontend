/**
 * Cross-surface player badges. Derives a small set of "accolade" chips from the
 * very same stats/awards pass that powers the Estadísticas screen, so a player
 * carries the same trophies wherever they appear — the group ranking and the
 * group's member list. Single source of truth: change the criteria here and both
 * surfaces stay in sync.
 *
 * Keyed by member NAME because that's the only identifier shared across surfaces
 * in the current mock (the ranking is seeded from a name pool, not the live
 * roster). BACKEND NOTE: key by a stable player id/tag once that exists.
 */
import { Member } from './lobby';
import { AwardColor, StatScope, awardsFor, statsFor } from './group-stats';

export interface MemberBadge {
  /** Stable id (matches the award id, or 'mvp'). */
  id: string;
  /** Emoji/symbol shown in the chip. */
  glyph: string;
  /** Short label, e.g. "MVP" or "EL GRANJERO" (used in the tooltip). */
  title: string;
  /** The number that justifies it, e.g. "5.2 cs/min" (used in the tooltip). */
  detail: string;
  color: AwardColor;
}

/**
 * Window the cross-surface badges are computed at. The season is the canonical
 * span for an accolade that should follow a player around the group, rather than
 * a single night's noise.
 */
export const BADGE_SCOPE: StatScope = 'temporada';

/**
 * Build a name → badges map for a group's roster. Includes the MVP (highest
 * composite rating) plus every trophy-wall award, each pinned to its winner.
 */
export function badgesFor(
  groupId: string,
  roster: readonly Member[],
  scope: StatScope = BADGE_SCOPE,
): Map<string, MemberBadge[]> {
  const map = new Map<string, MemberBadge[]>();
  const stats = statsFor(groupId, roster, scope);
  if (!stats.length) return map;

  const add = (name: string, badge: MemberBadge): void => {
    const list = map.get(name);
    if (list) list.push(badge);
    else map.set(name, [badge]);
  };

  // MVP — highest composite rating in the scope.
  const mvp = [...stats].sort((a, b) => b.rating - a.rating)[0];
  add(mvp.member.name, {
    id: 'mvp',
    glyph: '★',
    title: 'MVP',
    detail: `Rating ${mvp.rating}`,
    color: 'pink',
  });

  // Trophy-wall awards — one badge each, on its winner.
  for (const a of awardsFor(stats)) {
    add(a.member.name, {
      id: a.id,
      glyph: a.glyph,
      title: a.title,
      detail: a.value,
      color: a.color,
    });
  }

  return map;
}
