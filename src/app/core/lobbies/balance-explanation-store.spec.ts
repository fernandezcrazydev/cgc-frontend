import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { LobbiesApi } from './lobbies-api';
import { BalanceExplanationStore } from './balance-explanation-store';
import { BalanceExplanationResponse } from './models';

const LOBBY_ID = 'lb1';

function explanation(overrides: Partial<BalanceExplanationResponse> = {}): BalanceExplanationResponse {
  return {
    matchups: [
      { lane: 'TOP', playerA: 'u1', playerB: 'u6', effectiveA: 1200, effectiveB: 1190, difference: 10 },
    ],
    autofills: [{ userId: 'u6', lane: 'TOP' }],
    globalDifference: 7,
    laneDifferenceSum: 120,
    worstLaneDifference: 60,
    staleness: 1.5,
    weightedCost: 340,
    laneCeilingExceeded: false,
    uncertainty: 400,
    provisional: true,
    ratedPlayers: 2,
    poolSize: 10,
    nearTies: 12,
    searchTruncated: false,
    repetition: 0.2,
    familiarity: 0.56,
    blueTeam: 'A',
    ...overrides,
  };
}

/** Un ProblemDetail del backend, que es de donde sale el `code` que separa los dos 404. */
function problem(status: number, code: string | null): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    url: '/api/v1/lobbies/lb1/balance/explanation',
    error: code ? { code, detail: 'technical english' } : 'not json',
  });
}

class ApiStub {
  calls = 0;
  impl: () => Observable<BalanceExplanationResponse> = () => of(explanation());

  balanceExplanation(): Observable<BalanceExplanationResponse> {
    this.calls++;
    return this.impl();
  }
}

describe('BalanceExplanationStore', () => {
  let store: BalanceExplanationStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [BalanceExplanationStore, { provide: LobbiesApi, useValue: api }],
    });
    store = TestBed.inject(BalanceExplanationStore);
  });

  it('carga la explicación y la deja en ready', async () => {
    await store.load(LOBBY_ID);

    expect(store.status()).toBe('ready');
    expect(store.explanation()?.globalDifference).toBe(7);
    expect(store.showingId).toBe(LOBBY_ID);
  });

  it('BALANCE_NOT_RECORDED no es un error: es su propio estado', async () => {
    api.impl = () => throwError(() => problem(404, 'BALANCE_NOT_RECORDED'));

    await store.load(LOBBY_ID);

    expect(store.status()).toBe('not-recorded');
    expect(store.explanation()).toBeNull();
  });

  it('LOBBY_NOT_FOUND es un 404 distinto del anterior', async () => {
    api.impl = () => throwError(() => problem(404, 'LOBBY_NOT_FOUND'));

    await store.load(LOBBY_ID);

    expect(store.status()).toBe('not-found');
  });

  it('un 404 sin code cae en not-found, que es lo que dice el número', async () => {
    api.impl = () => throwError(() => problem(404, null));

    await store.load(LOBBY_ID);

    expect(store.status()).toBe('not-found');
  });

  it('un 403 (no eres admin del grupo) tiene su propio estado', async () => {
    api.impl = () => throwError(() => problem(403, null));

    await store.load(LOBBY_ID);

    expect(store.status()).toBe('forbidden');
  });

  it('un fallo de red queda en error', async () => {
    api.impl = () => throwError(() => problem(0, null));

    await store.load(LOBBY_ID);

    expect(store.status()).toBe('error');
  });

  it('ensureLoaded no repite la petición de la misma sala', async () => {
    await store.ensureLoaded(LOBBY_ID);
    await store.ensureLoaded(LOBBY_ID);

    expect(api.calls).toBe(1);
  });

  it('ensureLoaded tampoco repite un final que ya conocemos', async () => {
    api.impl = () => throwError(() => problem(404, 'BALANCE_NOT_RECORDED'));

    await store.ensureLoaded(LOBBY_ID);
    await store.ensureLoaded(LOBBY_ID);

    expect(api.calls).toBe(1);
    expect(store.status()).toBe('not-recorded');
  });

  it('ensureLoaded comparte la petición en vuelo entre dos interesados', async () => {
    await Promise.all([store.ensureLoaded(LOBBY_ID), store.ensureLoaded(LOBBY_ID)]);

    expect(api.calls).toBe(1);
  });

  it('reload fuerza el refetch de la sala que se está mirando', async () => {
    await store.ensureLoaded(LOBBY_ID);
    await store.reload();

    expect(api.calls).toBe(2);
  });

  it('la respuesta de una sala ya abandonada no pisa a la nueva', async () => {
    let resolveFirst: ((value: BalanceExplanationResponse) => void) | null = null;
    api.impl = () =>
      new Observable<BalanceExplanationResponse>((sub) => {
        resolveFirst = (value) => {
          sub.next(value);
          sub.complete();
        };
      });
    const stale = store.load('lb-viejo');

    api.impl = () => of(explanation({ globalDifference: 999 }));
    await store.load(LOBBY_ID);

    resolveFirst!(explanation({ globalDifference: 1 }));
    await stale;

    expect(store.status()).toBe('ready');
    expect(store.explanation()?.globalDifference).toBe(999);
  });

  it('clear devuelve el store a idle', async () => {
    await store.load(LOBBY_ID);
    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.explanation()).toBeNull();
    expect(store.showingId).toBeNull();
  });
});
