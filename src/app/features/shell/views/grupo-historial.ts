import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { GroupBridge, GroupsStore } from '../../../core/groups';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { MatchStore } from '../../../core/match-store';
import { GameDataStore } from '../../../core/game-data';
import { MatchCardComponent } from './match-history/match-card.component';
import { MatchFiltersComponent } from './match-history/match-filters.component';

@Component({
  selector: 'app-grupo-historial',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton, MatchCardComponent, MatchFiltersComponent],
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
          <p class="view__lead">Registro oficial de enfrentamientos 5v5 disputados por los miembros de este grupo. Pulsa sobre cualquier partida para ver el desglose completo.</p>
        </div>

        <!-- BANNER DE PARTIDA EN DIRECTO (SI EXISTE) -->
        @if (liveRoom(); as room) {
          <div class="live-match-banner">
            <span class="live-match-banner__pulse"></span>
            <div class="live-match-banner__meta">
              <strong>🔴 EN DIRECTO:</strong>
              <span>Sala #{{ room.code }} · 5v5 en curso en la Grieta</span>
            </div>
            <a class="live-match-banner__link nf-mono" [routerLink]="['/app', 'grupos', g.id, 'sala']">
              Ver sala en vivo →
            </a>
          </div>
        }

        <!-- TARJETAS DE RESUMEN DE LA LIGA -->
        @if (allGroupMatches().length > 0) {
          <div class="m-summary">
            <!-- Bloque 1: Partidas y Lado Ganador -->
            <div class="m-summary__stat-card">
              <div class="m-summary__title nf-mono">Balance de Bandos</div>
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
                <div class="m-summary__kda-line" style="color: var(--nf-warning);">
                  <strong>★ {{ mvp }}</strong>
                </div>
                <div class="m-summary__ratio nf-mono">
                  {{ groupStats().topMvpCount }} distinciones MVP en esta temporada
                </div>
              </div>
            }
          </div>

          <!-- BARRA DE FILTROS DEL GRUPO (Solo campeones jugados en este grupo) -->
          <app-match-filters [showGroupFilter]="false" [contextGroupId]="g.id" />

          <!-- LISTA DE PARTIDAS DEL GRUPO -->
          @if (filteredMatches().length > 0) {
            <div class="mh-list">
              @for (m of filteredMatches(); track m.id) {
                <app-match-card [match]="m" mode="group" />
              }
            </div>
          } @else {
            <div class="empty-state">
              <span class="empty-state__icon">🔍</span>
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
            <span class="empty-state__icon">🎮</span>
            <p class="empty-state__text nf-mono">Sin partidas todavía</p>
            <p class="empty-state__hint">Este grupo aún no ha disputado ninguna partida. ¡Crea una sala 5v5 para comenzar la competición!</p>
            <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">
              Crear sala 5v5
            </button>
          </div>
        }
      } @else if (loading()) {
        <!-- SKELETON MIENTRAS CARGA EL GRUPO -->
        <div class="view" aria-busy="true">
          <div class="view__head">
            <div class="view__eyebrow nf-mono">Cargando grupo...</div>
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
  private readonly matchStore = inject(MatchStore);
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
    const id = this.id();
    return id ? this.matchHistoryStore.filteredGroupMatches(id) : [];
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
    effect(() => {
      const id = this.id();
      if (id) {
        this.bridge.ensure(id);
      }
    });
  }

  resetFilters(): void {
    this.matchHistoryStore.resetFilters();
  }
}
