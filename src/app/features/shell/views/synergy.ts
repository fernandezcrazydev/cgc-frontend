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

interface ChemistryInfo {
  tier: 'S' | 'A' | 'B';
  tierLabel: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-synergy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrossMatchCardComponent, NfPagination],
  template: `
    @if (state.aggregateAllies(); as agg) {
      <div class="syn-view">
        @if (agg.games === 0) {
          <div class="empty-state">
            <p class="empty-state__text nf-mono">Sin partidas juntos</p>
            <p class="empty-state__hint">
              Aún no habéis jugado como compañeros en el mismo equipo en ninguna partida.
            </p>
          </div>
        } @else {
          <!-- Bloque Superior: Split de Métricas de Sinergia (Izq) y Anillo de Química (Der) -->
          <div class="syn-top-grid">
            <!-- Panel Izquierdo: Rendimiento y Aporte Cooperativo con Barras -->
            <section class="syn-panel">
              <div class="syn-panel__head">
                <span class="syn-panel__title nf-mono">Aporte y Rendimiento Conjunto</span>
                <span class="syn-panel__joint-impact nf-mono">
                  Impacto: {{ combinedDamage() }}% Daño · {{ combinedVision() }} Visión/p
                </span>
              </div>

              <div class="syn-panel__names">
                <span class="syn-fighter-name syn-fighter-name--me">{{ session.displayName() }} (Tú)</span>
                <span class="syn-fighter-name syn-fighter-name--them">{{ theirName() }} (Aliado)</span>
              </div>

              <div class="syn-metrics-list">
                @for (row of metricRows(); track row.key) {
                  <div class="syn-metric-row">
                    <div class="syn-metric-row__header nf-mono">
                      <span class="syn-metric-row__mine" [class.is-winner]="row.winner === 'me'">
                        {{ row.mineText }}
                      </span>
                      <span class="syn-metric-row__label">{{ row.label }}</span>
                      <span class="syn-metric-row__theirs" [class.is-winner]="row.winner === 'them'">
                        {{ row.theirsText }}
                      </span>
                    </div>

                    <!-- Barra de Aporte Cooperativo -->
                    <div class="syn-bar-track">
                      <div
                        class="syn-bar-fill syn-bar-fill--me"
                        [style.width.%]="row.minePct"
                      ></div>
                      <div
                        class="syn-bar-fill syn-bar-fill--them"
                        [style.width.%]="row.theirsPct"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </section>

            <!-- Panel Derecho: Tarjeta de Química de Dúo (Anillo de Winrate + Tier) -->
            <section class="syn-balance-card">
              <div class="syn-balance-card__top">
                <span class="syn-balance-card__title nf-mono">Química de Dúo</span>
                <span
                  class="syn-tier-badge nf-mono"
                  [class.syn-tier-badge--s]="chemistry().tier === 'S'"
                  [class.syn-tier-badge--a]="chemistry().tier === 'A'"
                  [class.syn-tier-badge--b]="chemistry().tier === 'B'"
                >
                  {{ chemistry().tierLabel }}
                </span>
              </div>

              <div class="syn-ring" [style.--wr]="agg.winrate" [class.syn-ring--lo]="agg.winrate < 50">
                <div class="syn-ring__inner">
                  <span class="syn-ring__val nf-mono">{{ agg.winrate }}%</span>
                  <span class="syn-ring__lbl nf-mono">WR</span>
                </div>
              </div>

              <div class="syn-balance-card__record nf-mono">
                <span class="syn-balance-card__wins">{{ agg.wins }}V</span>
                <span class="syn-balance-card__sep">-</span>
                <span class="syn-balance-card__losses">{{ agg.losses }}D</span>
              </div>

              <div class="syn-balance-card__extra nf-mono">
                @if (agg.streak; as s) {
                  <span class="syn-streak-pill">
                    Racha: {{ s.count }}{{ s.type === 'win' ? 'V' : 'D' }}
                  </span>
                }
                <span class="syn-balance-card__games">
                  {{ agg.games }} {{ agg.games === 1 ? 'partida juntos' : 'partidas juntos' }}
                </span>
              </div>
            </section>
          </div>

          <!-- Rejilla de Dúos y Sinergia de Líneas -->
          <div class="syn-grid">
            <!-- Dúos fetiche de campeones -->
            <div class="syn-card">
              <span class="syn-card__title">Dúos Fetiche (Campeones)</span>
              <div class="syn-card__list">
                @if (agg.topMatchups.length > 0) {
                  @for (m of agg.topMatchups.slice(0, 3); track m.myChampionId + '-' + m.theirChampionId) {
                    <div class="syn-card__item">
                      <span class="syn-card__item-label">{{ m.myChampionName }} + {{ m.theirChampionName }}</span>
                      <span class="syn-card__item-val nf-mono">{{ m.wins }}V - {{ m.games - m.wins }}D</span>
                    </div>
                  }
                } @else {
                  <div class="syn-card__item">
                    <span class="syn-card__item-label">Sin combinaciones repetidas</span>
                    <span class="syn-card__item-val nf-mono">-</span>
                  </div>
                }
              </div>
            </div>

            <!-- Sinergia por parejas de posiciones -->
            <div class="syn-card">
              <span class="syn-card__title">Sinergia por Roles</span>
              <div class="syn-card__list">
                @if (agg.rolePairs.length > 0) {
                  @for (r of agg.rolePairs.slice(0, 3); track r.mine + '-' + r.theirs) {
                    <div class="syn-card__item">
                      <span class="syn-card__item-label">{{ r.mine }} + {{ r.theirs }}</span>
                      <span class="syn-card__item-val nf-mono">{{ r.wins }}V en {{ r.games }} partidas</span>
                    </div>
                  }
                } @else {
                  <div class="syn-card__item">
                    <span class="syn-card__item-label">Sin roles fijados</span>
                    <span class="syn-card__item-val nf-mono">-</span>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Historial de Partidas Compartidas con Desplegable de 10 Jugadores -->
          <section class="syn-panel">
            <span class="syn-panel__title nf-mono">Partidas Compartidas en el Mismo Equipo ({{ state.allies().length }} partidas)</span>
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
              [total]="state.allies().length"
              [pageSize]="pageSize"
              [page]="page()"
              (pageChange)="onPageChange($event)"
            />
          </section>
        }
      </div>
    }
  `,
  styleUrl: './synergy.scss',
})
export class Synergy {
  readonly state = inject(CrossViewState);
  readonly session = inject(Session);

  readonly theirName = computed(() => this.state.player()?.name ?? 'Aliado');

  readonly returnTo = computed(() => `/app/jugador/${this.state.playerId()}/juntos`);

  readonly pageSize = 5;
  readonly page = signal(1);

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.state.allies().slice(start, start + this.pageSize);
  });

  readonly metricRows = computed<CrossMetricRow[]>(() =>
    aggregateMetricRows(this.state.aggregateAllies()),
  );

  readonly combinedDamage = computed(() => {
    const agg = this.state.aggregateAllies();
    return agg.damageShareMe + agg.damageShareThem;
  });

  readonly combinedVision = computed(() => {
    const agg = this.state.aggregateAllies();
    return agg.visionMe + agg.visionThem;
  });

  onPageChange(page: number): void {
    this.page.set(page);
    const list = this.list()?.nativeElement;
    if (list) {
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  readonly chemistry = computed<ChemistryInfo>(() => {
    const agg = this.state.aggregateAllies();
    const wr = agg.winrate;
    if (wr >= 70 && agg.games >= 2) {
      return {
        tier: 'S',
        tierLabel: 'Tier S',
        title: 'Química Imparable (Tier S)',
        desc: 'Una dupla de alto impacto con un porcentaje de victoria sobresaliente cuando jugáis en el mismo bando.',
      };
    }
    if (wr >= 50) {
      return {
        tier: 'A',
        tierLabel: 'Tier A',
        title: 'Sólida Coordinación (Tier A)',
        desc: 'Buen entendimiento colectivo y rendimiento positivo compartiendo equipo en vuestras customs.',
      };
    }
    return {
      tier: 'B',
      tierLabel: 'Tier B',
      title: 'En Desarrollo (Tier B)',
      desc: 'Aún necesitáis ajustar vuestras combinaciones de campeones para maximizar vuestro winrate juntos.',
    };
  });
}
