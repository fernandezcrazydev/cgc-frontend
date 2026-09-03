import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfPagination, NfSkeleton } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { GroupBridge, GroupsStore } from '../../../core/groups';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { filterGroupMatches, sortMatches } from '../../../core/matches/match-filtering';
import { MatchStore } from '../../../core/match-store';
import { GameDataStore } from '../../../core/game-data';
import { Viewport } from '../../../shared/viewport';
import { GroupMatchCardComponent } from './match-history/group-match-card.component';
import { MatchFiltersComponent } from './match-history/match-filters.component';
import { MatchHistoryUiState } from './match-history/match-history-ui';

@Component({
  selector: 'app-grupo-historial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Instancia propia: los filtros del historial personal no deben venirse puestos aquí.
  providers: [MatchHistoryUiState],
  imports: [
    RouterLink,
    NfButton,
    NfPagination,
    NfSkeleton,
    GroupMatchCardComponent,
    MatchFiltersComponent,
  ],
  styleUrl: './grupo-historial.scss',
  template: `
    <div class="view">
      @if (group(); as g) {
        <!-- NAVEGACIÓN HACIA EL GRUPO -->
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>

        <!-- CABECERA DEL HISTORIAL DE GRUPO -->
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Historial de Liga / Grupo</div>
          <h1 class="view__title">{{ g.name }}</h1>
        </div>

        <!-- BANNER DE PARTIDA EN DIRECTO (SI EXISTE) -->
        @if (liveRoom(); as room) {
          <div class="live-match-banner">
            <span class="live-match-banner__pulse"></span>
            <div class="live-match-banner__meta">
              <strong class="live-match-banner__tag">En directo</strong>
              <span>Sala #{{ room.code }} · 5v5 en curso en la Grieta</span>
            </div>
            <a class="live-match-banner__link nf-mono" [routerLink]="['/app', 'grupos', g.id, 'sala']">
              Ver sala en vivo
            </a>
          </div>
        }

        <!-- TARJETAS DE RESUMEN DE LA LIGA -->
        @if (allGroupMatches().length > 0) {
          <div class="m-summary">
            <!-- Bloque 1: Partidas y Lado Ganador -->
            <div class="m-summary__stat-card">
              <div class="m-summary__title nf-mono">Winrate por lado</div>
              <div class="m-summary__wr-row">
                <div class="m-summary__wr-val" style="color: var(--nf-team-blue);">
                  {{ groupStats().blueWinrate }}%
                </div>
                <div class="m-summary__wr-counts nf-mono">
                  <span style="color: var(--nf-team-blue); font-weight: 700;">{{ groupStats().blueSideWins }} Azul</span> -
                  <span style="color: var(--nf-team-red); font-weight: 700;">{{ groupStats().redSideWins }} Rojo</span>
                </div>
              </div>
              <div class="m-summary__progress-bar">
                <div class="m-summary__progress-win" style="background: var(--nf-team-blue);" [style.width.%]="groupStats().blueWinrate"></div>
                <div class="m-summary__progress-loss" style="background: var(--nf-team-red);" [style.width.%]="100 - groupStats().blueWinrate"></div>
              </div>
            </div>

            <!-- Bloque 2: Duración media -->
            <div class="m-summary__stat-card">
              <div class="m-summary__title nf-mono">Duración Promedio</div>
              <div class="m-summary__kda-line">
                <strong>{{ groupStats().avgDurationMinutes }} min</strong>
              </div>
              <div class="m-summary__ratio nf-mono">
                {{ groupStats().totalMatches }} partidas oficiales disputadas
              </div>
            </div>

            <!-- Bloque 3: Jugador más destacado (MVP) -->
            @if (groupStats().topMvpName; as mvp) {
              <div class="m-summary__stat-card">
                <div class="m-summary__title nf-mono">Líder de MVPs del Grupo</div>
                <div class="m-summary__kda-line m-summary__kda-line--mvp">
                  <strong>{{ mvp }}</strong>
                </div>
                <div class="m-summary__ratio nf-mono">
                  {{ groupStats().topMvpCount }} distinciones MVP en esta temporada
                </div>
              </div>
            }
          </div>

          <!-- BARRA DE FILTROS DEL GRUPO (Solo campeones jugados en este grupo) -->
          <app-match-filters
            mode="group"
            [contextGroupId]="g.id"
            [resultCount]="filteredMatches().length"
            [totalCount]="allGroupMatches().length"
          />

          <!-- LISTA DE PARTIDAS DEL GRUPO -->
          @if (pageItems().length > 0) {
            <div class="mh-list" #list>
              @for (m of pageItems(); track m.id) {
                <app-group-match-card [match]="m" />
              }
            </div>

            <nf-pagination
              [total]="filteredMatches().length"
              [pageSize]="pageSize"
              [page]="ui.page()"
              (pageChange)="onPageChange($event)"
            />
          } @else {
            <div class="empty-state">
              <p class="empty-state__text nf-mono">No se encontraron partidas</p>
              <p class="empty-state__hint">No hay partidas que coincidan con los filtros seleccionados para este grupo.</p>
              <button nfButton variant="secondary" size="md" (click)="resetFilters()">
                Limpiar filtros
              </button>
            </div>
          }
        } @else {
          <!-- EMPTY STATE: SIN PARTIDAS EN ESTE GRUPO -->
          <div class="empty-state">
            <p class="empty-state__text nf-mono">Sin partidas todavía</p>
            <p class="empty-state__hint">Este grupo aún no ha disputado ninguna partida. ¡Crea una sala 5v5 para comenzar la competición!</p>
            <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">
              Crear sala 5v5
            </button>
          </div>
        }
      } @else if (loading()) {
        <!--
          SKELETON MIENTRAS CARGA EL GRUPO
          Con la forma final —cabecera, tres tarjetas de resumen y cuatro filas— para que al
          llegar el dato no salte nada de sitio. Antes aquí solo había un eyebrow suelto
          dentro de un .view anidado en otro .view: en móvil eso es una pantalla vacía.
        -->
        <div aria-busy="true">
          <div class="view__head">
            <div class="view__eyebrow nf-mono">Historial de Liga / Grupo</div>
            <nf-skeleton width="min(280px, 70%)" height="clamp(24px, 5vw, 32px)" />
          </div>

          <div class="m-summary">
            @for (i of skeletonCards; track i) {
              <div class="m-summary__stat-card">
                <nf-skeleton width="120px" height="12px" />
                <nf-skeleton width="90px" height="26px" />
                <nf-skeleton width="150px" height="12px" />
              </div>
            }
          </div>

          <div class="mh-list">
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
        </div>
      } @else {
        <!-- ERROR 404: GRUPO NO ENCONTRADO -->
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
          <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">
          ← Volver a grupos
        </button>
      }
    </div>
  `,
})
export class GrupoHistorial {
  private readonly route = inject(ActivatedRoute);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly bridge = inject(GroupBridge);
  private readonly matchHistoryStore = inject(MatchHistoryStore);
  protected readonly ui = inject(MatchHistoryUiState);

  /** El mismo tamaño de página que el historial personal: son la misma lista con otro filtro. */
  protected readonly pageSize = 6;
  protected readonly skeletonCards = [1, 2, 3];
  protected readonly skeletonRows = [1, 2, 3, 4];
  private readonly matchStore = inject(MatchStore);
  private readonly viewport = inject(Viewport);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  protected readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly loading = computed(() => this.bridge.status() === 'loading');

  readonly group = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.groupStore.byId(id) ?? this.groupsStore.byId(id) ?? null;
  });

  readonly liveRoom = computed(() => {
    const id = this.id();
    if (!id) return null;
    const rooms = this.matchStore.activeOf(id);
    return rooms.find((r) => r.status === 'live') ?? rooms[0] ?? null;
  });

  readonly allGroupMatches = computed(() => {
    const id = this.id();
    return id ? this.matchHistoryStore.matchesByGroup(id) : [];
  });

  readonly filteredMatches = computed(() => {
    const f = this.ui.filters();
    return sortMatches(filterGroupMatches(this.allGroupMatches(), f), f.sortBy);
  });

  readonly pageItems = computed(() => {
    const start = (this.ui.page() - 1) * this.pageSize;
    return this.filteredMatches().slice(start, start + this.pageSize);
  });

  readonly groupStats = computed(() => {
    const id = this.id();
    return id ? this.matchHistoryStore.groupSummary(id) : {
      totalMatches: 0,
      blueSideWins: 0,
      redSideWins: 0,
      blueWinrate: 0,
      avgDurationMinutes: 0,
      topMvpName: null,
      topMvpCount: 0,
    };
  });

  constructor() {
    this.gameData.ensureLoaded();
    this.groupsStore.ensureLoaded();
    effect(() => {
      const id = this.id();
      if (id) {
        this.bridge.ensure(id);
      }
    });
  }

  /**
   * Al cambiar de página, en móvil se vuelve al principio de la LISTA y no del documento:
   * por encima están el resumen y los filtros, que ahí son casi dos pantallas de scroll
   * para llegar otra vez a las partidas que se acaban de pedir. En escritorio ese trecho
   * es corto y el comportamiento no cambia.
   */
  onPageChange(page: number): void {
    this.ui.setPage(page);
    const list = this.viewport.isMobile() ? this.list()?.nativeElement : null;
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  resetFilters(): void {
    this.ui.reset();
  }
}
