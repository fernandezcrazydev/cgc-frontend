import { describe, expect, it, beforeEach } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatchHistoryStore } from './match-history-store';
import { Match, MatchParticipant } from './models';

describe('MatchHistoryStore', () => {
  let store: MatchHistoryStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient()] });
    store = TestBed.inject(MatchHistoryStore);
  });

  const participants = (m: Match): MatchParticipant[] => [
    ...m.blueTeam.participants,
    ...m.redTeam.participants,
  ];

  it('en estado inicial el store tiene 0 partidas y resúmenes limpios', () => {
    expect(store.allMatches().length).toBe(0);
    expect(store.allPersonalMatches().length).toBe(0);

    const personal = store.personalSummary();
    expect(personal.totalMatches).toBe(0);
    expect(personal.wins).toBe(0);
    expect(personal.losses).toBe(0);
    expect(personal.winrate).toBe(0);

    const group = store.groupSummary('cualquier-grupo');
    expect(group.totalMatches).toBe(0);
    expect(group.blueWinrate).toBe(0);
    expect(group.avgDurationMinutes).toBe(0);
    expect(group.topMvpName).toBeNull();
  });

  it('matchesByGroup devuelve lista vacía si el grupo no tiene partidas', () => {
    expect(store.matchesByGroup('grupo-1')).toEqual([]);
  });

  it('los filtros de campeón devuelven lista vacía cuando no hay partidas', () => {
    expect(store.playedChampionIdsInPersonal()).toEqual([]);
    expect(store.playedChampionIdsInGroup('grupo-1')).toEqual([]);
    expect(store.championAverages(103)).toBeNull();
  });

  it('una partida que no existe no rompe la navegación ni el head to head', () => {
    expect(store.matchById('no-existe')).toBeUndefined();
    expect(store.neighboursOf('no-existe')).toEqual({ prev: null, next: null });

    const dummyParticipant: MatchParticipant = {
      id: 'p-1',
      userId: 'u-1',
      riotId: 'Test#123',
      isGuest: false,
      team: 'red',
      role: 'MID',
      championId: 103,
      championName: 'Ahri',
      championLevel: 15,
      wasAutofill: false,
      lpDelta: 0,
      stats: {
        kills: 0, deaths: 0, assists: 0, cs: 0, csPerMin: 0, gold: 0,
        totalDamageToChampions: 0, damageSharePercentage: 0, damageTaken: 0,
        visionScore: 0, wardsPlaced: 0, wardsKilled: 0, items: [], spells: [4, 14],
        goldAt14: 0, csAt14: 0, wonLane: false,
      },
    };

    const h2h = store.headToHead(dummyParticipant);
    expect(h2h.games).toBe(0);
    expect(h2h.wins).toBe(0);
    expect(h2h.losses).toBe(0);
  });

  it('calcula correctamente derivaciones cuando se asignan partidas', () => {
    const fixture: Match = {
      id: 'test-m1',
      code: 'TM01',
      groupId: 'g-1',
      group: {
        id: 'g-1',
        name: 'Grupo 1',
        tag: 'EUW',
        initials: 'G1',
        color1: '#fff',
        color2: '#000',
        seasonName: 'Temporada 1',
      },
      source: 'import',
      durationSeconds: 1800,
      decidedAt: new Date().toISOString(),
      winningTeam: 'blue',
      userOutcome: 'win',
      userParticipant: {
        id: 'p-blue',
        userId: 'u-me',
        riotId: 'Me#EUW',
        isGuest: false,
        team: 'blue',
        role: 'TOP',
        championId: 24,
        championName: 'Jax',
        championLevel: 16,
        wasAutofill: false,
        lpDelta: 25,
        stats: {
          kills: 5, deaths: 1, assists: 4, cs: 200, csPerMin: 6.6, gold: 12000,
          totalDamageToChampions: 15000, damageSharePercentage: 25, damageTaken: 18000,
          visionScore: 20, wardsPlaced: 10, wardsKilled: 4, items: [], spells: [4, 12],
          goldAt14: 4000, csAt14: 100, wonLane: true,
        },
      },
      blueTeam: {
        side: 'blue',
        won: true,
        totalKills: 15,
        totalDeaths: 5,
        totalAssists: 20,
        totalGold: 50000,
        totalDamage: 60000,
        dragons: 2,
        barons: 1,
        towers: 7,
        participants: [],
      },
      redTeam: {
        side: 'red',
        won: false,
        totalKills: 5,
        totalDeaths: 15,
        totalAssists: 8,
        totalGold: 40000,
        totalDamage: 45000,
        dragons: 1,
        barons: 0,
        towers: 2,
        participants: [],
      },
    };

    store.allMatches.set([fixture]);

    expect(store.allMatches().length).toBe(1);
    expect(store.allPersonalMatches().length).toBe(1);
    expect(store.personalSummary().wins).toBe(1);
    expect(store.personalSummary().totalMatches).toBe(1);
    expect(store.personalSummary().winrate).toBe(100);
    expect(store.matchesByGroup('g-1').length).toBe(1);
    expect(store.matchesByGroup('otro-grupo').length).toBe(0);
    expect(store.playedChampionIdsInPersonal()).toEqual([24]);
  });
});
