import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import {
  activeFilterCount,
  personalMatchQuery,
  personalSummaryQuery,
} from '../../../../core/matches/match-filtering';
import { GameDataStore } from '../../../../core/game-data';
import { Viewport } from '../../../../shared/viewport';
import { ViewMemoryService } from '../../../../shared/view-memory';
import { NfButton, NfPagination, NfSkeleton } from '../../../../ui';
import { MatchFiltersComponent } from './match-filters.component';
import { MatchHistoryUiState } from './match-history-ui';
import { MatchSummaryCardComponent } from './match-summary-card.component';
import { PersonalMatchCardComponent } from './personal-match-card.component';

/**
 * Mi historial: `GET /me/matches`, que cruza grupos.
 *
 * Filtrar, ordenar, buscar y paginar los hace el SERVIDOR. La vista solo traduce el estado de
 * los controles a query params y pinta lo que vuelve. Lo que ves en pantalla es una página, no
 * una porción de una lista que esté en memoria: por eso el contador sale de `totalElements` y
 * el resumen de cabecera es su propio endpoint.
 */
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

      <app-match-filters mode="personal" [resultCount]="total()" />

      @switch (status()) {
        @case ('loading') {
          <div class="mh-list" aria-busy="true">
            @for (i of skeletonRows; track i) {
              <div class="m-card m-card--skeleton" aria-hidden="true">
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
        }
        @case ('error') {
          <div class="empty-state">
            <p class="empty-state__text nf-mono">No se pudo cargar el historial</p>
            <p class="empty-state__hint">
              La conexión con el servidor falló. Tus partidas siguen ahí; vuelve a intentarlo.
            </p>
            <button nfButton variant="primary" size="md" (click)="retry()">Reintentar</button>
          </div>
        }
        @default {
          @if (matches().length > 0) {
            <div class="mh-list" #list>
              @for (m of matches(); track m.id) {
                <app-personal-match-card [match]="m" />
              }
            </div>

            <nf-pagination
              [total]="total()"
              [pageSize]="pageSize"
              [page]="ui.page()"
              (pageChange)="onPageChange($event)"
            />
          } @else if (hasFilters()) {
            <div class="empty-state">
              <p class="empty-state__text nf-mono">No se encontraron partidas</p>
              <p class="empty-state__hint">
                Ninguna partida coincide con los filtros seleccionados.
              </p>
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
        }
      }
    </div>
  `,
})
export class Historial {
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);
  private readonly viewport = inject(Viewport);
  private readonly viewMemory = inject(ViewMemoryService);
  protected readonly ui = inject(MatchHistoryUiState);

  protected readonly skeletonRows = [1, 2, 3, 4];
  protected readonly pageSize = 6;

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly matches = this.store.personalMatches;
  protected readonly total = this.store.personalTotal;

  /**
   * El catálogo de campeones cuenta como parte de la carga: una fila sin nombre de campeón no
   * está lista para enseñarse, y pintarla y cambiarla un instante después es el salto que los
   * esqueletos existen para evitar.
   */
  protected readonly status = computed(() => {
    const own = this.store.personalStatus();
    if (own === 'error') return 'error';
    const champs = this.gameData.status();
    if (own === 'idle' || own === 'loading' || champs === 'idle' || champs === 'loading') {
      return 'loading';
    }
    return 'ready';
  });

  protected readonly hasFilters = computed(() => activeFilterCount(this.ui.filters(), 'personal') > 0);

  /** El estado de los controles, traducido a lo que entiende el endpoint. */
  private readonly query = computed(() =>
    personalMatchQuery(this.ui.filters(), this.ui.page() - 1, this.pageSize),
  );

  constructor() {
    this.ui.setContextKey('/app/historial');
    this.gameData.ensureLoaded();

    // Una sola fuente: cambia el filtro o la página → cambia la consulta → se pide. El store
    // deduplica la consulta repetida y descarta las respuestas que lleguen fuera de orden.
    effect(() => {
      const query = this.query();
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      untracked(() => void this.store.ensurePersonal(query));
    });
    effect(() => {
      const query = personalSummaryQuery(this.ui.filters());
      untracked(() => void this.store.ensurePersonalSummary(query));
    });

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

  protected retry(): void {
    void this.store.reloadPersonal(this.query());
    void this.store.ensurePersonalSummary(personalSummaryQuery(this.ui.filters()));
  }

  protected resetFilters(): void {
    this.ui.reset();
  }
}
