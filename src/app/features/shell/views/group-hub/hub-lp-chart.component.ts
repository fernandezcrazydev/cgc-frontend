import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NfSelect, NfSkeleton } from '../../../../ui';
import { HubLpSeries, HubSeason } from '../../../../core/group-hub';

/** Un punto de la serie, ya proyectado al espacio del `viewBox`. */
interface ChartPoint {
  idx: number;
  x: number;
  y: number;
  /** Posición relativa para colocar el tooltip en HTML sobre el SVG. */
  percentX: number;
  percentY: number;
  lp: number;
  /** Diferencia con el punto anterior. */
  delta: number;
  label: string;
}

interface ChartTick {
  y: number;
  label: string;
}

/**
 * Evolución de LP del grupo en la temporada (§5.5.4, columna del 75%).
 *
 * El SVG se dibuja a pelo: el presupuesto de bundle no da para una librería de gráficas y aquí
 * solo hacen falta una línea, su relleno, unas cotas y el crosshair. La interacción es la misma
 * que la gráfica de Inicio (`inicio.html`): el ratón mueve una guía vertical al punto más cercano
 * y un tooltip dice cuántos LP había ese día y cuánto se movió respecto al anterior.
 */
@Component({
  selector: 'app-hub-lp-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSelect, NfSkeleton],
  template: `
    <section class="hub-card hub-lp" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="hub-card__head">
        <h2 class="hub-card__title nf-mono">Evolución de LP en la temporada</h2>
        <!-- Con una sola temporada el selector no decide nada: no se pinta (§5.5.4). -->
        @if (seasons().length > 1) {
          <nf-select
            [options]="seasonOptions()"
            [value]="seasonId()"
            (valueChange)="seasonChange.emit($event)"
          />
        }
      </header>

      @if (loading()) {
        <nf-skeleton width="100%" height="188px" radius="10px" />
        <nf-skeleton width="60%" height="13px" />
      } @else if (series(); as s) {
        <div class="hub-lp__meta nf-mono">
          <span class="hub-lp__meta-date">{{ active().label }}</span>
          <span class="hub-lp__meta-lp">{{ active().lp }} LP</span>
          @if (active().delta !== 0) {
            <span class="hub-lp__meta-delta" [class.is-down]="active().delta < 0">
              {{ active().delta > 0 ? '+' : '' }}{{ active().delta }} LP
            </span>
          }
        </div>

        <div
          class="hub-lp__plot"
          (mousemove)="onMove($event)"
          (mouseleave)="hovered.set(null)"
        >
          <div class="hub-lp__tooltip" [class.is-left]="active().percentX > 55"
            [style.left.%]="active().percentX"
            [style.top.%]="active().percentY"
          >
            <span class="hub-lp__tooltip-date nf-mono">{{ active().label }}</span>
            <span class="hub-lp__tooltip-lp nf-mono">{{ active().lp }} LP</span>
            @if (active().delta !== 0) {
              <span class="hub-lp__tooltip-delta nf-mono" [class.is-down]="active().delta < 0">
                {{ active().delta > 0 ? '+' : '' }}{{ active().delta }} respecto al punto anterior
              </span>
            }
          </div>

          <svg
            class="hub-lp__svg"
            viewBox="0 0 1000 300"
            preserveAspectRatio="none"
            role="img"
            [attr.aria-label]="chartLabel()"
          >
            @for (tick of ticks(); track tick.label) {
              <line class="hub-lp__guide" x1="10" [attr.y1]="tick.y" x2="900" [attr.y2]="tick.y" />
              <text class="hub-lp__axis nf-mono" x="912" [attr.y]="tick.y + 4">{{ tick.label }}</text>
            }

            <path class="hub-lp__area" [attr.d]="areaPath()" />
            <path class="hub-lp__line" [attr.d]="linePath()" />

            <line
              class="hub-lp__crosshair"
              [attr.x1]="active().x"
              y1="20"
              [attr.x2]="active().x"
              y2="270"
            />
            <circle class="hub-lp__dot" [attr.cx]="active().x" [attr.cy]="active().y" r="6" />
          </svg>
        </div>

        <div class="hub-lp__scale nf-mono" aria-hidden="true">
          <span>{{ s.points[0].label }}</span>
          <span>{{ s.points[s.points.length - 1].label }}</span>
        </div>
        <p class="hub-lp__summary nf-mono">
          <span class="hub-lp__stat">Puesto {{ s.rank }}.º</span>
          <span class="hub-lp__stat">{{ s.lp }} LP</span>
          <span class="hub-lp__stat" [class.is-down]="s.netLp < 0">{{ netLabel() }} neto</span>
          <span class="hub-lp__stat">{{ s.winrate }}% de victorias</span>
        </p>
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-lp-chart.component.scss'],
})
export class HubLpChartComponent {
  readonly series = input<HubLpSeries | null>(null);
  readonly seasons = input<readonly HubSeason[]>([]);
  readonly seasonId = input('current');
  readonly loading = input(false);
  readonly seasonChange = output<string>();

  /** Espacio del `viewBox`. El tamaño real lo pone el CSS (`preserveAspectRatio="none"`). */
  private static readonly W = 1000;
  private static readonly H = 300;
  private static readonly PAD = { left: 10, right: 100, top: 20, bottom: 30 };

  /** Punto bajo el cursor. Sin cursor encima manda el último de la serie. */
  readonly hovered = signal<ChartPoint | null>(null);

  protected readonly seasonOptions = computed(() =>
    this.seasons().map((s) => ({ value: s.id, label: s.label })),
  );

  /** La serie proyectada al `viewBox`, con su delta y su etiqueta ya resueltos por punto. */
  readonly points = computed<ChartPoint[]>(() => {
    const s = this.series();
    if (!s || !s.points.length) return [];
    const { W, H } = HubLpChartComponent;
    const { left, right, top, bottom } = HubLpChartComponent.PAD;
    const plotW = W - left - right;
    const plotH = H - top - bottom;
    const values = s.points.map((p) => p.lp);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // Nunca se divide por cero: una serie plana se dibuja plana, en el centro.
    const range = max - min || 1;

    return s.points.map((point, idx) => {
      const stepX = s.points.length > 1 ? plotW / (s.points.length - 1) : plotW / 2;
      const x = Number((left + idx * stepX).toFixed(1));
      const y = Number((top + (1 - (point.lp - min) / range) * plotH).toFixed(1));
      return {
        idx,
        x,
        y,
        percentX: Number(((x / W) * 100).toFixed(2)),
        percentY: Number(((y / H) * 100).toFixed(2)),
        lp: point.lp,
        delta: idx > 0 ? point.lp - s.points[idx - 1].lp : 0,
        label: point.label,
      };
    });
  });

  /** El punto que gobierna crosshair y tooltip. */
  readonly active = computed<ChartPoint>(() => {
    const points = this.points();
    const hovered = this.hovered();
    const fallback: ChartPoint = {
      idx: 0,
      x: HubLpChartComponent.PAD.left,
      y: HubLpChartComponent.PAD.top,
      percentX: 0,
      percentY: 0,
      lp: this.series()?.lp ?? 0,
      delta: 0,
      label: '',
    };
    if (!points.length) return fallback;
    if (hovered && points[hovered.idx]) return points[hovered.idx];
    return points[points.length - 1];
  });

  protected readonly linePath = computed(() => {
    const points = this.points();
    if (!points.length) return '';
    return 'M ' + points.map((p) => p.x + ',' + p.y).join(' L ');
  });

  protected readonly areaPath = computed(() => {
    const points = this.points();
    if (points.length < 2) return '';
    const base = HubLpChartComponent.H - HubLpChartComponent.PAD.bottom;
    const line = points.map((p) => p.x + ',' + p.y).join(' L ');
    return `M ${points[0].x},${base} L ${line} L ${points[points.length - 1].x},${base} Z`;
  });

  /** Cuatro cotas numéricas repartidas entre el mínimo y el máximo de la serie. */
  protected readonly ticks = computed<ChartTick[]>(() => {
    const s = this.series();
    if (!s || !s.points.length) return [];
    const values = s.points.map((p) => p.lp);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const { top, bottom } = HubLpChartComponent.PAD;
    const plotH = HubLpChartComponent.H - top - bottom;
    return [0, 1, 2, 3].map((k) => {
      const ratio = k / 3;
      return {
        y: Number((top + (1 - ratio) * plotH).toFixed(1)),
        label: Math.round(min + ratio * (max - min)) + ' LP',
      };
    });
  });

  protected readonly netLabel = computed(() => {
    const net = this.series()?.netLp ?? 0;
    return (net > 0 ? '+' : '') + net + ' LP';
  });

  protected readonly chartLabel = computed(() => {
    const s = this.series();
    if (!s) return 'Evolución de LP';
    return 'Evolución de LP: de ' + s.points[0].lp + ' a ' + s.lp + ' puntos de liga';
  });

  /** Engancha el crosshair al punto más cercano al cursor. */
  onMove(event: MouseEvent): void {
    const host = event.currentTarget as HTMLElement | null;
    const points = this.points();
    if (!host || !points.length) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    const x = ((event.clientX - rect.left) / rect.width) * HubLpChartComponent.W;
    let closest = points[0];
    for (const point of points) {
      if (Math.abs(point.x - x) < Math.abs(closest.x - x)) closest = point;
    }
    this.hovered.set(closest);
  }
}
