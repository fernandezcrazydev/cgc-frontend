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
import { NfButton, NfPagination, NfSkeleton } from '../../../ui';
import { CrossHeaderComponent } from './cross/cross-header.component';
import { CrossMatchCardComponent } from './cross/cross-match-card.component';
import { CrossViewState } from './cross/cross-view-state';
import { MatchFiltersComponent } from './match-history/match-filters.component';
import { MatchHistoryUiState } from './match-history/match-history-ui';

/**
 * Historial cruzado: las partidas que has compartido con otro jugador, juntos o enfrentados.
 *
 * Es el mismo armazón que `historial.ts` y `grupo-historial.ts` —cabecera, barra de filtros,
 * lista de `.m-card`, paginación y los cuatro estados separados— porque es la misma pregunta
 * sobre un recorte distinto de los mismos datos. Lo único propio es qué proyecta cada fila y
 * qué se abre al desplegarla: aquí no interesa quién más jugaba, sino cómo os fue a los dos.
 */
@Component({
  selector: 'app-historial-cruzado',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Por vista, no global: los filtros de aquí no deben aparecer puestos en otro historial, y
  // el contexto del cruce depende del `:playerId` de esta ruta.
  providers: [MatchHistoryUiState, CrossViewState],
  imports: [
    RouterLink,
    NfButton,
    NfPagination,
    NfSkeleton,
    CrossHeaderComponent,
    CrossMatchCardComponent,
    MatchFiltersComponent,
  ],
  template: `
    <div class="view cx-view">
      <!--
        El orden lo fija CLAUDE.md: cargando, error, y solo entonces la entidad o su 404.
        Estaba al revés —se preguntaba primero por el jugador— y por eso un fallo de red se
        colaba pintando la lista a medias en vez de ofrecer reintentar.
      -->
      @if (state.loading()) {
        <div class="cx-boot" aria-busy="true">
          <div class="cx-boot__hero">
            <nf-skeleton width="58px" height="58px" radius="50%" />
            <div class="cx-boot__stack">
              <nf-skeleton width="90px" height="12px" />
              <nf-skeleton width="220px" height="24px" />
              <nf-skeleton width="140px" height="12px" />
            </div>
          </div>
          <nf-skeleton width="100%" height="38px" radius="10px" />
        </div>
      } @else if (state.status() === 'error') {
        <!--
          Un fallo de red no es un 404. Antes los dos caían en la misma rama y el usuario leía
          «jugador no encontrado» cuando lo que había fallado era el catálogo de campeones.
        -->
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error de carga</div>
          <h1 class="view__title">No se ha podido cargar</h1>
          <p class="view__lead">
            No hemos podido traer vuestras partidas en común. Puede ser cosa de la conexión.
          </p>
        </div>
        <button nfButton variant="primary" size="md" (click)="state.reload()">Reintentar</button>
      } @else if (state.player(); as p) {
        <app-cross-header active="historial" />

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
              No hay ninguna partida registrada en la que {{ p.name }} y tú hayáis jugado, ni
              juntos ni enfrentados. En cuanto disputéis una aparecerá aquí.
            </p>
            <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos']">
              Ver mis grupos
            </button>
          </div>
        }
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Jugador no encontrado</h1>
          <p class="view__lead">
            Ese jugador no existe o ya no comparte ningún grupo contigo.
          </p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'historial']">
          Volver al historial
        </button>
      }
    </div>
  `,
})
export class HistorialCruzado {
  private readonly route = inject(ActivatedRoute);
  private readonly viewport = inject(Viewport);

  protected readonly state = inject(CrossViewState);
  protected readonly ui = inject(MatchHistoryUiState);

  protected readonly pageSize = 6;

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly all = this.state.all;

  constructor() {
    // Enlace profundo desde el perfil ajeno: las tarjetas de rivalidad y sinergia abren esta
    // lista ya acotada. Los valores de la URL son los que ya publicaban esos enlaces.
    const modo = this.route.snapshot.queryParamMap.get('modo');
    if (modo === 'versus') this.ui.update({ relation: 'enemy' });
    else if (modo === 'synergy') this.ui.update({ relation: 'ally' });
  }

  /** Solo los campeones que TÚ has jugado en estas partidas: filtrar por otro vaciaría la lista. */
  protected readonly championIds = computed(() => {
    const ids = new Set<number>();
    for (const c of this.all()) ids.add(c.me.championId);
    return Array.from(ids);
  });

  protected readonly filtered = computed(() => {
    const f = this.ui.filters();
    return sortCrossMatches(filterCrossMatches(this.all(), f), f.sortBy);
  });

  protected readonly pageItems = computed(() => {
    const start = (this.ui.page() - 1) * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  /** Para que «volver» del análisis completo de una partida regrese a esta lista. */
  protected readonly returnTo = computed(() => `/app/historial-cruzado/${this.state.playerId()}`);

  /**
   * En móvil se vuelve al principio de la LISTA y no del documento: por encima están la
   * cabecera y los filtros, que ahí son casi dos pantallas de scroll para llegar otra vez a
   * las partidas que se acaban de pedir.
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
