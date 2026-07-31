import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  RIOT_METRICS_WINDOWS,
  RiotMetricsStore,
  RiotMetricsWindow,
  RiotUsageStore,
} from '../../../core/admin';
import { areaPath, barHeights, linePoints, scaleMax } from '../../../shared/svg-chart';
import { NfAvatar, NfMeter, NfSkeleton } from '../../../ui';

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
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono nf-eyebrow">Administración</div>
        <h1 class="view__title">Métricas API Riot</h1>
        <p class="view__lead">
          Qué le pedimos a la API de Riot y cuánto nos cuesta. Esto <strong>mide, no frena</strong>:
          nada impide agotar la cuota, solo se ve venir.
        </p>
      </div>

      <!-- Uso en vivo. Comparte store con el indicador de la cabecera, que ya está polleando. -->
      <section class="rm-live">
        <div class="rm-live__meter">
          @if (usage.usage(); as u) {
            <nf-meter [value]="u.used" [max]="u.limit" label="Ventana de 2 minutos" />
          } @else {
            <nf-skeleton width="100%" height="34px" />
          }
        </div>
        <p class="rm-live__note nf-mono">{{ liveNote() }}</p>
      </section>

      <!-- Selector de ventana -->
      <div class="rm-seg" role="group" aria-label="Periodo">
        @for (w of windows; track w) {
          <button
            type="button"
            class="rm-seg__btn nf-mono nf-caps"
            [class.is-active]="store.window() === w"
            [attr.aria-pressed]="store.window() === w"
            (click)="selectWindow(w)"
          >
            {{ windowLabel(w) }}
          </button>
        }
      </div>

      @switch (store.status()) {
        @case ('loading') {
          <div class="rm-skeletons" aria-busy="true">
            <nf-skeleton width="100%" height="72px" />
            <nf-skeleton width="100%" height="200px" />
            <nf-skeleton width="100%" height="160px" />
          </div>
        }
        @case ('error') {
          <div class="empty-state">
            <p>No se han podido cargar las métricas.</p>
            <button type="button" class="rm-seg__btn nf-mono nf-caps" (click)="retry()">
              Reintentar
            </button>
          </div>
        }
        @default {
          @if (store.metrics(); as m) {
            <!-- Totales -->
            <div class="totals">
              <div class="totals__item">
                <div class="totals__val">{{ m.totals.calls }}</div>
                <div class="totals__lbl nf-mono nf-caps">Llamadas</div>
              </div>
              <div class="totals__item">
                <div class="totals__val">{{ m.totals.interactive }}</div>
                <div class="totals__lbl nf-mono nf-caps">Interactivas</div>
              </div>
              <div class="totals__item">
                <div class="totals__val">{{ m.totals.background }}</div>
                <div class="totals__lbl nf-mono nf-caps">De fondo</div>
              </div>
              <div class="totals__item">
                <div class="totals__val" [class.is-bad]="m.totals.rateLimited > 0">
                  {{ m.totals.rateLimited }}
                </div>
                <div class="totals__lbl nf-mono nf-caps">Rechazadas (429)</div>
              </div>
              <div class="totals__item">
                <div class="totals__val" [class.is-bad]="m.totals.failed > 0">{{ m.totals.failed }}</div>
                <div class="totals__lbl nf-mono nf-caps">Fallidas</div>
              </div>
              <div class="totals__item">
                <div class="totals__val">{{ m.totals.avgDurationMs }} ms</div>
                <div class="totals__lbl nf-mono nf-caps">Media (máx {{ m.totals.maxDurationMs }})</div>
              </div>
            </div>

            @if (m.totals.calls === 0) {
              <div class="empty-state">
                <p>No hemos hecho ninguna llamada a Riot en este periodo.</p>
              </div>
            } @else {
              <!-- Evolución por horas -->
              <section class="rm-panel">
                <h2 class="rm-panel__title nf-mono nf-caps">Evolución</h2>
                <svg
                  class="rm-chart"
                  [attr.viewBox]="'0 0 ' + chartW + ' ' + chartH"
                  preserveAspectRatio="none"
                  role="img"
                  [attr.aria-label]="chartLabel()"
                >
                  @for (y of gridLines; track y) {
                    <line class="rm-chart__grid" [attr.x1]="0" [attr.x2]="chartW" [attr.y1]="y" [attr.y2]="y" />
                  }
                  <path class="rm-chart__area" [attr.d]="areaD()" />
                  <polyline class="rm-chart__line" [attr.points]="lineP()" />
                  @if (hasRateLimited()) {
                    <polyline class="rm-chart__line rm-chart__line--bad" [attr.points]="rateLimitedP()" />
                  }
                </svg>
                <div class="rm-chart__axis nf-mono">
                  <span>{{ m.hourly[0].hour | date: 'd MMM HH:mm' }}</span>
                  <span>{{ m.hourly[m.hourly.length - 1].hour | date: 'd MMM HH:mm' }}</span>
                </div>
              </section>

              <!-- Endpoints más consumidos -->
              <section class="rm-panel">
                <h2 class="rm-panel__title nf-mono nf-caps">Endpoints más consumidos</h2>
                @for (e of m.topEndpoints; track e.endpoint) {
                  <div class="rm-row">
                    <div class="rm-row__head">
                      <span class="rm-row__name nf-mono">{{ e.endpoint }}</span>
                      <span class="rm-row__num nf-mono">
                        {{ e.calls }} · {{ e.avgDurationMs }} ms
                        @if (e.rateLimited > 0) {
                          <span class="rm-row__bad" [attr.title]="e.rateLimited + ' rechazadas'">●</span>
                        }
                      </span>
                    </div>
                    <div class="rm-row__track">
                      <div class="rm-row__fill" [style.width.%]="share(e.calls, m.totals.calls)"></div>
                    </div>
                  </div>
                }
              </section>

              <!-- Horas punta -->
              <section class="rm-panel">
                <h2 class="rm-panel__title nf-mono nf-caps">Horas punta</h2>
                <p class="rm-panel__hint">
                  Hora local del grupo (Europe/Madrid), sumando todos los días del periodo.
                  @if (store.window() === 24) {
                    Con 24 h cada franja es una sola muestra.
                  }
                </p>
                <div class="rm-hours">
                  @for (h of m.peakHours; track h.hourOfDay; let i = $index) {
                    <div
                      class="rm-hours__bar"
                      [class.is-peak]="h.calls > 0 && h.calls === peakCalls()"
                      [attr.title]="h.hourOfDay + ':00 — ' + h.calls + ' llamadas'"
                    >
                      <div class="rm-hours__fill" [style.height.%]="hourHeights()[i]"></div>
                    </div>
                  }
                </div>
                <div class="rm-hours__axis nf-mono">
                  <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
                </div>
              </section>

              <!-- Usuarios con más peticiones -->
              <section class="rm-panel">
                <h2 class="rm-panel__title nf-mono nf-caps">Quién gasta más cuota</h2>
                @for (u of m.topUsers; track u.userId) {
                  <div class="rm-user">
                    <nf-avatar
                      [src]="u.avatarUrl"
                      [fallback]="u.discordUsername ?? '?'"
                      [alt]="u.discordUsername ?? 'Cuenta eliminada'"
                      [size]="28"
                    />
                    <div class="rm-user__body">
                      <div class="rm-row__head">
                        <span class="rm-user__name" [class.is-gone]="!u.discordUsername">
                          {{ u.discordUsername ?? 'Cuenta eliminada' }}
                        </span>
                        <span class="rm-row__num nf-mono">{{ u.calls }}</span>
                      </div>
                      <div class="rm-row__track">
                        <div class="rm-row__fill" [style.width.%]="share(u.calls, topUserCalls())"></div>
                      </div>
                    </div>
                  </div>
                } @empty {
                  <p class="rm-panel__hint">Ninguna llamada de este periodo se puede atribuir a un usuario.</p>
                }
              </section>
            }
          }
        }
      }
    </div>
  `,
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
        font-size: 10px;
        letter-spacing: 1.5px;
        color: var(--nf-text-dim);
        background: transparent;
        border: 1.5px solid var(--nf-border);
        border-radius: 5px;
        cursor: pointer;
        transition: color 0.14s, border-color 0.14s;
      }
      .rm-seg__btn:hover,
      .rm-seg__btn.is-active {
        color: var(--nf-cyan);
        border-color: var(--nf-cyan);
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
        font-size: 10px;
        letter-spacing: 2px;
        color: var(--nf-text-mid);
      }
      .rm-panel__hint {
        margin: 0 0 12px;
        font-size: 11.5px;
        color: var(--nf-text-dim);
      }
      .totals__val.is-bad {
        color: var(--nf-red);
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
        fill: color-mix(in srgb, var(--nf-cyan) 16%, transparent);
      }
      .rm-chart__line {
        fill: none;
        stroke: var(--nf-cyan);
        stroke-width: 2;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
      .rm-chart__line--bad {
        stroke: var(--nf-red);
      }
      .rm-chart__axis {
        display: flex;
        justify-content: space-between;
        font-size: 10px;
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
        color: var(--nf-red);
      }
      .rm-row__track {
        height: 5px;
        background: var(--nf-inset);
        border-radius: 999px;
        overflow: hidden;
      }
      .rm-row__fill {
        height: 100%;
        background: var(--nf-cyan);
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
        background: var(--nf-purple);
        border-radius: 3px;
      }
      .rm-hours__bar.is-peak .rm-hours__fill {
        background: var(--nf-pink);
      }
      .rm-hours__axis {
        display: flex;
        justify-content: space-between;
        margin-top: 5px;
        font-size: 10px;
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
