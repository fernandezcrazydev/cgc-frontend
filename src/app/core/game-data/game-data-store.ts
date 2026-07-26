import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ChampionSummary, GameDataManifest } from './models';
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
 * Carga manifest + campeones a la vez. Los objetos NO entran aquí: son una
 * colección paginada que solo usa el buscador del selector (`GameDataApi.items`
 * suelto). Un `version: null` (nunca se ha importado) no es un error: el
 * backend responde 200 con catálogo vacío, así que el store queda `ready`
 * con una lista vacía, no `error`.
 */
@Injectable({ providedIn: 'root' })
export class GameDataStore {
  private readonly api = inject(GameDataApi);

  private readonly _manifest = signal<GameDataManifest>(EMPTY_MANIFEST);
  private readonly _champions = signal<ChampionSummary[]>([]);
  private readonly _status = signal<GameDataStatus>('idle');

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<void> | null = null;

  readonly status = this._status.asReadonly();
  readonly champions = this._champions.asReadonly();

  /** `null` si el backend nunca ha importado el catálogo. */
  readonly version = computed(() => this._manifest().version);
  readonly updatedAt = computed(() => this._manifest().updatedAt);

  /** Índice por id para que las vistas resuelvan `championId → ChampionSummary` en O(1). */
  readonly championById = computed<Map<number, ChampionSummary>>(
    () => new Map(this._champions().map((c) => [c.id, c])),
  );

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
    this._status.set('idle');
  }

  private async load(): Promise<void> {
    this._status.set('loading');
    try {
      const [manifest, champions] = await Promise.all([
        firstValueFrom(this.api.manifest()),
        firstValueFrom(this.api.champions()),
      ]);
      this._manifest.set(manifest);
      this._champions.set(champions);
      this._status.set('ready');
    } catch {
      this._manifest.set(EMPTY_MANIFEST);
      this._champions.set([]);
      this._status.set('error');
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa
      // rechazada y ningún reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
