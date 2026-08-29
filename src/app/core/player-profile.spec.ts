import { describe, expect, it } from 'vitest';
import { buildPlayerProfile, buildMemberProfile } from './player-profile';
import { GROUPS, CURRENT_USER, Member } from './lobby';

describe('Player Profile Domain', () => {
  const dummyRoster: Member[] = [
    {
      userId: 'm1',
      name: 'Pix3lQueen',
      tag: 'Pix3lQueen#LAN',
      role: 'Miembro',
      initials: 'PQ',
      owner: false,
      hue: 200,
    },
    {
      userId: 'm2',
      name: 'Cr1msonByte',
      tag: 'Cr1msonByte#LAN',
      role: 'Miembro',
      initials: 'CB',
      owner: false,
      hue: 20,
    },
  ];

  const rosterOf = (_groupId: string) => dummyRoster;

  it('buildPlayerProfile generates stable profile with 5v5 DNA metrics', () => {
    const profile = buildPlayerProfile(CURRENT_USER, GROUPS, rosterOf);

    expect(profile.name).toBe(CURRENT_USER.name);
    expect(profile.tag).toBe(CURRENT_USER.tag);
    expect(profile.games).toBeGreaterThan(0);
    expect(profile.wr).toBeGreaterThanOrEqual(0);
    expect(profile.wr).toBeLessThanOrEqual(100);

    // DNA checks
    expect(profile.dna).toBeDefined();
    expect(profile.dna.lane.wonLanePercentage).toBeGreaterThanOrEqual(0);
    expect(profile.dna.combat.damageSharePercentage).toBeGreaterThan(0);
    expect(profile.dna.vision.visionScoreAvg).toBeGreaterThan(0);
    expect(profile.dna.economy.csPerMinAvg).toBeGreaterThan(0);
    expect(profile.dna.clutch.mvpRate).toBeGreaterThanOrEqual(0);

    // Archetype
    expect(profile.archetype).toBeDefined();
    expect(profile.archetype.title).toBeTruthy();
    expect(profile.archetype.icon).toBeTruthy();

    // Top champions & roles
    expect(profile.topChampions.length).toBeGreaterThan(0);
    expect(profile.topChampions[0].kda).toBeDefined();
    expect(profile.topChampions[0].coreItemIds.length).toBeGreaterThan(0);
    expect(profile.roleStats.TOP).toBeDefined();
    expect(profile.roleStats.MID).toBeDefined();

    // Recent matches & LP trend
    expect(profile.recentMatches.length).toBe(12);
    expect(profile.recentMatches[0].kda).toContain('/');
  });

  it('buildMemberProfile builds member card with mutual H2H comparison', () => {
    const memberProfile = buildMemberProfile('Pix3lQueen#LAN', CURRENT_USER, GROUPS, rosterOf);

    expect(memberProfile).not.toBeNull();
    expect(memberProfile?.targetUserId).toBe('Pix3lQueen#LAN');
    expect(memberProfile?.mutualH2h).toBeDefined();
    expect(memberProfile?.mutualH2h.targetName).toBe('Pix3lQueen');
    expect(memberProfile?.mutualH2h.gamesTogether).toBeGreaterThan(0);
    expect(memberProfile?.mutualH2h.gamesVersus).toBeGreaterThan(0);
    expect(memberProfile?.mutualH2h.statsComparison.kdaUser).toBeDefined();
    expect(memberProfile?.mutualH2h.statsComparison.kdaTarget).toBeDefined();
  });
});
