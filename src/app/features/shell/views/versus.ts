import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NfPagination } from '../../../ui';
import { Session } from '../../../core/auth';
import { CrossViewState } from './cross/cross-view-state';
import { CrossMatchCardComponent } from './cross/cross-match-card.component';
import { aggregateMetricRows, CrossMetricRow } from './cross/cross-compare';

@Component({
  selector: 'app-versus',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrossMatchCardComponent, NfPagination],
  template: `
    @if (state.aggregateEnemies(); as agg) {
      <div class="vs-view">
        @if (agg.games === 0) {
          <div class="empty-state">
            <p class="empty-state__text nf-mono">Sin enfrentamientos directos</p>
            <p class="empty-state__hint">
              Aún no habéis jugado en bandos contrarios en ninguna partida de vuestros grupos.
            </p>
          </div>
        } @else {
          <!-- Bloque Superior: Split de Métricas Head-to-Head (Izq) y Anillo de Winrate (Der) -->
          <div class="vs-top-grid">
            <!-- Panel Izquierdo: Métricas Head-to-Head con Barras de Tira y Afloja -->
            <section class="vs-panel">
              <div class="vs-panel__head">
                <span class="vs-panel__title nf-mono">Comparativa Directa</span>
              </div>

              <div class="vs-panel__names">
                <span class="vs-fighter-name vs-fighter-name--me">{{ session.displayName() }} (Tú)</span>
                <span class="vs-fighter-name vs-fighter-name--them">{{ theirName() }} (Rival)</span>
              </div>

              <div class="vs-metrics-list">
                @for (row of metricRows(); track row.key) {
                  <div class="vs-metric-row">
                    <div class="vs-metric-row__header nf-mono">
                      <span class="vs-metric-row__mine" [class.is-winner]="row.winner === 'me'">
                        {{ row.mineText }}
                      </span>
                      <span class="vs-metric-row__label">{{ row.label }}</span>
                      <span class="vs-metric-row__theirs" [class.is-winner]="row.winner === 'them'">
                        {{ row.theirsText }}
                      </span>
                    </div>

                    <!-- Barra de Tira y Afloja -->
                    <div class="vs-bar-track">
                      <div
                        class="vs-bar-fill vs-bar-fill--me"
                        [style.width.%]="row.minePct"
                      ></div>
                      <div
                        class="vs-bar-fill vs-bar-fill--them"
                        [style.width.%]="row.theirsPct"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </section>

            <!-- Panel Derecho: Anillo Circular de Winrate (Estilo Perfil) -->
            <section class="vs-balance-card">
              <span class="vs-balance-card__title nf-mono">Balance 1v1</span>

              <div class="vs-ring" [style.--wr]="agg.winrate" [class.vs-ring--lo]="agg.winrate < 50">
                <div class="vs-ring__inner">
                  <span class="vs-ring__val nf-mono">{{ agg.winrate }}%</span>
                  <span class="vs-ring__lbl nf-mono">WR</span>
                </div>
              </div>

              <div class="vs-balance-card__record nf-mono">
                <span class="vs-balance-card__wins">{{ agg.wins }}V</span>
                <span class="vs-balance-card__sep">-</span>
                <span class="vs-balance-card__losses">{{ agg.losses }}D</span>
              </div>

              <span class="vs-balance-card__games nf-mono">
                {{ agg.games }} {{ agg.games === 1 ? 'partida en contra' : 'partidas en contra' }}
              </span>
            </section>
          </div>

          <!-- Rejilla 2x2: Duelos por línea y Matchups frecuentes -->
          <div class="vs-grid">
            <!-- Duelos en la misma línea -->
            <div class="vs-card">
              <span class="vs-card__title">Duelos en la misma línea</span>
              <div class="vs-card__list">
                <div class="vs-card__item">
                  <span class="vs-card__item-label">Partidas en misma posición</span>
                  <span class="vs-card__item-val nf-mono">{{ agg.laneGames }} de {{ agg.games }}</span>
                </div>
                <div class="vs-card__item">
                  <span class="vs-card__item-label">Tu récord en línea directa</span>
                  <span class="vs-card__item-val nf-mono">{{ agg.laneWins }}V - {{ agg.laneGames - agg.laneWins }}D ({{ agg.laneWinrate }}%)</span>
                </div>
                <div class="vs-card__item">
                  <span class="vs-card__item-label">Tasa de línea ganada (@14)</span>
                  <span class="vs-card__item-val nf-mono">{{ agg.wonLaneRate }}% a favor</span>
                </div>
              </div>
            </div>

            <!-- Matchups de campeones más frecuentes -->
            <div class="vs-card">
              <span class="vs-card__title">Matchups más frecuentes</span>
              <div class="vs-card__list">
                @if (agg.topMatchups.length > 0) {
                  @for (m of agg.topMatchups.slice(0, 3); track m.myChampionId + '-' + m.theirChampionId) {
                    <div class="vs-card__item">
                      <span class="vs-card__item-label">{{ m.myChampionName }} vs {{ m.theirChampionName }}</span>
                      <span class="vs-card__item-val nf-mono">{{ m.wins }}V - {{ m.games - m.wins }}D</span>
                    </div>
                  }
                } @else {
                  <div class="vs-card__item">
                    <span class="vs-card__item-label">Sin duelos de campeones repetidos</span>
                    <span class="vs-card__item-val nf-mono">-</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Historial Embebido de Partidas en Contra con Desplegable de 10 Jugadores -->
          <section class="vs-panel">
            <span class="vs-panel__head">Historial en Contra ({{ state.enemies().length }} partidas)</span>
            <div class="mh-list" #list>
              @for (c of pageItems(); track c.id) {
                <app-cross-match-card
                  [cross]="c"
                  [playerId]="state.playerId()"
                  [returnTo]="returnTo()"
                />
              }
            </div>

            <nf-pagination
              [total]="state.enemies().length"
              [pageSize]="pageSize"
              [page]="page()"
              (pageChange)="onPageChange($event)"
            />
          </section>
        }
      </div>
    }
  `,
  styleUrl: './versus.scss',
})
export class Versus {
  readonly state = inject(CrossViewState);
  readonly session = inject(Session);

  readonly theirName = computed(() => this.state.player()?.name ?? 'Rival');

  readonly returnTo = computed(() => `/app/jugador/${this.state.playerId()}/contra`);

  readonly pageSize = 5;
  readonly page = signal(1);

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.state.enemies().slice(start, start + this.pageSize);
  });

  readonly metricRows = computed<CrossMetricRow[]>(() =>
    aggregateMetricRows(this.state.aggregateEnemies()),
  );

  onPageChange(page: number): void {
    this.page.set(page);
    const list = this.list()?.nativeElement;
    if (list) {
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
