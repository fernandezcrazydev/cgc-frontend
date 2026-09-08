import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar, NfSkeleton } from '../../../../ui';
import { GameDataStore } from '../../../../core/game-data';
import { MemberStats, playerTiles } from '../../../../core/group-stats';
import { StatsTileIconComponent } from './stats-tile-icon.component';

export type LeaderSortKey = 'rating' | 'name' | 'kda' | 'cs' | 'vision' | 'damage' | 'games';

const LEADER_COLUMNS = [
  { key: 'name' as const, label: 'Jugador' },
  { key: 'kda' as const, label: 'KDA medio' },
  { key: 'cs' as const, label: 'CS / min' },
  { key: 'vision' as const, label: 'Visión' },
  { key: 'damage' as const, label: 'Daño / part.' },
  { key: 'games' as const, label: 'Partidas' },
];

/**
 * Líderes de rendimiento individual (§5.5.5, bloque 4): la tabla completa del grupo,
 * con cabeceras ordenables estilo Tierlist y filas desplegables con acordeón analítico.
 *
 * La fila abierta enseña el desglose de `playerTiles()` y el campeón que más juega
 * esa persona. El estado de qué fila está abierta NO vive aquí: es estado de
 * interfaz de la vista, que lo sincroniza con el parámetro `?jugador=` de la URL
 * para que un enlace pueda abrir directamente a alguien.
 */
@Component({
  selector: 'app-stats-leaders',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfSkeleton, StatsTileIconComponent],
  templateUrl: './stats-leaders.component.html',
  styleUrls: ['./stats-card.scss', './stats-leaders.component.scss'],
})
export class StatsLeadersComponent {
  readonly players = input<readonly MemberStats[]>([]);
  readonly loading = input(false);
  /** Tag del jugador cuya fila está desplegada, si hay alguna. */
  readonly expandedTag = input<string | null>(null);

  /** Pide abrir o cerrar la fila de un jugador; decide la vista. */
  readonly toggle = output<string>();

  readonly sortColumn = signal<LeaderSortKey>('rating');
  readonly sortAsc = signal(false);

  protected readonly columns = LEADER_COLUMNS;

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');
  protected readonly busy = computed(() => this.loading() || this.champsLoading());

  /** Ordenados según la columna activa (por defecto: valoración compuesta). */
  protected readonly rows = computed(() => {
    const list = [...this.players()];
    const col = this.sortColumn();
    const asc = this.sortAsc();
    const mult = asc ? 1 : -1;

    return list.sort((a, b) => {
      switch (col) {
        case 'name':
          return mult * a.member.name.localeCompare(b.member.name);
        case 'kda':
          return mult * (a.kda - b.kda);
        case 'cs':
          return mult * (a.csPerMin - b.csPerMin);
        case 'vision':
          return mult * (a.visionScore - b.visionScore);
        case 'damage':
          return mult * (a.dmgK - b.dmgK);
        case 'games':
          return mult * (a.games - b.games || a.wr - b.wr);
        case 'rating':
        default:
          return mult * (a.rating - b.rating);
      }
    });
  });

  protected readonly tilesOf = playerTiles;

  protected toggleSort(col: LeaderSortKey): void {
    if (this.sortColumn() === col) {
      this.sortAsc.update((asc) => !asc);
    } else {
      this.sortColumn.set(col);
      this.sortAsc.set(col === 'name');
    }
  }

  protected championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  protected championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? 'Campeón';
  }
}
