import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDataStore } from '../../../../core/game-data';
import {
  CrossAggregate,
  CrossChampionMatchup,
  CrossRelation,
  Lane,
  laneLabel,
} from '../../../../core/matches';
import { formatNumber } from '../../../../shared/date-format';
import { NfAvatar, NfButton, NfSkeleton } from '../../../../ui';
import { aggregateMetricRows } from './cross-compare';
import { CrossViewState } from './cross-view-state';

/**
 * Las medias acumuladas de un lado del cruce: todo lo jugado en contra, o todo lo jugado junto.
 *
 * Es un solo componente para las dos páginas porque es la misma pregunta sobre dos listas —lo
 * que cambia son las palabras y un par de bloques—, y tener dos copias garantizaba que una se
 * quedase atrás. Los números salen del mismo `crossWith()` que alimenta la lista cruzada: si la
 * lista enseña siete partidas, aquí no pueden salir doce.
 */
@Component({
  selector: 'app-cross-stats',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfButton, NfSkeleton],
  styleUrl: './cross-stats.component.scss',
  template: `
    <div class="cx-stats">
      <!--
        Aquí ya no se comprueba la carga: las dos vistas que montan este componente no lo pintan
        hasta que su estado es firme. Antes se decidía «todavía no habéis coincidido» con el
        recuento a cero sin más, y había una ventana en la que la pantalla negaba unas partidas
        que sí existían.
      -->
      @if (agg().games === 0) {
        <div class="empty-state">
          <p class="empty-state__text nf-mono">{{ emptyTitle() }}</p>
          <p class="empty-state__hint">{{ emptyHint() }}</p>
          <button
            nfButton
            variant="secondary"
            size="md"
            [routerLink]="['/app', 'historial-cruzado', state.playerId()]"
          >
            Ver el historial cruzado
          </button>
        </div>
      } @else {
        <!-- Balance -->
        <section class="cx-panel">
          <h2 class="cx-panel__title nf-mono">{{ balanceTitle() }}</h2>
          <div class="cx-tiles">
            <div class="cx-tile">
              <span class="cx-tile__value nf-mono" [class.cx-pos]="agg().winrate >= 50">
                {{ agg().winrate }} %
              </span>
              <span class="cx-tile__label nf-mono">{{ winrateLabel() }}</span>
              <span class="cx-tile__sub nf-mono">
                {{ agg().wins }}V - {{ agg().losses }}D en {{ agg().games }}
                {{ agg().games === 1 ? 'partida' : 'partidas' }}
              </span>
            </div>

            <div class="cx-tile">
              <span
                class="cx-tile__value nf-mono"
                [class.cx-pos]="agg().kdaDiff > 0"
                [class.cx-neg]="agg().kdaDiff < 0"
              >
                {{ agg().kdaDiff > 0 ? '+' : '' }}{{ agg().kdaDiff.toFixed(2) }}
              </span>
              <span class="cx-tile__label nf-mono">KDA diferencial</span>
              <span class="cx-tile__sub nf-mono">
                tú {{ agg().kdaMe.toFixed(2) }} · {{ theirName() }} {{ agg().kdaThem.toFixed(2) }}
              </span>
            </div>

            @if (agg().goldAt14Games > 0) {
              <div class="cx-tile">
                <span
                  class="cx-tile__value nf-mono"
                  [class.cx-pos]="agg().goldAt14Diff > 0"
                  [class.cx-neg]="agg().goldAt14Diff < 0"
                >
                  {{ agg().goldAt14Diff > 0 ? '+' : '' }}{{ formatGold(agg().goldAt14Diff) }}
                </span>
                <span class="cx-tile__label nf-mono">Oro de media en el minuto 14</span>
                <span class="cx-tile__sub nf-mono">
                  medido en {{ agg().goldAt14Games }}
                  {{ agg().goldAt14Games === 1 ? 'partida' : 'partidas' }}
                </span>
              </div>
            }

            @if (agg().streak; as s) {
              <div class="cx-tile">
                <span class="cx-tile__value nf-mono" [class.cx-pos]="s.type === 'win'" [class.cx-neg]="s.type === 'loss'">
                  {{ s.count }}{{ s.type === 'win' ? 'V' : 'D' }}
                </span>
                <span class="cx-tile__label nf-mono">Racha actual</span>
                <span class="cx-tile__sub nf-mono">{{ streakHint() }}</span>
              </div>
            }
          </div>
        </section>

        <!-- Medias enfrentadas -->
        <section class="cx-panel">
          <h2 class="cx-panel__title nf-mono">Medias enfrentadas</h2>
          <div class="cx-compare cx-compare--flat">
            <div class="cx-compare__legend nf-mono">
              <span class="cx-compare__legend-me">Tú</span>
              <span class="cx-compare__legend-them">{{ theirName() }}</span>
            </div>
            @for (r of metricRows(); track r.key) {
              <!--
                Una fila sin datos conserva su sitio pero se marca: la barra al 50/50 sin más se
                lee como «vais empatados», y lo que pasa es que esa métrica no la registra
                ninguna de vuestras partidas.
              -->
              <div class="cx-metric" [class.cx-metric--nodata]="r.noData">
                <div class="cx-metric__val cx-metric__val--me" [class.is-best]="r.winner === 'me'">
                  <span class="cx-metric__num nf-mono">{{ r.mineText }}</span>
                </div>
                <div class="cx-metric__center">
                  <span class="cx-metric__label nf-mono">
                    {{ r.label }}
                    @if (r.noData) {
                      <span class="cx-metric__nodata" title="Ninguna de vuestras partidas registra este dato">
                        sin datos
                      </span>
                    }
                  </span>
                  <div class="cx-metric__bar" role="presentation">
                    <span class="cx-metric__fill cx-metric__fill--me" [style.width.%]="r.minePct"></span>
                    <span class="cx-metric__fill cx-metric__fill--them" [style.width.%]="r.theirsPct"></span>
                  </div>
                </div>
                <div class="cx-metric__val cx-metric__val--them" [class.is-best]="r.winner === 'them'">
                  <span class="cx-metric__num nf-mono">{{ r.theirsText }}</span>
                </div>
              </div>
            }
          </div>
        </section>

        <!-- Duelo de línea: solo cuando hay bandos opuestos -->
        @if (isEnemy() && agg().laneGames > 0) {
          <section class="cx-panel">
            <h2 class="cx-panel__title nf-mono">Duelo de línea</h2>
            <p class="cx-panel__lead">
              De vuestras {{ agg().games }} partidas enfrentados, en {{ agg().laneGames }}
              coincidisteis en la misma posición. Es el único subconjunto en el que «ganar la
              línea» compara lo mismo, así que es el único en el que se cuenta.
            </p>
            <div class="cx-tiles">
              <div class="cx-tile">
                <span class="cx-tile__value nf-mono" [class.cx-pos]="agg().laneWinrate >= 50">
                  {{ agg().laneWinrate }} %
                </span>
                <span class="cx-tile__label nf-mono">Victorias en duelo directo</span>
                <span class="cx-tile__sub nf-mono">
                  {{ agg().laneWins }} de {{ agg().laneGames }}
                </span>
              </div>
              @if (agg().wonLaneGames > 0) {
                <div class="cx-tile">
                  <span class="cx-tile__value nf-mono" [class.cx-pos]="agg().wonLaneRate >= 50">
                    {{ agg().wonLaneRate }} %
                  </span>
                  <span class="cx-tile__label nf-mono">Líneas ganadas por ti</span>
                  <span class="cx-tile__sub nf-mono">
                    medido en {{ agg().wonLaneGames }}
                    {{ agg().wonLaneGames === 1 ? 'partida' : 'partidas' }}
                  </span>
                </div>
              }
            </div>
          </section>
        }

        <!-- Emparejamientos de campeón -->
        <section class="cx-panel">
          <h2 class="cx-panel__title nf-mono">{{ matchupTitle() }}</h2>
          <ul class="cx-matchups" [attr.aria-busy]="champsLoading() ? 'true' : null">
            @for (m of topMatchups(); track m.myChampionId + ':' + m.theirChampionId) {
              <li class="cx-matchup">
                <nf-avatar
                  class="cx-matchup__champ"
                  [loading]="champsLoading()"
                  [src]="icon(m.myChampionId)"
                  [fallback]="m.myChampionName"
                  [tint]="m.myChampionId"
                  [size]="30"
                  shape="square"
                />
                <span class="cx-matchup__name">
                  @if (champsLoading()) {
                    <nf-skeleton width="72px" height="12px" />
                  } @else {
                    {{ championName(m.myChampionId, m.myChampionName) }}
                  }
                </span>
                <span class="cx-matchup__vs nf-mono" aria-hidden="true">{{ isEnemy() ? 'vs' : '+' }}</span>
                <span class="cx-matchup__name cx-matchup__name--end">
                  @if (champsLoading()) {
                    <nf-skeleton width="72px" height="12px" />
                  } @else {
                    {{ championName(m.theirChampionId, m.theirChampionName) }}
                  }
                </span>
                <nf-avatar
                  class="cx-matchup__champ"
                  [loading]="champsLoading()"
                  [src]="icon(m.theirChampionId)"
                  [fallback]="m.theirChampionName"
                  [tint]="m.theirChampionId"
                  [size]="30"
                  shape="square"
                />
                <span class="cx-matchup__record nf-mono" [class.cx-pos]="m.wins * 2 > m.games">
                  {{ m.wins }}V - {{ m.games - m.wins }}D
                </span>
              </li>
            }
          </ul>
        </section>

        <!-- Posiciones -->
        <section class="cx-panel">
          <h2 class="cx-panel__title nf-mono">{{ roleTitle() }}</h2>
          <ul class="cx-roles">
            @for (r of agg().rolePairs; track r.mine + ':' + r.theirs) {
              <li class="cx-role">
                <span class="cx-role__pair nf-mono">
                  {{ laneName(r.mine) }} {{ isEnemy() ? 'contra' : 'y' }} {{ laneName(r.theirs) }}
                </span>
                <span class="cx-role__record nf-mono" [class.cx-pos]="r.wins * 2 > r.games">
                  {{ r.wins }}V - {{ r.games - r.wins }}D
                </span>
              </li>
            }
          </ul>
        </section>

        <div class="cx-stats__foot">
          <a
            class="m-lineup__more cx-more nf-mono"
            [routerLink]="['/app', 'historial-cruzado', state.playerId()]"
            [queryParams]="{ modo: isEnemy() ? 'versus' : 'synergy' }"
          >
            Ver estas {{ agg().games }} {{ agg().games === 1 ? 'partida' : 'partidas' }} una a una
          </a>
        </div>
      }
    </div>
  `,
})
export class CrossStatsComponent {
  readonly relation = input.required<CrossRelation>();

  protected readonly state = inject(CrossViewState);
  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly isEnemy = computed(() => this.relation() === 'enemy');

  protected readonly agg = computed<CrossAggregate>(() =>
    this.isEnemy() ? this.state.aggregateEnemies() : this.state.aggregateAllies(),
  );

  protected readonly theirName = computed(() => this.state.player()?.name ?? 'el otro jugador');

  protected readonly metricRows = computed(() => aggregateMetricRows(this.agg()));

  /** Seis caben sin volverse una tabla; el resto está en la lista, que es donde se rebusca. */
  protected readonly topMatchups = computed<CrossChampionMatchup[]>(() =>
    this.agg().topMatchups.slice(0, 6),
  );

  protected readonly balanceTitle = computed(() =>
    this.isEnemy() ? 'Balance de vuestros duelos' : 'Balance jugando juntos',
  );

  protected readonly winrateLabel = computed(() =>
    this.isEnemy() ? 'Victorias tuyas en los duelos' : 'Victorias jugando juntos',
  );

  protected readonly matchupTitle = computed(() =>
    this.isEnemy() ? 'Emparejamientos más frecuentes' : 'Combinaciones más jugadas',
  );

  protected readonly roleTitle = computed(() =>
    this.isEnemy() ? 'Posiciones enfrentadas' : 'Posiciones compartidas',
  );

  protected readonly emptyTitle = computed(() =>
    this.isEnemy() ? 'Nunca os habéis enfrentado' : 'Nunca habéis jugado juntos',
  );

  protected readonly emptyHint = computed(() =>
    this.isEnemy()
      ? `No hay ninguna partida registrada en la que ${this.theirName()} y tú estuvierais en bandos opuestos.`
      : `No hay ninguna partida registrada en la que ${this.theirName()} y tú jugarais en el mismo equipo.`,
  );

  protected readonly streakHint = computed(() => {
    const s = this.agg().streak;
    if (!s) return '';
    const noun = s.count === 1 ? 'partida' : 'partidas';
    const verb = s.type === 'win' ? 'ganadas' : 'perdidas';
    return `${s.count} ${noun} ${verb} seguidas`;
  });

  protected formatGold(value: number): string {
    return formatNumber(value);
  }

  protected laneName(lane: Lane): string {
    return laneLabel(lane);
  }

  protected icon(championId: number): string | null {
    return this.gameData.championById().get(championId)?.iconUrl ?? null;
  }

  protected championName(championId: number, fallback: string): string {
    return this.gameData.championById().get(championId)?.name ?? fallback;
  }
}
