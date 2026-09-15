/**
 * La timeline de UNA partida: la que está abierta ahora mismo (`cgc-backend#96`).
 *
 * Store propio y no más superficies en `MatchHistoryStore`, por lo mismo que el hilo de comentarios:
 * tiene su propio ciclo de vida —se carga al abrir una partida y se tira al salir— y, sobre todo,
 * **sus dos mitades se piden por separado**. El resumen lo quiere toda la pantalla; las posiciones
 * solo el mapa, y son diez coordenadas por minuto. Meterlas en la misma carga sería pagar el mapa
 * aunque nadie lo mire.
 *
 * Patrón `Session`: `status` explícito por mitad, `ensure*` idempotente por `matchId`, `reload()` y
 * `clear()`.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatchesApi } from './matches-api';
import { MatchTimelinePositions, MatchTimelineSummary } from './models';

export type MatchTimelineStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Lo que se pinta antes de la primera carga: ni datos ni la mentira de una timeline vacía. */
const NO_SUMMARY: MatchTimelineSummary = {
  available: false,
  frameCount: 0,
  kills: [],
  buildings: [],
  monsters: [],
  dragons: [],
};

const NO_POSITIONS: MatchTimelinePositions = { available: false, frames: [] };

@Injectable({ providedIn: 'root' })
export class MatchTimelineStore {
  private readonly api = inject(MatchesApi);

  private readonly _summary = signal<MatchTimelineSummary>(NO_SUMMARY);
  private readonly _summaryStatus = signal<MatchTimelineStatus>('idle');
  private summaryKey: string | null = null;
  private summarySeq = 0;

  private readonly _positions = signal<MatchTimelinePositions>(NO_POSITIONS);
  private readonly _positionsStatus = signal<MatchTimelineStatus>('idle');
  private positionsKey: string | null = null;
  private positionsSeq = 0;

  readonly summary = this._summary.asReadonly();
  readonly summaryStatus = this._summaryStatus.asReadonly();
  readonly positions = this._positions.asReadonly();
  readonly positionsStatus = this._positionsStatus.asReadonly();

  /**
   * Si esta partida tiene timeline guardada.
   *
   * **No es lo mismo que «ya cargó»**: mientras `summaryStatus()` no sea `ready` esto es `false`
   * porque todavía no se sabe, y la vista tiene que estar mirando el status, no esto. Existe para
   * decidir si se ofrece el bloque del mapa, no para pintarlo.
   */
  readonly available = computed(
    () => this._summaryStatus() === 'ready' && this._summary().available,
  );

  /** El resumen de esa partida. Repetir el mismo id no vuelve a la red. */
  ensureSummary(matchId: string): Promise<void> {
    if (matchId === this.summaryKey && this._summaryStatus() === 'ready') return Promise.resolve();
    return this.loadSummary(matchId);
  }

  /**
   * Las posiciones, que solo pide el mapa.
   *
   * Se llama cuando el bloque del mapa entra en pantalla y no al abrir la partida: la mitad pesada
   * no se paga por adelantado.
   */
  ensurePositions(matchId: string): Promise<void> {
    if (matchId === this.positionsKey && this._positionsStatus() === 'ready') {
      return Promise.resolve();
    }
    return this.loadPositions(matchId);
  }

  reloadSummary(matchId: string): Promise<void> {
    return this.loadSummary(matchId);
  }

  reloadPositions(matchId: string): Promise<void> {
    return this.loadPositions(matchId);
  }

  /** Al cerrar sesión, o al salir de la partida, no debe quedar la timeline de nadie en memoria. */
  clear(): void {
    this.summarySeq++;
    this.positionsSeq++;
    this.summaryKey = null;
    this.positionsKey = null;
    this._summary.set(NO_SUMMARY);
    this._positions.set(NO_POSITIONS);
    this._summaryStatus.set('idle');
    this._positionsStatus.set('idle');
  }

  private async loadSummary(matchId: string): Promise<void> {
    const seq = ++this.summarySeq;
    this.summaryKey = matchId;
    this._summaryStatus.set('loading');
    try {
      const summary = await firstValueFrom(this.api.timelineSummary(matchId));
      // La respuesta de la partida anterior no puede escribir sobre la que está abierta ahora.
      if (seq !== this.summarySeq) return;
      this._summary.set(summary);
      this._summaryStatus.set('ready');
    } catch {
      if (seq !== this.summarySeq) return;
      this.summaryKey = null;
      this._summary.set(NO_SUMMARY);
      this._summaryStatus.set('error');
    }
  }

  private async loadPositions(matchId: string): Promise<void> {
    const seq = ++this.positionsSeq;
    this.positionsKey = matchId;
    this._positionsStatus.set('loading');
    try {
      const positions = await firstValueFrom(this.api.timelinePositions(matchId));
      if (seq !== this.positionsSeq) return;
      this._positions.set(positions);
      this._positionsStatus.set('ready');
    } catch {
      if (seq !== this.positionsSeq) return;
      this.positionsKey = null;
      this._positions.set(NO_POSITIONS);
      this._positionsStatus.set('error');
    }
  }
}
