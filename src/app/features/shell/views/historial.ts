import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { GameDataStore } from '../../../core/game-data';
import { NfButton, NfPagination, NfSkeleton } from '../../../ui';
import { MatchCardComponent } from './match-history/match-card.component';
import { MatchFiltersComponent } from './match-history/match-filters.component';
import { MatchSummaryCardComponent } from './match-history/match-summary-card.component';

@Component({
  selector: 'app-historial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NfPagination,
    NfButton,
    NfSkeleton,
    MatchCardComponent,
    MatchFiltersComponent,
    MatchSummaryCardComponent,
  ],
  template: `
    <div class="view">
      <!-- CABECERA DE LA VISTA -->
      <div class="view__head">
        <div class="view__eyebrow nf-mono">Registro competitivo</div>
        <h1 class="view__title">Historial de Partidas</h1>
        <p class="view__lead">Tus últimas partidas disputadas en todas tus ligas y grupos. Pulsa sobre cualquier partida para desplegar el análisis completo y el marcador 5v5.</p>
      </div>

      <!-- AVISO DE CONTEXTO MULTI-GRUPO -->
      <div class="scope-note" role="note">
        <span class="scope-note__icon" aria-hidden="true">◆</span>
        <p class="scope-note__text">
          Estás viendo tu <strong>historial personal unificado</strong>.
          La etiqueta <strong>◆ Grupo</strong> en cada partida identifica en qué liga se disputó y te permite saltar a su registro colectivo.
        </p>
      </div>

      <!-- WIDGET DE RESUMEN DE RENDIMIENTO PERSONAL -->
      <app-match-summary-card />

      <!-- BARRA REACTIVA DE FILTROS -->
      <app-match-filters [showGroupFilter]="true" />

      <!-- LISTA DE PARTIDAS -->
      @if (champsLoading()) {
        <!-- SKELETON LOADERS -->
        <div class="mh-list" aria-busy="true">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="m-card" style="padding: 16px; min-height: 84px; display: flex; align-items: center; justify-content: space-between;">
              <div style="display: flex; gap: 14px; align-items: center;">
                <nf-skeleton width="46px" height="46px" radius="6px" />
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <nf-skeleton width="130px" height="16px" />
                  <nf-skeleton width="90px" height="12px" />
                </div>
              </div>
              <div style="display: flex; gap: 20px; align-items: center;">
                <nf-skeleton width="100px" height="18px" />
                <nf-skeleton width="140px" height="24px" />
                <nf-skeleton width="80px" height="14px" />
              </div>
            </div>
          }
        </div>
      } @else if (pageItems().length > 0) {
        <div class="mh-list">
          @for (m of pageItems(); track m.id) {
            <app-match-card [match]="m" mode="personal" />
          }
        </div>

        <!-- PAGINACIÓN -->
        <nf-pagination
          [total]="totalMatches()"
          [pageSize]="pageSize"
          [page]="page()"
          (pageChange)="onPageChange($event)"
        />
      } @else if (hasAnyMatches()) {
        <!-- EMPTY STATE: SIN RESULTADOS PARA LOS FILTROS ACTUALES -->
        <div class="empty-state">
          <span class="empty-state__icon">🔍</span>
          <p class="empty-state__text nf-mono">No se encontraron partidas</p>
          <p class="empty-state__hint">No hay partidas que coincidan con los filtros seleccionados.</p>
          <button nfButton variant="secondary" size="md" (click)="resetFilters()">
            Limpiar filtros
          </button>
        </div>
      } @else {
        <!-- EMPTY STATE: USUARIO SIN PARTIDAS -->
        <div class="empty-state">
          <span class="empty-state__icon">🎮</span>
          <p class="empty-state__text nf-mono">Historial vacío</p>
          <p class="empty-state__hint">Aún no has disputado ninguna partida en tus grupos. Únete a una sala abierta para registrar tu primera partida.</p>
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

  readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  readonly allPersonal = this.store.allPersonalMatches;
  readonly filtered = this.store.filteredPersonalMatches;

  readonly hasAnyMatches = computed(() => this.allPersonal().length > 0);
  readonly totalMatches = computed(() => this.filtered().length);

  readonly pageSize = 6;
  readonly page = signal(1);

  readonly pageItems = computed(() => {
    const list = this.filtered();
    const start = (this.page() - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  });

  constructor() {
    this.gameData.ensureLoaded();
  }

  onPageChange(newPage: number): void {
    this.page.set(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetFilters(): void {
    this.store.resetFilters();
    this.page.set(1);
  }
}
