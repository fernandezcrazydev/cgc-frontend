import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { GameDataStore } from '../../../../core/game-data';
import { GROUPS } from '../../../../core/lobby';
import { Lane } from '../../../../core/matches/models';
import { NfLaneIcon } from '../../../../ui';

@Component({
  selector: 'app-match-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfLaneIcon],
  template: `
    <div class="m-filters">
      <div class="m-filters__row">
        <!-- Filtro: Grupo (si no está fijado por la vista de grupo) -->
        @if (showGroupFilter()) {
          <div class="m-filter-group">
            <label class="m-filter-group__label nf-mono">Grupo</label>
            <select
              class="m-filter-select nf-mono"
              [value]="filters().groupId"
              (change)="onGroupChange($event)"
            >
              <option value="all">Todos los grupos</option>
              @for (g of groups; track g.id) {
                <option [value]="g.id">{{ g.name }}</option>
              }
            </select>
          </div>
        }

        <!-- Filtro: Rol / Línea -->
        <div class="m-filter-group">
          <label class="m-filter-group__label nf-mono">Posición</label>
          <div class="m-role-pills" role="radiogroup" aria-label="Filtrar por posición">
            <button
              type="button"
              class="m-role-pill"
              [class.is-active]="filters().role === 'all'"
              (click)="setRole('all')"
              title="Todas las posiciones"
            >
              <span class="nf-mono">TODAS</span>
            </button>
            @for (r of roles; track r) {
              <button
                type="button"
                class="m-role-pill"
                [class.is-active]="filters().role === r"
                (click)="setRole(r)"
                [title]="r"
              >
                <nf-lane-icon [lane]="r" mode="tinted" />
              </button>
            }
          </div>
        </div>

        <!-- Filtro: Resultado (Win / Loss) -->
        <div class="m-filter-group">
          <label class="m-filter-group__label nf-mono">Resultado</label>
          <div class="m-segmented-btn">
            <button
              type="button"
              class="m-seg-btn"
              [class.is-active]="filters().outcome === 'all'"
              (click)="setOutcome('all')"
            >
              Todos
            </button>
            <button
              type="button"
              class="m-seg-btn m-seg-btn--win"
              [class.is-active]="filters().outcome === 'win'"
              (click)="setOutcome('win')"
            >
              Victorias
            </button>
            <button
              type="button"
              class="m-seg-btn m-seg-btn--loss"
              [class.is-active]="filters().outcome === 'loss'"
              (click)="setOutcome('loss')"
            >
              Derrotas
            </button>
          </div>
        </div>

        <!-- Filtro: Campeón -->
        <div class="m-filter-group">
          <label class="m-filter-group__label nf-mono">Campeón</label>
          <select
            class="m-filter-select nf-mono"
            [value]="filters().championId"
            (change)="onChampionChange($event)"
          >
            <option value="all">Todos los campeones</option>
            @for (c of champions(); track c.id) {
              <option [value]="c.id">{{ c.name }}</option>
            }
          </select>
        </div>

        <!-- Búsqueda rápida -->
        <div class="m-filter-group m-filter-group--search">
          <label class="m-filter-group__label nf-mono">Buscar</label>
          <div class="m-search-box">
            <input
              type="text"
              class="m-search-input nf-mono"
              placeholder="Buscar invocador..."
              [value]="filters().searchQuery ?? ''"
              (input)="onSearchInput($event)"
            />
          </div>
        </div>

        <!-- Limpiar filtros -->
        @if (hasActiveFilters()) {
          <div class="m-filter-group m-filter-group--clear">
            <label class="m-filter-group__label nf-mono">&nbsp;</label>
            <button
              type="button"
              class="m-clear-btn nf-mono"
              (click)="resetFilters()"
            >
              ✕ Limpiar
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class MatchFiltersComponent {
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);

  readonly showGroupFilter = input(true);
  readonly contextGroupId = input<string | null>(null);

  readonly groups = GROUPS;
  readonly roles: Lane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];
  readonly filters = this.store.filters;

  /** Solo campeones que han sido jugados en el contexto activo (personal o de grupo) */
  readonly champions = computed(() => {
    const champMap = this.gameData.championById();
    const ctxId = this.contextGroupId();
    let playedIds: number[] = [];

    if (ctxId) {
      playedIds = this.store.playedChampionIdsInGroup(ctxId);
    } else if (this.filters().groupId !== 'all') {
      playedIds = this.store.playedChampionIdsInGroup(this.filters().groupId);
    } else {
      playedIds = this.store.playedChampionIdsInPersonal();
    }

    return playedIds
      .map((id) => {
        const c = champMap.get(id);
        return {
          id,
          name: c?.name ?? `Campeón #${id}`,
          iconUrl: c?.iconUrl ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  readonly hasActiveFilters = computed(() => {
    const f = this.filters();
    return (
      (this.showGroupFilter() && f.groupId !== 'all') ||
      f.role !== 'all' ||
      f.championId !== 'all' ||
      f.outcome !== 'all' ||
      (f.searchQuery && f.searchQuery.trim().length > 0)
    );
  });

  onGroupChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.store.updateFilters({ groupId: val });
  }

  setRole(role: Lane | 'all'): void {
    this.store.updateFilters({ role });
  }

  setOutcome(outcome: 'all' | 'win' | 'loss'): void {
    this.store.updateFilters({ outcome });
  }

  onChampionChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.store.updateFilters({ championId: val === 'all' ? 'all' : Number(val) });
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.store.updateFilters({ searchQuery: val });
  }

  resetFilters(): void {
    this.store.resetFilters();
  }
}
