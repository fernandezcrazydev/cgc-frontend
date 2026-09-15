import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { NfPagination } from '../../../../ui';
import { MatchHistoryUiState } from '../match-history/match-history-ui';
import { CrossViewState } from './cross-view-state';
import { CrossMatchCardComponent } from './cross-match-card.component';

/**
 * Sinergia: las partidas en las que jugasteis en el mismo equipo.
 *
 * `GET /me/matches?with={userId}&relation=ALLY` para la lista y
 * `GET /me/matches/summary` con los mismos parámetros para el récord.
 *
 * ## Lo que se retiró al conectarla
 *
 * El panel de «Aporte y Rendimiento Conjunto», los «dúos fetiche» de campeones, la sinergia por
 * parejas de posiciones, la racha viva y el tier de química. Los cuatro primeros salían de
 * recorrer el historial entero en memoria, y con la paginación en servidor eso ya no existe. El
 * tier salía de los otros: un sello «Tier S» calculado sobre la página que hay en pantalla es
 * una etiqueta con aspecto de veredicto y sin nada detrás.
 *
 * Es una superficie analítica propia y se sirve aparte (issue #69, §8). La comparación **de una
 * partida concreta** sí sigue: está en el desplegable de cada fila y en `/juntos/:matchId`.
 */
@Component({
  selector: 'app-synergy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrossMatchCardComponent, NfPagination],
  styleUrl: './synergy.scss',
  template: `
    <div class="syn-view">
      @if (summary(); as agg) {
        @if (agg.totalMatches === 0) {
          <div class="empty-state">
            <p class="empty-state__text nf-mono">Sin partidas juntos</p>
            <p class="empty-state__hint">
              Aún no habéis jugado como compañeros en el mismo equipo en ninguna partida.
            </p>
          </div>
        } @else {
          <section class="syn-balance-card">
            <div class="syn-balance-card__top">
              <span class="syn-balance-card__title nf-mono">Química de dúo</span>
            </div>

            <div class="syn-ring" [style.--wr]="winrate()" [class.syn-ring--lo]="winrate() < 50">
              <div class="syn-ring__inner">
                <span class="syn-ring__val nf-mono">{{ winrate() }}%</span>
                <span class="syn-ring__lbl nf-mono">WR</span>
              </div>
            </div>

            <div class="syn-balance-card__record nf-mono">
              <span class="syn-balance-card__wins">{{ agg.wins }}V</span>
              <span class="syn-balance-card__sep">-</span>
              <span class="syn-balance-card__losses">{{ agg.losses }}D</span>
            </div>

            <div class="syn-balance-card__extra nf-mono">
              <span class="syn-balance-card__games">
                {{ agg.totalMatches }}
                {{ agg.totalMatches === 1 ? 'partida juntos' : 'partidas juntos' }}
              </span>
            </div>
          </section>

          <section class="syn-panel">
            <span class="syn-panel__title nf-mono">
              Partidas en el mismo equipo ({{ state.total() }})
            </span>
            <div class="mh-list" #list>
              @for (c of state.page(); track c.id) {
                <app-cross-match-card
                  [cross]="c"
                  [playerId]="state.playerId()"
                  [returnTo]="returnTo()"
                />
              }
            </div>

            <nf-pagination
              [total]="state.total()"
              [pageSize]="state.pageSize"
              [page]="ui.page()"
              (pageChange)="onPageChange($event)"
            />
          </section>
        }
      }
    </div>
  `,
})
export class Synergy {
  readonly state = inject(CrossViewState);
  readonly ui = inject(MatchHistoryUiState);

  readonly summary = this.state.summaryAllies;

  readonly returnTo = computed(() => `/app/jugador/${this.state.playerId()}/juntos`);

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  /** Sobre partidas decididas: una anulada no cuenta ni como victoria ni como derrota. */
  readonly winrate = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    const decided = s.wins + s.losses;
    return decided > 0 ? Math.round((s.wins / decided) * 100) : 0;
  });

  constructor() {
    this.state.setRelation('ally');
  }

  onPageChange(page: number): void {
    this.ui.setPage(page);
    const list = this.list()?.nativeElement;
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
