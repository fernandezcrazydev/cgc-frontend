import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GroupStatsApi } from './group-stats-api';
import { GroupStats, StatsQuery, StatsScope, statsKey } from './models';

/** `not-found` = el grupo no existe o ya no eres miembro (403/404), como en `GroupBridge`. */
export type GroupStatsStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-found';

/**
 * Las estadísticas agregadas de un grupo, por alcance.
 *
 * Clon del patrón `Session` con una vuelta de tuerca: aquí lo que se carga no es «el grupo» sino
 * **un alcance** (grupo + modalidad + temporada), y cambiar cualquiera de los tres es una petición
 * nueva. De ahí las tres cosas que este store hace y un store de una sola entidad no necesita:
 *
 *  - **Cachea por clave de alcance.** Volver a la modalidad de la que vienes no vuelve a pedirla:
 *    es el mismo conjunto de partidas y no ha cambiado mientras pulsabas dos botones.
 *  - **Deduplica la petición en vuelo** por esa misma clave.
 *  - **Descarta la respuesta obsoleta.** Pulsar tres pestañas rápido lanza tres peticiones y no
 *    tienen por qué volver en orden; solo escribe la que sigue siendo el alcance activo. Sin esto,
 *    la pantalla acaba enseñando las cifras de la modalidad que NO está seleccionada, y no hay
 *    forma de notarlo mirando.
 */
@Injectable({ providedIn: 'root' })
export class GroupStatsStore {
  private readonly api = inject(GroupStatsApi);

  private readonly _status = signal<GroupStatsStatus>('idle');
  private readonly _scopesStatus = signal<GroupStatsStatus>('idle');
  private readonly _stats = signal<GroupStats | null>(null);
  private readonly _scopes = signal<readonly StatsScope[]>([]);

  readonly status = this._status.asReadonly();
  readonly scopesStatus = this._scopesStatus.asReadonly();
  readonly stats = this._stats.asReadonly();
  readonly scopes = this._scopes.asReadonly();

  /** Las modalidades que el grupo ha jugado de verdad. Las demás se ofrecen deshabilitadas. */
  readonly playedScopes = computed(() => this._scopes().filter((s) => s.matches > 0));

  private readonly cache = new Map<string, GroupStats>();
  private inFlight: { key: string; promise: Promise<void> } | null = null;

  /** Alcance activo: lo que decide qué respuesta se escribe y cuál se tira. */
  private activeKey: string | null = null;
  private scopesGroupId: string | null = null;
  private scopesInFlight: { groupId: string; promise: Promise<void> } | null = null;

  /**
   * Asegura que están los alcances del grupo. Idempotente; si hay una petición en vuelo para el
   * mismo grupo, se engancha a ella.
   */
  ensureScopes(groupId: string): Promise<void> {
    if (!groupId) return Promise.resolve();
    if (this.scopesGroupId === groupId && this._scopesStatus() === 'ready') return Promise.resolve();
    if (this.scopesInFlight?.groupId === groupId) return this.scopesInFlight.promise;
    return this.reloadScopes(groupId);
  }

  reloadScopes(groupId: string): Promise<void> {
    const promise = this.fetchScopes(groupId);
    this.scopesInFlight = { groupId, promise };
    return promise;
  }

  /**
   * Asegura el alcance pedido. Si ya está cacheado lo publica sin red — el alcance que acabas de
   * mirar no ha cambiado por volver a él.
   */
  ensure(groupId: string, query: StatsQuery): Promise<void> {
    if (!groupId) return Promise.resolve();
    const key = statsKey(groupId, query);
    this.activeKey = key;

    const cached = this.cache.get(key);
    if (cached) {
      this._stats.set(cached);
      this._status.set('ready');
      return Promise.resolve();
    }
    if (this.inFlight?.key === key) return this.inFlight.promise;
    return this.reload(groupId, query);
  }

  /** Fuerza el refetch del alcance. Tras registrar un resultado, lo derivado se ha quedado viejo. */
  reload(groupId: string, query: StatsQuery): Promise<void> {
    const key = statsKey(groupId, query);
    this.cache.delete(key);
    this.activeKey = key;
    const promise = this.fetch(groupId, query, key);
    this.inFlight = { key, promise };
    return promise;
  }

  /** Al cerrar sesión no puede quedar el grupo del usuario anterior en memoria. */
  clear(): void {
    this.cache.clear();
    this.activeKey = null;
    this.scopesGroupId = null;
    this.inFlight = null;
    this.scopesInFlight = null;
    this._stats.set(null);
    this._scopes.set([]);
    this._status.set('idle');
    this._scopesStatus.set('idle');
  }

  private async fetch(groupId: string, query: StatsQuery, key: string): Promise<void> {
    this._status.set('loading');
    try {
      const stats = await firstValueFrom(this.api.getStats(groupId, query));
      this.cache.set(key, stats);
      // La respuesta de un alcance que ya no está seleccionado se guarda en caché pero NO se
      // pinta: tres pestañas pulsadas rápido no tienen por qué volver en orden.
      if (this.activeKey !== key) return;
      this._stats.set(stats);
      this._status.set('ready');
    } catch (error) {
      if (this.activeKey !== key) return;
      this._status.set(isMissing(error) ? 'not-found' : 'error');
    } finally {
      if (this.inFlight?.key === key) this.inFlight = null;
    }
  }

  private async fetchScopes(groupId: string): Promise<void> {
    this._scopesStatus.set('loading');
    try {
      const scopes = await firstValueFrom(this.api.getScopes(groupId));
      if (this.scopesInFlight?.groupId !== groupId) return;
      this._scopes.set(scopes);
      this.scopesGroupId = groupId;
      this._scopesStatus.set('ready');
    } catch (error) {
      if (this.scopesInFlight?.groupId !== groupId) return;
      this._scopesStatus.set(isMissing(error) ? 'not-found' : 'error');
    } finally {
      if (this.scopesInFlight?.groupId === groupId) this.scopesInFlight = null;
    }
  }
}

/** Un 403 (no eres miembro) y un 404 (no existe) se tratan igual: la vista pinta su 404. */
function isMissing(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
}
