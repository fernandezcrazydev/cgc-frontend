import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { RiotApiUsage } from './admin-models';
import { RiotMetricsApi } from './riot-metrics-api';
import { RiotUsageStore } from './riot-usage-store';

const POLL_MS = 10_000;

function usage(used: number): RiotApiUsage {
  return {
    used,
    limit: 100,
    windowSeconds: 120,
    rateLimited: 0,
    riotCount: null,
    riotCountAt: null,
    nextSlotAt: '2026-08-01T20:00:41Z',
    windowClearAt: '2026-08-01T20:01:58Z',
    serverTime: '2026-08-01T20:00:00Z',
  };
}

/**
 * Deja correr los microtasks pendientes. El store publica su estado tras un `await`, así que sin
 * esto se observaría siempre el instante anterior a la respuesta.
 */
const flush = () => Promise.resolve().then(() => Promise.resolve());

/**
 * Doble manual con la respuesta resuelta a mano, para poder observar el estado con una petición
 * todavía en vuelo — que es donde viven los bugs de este store.
 */
class ApiDouble {
  calls = 0;
  private resolvers: Array<(u: RiotApiUsage) => void> = [];
  failWith: HttpErrorResponse | null = null;

  usage(): Observable<RiotApiUsage> {
    this.calls++;
    if (this.failWith) return throwError(() => this.failWith);
    return new Observable<RiotApiUsage>((subscriber) => {
      this.resolvers.push((u) => {
        subscriber.next(u);
        subscriber.complete();
      });
    });
  }

  /** Resuelve lo que haya en vuelo y espera a que el store publique el resultado. */
  async resolveAll(used = 10): Promise<void> {
    const pending = this.resolvers;
    this.resolvers = [];
    pending.forEach((resolve) => resolve(usage(used)));
    await flush();
  }
}

describe('RiotUsageStore', () => {
  let store: RiotUsageStore;
  let api: ApiDouble;

  beforeEach(() => {
    vi.useFakeTimers();
    api = new ApiDouble();
    TestBed.configureTestingModule({
      providers: [{ provide: RiotMetricsApi, useValue: api }],
    });
    store = TestBed.inject(RiotUsageStore);
  });

  afterEach(() => {
    store.clear();
    vi.useRealTimers();
  });

  it('pide el uso en cuanto arranca, sin esperar al primer tick', () => {
    store.start();

    expect(api.calls).toBe(1);
  });

  it('vuelve a preguntar cada 10 segundos', async () => {
    store.start();
    await api.resolveAll();

    vi.advanceTimersByTime(POLL_MS);
    expect(api.calls).toBe(2);
    await api.resolveAll();

    vi.advanceTimersByTime(POLL_MS);
    expect(api.calls).toBe(3);
  });

  /** Sin esto, entrar en la vista de métricas con el indicador ya montado duplicaría el polling. */
  it('start() dos veces no crea un segundo intervalo', async () => {
    store.start();
    await api.resolveAll();
    store.start();

    expect(api.calls).toBe(1);
    vi.advanceTimersByTime(POLL_MS);
    expect(api.calls).toBe(2);
  });

  it('stop() corta el polling', async () => {
    store.start();
    await api.resolveAll();
    store.stop();

    vi.advanceTimersByTime(POLL_MS * 3);
    expect(api.calls).toBe(1);
  });

  /** Una red lenta no debe acumular peticiones: el tick que pilla una en vuelo se salta. */
  it('un tick con una petición en vuelo no lanza otra', async () => {
    store.start();
    expect(api.calls).toBe(1);

    vi.advanceTimersByTime(POLL_MS);
    expect(api.calls).toBe(1);

    await api.resolveAll();
    vi.advanceTimersByTime(POLL_MS);
    expect(api.calls).toBe(2);
  });

  it('publica el uso y deriva la fracción, el nivel y la etiqueta', async () => {
    store.start();
    await api.resolveAll(90);

    expect(store.status()).toBe('ready');
    expect(store.label()).toBe('90/100');
    expect(store.fraction()).toBeCloseTo(0.9);
    expect(store.level()).toBe('danger');
  });

  it('avisa en amarillo a partir del 60%', async () => {
    store.start();
    await api.resolveAll(70);

    expect(store.level()).toBe('warn');
  });

  /** La cuenta atrás se mide contra el reloj del servidor, no contra el del navegador. */
  it('calcula los segundos hasta el próximo hueco con el reloj del servidor', async () => {
    store.start();
    await api.resolveAll(50);

    expect(store.secondsToNextSlot()).toBe(41);
  });

  /**
   * Un 403 no se arregla esperando: sin esto, un usuario sin rol martillearía el endpoint cada
   * 10 segundos para siempre.
   */
  it('un 403 para el polling definitivamente', async () => {
    api.failWith = new HttpErrorResponse({ status: 403 });
    store.start();
    await flush();

    expect(store.status()).toBe('error');
    vi.advanceTimersByTime(POLL_MS * 5);
    expect(api.calls).toBe(1);

    // Ni siquiera un start() posterior lo revive: hace falta un clear() (logout).
    store.start();
    expect(api.calls).toBe(1);
  });

  /** Un 500 sí es transitorio: el polling sigue, por si el backend vuelve. */
  it('un error transitorio no para el polling', async () => {
    api.failWith = new HttpErrorResponse({ status: 500 });
    store.start();
    await flush();
    expect(store.status()).toBe('error');

    vi.advanceTimersByTime(POLL_MS);
    expect(api.calls).toBe(2);
  });

  it('clear() vacía el estado y deja el store listo para otro usuario', async () => {
    api.failWith = new HttpErrorResponse({ status: 403 });
    store.start();
    await flush();

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.usage()).toBeNull();

    // Tras el logout el store vuelve a ser utilizable por el siguiente usuario.
    api.failWith = null;
    store.start();
    expect(api.calls).toBe(2);
  });
});
