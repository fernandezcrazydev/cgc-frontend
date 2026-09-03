import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { filterPersonalMatches, sortMatches } from '../../../core/matches/match-filtering';
import { GameDataStore } from '../../../core/game-data';
import { GroupsStore } from '../../../core/groups';
import { Viewport } from '../../../shared/viewport';
import { ViewMemoryService } from '../../../shared/view-memory';
import { NfButton, NfPagination, NfSkeleton } from '../../../ui';
import { MatchFiltersComponent } from './match-history/match-filters.component';
import { MatchHistoryUiState } from './match-history/match-history-ui';
import { MatchSummaryCardComponent } from './match-history/match-summary-card.component';
import { PersonalMatchCardComponent } from './match-history/personal-match-card.component';

@Component({
  selector: 'app-historial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Por vista, no global: los filtros de aquí no deben aparecer puestos en el historial de
  // un grupo, y al salir de la ruta se limpian solos.
  providers: [MatchHistoryUiState],
  imports: [
    RouterLink,
    NfPagination,
    NfButton,
    NfSkeleton,
    MatchFiltersComponent,
    MatchSummaryCardComponent,
    PersonalMatchCardComponent,
  ],
  template: `
    <div class="view">
      <app-match-summary-card />

      <app-match-filters
        mode="personal"
        [resultCount]="filtered().length"
        [totalCount]="allPersonal().length"
      />

      @if (champsLoading()) {
        <div class="mh-list" aria-busy="true">
          @for (i of skeletonRows; track i) {
            <div class="m-card m-card--skeleton">
              <div class="m-card__skeleton-left">
                <nf-skeleton width="46px" height="46px" radius="6px" />
                <div class="m-card__skeleton-stack">
                  <nf-skeleton width="130px" height="16px" />
                  <nf-skeleton width="90px" height="12px" />
                </div>
              </div>
              <div class="m-card__skeleton-right">
                <nf-skeleton width="100px" height="18px" />
                <nf-skeleton width="140px" height="24px" />
                <nf-skeleton width="80px" height="14px" />
              </div>
            </div>
          }
        </div>
      } @else if (pageItems().length > 0) {
        <div class="mh-list" #list>
          @for (m of pageItems(); track m.id) {
            <app-personal-match-card [match]="m" />
          }
        </div>

        <nf-pagination
          [total]="filtered().length"
          [pageSize]="pageSize"
          [page]="ui.page()"
          (pageChange)="onPageChange($event)"
        />
      } @else if (allPersonal().length > 0) {
        <div class="empty-state">
          <p class="empty-state__text nf-mono">No se encontraron partidas</p>
          <p class="empty-state__hint">Ninguna partida coincide con los filtros seleccionados.</p>
          <button nfButton variant="secondary" size="md" (click)="resetFilters()">
            Limpiar filtros
          </button>
        </div>
      } @else {
        <div class="empty-state">
          <p class="empty-state__text nf-mono">Historial vacío</p>
          <p class="empty-state__hint">
            Aún no has disputado ninguna partida en tus grupos. Únete a una sala abierta para
            registrar la primera.
          </p>
          <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos']">
            Ver mis grupos
          </button>
        </div>
      }
    </div>
  `,
})
export class Historial {
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly viewport = inject(Viewport);
  private readonly viewMemory = inject(ViewMemoryService);
  protected readonly ui = inject(MatchHistoryUiState);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly pageSize = 6;

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly allPersonal = this.store.allPersonalMatches;

  protected readonly filtered = computed(() => {
    const f = this.ui.filters();
    return sortMatches(filterPersonalMatches(this.allPersonal(), f), f.sortBy);
  });

  protected readonly pageItems = computed(() => {
    const start = (this.ui.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  constructor() {
    this.ui.setContextKey('/app/historial');
    this.gameData.ensureLoaded();
    // El historial se reparte sobre las ligas del usuario, asi que la lista tiene que estar
    // pedida aunque se entre aqui directamente por URL. Idempotente y deduplicada.
    this.groupsStore.ensureLoaded();

    afterNextRender(() => {
      // El scroll se recupera solo al volver del detalle: entrar de nuevo por el menú empieza
      // arriba, como cualquier lista recién abierta.
      if (!this.viewMemory.consumeReturn('/app/historial')) return;
      const y = this.viewMemory.consumeScroll('/app/historial');
      if (y !== null && y > 0) {
        window.scrollTo({ top: y, behavior: 'instant' });
      }
    });
  }

  /**
   * Al cambiar de página, en móvil se vuelve al principio de la LISTA y no del documento:
   * por encima están el resumen y los filtros, que ahí son casi dos pantallas de scroll
   * para llegar otra vez a las partidas que se acaban de pedir. En escritorio ese trecho
   * es corto y el comportamiento no cambia.
   */
  protected onPageChange(page: number): void {
    this.ui.setPage(page);
    const list = this.viewport.isMobile() ? this.list()?.nativeElement : null;
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected resetFilters(): void {
    this.ui.reset();
  }
}
