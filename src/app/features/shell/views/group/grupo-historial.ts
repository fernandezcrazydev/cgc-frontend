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
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfPagination, NfSkeleton } from '../../../../ui';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge, GroupDetailStore, GroupsStore } from '../../../../core/groups';
import { LeaguesStore } from '../../../../core/leagues';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { activeFilterCount, groupMatchQuery } from '../../../../core/matches/match-filtering';
import { GameDataStore } from '../../../../core/game-data';
import { formatDurationMinutes } from '../../../../shared/date-format';
import { Viewport } from '../../../../shared/viewport';
import { ViewMemoryService } from '../../../../shared/view-memory';
import { GroupMatchCardComponent } from '../match-history/group-match-card.component';
import { MatchFiltersComponent } from '../match-history/match-filters.component';
import { MatchHistoryUiState } from '../match-history/match-history-ui';

/**
 * El historial de un grupo: `GET /groups/{id}/matches`, más sus tres tarjetas de cabecera
 * (`/matches/summary`).
 *
 * Dos cosas del contrato mandan sobre lo que se pinta arriba, y no son estilo:
 *
 * - **Los porcentajes se calculan aquí, con el denominador correcto**, porque el servidor manda
 *   cuentas y no medias a propósito. `blueWins + redWins` NO es `totalMatches`: una sala sin
 *   lado decidido no está en ninguno de los dos, así que el winrate por bando se divide entre
 *   `matchesWithSide`. La duración media va sobre `matchesWithStats`, porque solo una partida
 *   subida tiene duración.
 * - **El resumen describe el grupo entero, no la lista filtrada.** El endpoint no acepta
 *   filtros, y la cabecera lo dice en voz alta para que nadie lea las tarjetas como si
 *   siguieran a los controles de abajo.
 */
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
        <!-- TARJETAS DE RESUMEN DEL GRUPO -->
        @if (summaryLoading()) {
          <div class="m-summary" aria-busy="true">
            @for (i of skeletonCards; track i) {
              <div class="m-summary__stat-card" aria-hidden="true">
                <nf-skeleton width="120px" height="12px" />
                <nf-skeleton width="90px" height="26px" />
                <nf-skeleton width="150px" height="12px" />
              </div>
            }
          </div>
        } @else if (summary(); as s) {
          @if (s.totalMatches > 0) {
            <div class="m-summary">
              <!-- Bloque 1: winrate por lado, sobre las partidas que SÍ tienen lado -->
              <div class="m-summary__stat-card">
                <div class="m-summary__title nf-mono">Winrate por lado</div>
                <div class="m-summary__wr-row m-summary__wr-row--symmetric">
                  <div class="m-summary__side">
                    <span class="m-summary__wr-val" style="color: var(--nf-team-blue);">
                      {{ blueWinrate() }}%
                    </span>
                    <span class="m-summary__side-badge nf-mono" style="color: var(--nf-team-blue);">
                      {{ s.blueWins }} Azul
                    </span>
                  </div>
                  <div class="m-summary__side">
                    <span class="m-summary__side-badge nf-mono" style="color: var(--nf-team-red);">
                      {{ s.redWins }} Rojo
                    </span>
                    <span class="m-summary__wr-val" style="color: var(--nf-team-red);">
                      {{ redWinrate() }}%
                    </span>
                  </div>
                </div>
                <div class="m-summary__progress-bar">
                  <div class="m-summary__progress-win" style="background: var(--nf-team-blue);" [style.width.%]="blueWinrate()"></div>
                  <div class="m-summary__progress-loss" style="background: var(--nf-team-red);" [style.width.%]="redWinrate()"></div>
                </div>
                <!--
                  El denominador se dice, no se esconde: sin lado decidido una partida no cuenta
                  para ninguno de los dos bandos, y sin esta línea los dos porcentajes parecen
                  repartirse el total de la tarjeta de al lado.
                -->
                <div class="gh-summary__note nf-mono">
                  Sobre {{ s.matchesWithSide }} de {{ s.totalMatches }} con bando decidido
                </div>
              </div>

              <!-- Bloque 2: duración media, sobre las partidas subidas -->
              <div class="m-summary__stat-card">
                <div class="m-summary__title nf-mono">Duración promedio</div>
                <div class="m-summary__kda-line">
                  @if (averageDuration(); as d) {
                    <strong>{{ d }}</strong>
                  } @else {
                    <strong>Sin datos</strong>
                  }
                </div>
                <div class="m-summary__ratio nf-mono">
                  {{ s.totalMatches }} {{ s.totalMatches === 1 ? 'partida disputada' : 'partidas disputadas' }}
                </div>
                <div class="gh-summary__note nf-mono">
                  {{ s.matchesWithStats }} con estadísticas subidas
                </div>
              </div>

              <!-- Bloque 3: líder de MVPs -->
              <div class="m-summary__stat-card">
                <div class="m-summary__title nf-mono">Líder de MVPs del grupo</div>
                @if (topMvpName(); as mvp) {
                  <div class="m-summary__kda-line m-summary__kda-line--mvp">
                    <strong>{{ mvp }}</strong>
                  </div>
                  <div class="m-summary__ratio nf-mono">
                    {{ s.topMvpCount }} {{ s.topMvpCount === 1 ? 'distinción MVP' : 'distinciones MVP' }}
                  </div>
                } @else {
                  <!--
                    topMvpUserId nulo significa que NO HAY ningún MVP todavía porque nadie ha
                    exportado nada. No es un empate a cero, y por eso no se pinta un nombre vacío.
                  -->
                  <div class="m-summary__kda-line m-summary__kda-line--mvp">
                    <strong>Todavía nadie</strong>
                  </div>
                  <div class="m-summary__ratio nf-mono">
                    Hará falta subir alguna partida desde el cliente de LoL
                  </div>
                }
              </div>
            </div>

            <!--
              Dos avisos que evitan leer un descuadre donde no lo hay: el resumen no sigue a los
              filtros (su endpoint no los acepta) y no cuenta las partidas anuladas, que sí
              aparecen en la lista. La lista es el registro de lo que pasó; el resumen, lo que
              cuenta.
            -->
            <div class="gh-summary__scope nf-mono">
              Estas tres tarjetas resumen el grupo entero, no la lista filtrada, y dejan fuera
              las partidas anuladas
            </div>
          }
        }

        <app-match-filters
          mode="group"
          [contextGroupId]="g.id"
          [resultCount]="total()"
        />

        <!-- LISTA DE PARTIDAS DEL GRUPO -->
        @switch (listStatus()) {
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
                La conexión con el servidor falló. Las partidas del grupo siguen ahí; vuelve a
                intentarlo.
              </p>
              <button nfButton variant="primary" size="md" (click)="retry()">Reintentar</button>
            </div>
          }
          @default {
            @if (matches().length > 0) {
              <div class="mh-list" #list>
                @for (m of matches(); track m.id) {
                  <app-group-match-card [match]="m" />
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
                <p class="empty-state__hint">No hay partidas que coincidan con los filtros seleccionados para este grupo.</p>
                <button nfButton variant="secondary" size="md" (click)="resetFilters()">
                  Limpiar filtros
                </button>
              </div>
            } @else {
              <div class="empty-state">
                <p class="empty-state__text nf-mono">Sin partidas todavía</p>
                <p class="empty-state__hint">Este grupo aún no ha disputado ninguna partida. ¡Crea una sala 5v5 para comenzar la competición!</p>
                <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'tablon']">
                  Crear sala 5v5
                </button>
              </div>
            }
          }
        }
      } @else if (loading()) {
        <!--
          SKELETON MIENTRAS CARGA EL GRUPO
          Con la forma final —tres tarjetas de resumen y cuatro filas— para que al llegar el
          dato no salte nada de sitio. Antes aquí solo había un eyebrow suelto dentro de un
          .view anidado en otro .view: en móvil eso es una pantalla vacía.
        -->
        <div aria-busy="true">
          <div class="m-summary">
            @for (i of skeletonCards; track i) {
              <div class="m-summary__stat-card" aria-hidden="true">
                <nf-skeleton width="120px" height="12px" />
                <nf-skeleton width="90px" height="26px" />
                <nf-skeleton width="150px" height="12px" />
              </div>
            }
          </div>

          <div class="mh-list">
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
  private readonly groupDetail = inject(GroupDetailStore);
  private readonly leagues = inject(LeaguesStore);
  private readonly bridge = inject(GroupBridge);
  private readonly store = inject(MatchHistoryStore);
  protected readonly ui = inject(MatchHistoryUiState);

  /** El mismo tamaño de página que el historial personal: son la misma lista con otro filtro. */
  protected readonly pageSize = 6;
  protected readonly skeletonCards = [1, 2, 3];
  protected readonly skeletonRows = [1, 2, 3, 4];
  private readonly viewport = inject(Viewport);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly gameData = inject(GameDataStore);
  private readonly viewMemory = inject(ViewMemoryService);

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

  protected readonly matches = this.store.groupMatches;
  protected readonly total = this.store.groupTotal;
  protected readonly summary = this.store.groupSummary;

  protected readonly listStatus = computed(() => {
    const own = this.store.groupStatus();
    if (own === 'error') return 'error';
    const champs = this.gameData.status();
    if (own === 'idle' || own === 'loading' || champs === 'idle' || champs === 'loading') {
      return 'loading';
    }
    return 'ready';
  });

  protected readonly summaryLoading = computed(() => {
    const s = this.store.groupSummaryStatus();
    return s === 'idle' || s === 'loading';
  });

  protected readonly hasFilters = computed(() => activeFilterCount(this.ui.filters(), 'group') > 0);

  /**
   * El winrate por bando se divide entre las partidas CON BANDO, no entre todas: una sala sin
   * lado decidido no está ni en `blueWins` ni en `redWins`, y usar `totalMatches` daría dos
   * porcentajes que no suman 100 sin decir por qué.
   */
  protected readonly blueWinrate = computed(() => {
    const s = this.summary();
    return percent(s?.blueWins ?? 0, s?.matchesWithSide ?? 0);
  });

  protected readonly redWinrate = computed(() => {
    const s = this.summary();
    return percent(s?.redWins ?? 0, s?.matchesWithSide ?? 0);
  });

  /** `null` cuando no hay ninguna partida subida: no hay duración que promediar, y no es «0 min». */
  protected readonly averageDuration = computed(() => {
    const seconds = this.summary()?.averageDurationSeconds;
    return seconds == null ? null : formatDurationMinutes(seconds);
  });

  /**
   * El nombre del líder de MVPs. El resumen manda su `userId` y nada más, así que aquí sí hace
   * falta el censo del grupo —que esta pantalla ya tiene cargado—. Las filas no lo necesitan:
   * cada asiento viene con su nombre.
   */
  protected readonly topMvpName = computed(() => {
    const id = this.summary()?.topMvpUserId;
    if (!id) return null;
    const member = this.groupDetail.roster().find((m) => m.userId === id);
    return member ? (member.riotId ?? member.discordUsername ?? null) : null;
  });

  /** El estado de los controles, traducido a lo que entiende el endpoint. */
  private readonly query = computed(() =>
    groupMatchQuery(this.ui.filters(), this.ui.page() - 1, this.pageSize),
  );

  constructor() {
    this.gameData.ensureLoaded();
    this.groupsStore.ensureLoaded();

    effect(() => {
      const id = this.id();
      if (!id) return;
      this.bridge.ensure(id);
      // Las temporadas alimentan el desplegable de liga del panel de filtros, y el censo
      // resuelve el nombre de cada asiento. Las dos son idempotentes por grupo.
      void this.leagues.loadSeasons(id);
      this.ui.setContextKey('/app/grupos/' + id + '/historial');
    });

    effect(() => {
      const g = this.group();
      if (!g) return;
      const query = this.query();
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      untracked(() => void this.store.ensureGroup({ id: g.id, name: g.name }, query));
    });

    effect(() => {
      const id = this.id();
      if (id) untracked(() => void this.store.ensureGroupSummary(id));
    });

    afterNextRender(() => {
      const id = this.id();
      if (!id) return;
      // Igual que en el historial personal: el scroll solo se restaura si esto es una vuelta.
      const key = '/app/grupos/' + id + '/historial';
      if (!this.viewMemory.consumeReturn(key)) return;
      const y = this.viewMemory.consumeScroll(key);
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
  onPageChange(page: number): void {
    this.ui.setPage(page);
    const list = this.viewport.isMobile() ? this.list()?.nativeElement : null;
    if (list) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  retry(): void {
    const g = this.group();
    if (!g) return;
    void this.store.reloadGroup({ id: g.id, name: g.name }, this.query());
  }

  resetFilters(): void {
    this.ui.reset();
  }
}

/** Un denominador de cero da 0%, que es la lectura correcta, no `NaN`. */
function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
