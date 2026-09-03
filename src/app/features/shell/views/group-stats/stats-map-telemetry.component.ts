import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NfSkeleton } from '../../../../ui';
import { MapTelemetry } from '../../../../core/group-stats';

/**
 * Telemetría de mapa y control de objetivos (§5.5.5, bloque 1 de la pestaña de
 * rendimiento): cómo se reparten las victorias entre los dos lados de la grieta y
 * cuánto pesa cada objetivo grande en ganar la partida.
 *
 * La barra de bandos no lleva leyenda de color aparte: cada extremo va rotulado con
 * su propio nombre y su cifra, que es lo que se lee de un vistazo. Los cuatro
 * indicadores traducen además el porcentaje a una palabra («decisivo», «alto»,
 * «medio») para no obligar a interpretar el número.
 */
@Component({
  selector: 'app-stats-map-telemetry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton],
  template: `
    <section class="st-card" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Telemetría de mapa y control de objetivos</h2>
      </header>

      @if (loading()) {
        <nf-skeleton width="100%" height="58px" radius="10px" />
        <div class="st-grid tm-objectives">
          @for (s of [0, 1, 2, 3]; track s) {
            <nf-skeleton width="100%" height="86px" radius="10px" />
          }
        </div>
      } @else if (telemetry(); as t) {
        <div class="tm-sides">
          <div class="tm-sides__row">
            <span class="tm-sides__label tm-sides__label--blue">
              Bando azul
              <strong class="nf-mono">{{ t.side.bluePct }}%</strong>
            </span>
            <span class="tm-sides__label tm-sides__label--red">
              <strong class="nf-mono">{{ t.side.redPct }}%</strong>
              Bando rojo
            </span>
          </div>

          <div
            class="tm-sides__bar"
            role="img"
            [attr.aria-label]="
              'El bando azul gana el ' +
              t.side.bluePct +
              ' por ciento de las partidas y el rojo el ' +
              t.side.redPct +
              ' por ciento'
            "
          >
            <span class="tm-sides__fill tm-sides__fill--blue" [style.width.%]="t.side.bluePct"></span>
            <span class="tm-sides__fill tm-sides__fill--red" [style.width.%]="t.side.redPct"></span>
          </div>

          <p class="tm-sides__foot nf-mono">
            {{ t.side.blueWins }} victorias en azul · {{ t.side.redWins }} en rojo ·
            {{ t.side.games }} partidas
          </p>
        </div>

        <ul class="st-grid tm-objectives">
          @for (o of t.objectives; track o.id) {
            <li class="tm-objective" [attr.data-impact]="o.impact">
              <span class="tm-objective__label">{{ o.label }}</span>
              <span class="tm-objective__value nf-mono">{{ o.winrate }}%</span>
              <span class="tm-objective__sub nf-mono">{{ o.wins }} de {{ o.games }} partidas</span>
              <span class="tm-objective__impact">Impacto {{ o.impact.toLowerCase() }}</span>
            </li>
          }
        </ul>
      } @else {
        <p class="st-card__empty">
          Todavía no hay partidas suficientes para medir el control del mapa.
        </p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-map-telemetry.component.scss'],
})
export class StatsMapTelemetryComponent {
  readonly telemetry = input<MapTelemetry | null>(null);
  readonly loading = input(false);
}
