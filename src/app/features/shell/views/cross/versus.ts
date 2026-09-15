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
 * Cara a cara: las partidas en las que jugasteis en bandos contrarios.
 *
 * `GET /me/matches?with={userId}&relation=ENEMY` para la lista y
 * `GET /me/matches/summary` con los mismos parámetros para el récord. **La relación la decide el
 * servidor leyendo los dos equipos**: esta vista no la adivina ni la filtra por su cuenta.
 *
 * ## Lo que se retiró al conectarla
 *
 * El panel de «Comparativa Directa» enfrentaba vuestras MEDIAS —KDA acumulado, cuota de daño,
 * CS por minuto, visión— y la racha viva. Todo eso se calculaba recorriendo el historial entero
 * cuando el cliente lo tenía en memoria; con la paginación en servidor solo hay una página, y
 * promediarla y presentarla como «vuestro récord» sería una cifra inventada con aspecto de
 * medida. Es una superficie analítica propia y se sirve aparte (issue #69, §8).
 *
 * La comparación cara a cara **de una partida concreta** sí sigue: está en el desplegable de
 * cada fila y en `/contra/:matchId`, donde los dos asientos están delante y no hay que promediar
 * nada.
 */
@Component({
  selector: 'app-versus',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CrossMatchCardComponent, NfPagination],
  styleUrl: './versus.scss',
  template: `
    <div class="vs-view">
      @if (summary(); as agg) {
        @if (agg.totalMatches === 0) {
          <div class="empty-state">
            <p class="empty-state__text nf-mono">Sin enfrentamientos directos</p>
            <p class="empty-state__hint">
              Aún no habéis jugado en bandos contrarios en ninguna partida de vuestros grupos.
            </p>
          </div>
        } @else {
          <section class="vs-balance-card">
            <span class="vs-balance-card__title nf-mono">Balance 1v1</span>

            <div class="vs-ring" [style.--wr]="winrate()" [class.vs-ring--lo]="winrate() < 50">
              <div class="vs-ring__inner">
                <span class="vs-ring__val nf-mono">{{ winrate() }}%</span>
                <span class="vs-ring__lbl nf-mono">WR</span>
              </div>
            </div>

            <div class="vs-balance-card__record nf-mono">
              <span class="vs-balance-card__wins">{{ agg.wins }}V</span>
              <span class="vs-balance-card__sep">-</span>
              <span class="vs-balance-card__losses">{{ agg.losses }}D</span>
            </div>

            <div class="vs-balance-card__extra nf-mono">
              <span class="vs-balance-card__games">
                {{ agg.totalMatches }}
                {{ agg.totalMatches === 1 ? 'partida enfrentados' : 'partidas enfrentados' }}
              </span>
            </div>
          </section>

          <section class="vs-panel">
            <span class="vs-panel__title nf-mono">
              Partidas en bandos contrarios ({{ state.total() }})
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
export class Versus {
  readonly state = inject(CrossViewState);
  readonly ui = inject(MatchHistoryUiState);

  readonly summary = this.state.summaryEnemies;

  readonly returnTo = computed(() => `/app/jugador/${this.state.playerId()}/contra`);

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  /** Sobre partidas decididas: una anulada no cuenta ni como victoria ni como derrota. */
  readonly winrate = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    const decided = s.wins + s.losses;
    return decided > 0 ? Math.round((s.wins / decided) * 100) : 0;
  });

  constructor() {
    this.state.setRelation('enemy');
  }

  onPageChange(page: number): void {
    this.ui.setPage(page);
    const list = this.list()?.nativeElement;
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
