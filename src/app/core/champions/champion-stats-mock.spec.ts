import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { banRateFor } from '../group-stats-mock';
import {
  ChampionStatsMockSource,
  mockMatchFixture,
  mockParticipantFixture,
  skillOrderFor,
} from './champion-stats-mock';

describe('ChampionStatsMockSource', () => {
  it('un campeón con 3 partidas y 2 victorias da games: 3, wins: 2, winrate: 67', async () => {
    const source = new ChampionStatsMockSource();

    const pAhri1 = mockParticipantFixture({ id: 'p1', team: 'blue', role: 'MID', championId: 103 });
    const pAhri2 = mockParticipantFixture({ id: 'p2', team: 'blue', role: 'MID', championId: 103 });
    const pAhri3 = mockParticipantFixture({ id: 'p3', team: 'red', role: 'MID', championId: 103 });

    const m1 = mockMatchFixture({ id: 'm1', winningTeam: 'blue', blue: [pAhri1], red: [] });
    const m2 = mockMatchFixture({ id: 'm2', winningTeam: 'blue', blue: [pAhri2], red: [] });
    const m3 = mockMatchFixture({ id: 'm3', winningTeam: 'blue', blue: [], red: [pAhri3] });

    source.useCorpus([m1, m2, m3]);

    const res = await firstValueFrom(source.stats(null, 103));
    expect(res).not.toBeNull();
    expect(res!.games).toBe(3);
    expect(res!.wins).toBe(2);
    expect(res!.winrate).toBe(67);
  });

  it('las sinergias cuentan a los cuatro compañeros y no al propio campeón', async () => {
    const source = new ChampionStatsMockSource();

    const pAhri = mockParticipantFixture({ id: 'p1', team: 'blue', role: 'MID', championId: 103 });
    const pTop = mockParticipantFixture({ id: 'p2', team: 'blue', role: 'TOP', championId: 266 });
    const pJg = mockParticipantFixture({ id: 'p3', team: 'blue', role: 'JUNGLA', championId: 64 });
    const pAdc = mockParticipantFixture({ id: 'p4', team: 'blue', role: 'ADC', championId: 222 });
    const pSup = mockParticipantFixture({ id: 'p5', team: 'blue', role: 'SUPPORT', championId: 89 });

    const m = mockMatchFixture({
      id: 'm1',
      winningTeam: 'blue',
      blue: [pAhri, pTop, pJg, pAdc, pSup],
      red: [],
    });

    source.useCorpus([m]);

    const res = await firstValueFrom(source.stats(null, 103));
    expect(res).not.toBeNull();
    expect(res!.synergies.length).toBe(4);
    expect(res!.synergies.some((s) => s.championId === 103)).toBe(false);
    expect(res!.synergies.map((s) => s.championId).sort((a, b) => a - b)).toEqual([64, 89, 222, 266]);
  });

  it('el counter es el rival de la misma posición, no los cinco del otro equipo', async () => {
    const source = new ChampionStatsMockSource();

    const pAhri = mockParticipantFixture({ id: 'p1', team: 'blue', role: 'MID', championId: 103 });
    const pEnemyMid = mockParticipantFixture({ id: 'e1', team: 'red', role: 'MID', championId: 238 });
    const pEnemyTop = mockParticipantFixture({ id: 'e2', team: 'red', role: 'TOP', championId: 266 });

    const m = mockMatchFixture({
      id: 'm1',
      winningTeam: 'red',
      blue: [pAhri],
      red: [pEnemyMid, pEnemyTop],
    });

    source.useCorpus([m]);

    const res = await firstValueFrom(source.stats(null, 103));
    expect(res).not.toBeNull();
    expect(res!.counters.length).toBe(1);
    expect(res!.counters[0].championId).toBe(238);
    expect(res!.counters[0].games).toBe(1);
    expect(res!.counters[0].wins).toBe(0);
    expect(res!.counters[0].winrate).toBe(0);
  });

  it('stats() de un campeón que no aparece en ninguna partida resuelve a null', async () => {
    const source = new ChampionStatsMockSource();

    source.useCorpus([]);

    const res = await firstValueFrom(source.stats(null, 999));
    expect(res).toBeNull();
  });

  it('skillOrderFor y banRateFor devuelven lo mismo llamadas dos veces', () => {
    const order1 = skillOrderFor(103);
    const order2 = skillOrderFor(103);
    expect(order1).toEqual(order2);

    const ban1 = banRateFor('g1', 103);
    const ban2 = banRateFor('g1', 103);
    expect(ban1).toBe(ban2);
  });

  it('con tres partidas que compartan piedra angular y árbol secundario pero difieran en las runas menores, runePage.games es 3', async () => {
    const source = new ChampionStatsMockSource();

    const pAhri1 = mockParticipantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
      stats: {
        kills: 5,
        deaths: 2,
        assists: 5,
        cs: 150,
        csPerMin: 5,
        gold: 10000,
        totalDamageToChampions: 15000,
        damageSharePercentage: 25,
        damageTaken: 8000,
        visionScore: 15,
        wardsPlaced: 8,
        wardsKilled: 2,
        items: [],
        spells: [4, 14],
        primaryTreeId: 8100,
        secondaryRuneTreeId: 8000,
        primaryRuneId: 8112,
        primaryRuneIds: [8126, 8138, 8105],
        secondaryRuneIds: [8009, 8014],
        statShardIds: [5008, 5008, 5002],
      },
    });

    const pAhri2 = mockParticipantFixture({
      id: 'p2',
      team: 'blue',
      role: 'MID',
      championId: 103,
      stats: {
        kills: 6,
        deaths: 1,
        assists: 4,
        cs: 160,
        csPerMin: 5.5,
        gold: 11000,
        totalDamageToChampions: 18000,
        damageSharePercentage: 30,
        damageTaken: 7000,
        visionScore: 18,
        wardsPlaced: 9,
        wardsKilled: 3,
        items: [],
        spells: [4, 14],
        primaryTreeId: 8100,
        secondaryRuneTreeId: 8000,
        primaryRuneId: 8112,
        primaryRuneIds: [8143, 8138, 8135],
        secondaryRuneIds: [8009, 8017],
        statShardIds: [5008, 5008, 5003],
      },
    });

    const pAhri3 = mockParticipantFixture({
      id: 'p3',
      team: 'red',
      role: 'MID',
      championId: 103,
      stats: {
        kills: 2,
        deaths: 5,
        assists: 3,
        cs: 130,
        csPerMin: 4.5,
        gold: 7000,
        totalDamageToChampions: 10000,
        damageSharePercentage: 18,
        damageTaken: 12000,
        visionScore: 10,
        wardsPlaced: 5,
        wardsKilled: 1,
        items: [],
        spells: [4, 14],
        primaryTreeId: 8100,
        secondaryRuneTreeId: 8000,
        primaryRuneId: 8112,
        primaryRuneIds: [8139, 8138, 8106],
        secondaryRuneIds: [8009, 8014],
        statShardIds: [5008, 5008, 5002],
      },
    });

    const m1 = mockMatchFixture({ id: 'm1', winningTeam: 'blue', blue: [pAhri1], red: [], decidedAt: '2026-09-01T10:00:00Z' });
    const m2 = mockMatchFixture({ id: 'm2', winningTeam: 'blue', blue: [pAhri2], red: [], decidedAt: '2026-09-02T10:00:00Z' });
    const m3 = mockMatchFixture({ id: 'm3', winningTeam: 'blue', blue: [], red: [pAhri3], decidedAt: '2026-09-03T10:00:00Z' });

    source.useCorpus([m1, m2, m3]);

    const res = await firstValueFrom(source.stats(null, 103));
    expect(res).not.toBeNull();
    expect(res!.runePage).not.toBeNull();
    expect(res!.runePage!.games).toBe(3);
    expect(res!.runePage!.wins).toBe(2);
    expect(res!.runePage!.keystoneId).toBe(8112);
    expect(res!.runePage!.secondaryTreeId).toBe(8000);
    expect(res!.runePage!.primaryRuneIds).toEqual([8139, 8138, 8106]);
  });

  it('cuenta las dos apariciones cuando el mismo campeón se juega en los dos equipos', async () => {
    const source = new ChampionStatsMockSource();

    const pAhriBlue = mockParticipantFixture({ id: 'p1', team: 'blue', role: 'MID', championId: 103 });
    const pAhriRed = mockParticipantFixture({ id: 'p2', team: 'red', role: 'MID', championId: 103 });

    const m = mockMatchFixture({
      id: 'm1',
      winningTeam: 'blue',
      blue: [pAhriBlue],
      red: [pAhriRed],
    });

    source.useCorpus([m]);

    const statsRes = await firstValueFrom(source.stats(null, 103));
    expect(statsRes).not.toBeNull();
    expect(statsRes!.games).toBe(2);
    expect(statsRes!.wins).toBe(1);
    expect(statsRes!.winrate).toBe(50);

    const boardRes = await firstValueFrom(source.board(null));
    const ahriRow = boardRes.rows.find((r) => r.championId === 103);
    expect(ahriRow).toBeDefined();
    expect(ahriRow!.games).toBe(2);
    expect(ahriRow!.wins).toBe(1);
    expect(ahriRow!.winrate).toBe(50);
  });
});
