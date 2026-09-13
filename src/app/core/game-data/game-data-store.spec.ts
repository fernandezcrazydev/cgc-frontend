import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { ChampionSummary, GameDataManifest, GameItem, Perk, SummonerSpell } from './models';
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
  summonerSpellsCalls = 0;
  perksCalls = 0;

  itemsCalls = 0;
  itemsPages: { content: GameItem[]; page: number; size: number; totalElements: number; totalPages: number }[] = [
    {
      content: [
        {
          id: 3089,
          name: 'Sombrero mortal de Rabadon',
          iconUrl: '.../3089.png',
          totalGold: 3600,
          purchasable: true,
          available: true,
        },
      ],
      page: 0,
      size: 200,
      totalElements: 1,
      totalPages: 1,
    },
  ];

  private resolveManifest!: (m: GameDataManifest) => void;
  private resolveChampions!: (c: ChampionSummary[]) => void;
  private resolveSpells!: (s: SummonerSpell[]) => void;
  private resolvePerks!: (p: Perk[]) => void;
  failManifest = false;
  failChampions = false;
  failPerks = false;

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

  summonerSpells(): Observable<SummonerSpell[]> {
    this.summonerSpellsCalls++;
    return new Observable((sub) => {
      this.resolveSpells = (spells) => {
        sub.next(spells);
        sub.complete();
      };
    });
  }

  perks(): Observable<Perk[]> {
    this.perksCalls++;
    if (this.failPerks) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolvePerks = (perks) => {
        sub.next(perks);
        sub.complete();
      };
    });
  }

  items(page: number, size: number, _q?: string): Observable<{ content: GameItem[]; page: number; size: number; totalElements: number; totalPages: number }> {
    this.itemsCalls++;
    const found = this.itemsPages.find((p) => p.page === page);
    return of(
      found ?? {
        content: [],
        page,
        size,
        totalElements: 0,
        totalPages: 0,
      },
    );
  }

  /** Deja que el microtask de `firstValueFrom` corra tras emitir. */
  async settle(
    manifest: GameDataManifest,
    champions: ChampionSummary[],
    spells: SummonerSpell[] = [FLASH],
    perks: Perk[] = [ELECTROCUTE],
  ): Promise<void> {
    this.resolveManifest(manifest);
    this.resolveChampions(champions);
    this.resolveSpells(spells);
    if (!this.failPerks) this.resolvePerks(perks);
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
const FLASH: SummonerSpell = {
  id: 4,
  slug: 'SummonerFlash',
  name: 'Destello',
  iconUrl: '.../SummonerFlash.png',
  modes: ['CLASSIC'],
};
/**
 * Runa clave. Ojo al `iconUrl`: apunta a CommunityDragon y no a ddragon, porque Riot
 * retiró las runas de Data Dragon. Para el store es una URL absoluta más — que el
 * origen sea otro es cosa del backend.
 */
const ELECTROCUTE: Perk = {
  id: 8112,
  name: 'Electrocutar',
  iconUrl: '.../perk-images/styles/domination/electrocute/electrocute.png',
  style: false,
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

  it('arranca idle, sin catálogo y sin versión', () => {
    expect(store.status()).toBe('idle');
    expect(store.champions()).toEqual([]);
    expect(store.summonerSpells()).toEqual([]);
    expect(store.perks()).toEqual([]);
    expect(store.version()).toBeNull();
    expect(store.championById().size).toBe(0);
    expect(store.summonerSpellById().size).toBe(0);
    expect(store.perkById().size).toBe(0);
    expect(store.itemsById().size).toBe(0);
  });

  it('ensureLoaded pasa por loading y deja el catálogo en ready sin pedir objetos', async () => {
    const load = store.ensureLoaded();
    expect(store.status()).toBe('loading');

    await api.settle(MANIFEST, [AHRI]);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.version()).toBe('16.14.1');
    expect(store.champions()).toEqual([AHRI]);
    expect(store.championById().get(103)).toEqual(AHRI);
    expect(store.summonerSpellById().get(4)).toEqual(FLASH);
    expect(store.perkById().get(8112)).toEqual(ELECTROCUTE);
    expect(api.itemsCalls).toBe(0);
  });

  it('deduplica llamadas concurrentes a ensureLoaded en una sola petición', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();
    await api.settle(MANIFEST, [AHRI]);
    await Promise.all([a, b]);

    expect(api.manifestCalls).toBe(1);
    expect(api.championsCalls).toBe(1);
    expect(api.summonerSpellsCalls).toBe(1);
    expect(api.perksCalls).toBe(1);
    expect(api.itemsCalls).toBe(0);
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

  /**
   * Las cuatro peticiones van en el mismo `Promise.all`, así que si cae una cae la carga
   * entera: un catálogo a medias dejaría la vista pintando unos iconos sí y otros no sin
   * que `status` lo delatara. Se prueba con las runas porque son las que vienen de otro
   * host (CommunityDragon) y por tanto las que más probablemente fallen solas.
   */
  it('un fallo solo de las runas deja el catálogo entero en error, no a medias', async () => {
    api.failPerks = true;
    await store.ensureLoaded();

    expect(store.status()).toBe('error');
    expect(store.champions()).toEqual([]);
    expect(store.summonerSpells()).toEqual([]);
    expect(store.perks()).toEqual([]);
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

    store.item(3089);
    await Promise.resolve();
    await Promise.resolve();
    expect(store.itemsById().size).toBe(1);

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.champions()).toEqual([]);
    expect(store.summonerSpells()).toEqual([]);
    expect(store.perks()).toEqual([]);
    expect(store.version()).toBeNull();
    expect(store.itemsById().size).toBe(0);
  });

  it('item(id) carga de forma perezosa el catálogo de objetos y resuelve por id', async () => {
    expect(api.itemsCalls).toBe(0);

    const itemSig = store.item(3089);
    expect(itemSig()).toBeNull();
    expect(api.itemsCalls).toBe(1);

    await Promise.resolve();
    await Promise.resolve();

    expect(itemSig()).toEqual({
      id: 3089,
      name: 'Sombrero mortal de Rabadon',
      iconUrl: '.../3089.png',
      totalGold: 3600,
      purchasable: true,
      available: true,
    });
    expect(store.itemsById().get(3089)?.name).toBe('Sombrero mortal de Rabadon');
  });

  it('item(id) encadena todas las páginas del catálogo sin q', async () => {
    api.itemsPages = [
      {
        content: [
          {
            id: 3089,
            name: 'Sombrero mortal de Rabadon',
            iconUrl: '.../3089.png',
            totalGold: 3600,
            purchasable: true,
            available: true,
          },
        ],
        page: 0,
        size: 200,
        totalElements: 2,
        totalPages: 2,
      },
      {
        content: [
          {
            id: 3031,
            name: 'Filo del Infinito',
            iconUrl: '.../3031.png',
            totalGold: 3400,
            purchasable: true,
            available: true,
          },
        ],
        page: 1,
        size: 200,
        totalElements: 2,
        totalPages: 2,
      },
    ];

    const sig1 = store.item(3089);
    const sig2 = store.item(3031);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(api.itemsCalls).toBe(2);
    expect(sig1()?.name).toBe('Sombrero mortal de Rabadon');
    expect(sig2()?.name).toBe('Filo del Infinito');
    expect(store.itemsById().size).toBe(2);
  });

  it('item(id) devuelve null para un id inexistente una vez cargado el catálogo', async () => {
    const itemSig = store.item(999999);
    await Promise.resolve();
    await Promise.resolve();

    expect(itemSig()).toBeNull();
  });
});
