import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { GroupStatsApi } from './group-stats-api';
import { GroupStatsStore } from './group-stats-store';
import { GroupStats, StatsScope } from './models';

function statsWith(matches: number): GroupStats {
  return {
    matches,
    matchesWithStats: matches,
    totalSeconds: matches * 1800,
    totalKills: matches * 30,
    side: { games: matches, blueWins: matches, redWins: 0 },
    objectives: [],
    champions: [],
    duos: [],
    lanes: [],
    records: [],
    players: [],
  };
}

const SCOPES: StatsScope[] = [
  { preset: 'BALANCED', matches: 10, seasons: [] },
  { preset: 'PRECISION', matches: 0, seasons: [] },
  { preset: 'CHAOS', matches: 0, seasons: [] },
];

function setUp(api: Partial<GroupStatsApi>) {
  TestBed.configureTestingModule({
    providers: [GroupStatsStore, { provide: GroupStatsApi, useValue: api }],
  });
  return TestBed.inject(GroupStatsStore);
}

describe('GroupStatsStore', () => {
  it('publica el agregado y pasa a ready', async () => {
    const getStats = vi.fn().mockReturnValue(of(statsWith(10)));
    const store = setUp({ getStats });

    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });

    expect(store.status()).toBe('ready');
    expect(store.stats()?.matches).toBe(10);
  });

  /** Volver al alcance del que vienes no vuelve a pedirlo: es el mismo conjunto de partidas. */
  it('cachea por alcance y no repite la petición', async () => {
    const getStats = vi.fn().mockReturnValue(of(statsWith(10)));
    const store = setUp({ getStats });

    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });

    expect(getStats).toHaveBeenCalledTimes(1);
  });

  it('cambiar de modalidad sí es una petición nueva', async () => {
    const getStats = vi.fn().mockReturnValue(of(statsWith(10)));
    const store = setUp({ getStats });

    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    await store.ensure('grp-1', { preset: 'CHAOS', leagueId: null });

    expect(getStats).toHaveBeenCalledTimes(2);
  });

  it('y cambiar de temporada también', async () => {
    const getStats = vi.fn().mockReturnValue(of(statsWith(10)));
    const store = setUp({ getStats });

    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: 'liga-1' });

    expect(getStats).toHaveBeenCalledTimes(2);
  });

  it('deduplica la petición en vuelo del mismo alcance', async () => {
    const pending = new Subject<GroupStats>();
    const getStats = vi.fn().mockReturnValue(pending.asObservable());
    const store = setUp({ getStats });

    const first = store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    const second = store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });

    pending.next(statsWith(10));
    pending.complete();
    await Promise.all([first, second]);

    expect(getStats).toHaveBeenCalledTimes(1);
  });

  /**
   * <strong>El borde que de verdad importa.</strong> Pulsar tres pestañas seguidas lanza tres
   * peticiones y no tienen por qué volver en orden. Si se escribiera la última EN LLEGAR, la
   * pantalla acabaría enseñando las cifras de la modalidad que no está seleccionada — y no hay
   * forma de notarlo mirando: son números plausibles bajo el rótulo equivocado.
   */
  it('descarta la respuesta de un alcance que ya no es el activo', async () => {
    const slow = new Subject<GroupStats>();
    const fast = new Subject<GroupStats>();
    const getStats = vi.fn((_: string, query: { preset: string }) =>
      query.preset === 'BALANCED' ? slow.asObservable() : fast.asObservable(),
    );
    const store = setUp({ getStats } as unknown as Partial<GroupStatsApi>);

    const first = store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    const second = store.ensure('grp-1', { preset: 'CHAOS', leagueId: null });

    // El segundo alcance contesta primero y es el activo: ese sí se pinta.
    fast.next(statsWith(3));
    fast.complete();
    await second;
    expect(store.stats()?.matches).toBe(3);

    // Y el primero llega tarde: se cachea, pero no pisa lo que se está mirando.
    slow.next(statsWith(99));
    slow.complete();
    await first;
    expect(store.stats()?.matches).toBe(3);
  });

  it('un 403 o un 404 son not-found, no error: el grupo no es tuyo o no existe', async () => {
    const getStats = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const store = setUp({ getStats });

    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });

    expect(store.status()).toBe('not-found');
  });

  it('un 500 deja la vista en error, con su reintento', async () => {
    const getStats = vi
      .fn()
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const store = setUp({ getStats });

    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });

    expect(store.status()).toBe('error');
  });

  it('reload fuerza el refetch aunque el alcance esté cacheado', async () => {
    const getStats = vi.fn().mockReturnValue(of(statsWith(10)));
    const store = setUp({ getStats });

    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    await store.reload('grp-1', { preset: 'BALANCED', leagueId: null });

    expect(getStats).toHaveBeenCalledTimes(2);
  });

  it('los alcances se piden una vez por grupo', async () => {
    const getScopes = vi.fn().mockReturnValue(of(SCOPES));
    const store = setUp({ getScopes });

    await store.ensureScopes('grp-1');
    await store.ensureScopes('grp-1');

    expect(getScopes).toHaveBeenCalledTimes(1);
    expect(store.scopesStatus()).toBe('ready');
    expect(store.playedScopes().map((s) => s.preset)).toEqual(['BALANCED']);
  });

  it('clear no deja el grupo del usuario anterior en memoria', async () => {
    const getStats = vi.fn().mockReturnValue(of(statsWith(10)));
    const getScopes = vi.fn().mockReturnValue(of(SCOPES));
    const store = setUp({ getStats, getScopes });

    await store.ensureScopes('grp-1');
    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    store.clear();

    expect(store.stats()).toBeNull();
    expect(store.scopes()).toEqual([]);
    expect(store.status()).toBe('idle');

    // Y la caché también se vacía: el alcance se vuelve a pedir de verdad.
    await store.ensure('grp-1', { preset: 'BALANCED', leagueId: null });
    expect(getStats).toHaveBeenCalledTimes(2);
  });
});
