import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { activeFilterCount } from '../../../../core/matches';
import { NfButton, NfPagination } from '../../../../ui';
import { CrossMatchCardComponent } from './cross-match-card.component';
import { CrossViewState } from './cross-view-state';
import { MatchFiltersComponent } from '../match-history/match-filters.component';
import { MatchHistoryUiState } from '../match-history/match-history-ui';

/**
 * El historial cruzado completo: todas las partidas en las que coincidisteis, juntos o
 * enfrentados.
 *
 * Es `GET /me/matches?with={userId}` sin `relation`. Filtrar, ordenar y paginar los hace el
 * servidor, así que el desplegable de relación del panel de filtros manda el parámetro en vez
 * de recortar una lista que ya no está en el cliente.
 */
@Component({
  selector: 'app-historial-cruzado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton, NfPagination, CrossMatchCardComponent, MatchFiltersComponent],
  template: `
    <div class="cx-history-view">
      <app-match-filters mode="cross" [resultCount]="state.total()" />

      @if (state.page().length > 0) {
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
      } @else if (hasFilters()) {
        <div class="empty-state">
          <p class="empty-state__text nf-mono">No se encontraron partidas</p>
          <p class="empty-state__hint">
            Ninguna de vuestras partidas en común coincide con los filtros seleccionados.
          </p>
          <button nfButton variant="secondary" size="md" (click)="resetFilters()">
            Limpiar filtros
          </button>
        </div>
      } @else {
        <div class="empty-state">
          <p class="empty-state__text nf-mono">Todavía no habéis coincidido</p>
          <p class="empty-state__hint">
            No hay ninguna partida registrada en la que hayáis jugado juntos ni enfrentados.
          </p>
          <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos']">
            Ver mis grupos
          </button>
        </div>
      }
    </div>
  `,
})
export class HistorialCruzado {
  protected readonly state = inject(CrossViewState);
  protected readonly ui = inject(MatchHistoryUiState);

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly hasFilters = computed(
    () => activeFilterCount(this.ui.filters(), 'cross') > 0,
  );

  protected readonly returnTo = computed(() => `/app/jugador/${this.state.playerId()}`);

  constructor() {
    // Esta pestaña son TODAS las partidas compartidas; la relación la eligen las otras dos, o
    // el desplegable del panel de filtros dentro de esta.
    this.state.setRelation('all');
  }

  protected onPageChange(page: number): void {
    this.ui.setPage(page);
    const list = this.list()?.nativeElement;
    if (list) {
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected resetFilters(): void {
    this.ui.reset();
  }
}
