import { Injectable, Signal, WritableSignal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChampionDetail, ChampionSummary, GameDataManifest, GameItem, Perk, SummonerSpell } from './models';
import { GameDataApi } from './game-data-api';

export type GameDataStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Lo que ve una vista mientras aún no hay manifest, o si nunca se importó nada. */
const EMPTY_MANIFEST: GameDataManifest = { version: null, updatedAt: null };

/**
 * Catálogo de campeones cacheado de Data Dragon, cargado una sola vez y
 * compartido por toda la app como signals. Clon del patrón `Session`
 * (`core/auth/session.ts`): `status` explícito y `ensureLoaded()` idempotente
 * con deduplicación de la petición en vuelo.
 *
 * Carga manifest + campeones + hechizos de invocador + runas a la vez. Hechizos y
 * runas son listas fijas y cortas (una docena y ~108) que el marcador de una partida
 * y el acordeón del ranking necesitan para resolver `id → icono`, así que caben en la
 * misma carga; los objetos se cargan enteros en memoria de forma perezosa
 * al llamar a `item(id)` (no entran en `ensureLoaded()`) barriendo las páginas de
 * `api.items(page, size)` una sola vez por sesión. Un `version: null` (nunca
 * se ha importado) no es un error: el backend responde 200 con catálogo vacío, así que
 * el store queda `ready` con una lista vacía, no `error`.
 */
@Injectable({ providedIn: 'root' })
export class GameDataStore {
  private readonly api = inject(GameDataApi);

  private readonly _manifest = signal<GameDataManifest>(EMPTY_MANIFEST);
  private readonly _champions = signal<ChampionSummary[]>([]);
  private readonly _summonerSpells = signal<SummonerSpell[]>([]);
  private readonly _perks = signal<Perk[]>([]);
  private readonly _status = signal<GameDataStatus>('idle');
  private readonly _itemsById = signal<ReadonlyMap<number, GameItem>>(new Map());

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<void> | null = null;
  private itemsInFlight: Promise<void> | null = null;
  private _itemsLoaded = false;

  readonly status = this._status.asReadonly();
  readonly champions = this._champions.asReadonly();
  readonly summonerSpells = this._summonerSpells.asReadonly();
  readonly perks = this._perks.asReadonly();
  readonly itemsById: Signal<ReadonlyMap<number, GameItem>> = this._itemsById.asReadonly();

  /** `null` si el backend nunca ha importado el catálogo. */
  readonly version = computed(() => this._manifest().version);
  readonly updatedAt = computed(() => this._manifest().updatedAt);

  /** Índice por id para que las vistas resuelvan `championId → ChampionSummary` en O(1). */
  readonly championById = computed<Map<number, ChampionSummary>>(
    () => new Map(this._champions().map((c) => [c.id, c])),
  );

  /** Índice por id para resolver los dos hechizos de un participante (`stats.spells`). */
  readonly summonerSpellById = computed<Map<number, SummonerSpell>>(
    () => new Map(this._summonerSpells().map((s) => [s.id, s])),
  );

  /**
   * Índice por id de runas y árboles. Comparten espacio de ids sin solaparse (verificado
   * contra los dos feeds), así que un solo mapa resuelve tanto la runa clave como el árbol
   * secundario que pinta el acordeón del ranking.
   */
  readonly perkById = computed<Map<number, Perk>>(
    () => new Map(this._perks().map((p) => [p.id, p])),
  );

  private readonly _championDetails = new Map<number, WritableSignal<ChampionDetail | null>>();
  private readonly _detailInFlight = new Map<number, Promise<void>>();
  private readonly _itemSignals = new Map<number, Signal<GameItem | null>>();

  /** Detalle de un campeón, cacheado por id. `null` mientras carga o si no existe. */
  championDetail(id: number): Signal<ChampionDetail | null> {
    let sig = this._championDetails.get(id);
    if (!sig) {
      sig = signal<ChampionDetail | null>(null);
      this._championDetails.set(id, sig);
      this.fetchChampionDetail(id, sig);
    }
    return sig.asReadonly();
  }

  private async fetchChampionDetail(id: number, sig: WritableSignal<ChampionDetail | null>): Promise<void> {
    if (this._detailInFlight.has(id)) return;
    const p = (async () => {
      try {
        const detail = await firstValueFrom(this.api.champion(id));
        sig.set(detail);
      } catch {
        sig.set(null);
      } finally {
        this._detailInFlight.delete(id);
      }
    })();
    this._detailInFlight.set(id, p);
  }

  /** Detalle de un objeto, resuelto del mapa global de objetos. `null` mientras carga o si no existe. */
  item(id: number): Signal<GameItem | null> {
    void this.ensureItemsLoaded();
    let sig = this._itemSignals.get(id);
    if (!sig) {
      sig = computed(() => this._itemsById().get(id) ?? null);
      this._itemSignals.set(id, sig);
    }
    return sig;
  }

  private ensureItemsLoaded(): Promise<void> {
    if (this._itemsLoaded) return Promise.resolve();
    return (this.itemsInFlight ??= this.loadAllItems());
  }

  private async loadAllItems(): Promise<void> {
    try {
      const size = 200;
      let page = 0;
      const firstPage = await firstValueFrom(this.api.items(page, size));
      const allItems: GameItem[] = [...firstPage.content];
      const totalPages = firstPage.totalPages;

      while (++page < totalPages) {
        const nextPage = await firstValueFrom(this.api.items(page, size));
        allItems.push(...nextPage.content);
      }

      const map = new Map<number, GameItem>();
      for (const it of allItems) {
        map.set(it.id, it);
      }
      this._itemsById.set(map);
      this._itemsLoaded = true;
    } catch {
      // Si falla dejamos el mapa vacío y permitimos reintentar en futuras consultas
    } finally {
      this.itemsInFlight = null;
    }
  }

  /**
   * Devuelve cuando el catálogo está cargado, cargándolo si hace falta.
   * Idempotente: una vez `ready` no vuelve a tocar la red. Nunca lanza — un
   * fallo se traduce en `status === 'error'`.
   */
  ensureLoaded(): Promise<void> {
    if (this._status() === 'ready') return Promise.resolve();
    return (this.inFlight ??= this.load());
  }

  /** Fuerza una recarga contra el backend (reintento tras error, o refresco manual). */
  reload(): Promise<void> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  /** Al cerrar sesión no debe quedar rastro del catálogo anterior en memoria. */
  clear(): void {
    this.inFlight = null;
    this._manifest.set(EMPTY_MANIFEST);
    this._champions.set([]);
    this._summonerSpells.set([]);
    this._perks.set([]);
    this._championDetails.clear();
    this._detailInFlight.clear();
    this._itemsById.set(new Map());
    this._itemSignals.clear();
    this.itemsInFlight = null;
    this._itemsLoaded = false;
    this._status.set('idle');
  }

  private async load(): Promise<void> {
    this._status.set('loading');
    try {
      const [manifest, champions, spells, perks] = await Promise.all([
        firstValueFrom(this.api.manifest()),
        firstValueFrom(this.api.champions()),
        firstValueFrom(this.api.summonerSpells()),
        firstValueFrom(this.api.perks()),
      ]);
      this._manifest.set(manifest);
      this._champions.set(champions);
      this._summonerSpells.set(spells);
      this._perks.set(perks);
      this._status.set('ready');
    } catch {
      // Todo o nada: un catálogo a medias dejaría vistas pintando unos iconos y otros no,
      // sin que `status` lo delatara. `error` con las cuatro listas vacías es el estado que
      // la vista sabe reintentar.
      this._manifest.set(EMPTY_MANIFEST);
      this._champions.set([]);
      this._summonerSpells.set([]);
      this._perks.set([]);
      this._status.set('error');
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa
      // rechazada y ningún reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
