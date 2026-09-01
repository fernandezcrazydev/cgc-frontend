import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { filterCrossMatches, sortCrossMatches } from '../../../core/matches';
import { Viewport } from '../../../shared/viewport';
import { NfButton, NfPagination } from '../../../ui';
import { CrossMatchCardComponent } from './cross/cross-match-card.component';
import { CrossViewState } from './cross/cross-view-state';
import { MatchFiltersComponent } from './match-history/match-filters.component';
import { MatchHistoryUiState } from './match-history/match-history-ui';

@Component({
  selector: 'app-historial-cruzado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MatchHistoryUiState],
  imports: [
    RouterLink,
    NfButton,
    NfPagination,
    CrossMatchCardComponent,
    MatchFiltersComponent,
  ],
  template: `
    <div class="cx-history-view">
      <app-match-filters
        mode="cross"
        [championIds]="championIds()"
        [resultCount]="filtered().length"
        [totalCount]="all().length"
      />

      @if (pageItems().length > 0) {
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
          [total]="filtered().length"
          [pageSize]="pageSize"
          [page]="ui.page()"
          (pageChange)="onPageChange($event)"
        />
      } @else if (all().length > 0) {
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
  private readonly route = inject(ActivatedRoute);
  private readonly viewport = inject(Viewport);

  protected readonly state = inject(CrossViewState);
  protected readonly ui = inject(MatchHistoryUiState);

  protected readonly pageSize = 5;

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly all = this.state.all;

  constructor() {
    const modo = this.route.snapshot?.queryParamMap?.get('modo');
    if (modo === 'versus') {
      this.ui.update({ relation: 'enemy' });
    } else if (modo === 'synergy') {
      this.ui.update({ relation: 'ally' });
    }
  }

  protected readonly championIds = computed(() => {
    const ids = new Set<number>();
    for (const c of this.all()) {
      ids.add(c.me.championId);
      ids.add(c.them.championId);
    }
    return Array.from(ids);
  });

  protected readonly filtered = computed(() => {
    const filters = this.ui.filters();
    const subset = filterCrossMatches(this.all(), filters);
    return sortCrossMatches(subset, filters.sortBy);
  });

  protected readonly pageItems = computed(() => {
    const start = (this.ui.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  protected readonly returnTo = computed(() => {
    return `/app/jugador/${this.state.playerId()}`;
  });

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
