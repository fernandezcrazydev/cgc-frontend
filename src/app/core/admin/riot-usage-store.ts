import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { RiotApiUsage } from './admin-models';
import { RiotMetricsApi } from './riot-metrics-api';

export type RiotUsageStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Cuándo la barra pasa de tranquila a avisar, y de avisar a alarmar. */
const WARN_AT = 0.6;
const DANGER_AT = 0.85;

/**
 * Cada cuánto se repregunta el uso.
 *
 * La ventana es de 120 s y el límite de 100, así que con 10 s la barra va como mucho 10 s
 * desfasada: en la ráfaga realista más agresiva (el barrido nocturno, ~1 llamada cada 1,5 s)
 * son 7 llamadas de 100 sin reflejar, que no cambian ninguna decisión. Bajar a 5 s duplicaría
 * el tráfico para un número que se mueve despacio; subir a 30 s haría visiblemente falsa la
 * cuenta atrás de "queda X para que se libere un hueco".
 *
 * Y por eso NO es SSE: mantener una conexión abierta por admin para un número que se sirve
 * desde un deque en memoria sería infraestructura sin un dolor que la justifique.
 */
const POLL_MS = 10_000;

/**
 * El indicador de rate limit de Riot de la cabecera. Solo lo arranca el componente del
 * indicador, que a su vez solo existe si el usuario es ADMIN.
 *
 * La barra es el único aviso que tiene un admin antes de que Riot empiece a rechazarnos, así
 * que este store prefiere apagarse a mentir: un 403 lo para para siempre, y un fallo de red
 * deja el último valor bueno visible marcando el estado como error.
 */
@Injectable({ providedIn: 'root' })
export class RiotUsageStore {
  private readonly api = inject(RiotMetricsApi);

  private readonly _usage = signal<RiotApiUsage | null>(null);
  private readonly _status = signal<RiotUsageStatus>('idle');

  private timer: ReturnType<typeof setInterval> | null = null;
  /** Una petición en vuelo: un tick no debe encolar otra si la red va lenta. */
  private inFlight = false;
  /** Un 403/401 apaga el polling del todo; sin esto martillearía el servidor para siempre. */
  private stopped = false;

  readonly usage = this._usage.asReadonly();
  readonly status = this._status.asReadonly();

  /** 0..1. Si `limit` viniera a 0 por lo que sea, no dividimos entre cero. */
  readonly fraction = computed(() => {
    const usage = this._usage();
    if (!usage || usage.limit <= 0) return 0;
    return Math.min(usage.used / usage.limit, 1);
  });

  readonly level = computed<'ok' | 'warn' | 'danger'>(() => {
    const fraction = this.fraction();
    if (fraction >= DANGER_AT) return 'danger';
    if (fraction >= WARN_AT) return 'warn';
    return 'ok';
  });

  /** "63/100" — lo que se lee dentro de la barra. */
  readonly label = computed(() => {
    const usage = this._usage();
    return usage ? `${usage.used}/${usage.limit}` : '—';
  });

  /**
   * Segundos hasta que se libere el primer hueco, medidos contra el reloj del SERVIDOR.
   * `null` cuando no estamos reteniendo nada.
   */
  readonly secondsToNextSlot = computed(() => {
    const usage = this._usage();
    if (!usage?.nextSlotAt) return null;
    const remaining = Date.parse(usage.nextSlotAt) - Date.parse(usage.serverTime);
    return Math.max(0, Math.round(remaining / 1000));
  });

  constructor() {
    // El polling nunca debe sobrevivir al componente que lo arrancó.
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Idempotente: llamarlo dos veces no crea un segundo intervalo. */
  start(): void {
    if (this.stopped || this.timer !== null) return;
    void this.fetch();
    this.timer = setInterval(() => void this.fetch(), POLL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Al cerrar sesión no debe quedar rastro, ni seguir preguntando. */
  clear(): void {
    this.stop();
    this.stopped = false;
    this.inFlight = false;
    this._usage.set(null);
    this._status.set('idle');
  }

  private async fetch(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    if (this._status() === 'idle') this._status.set('loading');
    try {
      this._usage.set(await firstValueFrom(this.api.usage()));
      this._status.set('ready');
    } catch (error) {
      // 401/403: este usuario no puede leer esto, y no lo podrá dentro de 10 s tampoco.
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        this.stopped = true;
        this.stop();
      }
      this._status.set('error');
    } finally {
      this.inFlight = false;
    }
  }
}
