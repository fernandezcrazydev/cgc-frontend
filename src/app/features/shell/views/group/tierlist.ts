import {
  ChangeDetectionStrategy,
  Component,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ChampionStatsStore, TierRank } from '../../../../core/champions';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import { Lane } from '../../../../core/matches/models';
import { ViewMemoryService } from '../../../../shared/view-memory';
import { NfAvatar, NfButton, NfLaneIcon, NfSkeleton } from '../../../../ui';

export type SortColumn = 'rank' | 'tier' | 'name' | 'role' | 'games' | 'winrate' | 'kda' | 'damage';

export interface TierlistRowViewModel {
  championId: number;
  name: string;
  title: string;
  iconUrl: string | null;
  role: Lane;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  pickrate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kdaRatio: string;
  kdaNum: number;
  avgDamagePerMin: number;
  tier: TierRank;
  tierWeight: number;
  specialist: {
    name: string;
    riotId: string;
    avatarUrl: string | null;
    wins: number;
    games: number;
    winrate: number;
  } | null;
}

const ROLE_FILTERS: readonly { id: Lane | 'ALL'; label: string; glyph: string }[] = [
  { id: 'ALL', label: 'Todas', glyph: '★' },
  { id: 'TOP', label: 'TOP', glyph: '⚔' },
  { id: 'JUNGLA', label: 'JG', glyph: '🌲' },
  { id: 'MID', label: 'MID', glyph: '⚡' },
  { id: 'ADC', label: 'ADC', glyph: '🏹' },
  { id: 'SUPPORT', label: 'SUP', glyph: '🛡' },
];

/**
 * Vista de Tierlist de Campeones del Grupo (/app/grupos/:id/tierlist).
 *
 * Data Grid analítico competitivo de metagame del grupo.
 */
@Component({
  selector: 'app-tierlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NfButton, NfLaneIcon, NfAvatar, NfSkeleton],
  templateUrl: './tierlist.html',
  styleUrls: ['./tierlist.scss'],
})
export class Tierlist {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groups = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  private readonly championStats = inject(ChampionStatsStore);
  private readonly viewMemory = inject(ViewMemoryService);

  readonly roleFilters = ROLE_FILTERS;

  /** Id del grupo resuelto desde la ruta (/app/grupos/:id/tierlist). */
  readonly groupId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  /** Grupo activo para el rótulo de cabecera. */
  readonly group = computed(() => this.groups.byId(this.groupId()));
  readonly groupName = computed(() => this.group()?.name ?? 'Grupo');

  /** Tablero de metagame del grupo obtenido desde ChampionStatsStore. */
  readonly boardEntry = computed(() =>
    this.championStats.board(this.groupId() || null)(),
  );

  private readonly boardSignal = computed(() => this.boardEntry().data);

  readonly totalMatches = computed(() => this.boardSignal()?.totalMatches ?? 0);

  readonly isLoading = computed(() => {
    return this.boardEntry().status === 'loading' || this.boardEntry().status === 'idle' || this.gameData.status() === 'loading';
  });

  readonly isError = computed(() => {
    return this.boardEntry().status === 'error' || this.gameData.status() === 'error';
  });

  readonly errorMessage = computed(() => {
    return this.boardEntry().error ?? 'No se pudo cargar la tierlist del grupo.';
  });

  /** Estado de filtros locales con signals */
  readonly searchQuery = signal('');
  readonly selectedRole = signal<Lane | 'ALL'>('ALL');
  readonly sortColumn = signal<SortColumn>('winrate');
  readonly sortAsc = signal<boolean>(false);

  /** ID del campeón con destello de foco al volver de la ficha */
  readonly focusedChampId = signal<number | null>(null);

  retry(): void {
    void this.gameData.reload();
    this.championStats.invalidate();
  }

  constructor() {
    void this.groups.ensureLoaded();
    void this.gameData.ensureLoaded();

    const paramChamp = this.route.snapshot?.queryParamMap?.get('campeon');
    if (paramChamp) {
      const champId = Number(paramChamp);
      if (!isNaN(champId) && champId > 0) {
        const gid = this.groupId();
        if (gid) {
          void this.router.navigate(['/app', 'grupos', gid, 'campeon', champId]);
        } else {
          void this.router.navigate(['/app', 'campeon', champId]);
        }
      }
    }

    afterNextRender(() => {
      const gid = this.group()?.id;
      const key = gid ? ['/app', 'grupos', gid, 'tierlist'].join('/') : '/app/tierlist';
      const returning = this.viewMemory.consumeReturn(key);
      if (!returning) return;

      const y = this.viewMemory.consumeScroll(key);
      if (y !== null && y > 0) {
        window.scrollTo({ top: y, behavior: 'instant' });
      }
      const focused = this.viewMemory.consumeFocusedId(key);
      if (focused) {
        const idNum = Number(focused);
        if (!isNaN(idNum)) {
          this.focusedChampId.set(idNum);
          setTimeout(() => this.focusedChampId.set(null), 1800);
        }
      }
    });
  }

  /**
   * Filas del metagame mapeadas con los metadatos de GameDataStore.
   */
  readonly allRows = computed<TierlistRowViewModel[]>(() => {
    const board = this.boardSignal();
    if (!board || board.rows.length === 0) return [];

    const champMap = this.gameData.championById();

    return board.rows.map((row) => {
      const champInfo = champMap.get(row.championId);
      return {
        championId: row.championId,
        name: champInfo?.name ?? 'Campeón',
        title: champInfo?.title ?? '',
        iconUrl: champInfo?.iconUrl ?? null,
        role: row.role,
        games: row.games,
        wins: row.wins,
        losses: row.losses,
        winrate: row.winrate,
        pickrate: row.pickrate,
        avgKills: row.avgKills,
        avgDeaths: row.avgDeaths,
        avgAssists: row.avgAssists,
        kdaRatio: row.kdaRatio,
        kdaNum: row.kdaNum,
        avgDamagePerMin: row.avgDamagePerMin,
        tier: row.tier,
        tierWeight: row.tierWeight,
        specialist: row.specialist
          ? {
              name: row.specialist.displayName,
              riotId: row.specialist.riotId,
              avatarUrl: row.specialist.avatarUrl,
              wins: row.specialist.wins,
              games: row.specialist.games,
              winrate: row.specialist.winrate,
            }
          : null,
      };
    });
  });

  /** Filas filtradas por rol y búsqueda. */
  readonly filteredRows = computed<TierlistRowViewModel[]>(() => {
    const rows = this.allRows();
    const role = this.selectedRole();
    const query = this.searchQuery().trim().toLowerCase();

    return rows.filter((row) => {
      if (role !== 'ALL' && row.role !== role) return false;
      if (query && !row.name.toLowerCase().includes(query) && !row.title.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  });

  /** Filas ordenadas según la columna y dirección activa. */
  readonly sortedRows = computed<TierlistRowViewModel[]>(() => {
    const list = [...this.filteredRows()];
    const col = this.sortColumn();
    const asc = this.sortAsc();

    return list.sort((a, b) => {
      let diff = 0;
      switch (col) {
        case 'tier':
          diff = a.tierWeight - b.tierWeight;
          if (diff === 0) diff = a.winrate - b.winrate;
          break;
        case 'name':
          diff = a.name.localeCompare(b.name);
          break;
        case 'role':
          diff = a.role.localeCompare(b.role);
          break;
        case 'games':
          diff = a.games - b.games;
          break;
        case 'winrate':
          diff = a.winrate - b.winrate;
          if (diff === 0) diff = a.games - b.games;
          break;
        case 'kda':
          diff = a.kdaNum - b.kdaNum;
          break;
        case 'damage':
          diff = a.avgDamagePerMin - b.avgDamagePerMin;
          break;
        default:
          diff = a.winrate - b.winrate;
      }
      return asc ? diff : -diff;
    });
  });

  toggleSort(col: SortColumn): void {
    if (this.sortColumn() === col) {
      this.sortAsc.update((asc) => !asc);
    } else {
      this.sortColumn.set(col);
      // Por defecto descendente en métricas numéricas, ascendente en texto
      this.sortAsc.set(col === 'name' || col === 'role');
    }
  }

  navigateToChampion(championId: number): void {
    const gid = this.group()?.id;
    const key = gid ? ['/app', 'grupos', gid, 'tierlist'].join('/') : '/app/tierlist';
    this.viewMemory.save(
      key,
      {
        scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
        lastFocusedId: String(championId),
      },
      true,
    );

    const groupParamId = this.groupId();
    if (groupParamId) {
      void this.router.navigate(['/app', 'grupos', groupParamId, 'campeon', championId]);
    } else {
      void this.router.navigate(['/app', 'campeon', championId]);
    }
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedRole.set('ALL');
  }

  tierBadgeClass(tier: TierRank): string {
    switch (tier) {
      case 'S+':
        return 'tier-badge--s-plus';
      case 'S':
        return 'tier-badge--s';
      case 'A':
        return 'tier-badge--a';
      case 'B':
        return 'tier-badge--b';
      case 'C':
        return 'tier-badge--c';
    }
  }
}