import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RiotApiMetrics } from './admin-models';
import { RiotMetricsApi } from './riot-metrics-api';

export type RiotMetricsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Las ventanas que ofrece el selector. 168 h = los 7 días de retención del log. */
export const RIOT_METRICS_WINDOWS = [24, 72, 168] as const;
export type RiotMetricsWindow = (typeof RIOT_METRICS_WINDOWS)[number];

/**
 * Las métricas de la API de Riot de la vista `/app/admin/riot-metricas`. Clon del patrón
 * `SettingsStore`: carga única deduplicada, `status` explícito y `clear()` al cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class RiotMetricsStore {
  private readonly api = inject(RiotMetricsApi);

  private readonly _metrics = signal<RiotApiMetrics | null>(null);
  private readonly _status = signal<RiotMetricsStatus>('idle');
  private readonly _window = signal<RiotMetricsWindow>(24);

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<RiotApiMetrics | null> | null = null;

  readonly metrics = this._metrics.asReadonly();
  readonly status = this._status.asReadonly();
  readonly window = this._window.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  ensureLoaded(): Promise<RiotApiMetrics | null> {
    if (this._status() === 'ready') return Promise.resolve(this._metrics());
    return (this.inFlight ??= this.load(this._window()));
  }

  /** Fuerza un refetch: reintento tras error, o al volver a entrar en la vista. */
  reload(): Promise<RiotApiMetrics | null> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  /** Cambia la ventana y recarga. Pedir la misma que ya está puesta no vuelve a la red. */
  setWindow(hours: RiotMetricsWindow): Promise<RiotApiMetrics | null> {
    if (hours === this._window() && this._status() === 'ready') {
      return Promise.resolve(this._metrics());
    }
    this._window.set(hours);
    return this.reload();
  }

  clear(): void {
    this.inFlight = null;
    this._metrics.set(null);
    this._status.set('idle');
    this._window.set(24);
  }

  private async load(hours: number): Promise<RiotApiMetrics | null> {
    this._status.set('loading');
    try {
      const metrics = await firstValueFrom(this.api.metrics(hours));
      this._metrics.set(metrics);
      this._status.set('ready');
      return metrics;
    } catch {
      this._metrics.set(null);
      this._status.set('error');
      return null;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa rechazada y ningún
      // reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
