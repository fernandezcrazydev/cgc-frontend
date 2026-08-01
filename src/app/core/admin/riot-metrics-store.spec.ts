import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { RiotApiMetrics } from './admin-models';
import { RiotMetricsApi } from './riot-metrics-api';
import { RiotMetricsStore } from './riot-metrics-store';

function metrics(windowHours: number): RiotApiMetrics {
  return {
    windowHours,
    totals: {
      calls: 0,
      rateLimited: 0,
      failed: 0,
      interactive: 0,
      background: 0,
      avgDurationMs: 0,
      maxDurationMs: 0,
    },
    topEndpoints: [],
    hourly: [],
    peakHours: [],
    topUsers: [],
  };
}

/** Doble manual con resolución diferida, para observar el estado con la petición en vuelo. */
class ApiDouble {
  calls: number[] = [];
  private resolvers: Array<(m: RiotApiMetrics) => void> = [];
  shouldFail = false;

  metrics(hours: number): Observable<RiotApiMetrics> {
    this.calls.push(hours);
    if (this.shouldFail) return throwError(() => new Error('boom'));
    return new Observable<RiotApiMetrics>((subscriber) => {
      this.resolvers.push((m) => {
        subscriber.next(m);
        subscriber.complete();
      });
    });
  }

  resolveAll(hours: number): void {
    const pending = this.resolvers;
    this.resolvers = [];
    pending.forEach((resolve) => resolve(metrics(hours)));
  }
}

describe('RiotMetricsStore', () => {
  let store: RiotMetricsStore;
  let api: ApiDouble;

  beforeEach(() => {
    api = new ApiDouble();
    TestBed.configureTestingModule({
      providers: [{ provide: RiotMetricsApi, useValue: api }],
    });
    store = TestBed.inject(RiotMetricsStore);
  });

  it('carga la ventana de 24 h por defecto', async () => {
    const loading = store.ensureLoaded();
    expect(store.status()).toBe('loading');
    expect(api.calls).toEqual([24]);

    api.resolveAll(24);
    await loading;

    expect(store.status()).toBe('ready');
    expect(store.metrics()?.windowHours).toBe(24);
  });

  /** Dos vistas montándose a la vez no deben hacer dos veces la misma consulta. */
  it('deduplica las cargas concurrentes en una sola petición', async () => {
    const first = store.ensureLoaded();
    const second = store.ensureLoaded();

    expect(api.calls).toEqual([24]);

    api.resolveAll(24);
    await Promise.all([first, second]);
  });

  it('una vez cargado, ensureLoaded() no vuelve a la red', async () => {
    const loading = store.ensureLoaded();
    api.resolveAll(24);
    await loading;

    await store.ensureLoaded();

    expect(api.calls).toEqual([24]);
  });

  it('reload() fuerza un refetch aunque ya esté cargado', async () => {
    const loading = store.ensureLoaded();
    api.resolveAll(24);
    await loading;

    const again = store.reload();
    api.resolveAll(24);
    await again;

    expect(api.calls).toEqual([24, 24]);
  });

  /**
   * El bug que documenta `settings-store.ts`: si la promesa rechazada se quedara cacheada en
   * `inFlight`, el botón de "reintentar" no volvería a tocar la red nunca.
   */
  it('tras un error, un reintento sí vuelve a la red', async () => {
    api.shouldFail = true;
    await store.ensureLoaded();
    expect(store.status()).toBe('error');

    api.shouldFail = false;
    const retry = store.reload();
    api.resolveAll(24);
    await retry;

    expect(store.status()).toBe('ready');
    expect(api.calls).toEqual([24, 24]);
  });

  it('setWindow() recarga con la ventana nueva', async () => {
    const loading = store.ensureLoaded();
    api.resolveAll(24);
    await loading;

    const wider = store.setWindow(168);
    api.resolveAll(168);
    await wider;

    expect(api.calls).toEqual([24, 168]);
    expect(store.window()).toBe(168);
    expect(store.metrics()?.windowHours).toBe(168);
  });

  /** Pulsar la pestaña que ya está activa no debe disparar una consulta idéntica. */
  it('setWindow() con la ventana que ya está puesta no vuelve a la red', async () => {
    const loading = store.ensureLoaded();
    api.resolveAll(24);
    await loading;

    await store.setWindow(24);

    expect(api.calls).toEqual([24]);
  });

  it('clear() deja el store como recién creado', async () => {
    const loading = store.setWindow(168);
    api.resolveAll(168);
    await loading;

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.metrics()).toBeNull();
    expect(store.window()).toBe(24);
  });
});
