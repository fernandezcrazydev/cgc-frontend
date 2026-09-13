import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, beforeEach } from 'vitest';
import { ChampionStatsStore } from './champion-stats-store';
import { ChampionStatsSource } from './champion-stats-api';
import { ChampionBoard, ChampionStats } from './models';

class SourceStub implements ChampionStatsSource {
  boardCalls = 0;
  statsCalls = 0;
  failBoard = false;
  failStats = false;

  board(groupId: string | null): Observable<ChampionBoard> {
    this.boardCalls++;
    if (this.failBoard) return throwError(() => new Error('Fallo al cargar tablero'));
    return of({ totalMatches: 10, rows: [] });
  }

  stats(groupId: string | null, championId: number): Observable<ChampionStats | null> {
    this.statsCalls++;
    if (this.failStats) return throwError(() => new Error('Fallo al cargar stats'));
    return of({
      championId,
      role: 'MID',
      tier: 'S',
      tierWeight: 4,
      games: 5,
      wins: 3,
      losses: 2,
      winrate: 60,
      pickrate: 50,
      avgKills: 6,
      avgDeaths: 2,
      avgAssists: 8,
      kdaRatio: '7.00',
      kdaNum: 7,
      avgDamagePerMin: 600,
      laneWinrate: 60,
      avgGoldAt14: 4000,
      avgCsAt14: 110,
      avgGoldPerMin: 450,
      avgCsPerMin: 7.5,
      avgVisionScore: 18,
      avgDamageShare: 25,
      specialist: null,
      scope: groupId ? 'group' : 'global',
      firstBloodRate: 20,
      firstTowerRate: 20,
      banRate: 10,
      skillOrder: ['Q', 'W', 'E'],
      specialists: [],
      synergies: [],
      counters: [],
      items: [],
      runePage: null,
    });
  }
}

describe('ChampionStatsStore', () => {
  let store: ChampionStatsStore;
  let source: SourceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChampionStatsStore],
    });
    store = TestBed.inject(ChampionStatsStore);
    source = new SourceStub();
    store.useSource(source);
  });

  it('board() expone su propio status y carga el dato', async () => {
    const entrySig = store.board('g1');
    expect(entrySig().status).toBe('loading');

    await Promise.resolve();
    await Promise.resolve();

    expect(entrySig().status).toBe('ready');
    expect(entrySig().data).not.toBeNull();
    expect(entrySig().data!.totalMatches).toBe(10);
  });

  it('stats() expone su propio status independiente de board()', async () => {
    const boardSig = store.board('g1');
    await Promise.resolve();
    await Promise.resolve();
    expect(boardSig().status).toBe('ready');

    const statsSig = store.stats('g1', 103);
    expect(statsSig().status).toBe('loading');
    expect(boardSig().status).toBe('ready');

    await Promise.resolve();
    await Promise.resolve();

    expect(statsSig().status).toBe('ready');
    expect(statsSig().data?.championId).toBe(103);
  });

  it('un error en board no contamina el estado de una ficha de campeón', async () => {
    source.failBoard = true;
    const boardSig = store.board('g1');
    const statsSig = store.stats('g1', 103);

    await Promise.resolve();
    await Promise.resolve();

    expect(boardSig().status).toBe('error');
    expect(boardSig().error).toBe('Fallo al cargar tablero');

    expect(statsSig().status).toBe('ready');
    expect(statsSig().error).toBeNull();
    expect(statsSig().data?.championId).toBe(103);
  });

  it('clear() conserva las referencias de las señales pero resetea su valor a idle/null', async () => {
    const statsSig1 = store.stats('g1', 103);
    await Promise.resolve();
    await Promise.resolve();
    expect(statsSig1().status).toBe('ready');

    store.clear();

    expect(statsSig1().status).toBe('idle');
    expect(statsSig1().data).toBeNull();

    const statsSig2 = store.stats('g1', 103);
    expect(statsSig1).toBe(statsSig2);
  });

  it('invalidate() re-ejecuta las peticiones para las señales existentes', async () => {
    store.board('g1');
    store.stats('g1', 103);
    await Promise.resolve();
    await Promise.resolve();

    expect(source.boardCalls).toBe(1);
    expect(source.statsCalls).toBe(1);

    store.invalidate();
    await Promise.resolve();
    await Promise.resolve();

    expect(source.boardCalls).toBe(2);
    expect(source.statsCalls).toBe(2);
  });
});
