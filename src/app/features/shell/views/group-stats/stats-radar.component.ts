import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { NfSkeleton } from '../../../../ui';
import { MapTelemetry, ObjectiveId } from '../../../../core/group-stats';

export interface RadarPoint {
  id: ObjectiveId;
  label: string;
  winrate: number;
  impact: string;
  x: number;
  y: number;
  axisX: number;
  axisY: number;
  labelX: number;
  labelY: number;
}

/**
 * Radar pentagonal de control de objetivos (§5.5.5, bloque 1 - visualización complementaria):
 * Dibuja la huella de dominio táctico sobre los 5 objetivos de la grieta.
 */
@Component({
  selector: 'app-stats-radar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton],
  template: `
    <section class="st-card st-radar" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Radar de objetivos</h2>
      </header>

      @if (loading()) {
        <div class="st-radar__loading">
          <nf-skeleton width="100%" height="240px" radius="10px" />
        </div>
      } @else if (radarData(); as data) {
        <div class="st-radar__body">
          <svg class="st-radar__svg" viewBox="0 0 280 260" aria-label="Radar pentagonal de control de objetivos">
            <defs>
              <radialGradient id="stRadarGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="var(--nf-primary)" stop-opacity="0.55" />
                <stop offset="100%" stop-color="var(--nf-secondary)" stop-opacity="0.15" />
              </radialGradient>
            </defs>

            <!-- Mallas concéntricas (50% y 100%) -->
            <circle cx="140" cy="130" r="45" class="st-radar__grid-circle" />
            <circle cx="140" cy="130" r="90" class="st-radar__grid-circle" />
            <polygon [attr.points]="data.outerPoints" class="st-radar__outer-poly" />

            <!-- Ejes radiales -->
            @for (p of data.points; track p.id) {
              <line
                x1="140"
                y1="130"
                [attr.x2]="p.axisX"
                [attr.y2]="p.axisY"
                class="st-radar__axis"
              />
            }

            <!-- Área poligonal de control rellena -->
            <polygon [attr.points]="data.polygonPoints" class="st-radar__data-poly" fill="url(#stRadarGrad)" />

            <!-- Nodos interactivos en cada vértice -->
            @for (p of data.points; track p.id) {
              <g
                class="st-radar__node"
                [class.is-hovered]="hoveredId() === p.id"
                (mouseenter)="hoveredId.set(p.id)"
                (mouseleave)="hoveredId.set(null)"
              >
                <circle
                  [attr.cx]="p.x"
                  [attr.cy]="p.y"
                  r="5"
                  class="st-radar__dot"
                />
                <text
                  [attr.x]="p.labelX"
                  [attr.y]="p.labelY"
                  class="st-radar__text nf-mono"
                >
                  {{ p.winrate }}%
                </text>
              </g>
            }
          </svg>

          <div class="st-radar__caption">
            @if (hoveredPoint(); as h) {
              <span class="st-radar__caption-highlight">
                <span class="st-radar__caption-name">{{ h.label }}:</span>
                <strong class="st-radar__caption-val nf-mono">{{ h.winrate }}%</strong>
                <span class="st-radar__caption-tag" [attr.data-impact]="h.impact">{{ h.impact }}</span>
              </span>
            } @else {
              <span class="st-radar__caption-dim">
                Huella de dominio táctico
              </span>
            }
          </div>
        </div>
      } @else {
        <p class="st-card__empty">
          Todavía no hay datos de objetivos suficientes para dibujar el radar.
        </p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-radar.component.scss'],
})
export class StatsRadarComponent {
  readonly telemetry = input<MapTelemetry | null>(null);
  readonly loading = input(false);

  readonly hoveredId = model<string | null>(null);

  readonly radarData = computed(() => {
    const t = this.telemetry();
    if (!t || !t.objectives.length) return null;
    const cx = 140;
    const cy = 130;
    const maxR = 90;
    const points: RadarPoint[] = t.objectives.map((o, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const r = (o.winrate / 100) * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const axisX = cx + maxR * Math.cos(angle);
      const axisY = cy + maxR * Math.sin(angle);
      const labelX = cx + (maxR + 24) * Math.cos(angle);
      const labelY = cy + (maxR + 18) * Math.sin(angle);

      return {
        id: o.id,
        label: o.label,
        winrate: o.winrate,
        impact: o.impact,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        axisX: Math.round(axisX * 10) / 10,
        axisY: Math.round(axisY * 10) / 10,
        labelX: Math.round(labelX * 10) / 10,
        labelY: Math.round(labelY * 10) / 10,
      };
    });

    const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const outerPoints = points.map((p) => `${p.axisX},${p.axisY}`).join(' ');

    return { points, polygonPoints, outerPoints };
  });

  readonly hoveredPoint = computed(
    () => this.radarData()?.points.find((p) => p.id === this.hoveredId()) ?? null,
  );
}
