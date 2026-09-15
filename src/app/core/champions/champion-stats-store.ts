import { Injectable, Signal, WritableSignal, inject, signal, untracked } from '@angular/core';
import { ChampionStatsApi, ChampionStatsSource } from './champion-stats-api';
import { ChampionBoard, ChampionStats } from './models';

export type ChampionStatsStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ChampionCacheEntry<T> {
  status: ChampionStatsStatus;
  error: string | null;
  data: T | null;
}

/**
 * Store de estadísticas y telemetría de campeones.
 * Consume, cachea y expone DTOs. NO realiza operaciones aritméticas.
 */
@Injectable({ providedIn: 'root' })
export class ChampionStatsStore {
  private source: ChampionStatsSource = inject(ChampionStatsApi);

  private readonly _status = signal<ChampionStatsStatus>('idle');
  private readonly _error = signal<string | null>(null);

  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();

  private readonly boardSignals = new Map<string, { sig: WritableSignal<ChampionCacheEntry<ChampionBoard>>; groupId: string | null }>();
  private readonly statsSignals = new Map<string, { sig: WritableSignal<ChampionCacheEntry<ChampionStats>>; groupId: string | null; championId: number }>();

  /**
   * Sustituye la fuente de datos. La usa SOLO el suplente de desarrollo desde `app.config.ts`.
   * BACKEND NOTE: muere con el endpoint, junto con `champion-stats-mock.ts`.
   */
  useSource(source: ChampionStatsSource): void {
    this.source = source;
    this.invalidate();
  }

  /** El tablero de un grupo (`null` = ámbito global). Cachea por clave de ámbito. */
  board(groupId: string | null): Signal<ChampionCacheEntry<ChampionBoard>> {
    const key = groupId ?? '__global__';
    let entry = this.boardSignals.get(key);
    if (!entry) {
      entry = {
        sig: signal<ChampionCacheEntry<ChampionBoard>>({
          status: 'loading',
          error: null,
          data: null,
        }),
        groupId,
      };
      this.boardSignals.set(key, entry);
      this.fetchBoard(entry);
    }
    return entry.sig.asReadonly();
  }

  /** La ficha de un campeón. Cachea por ámbito + campeón. */
  stats(groupId: string | null, championId: number): Signal<ChampionCacheEntry<ChampionStats>> {
    const key = `${groupId ?? '__global__'}:${championId}`;
    let entry = this.statsSignals.get(key);
    if (!entry) {
      entry = {
        sig: signal<ChampionCacheEntry<ChampionStats>>({
          status: 'loading',
          error: null,
          data: null,
        }),
        groupId,
        championId,
      };
      this.statsSignals.set(key, entry);
      this.fetchStats(entry);
    }
    return entry.sig.asReadonly();
  }

  /** Re-evalúa todas las señales cacheadas usando la fuente activa. */
  invalidate(): void {
    for (const entry of this.boardSignals.values()) {
      this.fetchBoardDirect(entry);
    }
    for (const entry of this.statsSignals.values()) {
      this.fetchStatsDirect(entry);
    }
  }

  /** Limpia las cachés (usado en cambio de fuente o cierre de sesión). */
  clear(): void {
    for (const entry of this.boardSignals.values()) {
      entry.sig.set({ status: 'idle', error: null, data: null });
    }
    for (const entry of this.statsSignals.values()) {
      entry.sig.set({ status: 'idle', error: null, data: null });
    }
    this._status.set('idle');
    this._error.set(null);
  }

  private fetchBoardDirect(
    entry: { sig: WritableSignal<ChampionCacheEntry<ChampionBoard>>; groupId: string | null },
  ): void {
    // `untracked` no es decorativo: esto se llama desde el effect de `champion-stats-mock.ts`,
    // y leer `entry.sig()` ahí dentro lo convierte en dependencia del effect. Como la línea
    // siguiente escribe esa misma señal, el effect se reinvalida a sí mismo y gira para
    // siempre: con `allowSignalWrites: true` nadie lo detiene y el worker de los tests muere
    // por memoria sin llegar a ejecutar una sola prueba.
    const previa = untracked(() => entry.sig().data);
    entry.sig.set({ status: 'loading', error: null, data: previa });
    this._status.set('loading');
    this._error.set(null);
    this.source.board(entry.groupId).subscribe({
      next: (data) => {
        entry.sig.set({ status: 'ready', error: null, data });
        this._status.set('ready');
      },
      error: (err: unknown) => {
        const errMsg = err instanceof Error ? err.message : 'Error al cargar tablero';
        entry.sig.set({ status: 'error', error: errMsg, data: null });
        this._status.set('error');
        this._error.set(errMsg);
      },
    });
  }

  private fetchStatsDirect(
    entry: { sig: WritableSignal<ChampionCacheEntry<ChampionStats>>; groupId: string | null; championId: number },
  ): void {
    // `untracked` no es decorativo: esto se llama desde el effect de `champion-stats-mock.ts`,
    // y leer `entry.sig()` ahí dentro lo convierte en dependencia del effect. Como la línea
    // siguiente escribe esa misma señal, el effect se reinvalida a sí mismo y gira para
    // siempre: con `allowSignalWrites: true` nadie lo detiene y el worker de los tests muere
    // por memoria sin llegar a ejecutar una sola prueba.
    const previa = untracked(() => entry.sig().data);
    entry.sig.set({ status: 'loading', error: null, data: previa });
    this._status.set('loading');
    this._error.set(null);
    this.source.stats(entry.groupId, entry.championId).subscribe({
      next: (data) => {
        entry.sig.set({ status: 'ready', error: null, data });
        this._status.set('ready');
      },
      error: (err: unknown) => {
        const errMsg = err instanceof Error ? err.message : 'Error al cargar ficha del campeón';
        entry.sig.set({ status: 'error', error: errMsg, data: null });
        this._status.set('error');
        this._error.set(errMsg);
      },
    });
  }

  private fetchBoard(
    entry: { sig: WritableSignal<ChampionCacheEntry<ChampionBoard>>; groupId: string | null },
  ): void {
    queueMicrotask(() => this.fetchBoardDirect(entry));
  }

  private fetchStats(
    entry: { sig: WritableSignal<ChampionCacheEntry<ChampionStats>>; groupId: string | null; championId: number },
  ): void {
    queueMicrotask(() => this.fetchStatsDirect(entry));
  }
}
