import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  RIOT_METRICS_WINDOWS,
  RiotMetricsStore,
  RiotMetricsWindow,
  RiotUsageStore,
} from '../../../../core/admin';
import { areaPath, barHeights, linePoints, scaleMax } from '../../../../shared/svg-chart';
import { NfAvatar, NfMeter, NfSkeleton } from '../../../../ui';

/** Espacio del viewBox de la gráfica de evolución. El tamaño real lo pone el CSS. */
const CHART_W = 600;
const CHART_H = 160;

/** Etiquetas de las ventanas del selector. 168 h = los 7 días de retención del log. */
const WINDOW_LABELS: Record<RiotMetricsWindow, string> = {
  24: '24 h',
  72: '3 días',
  168: '7 días',
};

/**
 * Métricas de la API de Riot (solo ADMIN, protegido por `adminGuard`).
 *
 * Toda la aplicación se apoya en una API ajena con un presupuesto muy corto (100 llamadas cada
 * 2 min). Esta pantalla existe para responder a "¿qué le estamos pidiendo y qué nos podríamos
 * ahorrar?": qué endpoints repetimos, a qué horas apretamos, y quién sale caro.
 *
 * Las gráficas son SVG y CSS a pelo, sin librería: el presupuesto de build es de 500 kB y una
 * librería de charts se lo come para pintar una línea y unas barras.
 */
@Component({
  selector: 'app-admin-riot-metricas',
  standalone: true,
  imports: [DatePipe, NfAvatar, NfMeter, NfSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-riot-metricas.html',
  styles: [
    `
      .rm-live {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 14px 16px;
        margin-bottom: 18px;
        background: var(--nf-surface-2);
        border: 1px solid var(--nf-border);
        border-radius: 10px;
      }
      .rm-live__note {
        margin: 0;
        font-size: 11px;
        color: var(--nf-text-dim);
      }
      .rm-seg {
        display: inline-flex;
        gap: 4px;
        margin-bottom: 18px;
      }
      .rm-seg__btn {
        padding: 6px 12px;
        font-size: 11px;
        color: var(--nf-text-dim);
        background: transparent;
        border: 1.5px solid var(--nf-border);
        border-radius: 5px;
        cursor: pointer;
        transition: color 0.14s, border-color 0.14s;
      }
      .rm-seg__btn:hover,
      .rm-seg__btn.is-active {
        color: var(--nf-secondary);
        border-color: var(--nf-secondary);
      }
      .rm-skeletons {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .rm-panel {
        padding: 16px;
        margin-bottom: 16px;
        background: var(--nf-surface-2);
        border: 1px solid var(--nf-border);
        border-radius: 10px;
      }
      .rm-panel__title {
        margin: 0 0 4px;
        font-size: 11px;
        color: var(--nf-text-mid);
      }
      .rm-panel__hint {
        margin: 0 0 12px;
        font-size: 11.5px;
        color: var(--nf-text-dim);
      }
      .totals__val.is-bad {
        color: var(--nf-danger);
      }
      .rm-chart {
        display: block;
        width: 100%;
        height: 180px;
        margin-top: 10px;
      }
      .rm-chart__grid {
        stroke: var(--nf-border);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }
      .rm-chart__area {
        fill: color-mix(in srgb, var(--nf-secondary) 16%, transparent);
      }
      .rm-chart__line {
        fill: none;
        stroke: var(--nf-secondary);
        stroke-width: 2;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
      .rm-chart__line--bad {
        stroke: var(--nf-danger);
      }
      .rm-chart__axis {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--nf-text-dim);
      }
      .rm-row {
        margin-bottom: 12px;
      }
      .rm-row__head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 4px;
        min-width: 0;
      }
      .rm-row__name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11.5px;
        color: var(--nf-text);
      }
      .rm-row__num {
        flex: none;
        font-size: 11px;
        color: var(--nf-text-dim);
        font-variant-numeric: tabular-nums;
      }
      .rm-row__bad {
        color: var(--nf-danger);
      }
      .rm-row__track {
        height: 5px;
        background: var(--nf-inset);
        border-radius: 999px;
        overflow: hidden;
      }
      .rm-row__fill {
        height: 100%;
        background: var(--nf-secondary);
        border-radius: 999px;
      }
      .rm-hours {
        display: grid;
        grid-template-columns: repeat(24, 1fr);
        align-items: end;
        gap: 3px;
        height: 90px;
      }
      .rm-hours__bar {
        display: flex;
        align-items: flex-end;
        height: 100%;
        background: var(--nf-inset);
        border-radius: 3px;
        overflow: hidden;
      }
      .rm-hours__fill {
        width: 100%;
        background: var(--nf-tertiary);
        border-radius: 3px;
      }
      .rm-hours__bar.is-peak .rm-hours__fill {
        background: var(--nf-primary);
      }
      .rm-hours__axis {
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        font-size: 11px;
        color: var(--nf-text-dim);
      }
      .rm-user {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .rm-user__body {
        flex: 1;
        min-width: 0;
      }
      .rm-user__name {
        font-size: 12.5px;
        color: var(--nf-text);
      }
      .rm-user__name.is-gone {
        color: var(--nf-text-dim);
        font-style: italic;
      }
    `,
  ],
})
export class AdminRiotMetricas {
  readonly store = inject(RiotMetricsStore);
  /** Misma instancia que el indicador de la cabecera: ya está polleando, no se duplica. */
  readonly usage = inject(RiotUsageStore);

  readonly windows = RIOT_METRICS_WINDOWS;
  readonly chartW = CHART_W;
  readonly chartH = CHART_H;
  readonly gridLines = [CHART_H * 0.25, CHART_H * 0.5, CHART_H * 0.75];

  constructor() {
    void this.store.ensureLoaded();
    // Puede que el usuario entre aquí directamente por URL, sin haber pasado por la cabecera.
    this.usage.start();
  }

  private readonly hourlyCalls = computed(() => this.store.metrics()?.hourly.map((h) => h.calls) ?? []);

  readonly lineP = computed(() => linePoints(this.hourlyCalls(), CHART_W, CHART_H));
  readonly areaD = computed(() => areaPath(this.hourlyCalls(), CHART_W, CHART_H));

  /**
   * La línea de 429 se dibuja con el MISMO máximo que la de llamadas, para que se lea como la
   * fracción de ellas que es. Con su propia escala, dos rechazos llenarían el alto del gráfico
   * y parecerían una catástrofe.
   */
  readonly rateLimitedP = computed(() => {
    const hourly = this.store.metrics()?.hourly;
    if (!hourly) return '';
    return linePoints(
      hourly.map((h) => h.rateLimited),
      CHART_W,
      CHART_H,
      scaleMax(this.hourlyCalls()),
    );
  });

  readonly hasRateLimited = computed(() => (this.store.metrics()?.totals.rateLimited ?? 0) > 0);

  readonly hourHeights = computed(() =>
    barHeights(this.store.metrics()?.peakHours.map((h) => h.calls) ?? []),
  );

  readonly peakCalls = computed(() =>
    Math.max(...(this.store.metrics()?.peakHours.map((h) => h.calls) ?? [0])),
  );

  readonly topUserCalls = computed(() => this.store.metrics()?.topUsers[0]?.calls ?? 0);

  readonly chartLabel = computed(() => {
    const metrics = this.store.metrics();
    if (!metrics) return 'Evolución de las llamadas';
    return `Evolución de las llamadas a Riot: ${metrics.totals.calls} en ${metrics.windowHours} horas`;
  });

  /** El pie del bloque en vivo, que es donde se explica lo de compartir la API key. */
  readonly liveNote = computed(() => {
    const u = this.usage.usage();
    if (!u) return 'Cargando el uso actual…';

    const parts = [`${u.used} de ${u.limit} en los últimos ${u.windowSeconds} s`];
    if (u.riotCount !== null) {
      parts.push(
        `Riot cuenta ${u.riotCount}: la diferencia es lo que gasta la app antigua con la misma clave`,
      );
    }
    const seconds = this.usage.secondsToNextSlot();
    if (seconds !== null && u.used > 0) parts.push(`hueco libre en ${seconds} s`);
    return parts.join(' · ');
  });

  windowLabel(hours: RiotMetricsWindow): string {
    return WINDOW_LABELS[hours];
  }

  selectWindow(hours: RiotMetricsWindow): void {
    void this.store.setWindow(hours);
  }

  retry(): void {
    void this.store.reload();
  }

  /** Porcentaje de una barra sobre su referencia. Nunca divide entre cero. */
  share(value: number, total: number): number {
    return total > 0 ? Math.min((value / total) * 100, 100) : 0;
  }
}
