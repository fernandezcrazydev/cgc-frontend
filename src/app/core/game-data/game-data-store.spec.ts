import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { ChampionSummary, GameDataManifest } from './models';
import { GameDataApi } from './game-data-api';
import { GameDataStore } from './game-data-store';

/**
 * Doble del API con promesas resueltas a mano: así se puede observar el
 * estado del store MIENTRAS la petición está en vuelo (loading), que es
 * justo lo que la vista pinta con el skeleton.
 */
class ApiStub {
  manifestCalls = 0;
  championsCalls = 0;

  private resolveManifest!: (m: GameDataManifest) => void;
  private resolveChampions!: (c: ChampionSummary[]) => void;
  failManifest = false;
  failChampions = false;

  manifest(): Observable<GameDataManifest> {
    this.manifestCalls++;
    if (this.failManifest) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveManifest = (m) => {
        sub.next(m);
        sub.complete();
      };
    });
  }

  champions(): Observable<ChampionSummary[]> {
    this.championsCalls++;
    if (this.failChampions) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveChampions = (c) => {
        sub.next(c);
        sub.complete();
      };
    });
  }

  /** Deja que el microtask de `firstValueFrom` corra tras emitir. */
  async settle(manifest: GameDataManifest, champions: ChampionSummary[]): Promise<void> {
    this.resolveManifest(manifest);
    this.resolveChampions(champions);
    await Promise.resolve();
    await Promise.resolve();
  }
}

const AHRI: ChampionSummary = {
  id: 103,
  slug: 'Ahri',
  name: 'Ahri',
  title: 'la zorra de nueve colas',
  tags: ['Mage', 'Assassin'],
  iconUrl: '.../Ahri.png',
  loadingUrl: '.../Ahri_0.jpg',
};
const MANIFEST: GameDataManifest = { version: '16.14.1', updatedAt: '2026-07-26T04:17:03Z' };

describe('GameDataStore', () => {
  let store: GameDataStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [GameDataStore, { provide: GameDataApi, useValue: api }],
    });
    store = TestBed.inject(GameDataStore);
  });

  it('arranca idle, sin campeones y sin versión', () => {
    expect(store.status()).toBe('idle');
    expect(store.champions()).toEqual([]);
    expect(store.version()).toBeNull();
    expect(store.championById().size).toBe(0);
  });

  it('ensureLoaded pasa por loading y deja el catálogo en ready', async () => {
    const load = store.ensureLoaded();
    expect(store.status()).toBe('loading');

    await api.settle(MANIFEST, [AHRI]);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.version()).toBe('16.14.1');
    expect(store.champions()).toEqual([AHRI]);
    expect(store.championById().get(103)).toEqual(AHRI);
  });

  it('deduplica llamadas concurrentes a ensureLoaded en una sola petición', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();
    await api.settle(MANIFEST, [AHRI]);
    await Promise.all([a, b]);

    expect(api.manifestCalls).toBe(1);
    expect(api.championsCalls).toBe(1);
  });

  it('no vuelve a pedir una vez cargado, y reload sí fuerza el refetch', async () => {
    const load = store.ensureLoaded();
    await api.settle(MANIFEST, [AHRI]);
    await load;

    await store.ensureLoaded();
    expect(api.manifestCalls).toBe(1);

    const again = store.reload();
    expect(store.status()).toBe('loading');
    await api.settle(MANIFEST, [AHRI]);
    await again;
    expect(api.manifestCalls).toBe(2);
  });

  it('un fallo de carga deja status error y permite reintentar con reload', async () => {
    api.failManifest = true;
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.champions()).toEqual([]);

    api.failManifest = false;
    const retry = store.reload();
    await api.settle(MANIFEST, [AHRI]);
    await retry;

    expect(store.status()).toBe('ready');
    expect(store.version()).toBe('16.14.1');
  });

  /**
   * El backend nunca ha importado el catálogo: 200 con `version: null` y
   * campeones vacíos. NO es un error — el store queda `ready` con lista
   * vacía, y es `nf-avatar` quien cae a iniciales al no tener `iconUrl`.
   */
  it('version null con catálogo vacío es un ready normal, no un error', async () => {
    const load = store.ensureLoaded();
    await api.settle({ version: null, updatedAt: null }, []);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.version()).toBeNull();
    expect(store.champions()).toEqual([]);
    expect(store.championById().size).toBe(0);
  });

  it('clear borra el estado (logout)', async () => {
    const load = store.ensureLoaded();
    await api.settle(MANIFEST, [AHRI]);
    await load;

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.champions()).toEqual([]);
    expect(store.version()).toBeNull();
  });
});
