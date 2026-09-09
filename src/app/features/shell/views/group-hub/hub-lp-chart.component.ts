import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { NfSelect, NfSkeleton } from '../../../../ui';
import { HubLeagueSeries, HubSeason } from '../../../../core/group-hub';
import { StatModality } from '../../../../core/group-stats';

/** Un punto de una liga, ya proyectado al espacio del `viewBox`. */
interface ChartPoint {
  x: number;
  y: number;
  day: number;
  lp: number;
  /** Diferencia con el punto anterior de SU liga. */
  delta: number;
  label: string;
}

/** Una liga lista para pintar: su trazo, su relleno y sus puntos ya proyectados. */
interface ChartLeague {
  modality: StatModality;
  label: string;
  points: ChartPoint[];
  linePath: string;
  areaPath: string;
  rank: number;
  lp: number;
  netLp: number;
  winrate: number;
}

/** Lo que dice el tooltip de una liga en el día señalado por el cursor. */
interface Reading {
  modality: StatModality;
  label: string;
  point: ChartPoint;
}

interface ChartTick {
  y: number;
  label: string;
}

/** Qué temporada quiere ver el usuario, y de qué liga. */
export interface LeagueSeasonChange {
  modality: StatModality;
  seasonId: string;
}

/**
 * Evolución de LP de **las tres ligas** en la temporada (`FlujoJuego.md` §3.1).
 *
 * La usan dos pantallas: el hub del grupo, donde el desplegable elige **temporada**, y el perfil
 * propio (`ProfileLpChartComponent`), donde elige **grupo**. Por eso el desplegable se llama
 * `options`/`optionId`/`optionChange` y no `seasons`: la gráfica no sabe —ni le importa— qué
 * distingue una serie de otra, solo que hay varias y que el usuario elige entre ellas. Si vuelve
 * a llamarse "temporada" aquí dentro, el perfil tendrá que mentir para usarla.
 *
 * **Las tres ligas se pintan juntas y cada una se puede apagar.** Es lo que pidió el usuario el
 * 2026-09-09 y tiene un motivo de uso claro: lo normal no es comparar Competitivo con Caos, es
 * seguir una sola —«me apetece ver mi progreso en Caos»—, y para eso hay que poder quitar las
 * otras dos de en medio. Las que están en `NOT_STARTED` (§3.2) no se pueden encender: no es que
 * no haya datos, es que esa temporada todavía no ha arrancado.
 *
 * **El eje X son días de temporada, no fechas de calendario ni porcentaje.** Cada temporada
 * arranca con su primera partida (§3.2), al cerrarse **el LP se limpia** (§3.5) y la siguiente
 * nace de cero, así que una temporada es una curva completa y las tres ligas nunca están en el
 * mismo punto del calendario. Poniendo el día 0 de cada una en el origen, las tres se pueden
 * comparar —y también dos temporadas distintas de la misma liga—. En días absolutos y no en
 * porcentaje **a propósito**: el owner puede cambiar la duración de una temporada a la siguiente
 * (§3.4), así que el 50% de una de dos meses y el de una de tres no son lo mismo; con días, la
 * corta simplemente acaba antes en el eje, que es la verdad. Apagar una liga reescala el eje a
 * las que quedan.
 *
 * **Cada liga elige su propia temporada**, y su desplegable solo aparece si tiene más de una
 * jugada (§5.5.4: un desplegable de un elemento es un control que no decide nada). No existe la
 * «temporada del grupo»: con 6, 3 y 2 meses de duración, en un año caben ~2 de Competitivo, ~4 de
 * Equilibrado y ~6 de Caos, y ninguna empieza cuando la otra.
 *
 * El SVG se dibuja a pelo: el presupuesto de bundle no da para una librería de gráficas y aquí
 * solo hacen falta unas líneas, unas cotas y el crosshair.
 */
@Component({
  selector: 'app-hub-lp-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSelect, NfSkeleton],
  template: `
    <section class="hub-card hub-lp" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="hub-card__head">
        <h2 class="hub-card__title nf-mono">{{ title() }}</h2>
        <!-- Con una sola serie el selector no decide nada: no se pinta (§5.5.4). -->
        @if (options().length > 1) {
          <nf-select
            [options]="selectOptions()"
            [value]="optionId()"
            [ariaLabel]="optionsLabel()"
            (valueChange)="optionChange.emit($event)"
          />
        }
      </header>

      @if (loading()) {
        <nf-skeleton width="100%" height="56px" radius="10px" />
        <nf-skeleton width="100%" height="188px" radius="10px" />
      } @else {
        <!-- Leyenda, interruptor y estado actual de cada liga, todo en la misma pieza: son tres
             lecturas de la misma cosa y separarlas obligaría a mirar a dos sitios. -->
        <ul class="hub-lp__legend">
          @for (l of leagues(); track l.modality) {
            <li [class]="'hub-lp__league ' + colorClass(l.modality)" [class.is-off]="!isOn(l.modality)">
              <!-- El interruptor es un botón de verdad y NO envuelve al desplegable: un select
                   dentro de un button no es HTML válido y el teclado no sabría a cuál va. -->
              <button
                type="button"
                class="hub-lp__league-toggle"
                [disabled]="!l.started"
                [attr.aria-pressed]="l.started ? isOn(l.modality) : null"
                [title]="leagueTitle(l)"
                (click)="toggle(l.modality)"
              >
                <span class="hub-lp__league-head">
                  <span class="hub-lp__dot" aria-hidden="true"></span>
                  <span class="hub-lp__league-name">{{ l.label }}</span>
                </span>

                @if (l.started) {
                  <span class="hub-lp__league-state nf-mono">
                    {{ l.rank }}.º · {{ l.lp }} LP
                  </span>
                  <span class="hub-lp__league-sub nf-mono">
                    <span [class.is-down]="l.netLp < 0">{{ signed(l.netLp) }} LP</span>
                    · {{ l.winrate }}% de victorias
                  </span>
                } @else {
                  <span class="hub-lp__league-state nf-mono">Sin empezar</span>
                  <span class="hub-lp__league-sub nf-mono">Arranca con su primera partida</span>
                }
              </button>

              <!-- Con una sola temporada el nombre del trofeo se dice y ya: no hay nada que
                   elegir (§5.5.4). Sin ninguna, no se dice nada. -->
              @if (l.seasons.length > 1) {
                <nf-select
                  class="hub-lp__league-season"
                  [options]="seasonOptionsOf(l)"
                  [value]="l.seasonId"
                  [ariaLabel]="'Elegir temporada de ' + l.label"
                  (valueChange)="leagueSeasonChange.emit({ modality: l.modality, seasonId: $event })"
                />
              } @else if (l.seasons.length === 1) {
                <span class="hub-lp__league-season-name nf-mono">{{ l.seasonLabel }}</span>
              }
            </li>
          }
        </ul>

        @if (visible().length) {
          <div class="hub-lp__plot" (mousemove)="onMove($event)" (mouseleave)="hoveredDay.set(null)">
            <div
              class="hub-lp__tooltip"
              [class.is-left]="tooltipPercentX() > 55"
              [style.left.%]="tooltipPercentX()"
            >
              <span class="hub-lp__tooltip-date nf-mono">{{ activeLabel() }}</span>
              @for (r of readings(); track r.modality) {
                <span class="hub-lp__tooltip-row" [class]="'hub-lp__tooltip-row ' + colorClass(r.modality)">
                  <span class="hub-lp__dot" aria-hidden="true"></span>
                  <span class="hub-lp__tooltip-league">{{ r.label }}</span>
                  <span class="hub-lp__tooltip-lp nf-mono">{{ r.point.lp }} LP</span>
                  @if (r.point.delta !== 0) {
                    <span class="hub-lp__tooltip-delta nf-mono" [class.is-down]="r.point.delta < 0">
                      {{ signed(r.point.delta) }}
                    </span>
                  }
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

              <line
                class="hub-lp__crosshair"
                [attr.x1]="activeX()"
                y1="20"
                [attr.x2]="activeX()"
                y2="270"
              />

              @for (l of visible(); track l.modality) {
                <g [class]="colorClass(l.modality)">
                  <!-- El relleno solo con UNA liga encendida: tres áreas superpuestas tapan las
                       líneas y no se lee ninguna. -->
                  @if (visible().length === 1) {
                    <path class="hub-lp__area" [attr.d]="l.areaPath" />
                  }
                  <path class="hub-lp__line" [attr.d]="l.linePath" />
                </g>
              }

              @for (r of readings(); track r.modality) {
                <circle
                  [class]="'hub-lp__marker ' + colorClass(r.modality)"
                  [attr.cx]="r.point.x"
                  [attr.cy]="r.point.y"
                  r="5"
                />
              }
            </svg>
          </div>

          <div class="hub-lp__scale nf-mono" aria-hidden="true">
            <span>{{ firstLabel() }}</span>
            <span>{{ lastLabel() }}</span>
          </div>
        } @else {
          <p class="hub-card__empty">{{ emptyText() }}</p>
        }
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-lp-chart.component.scss'],
})
export class HubLpChartComponent {
  /** Las tres ligas (`FlujoJuego.md` §3.1). Las no empezadas vienen con `started: false`. */
  readonly leagues = input<readonly HubLeagueSeries[]>([]);
  readonly title = input('Evolución de LP en la temporada');
  /** Las series entre las que puede elegir el usuario: temporadas en el hub, grupos en el perfil. */
  readonly options = input<readonly HubSeason[]>([]);
  readonly optionId = input('current');
  /** Etiqueta accesible del desplegable, que cambia con lo que se está eligiendo. */
  readonly optionsLabel = input('Seleccionar temporada');
  readonly loading = input(false);
  readonly optionChange = output<string>();
  /** El usuario ha elegido otra temporada de UNA liga; las demás no se tocan. */
  readonly leagueSeasonChange = output<LeagueSeasonChange>();

  /** Espacio del `viewBox`. El tamaño real lo pone el CSS (`preserveAspectRatio="none"`). */
  private static readonly W = 1000;
  private static readonly H = 300;
  private static readonly PAD = { left: 10, right: 100, top: 20, bottom: 30 };

  /**
   * Ligas apagadas a mano. Se guarda lo apagado y no lo encendido para que una liga que estrena
   * temporada aparezca sola, sin que haya que acordarse de encenderla.
   */
  private readonly off = signal<ReadonlySet<StatModality>>(new Set());

  /** Día señalado por el cursor. Sin cursor encima manda el último día con datos. */
  protected readonly hoveredDay = signal<number | null>(null);

  protected readonly selectOptions = computed(() =>
    this.options().map((s) => ({ value: s.id, label: s.label })),
  );

  protected isOn(modality: StatModality): boolean {
    return !this.off().has(modality);
  }

  protected toggle(modality: StatModality): void {
    this.off.update((set) => {
      const next = new Set(set);
      if (next.has(modality)) next.delete(modality);
      else next.add(modality);
      return next;
    });
  }

  /** Las ligas que hoy tienen curva: empezadas y encendidas. */
  private readonly active = computed<HubLeagueSeries[]>(() =>
    this.leagues().filter((l) => l.started && this.isOn(l.modality)),
  );

  /** Ventana del eje X: del primer día con datos al último, entre las ligas visibles. */
  private readonly xDomain = computed<[number, number]>(() => {
    const days = this.active().flatMap((l) => l.points.map((p) => p.day));
    if (!days.length) return [0, 1];
    const min = Math.min(...days);
    const max = Math.max(...days);
    // Una liga con un solo punto (o todos el mismo día) no puede dividir por cero.
    return [min, max > min ? max : min + 1];
  });

  private readonly yDomain = computed<[number, number]>(() => {
    const lps = this.active().flatMap((l) => l.points.map((p) => p.lp));
    if (!lps.length) return [0, 1];
    const min = Math.min(...lps);
    const max = Math.max(...lps);
    return [min, max > min ? max : min + 1];
  });

  /** Las ligas visibles, proyectadas al `viewBox`. */
  protected readonly visible = computed<ChartLeague[]>(() => {
    const { W, H } = HubLpChartComponent;
    const { left, right, top, bottom } = HubLpChartComponent.PAD;
    const plotW = W - left - right;
    const plotH = H - top - bottom;
    const [dayMin, dayMax] = this.xDomain();
    const [lpMin, lpMax] = this.yDomain();
    const base = H - bottom;

    return this.active().map((league) => {
      const points: ChartPoint[] = league.points.map((p, idx) => ({
        x: Number((left + ((p.day - dayMin) / (dayMax - dayMin)) * plotW).toFixed(1)),
        y: Number((top + (1 - (p.lp - lpMin) / (lpMax - lpMin)) * plotH).toFixed(1)),
        day: p.day,
        lp: p.lp,
        delta: idx > 0 ? p.lp - league.points[idx - 1].lp : 0,
        label: p.label,
      }));
      const line = points.map((p) => p.x + ',' + p.y).join(' L ');
      return {
        modality: league.modality,
        label: league.label,
        points,
        linePath: points.length ? 'M ' + line : '',
        areaPath:
          points.length > 1
            ? `M ${points[0].x},${base} L ${line} L ${points[points.length - 1].x},${base} Z`
            : '',
        rank: league.rank,
        lp: league.lp,
        netLp: league.netLp,
        winrate: league.winrate,
      };
    });
  });

  /** El día del que habla el crosshair: el del cursor, o el último con datos. */
  private readonly activeDay = computed<number>(() => {
    const hovered = this.hoveredDay();
    if (hovered !== null) return hovered;
    return this.xDomain()[1];
  });

  /** Qué marca cada liga visible en ese día: su punto más cercano. */
  protected readonly readings = computed<Reading[]>(() => {
    const day = this.activeDay();
    const out: Reading[] = [];
    for (const league of this.visible()) {
      let closest = league.points[0];
      if (!closest) continue;
      for (const point of league.points) {
        if (Math.abs(point.day - day) < Math.abs(closest.day - day)) closest = point;
      }
      out.push({ modality: league.modality, label: league.label, point: closest });
    }
    return out;
  });

  protected readonly activeX = computed(() => {
    const { W } = HubLpChartComponent;
    const { left, right } = HubLpChartComponent.PAD;
    const [min, max] = this.xDomain();
    const ratio = (this.activeDay() - min) / (max - min);
    return Number((left + Math.max(0, Math.min(1, ratio)) * (W - left - right)).toFixed(1));
  });

  protected readonly tooltipPercentX = computed(
    () => Number(((this.activeX() / HubLpChartComponent.W) * 100).toFixed(2)),
  );

  /**
   * El encabezado del tooltip. Habla en días de temporada, que es lo que comparten las tres
   * curvas; la fecha real solo se añade cuando hay UNA liga visible, porque con varias sería la
   * fecha de una de ellas y las otras estarían en otro mes.
   */
  protected readonly activeLabel = computed(() => {
    const readings = this.readings();
    if (!readings.length) return '';
    const day = Math.round(this.activeDay());
    if (readings.length > 1) return 'Día ' + day + ' de temporada';
    return 'Día ' + day + ' · ' + readings[0].point.label;
  });

  /** Cuatro cotas numéricas repartidas entre el mínimo y el máximo de lo visible. */
  protected readonly ticks = computed<ChartTick[]>(() => {
    if (!this.visible().length) return [];
    const [min, max] = this.yDomain();
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

  protected readonly firstLabel = computed(() => 'Primera partida');
  protected readonly lastLabel = computed(() => 'Día ' + Math.round(this.xDomain()[1]));

  /** Las temporadas de una liga, tal cual, para su desplegable. */
  protected seasonOptionsOf(league: HubLeagueSeries): { value: string; label: string }[] {
    return league.seasons.map((s) => ({ value: s.id, label: s.label }));
  }

  /**
   * Dos huecos que parecen el mismo y no lo son: uno es que no hay nada que enseñar y el otro es
   * que lo has escondido tú. Decir "has apagado las tres ligas" cuando una de ellas ni siquiera
   * ha empezado manda al usuario a buscar un interruptor que no existe.
   */
  protected readonly emptyText = computed(() => {
    if (!this.leagues().some((l) => l.started)) {
      return 'Ninguna de las tres ligas ha empezado todavía. Cada una arranca con su primera partida.';
    }
    return 'No hay ninguna liga encendida. Enciende alguna aquí arriba para ver su evolución.';
  });

  protected readonly chartLabel = computed(() => {
    const visible = this.visible();
    if (!visible.length) return 'Evolución de LP';
    return (
      'Evolución de LP por liga: ' +
      visible.map((l) => l.label + ', ' + l.lp + ' puntos').join('; ')
    );
  });

  protected colorClass(modality: StatModality): string {
    return COLOR_CLASS[modality];
  }

  protected signed(value: number): string {
    return (value > 0 ? '+' : '') + value;
  }

  protected leagueTitle(league: HubLeagueSeries): string {
    if (!league.started) {
      return league.label + ': esta liga todavía no ha jugado ninguna temporada';
    }
    const verb = this.isOn(league.modality) ? 'Ocultar' : 'Mostrar';
    return verb + ' ' + league.label + ' · ' + league.seasonLabel;
  }

  /** Engancha el crosshair al día bajo el cursor. */
  onMove(event: MouseEvent): void {
    const host = event.currentTarget as HTMLElement | null;
    if (!host || !this.visible().length) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width) return;
    const { W } = HubLpChartComponent;
    const { left, right } = HubLpChartComponent.PAD;
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const ratio = (x - left) / (W - left - right);
    const [min, max] = this.xDomain();
    this.hoveredDay.set(min + Math.max(0, Math.min(1, ratio)) * (max - min));
  }
}

/**
 * Qué clase de color lleva cada liga. Se escribe el nombre entero y no `'is-' + modality` a
 * propósito: una clase compuesta en runtime no la ve ni un grep ni la regla `dead-css` de
 * `npm run arch`, que la daría por muerta y acabaría borrando el estilo de las tres ligas.
 */
const COLOR_CLASS: Record<StatModality, string> = {
  COMPETITIVE: 'is-competitive',
  BALANCED: 'is-balanced',
  CHAOS: 'is-chaos',
};
