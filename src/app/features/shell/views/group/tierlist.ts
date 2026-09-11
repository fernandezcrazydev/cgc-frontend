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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { Lane, Match, MatchParticipant } from '../../../../core/matches/models';
import { ViewMemoryService } from '../../../../shared/view-memory';
import { NfAvatar, NfButton, NfLaneIcon } from '../../../../ui';

export type TierRank = 'S+' | 'S' | 'A' | 'B' | 'C';
export type SortColumn = 'rank' | 'tier' | 'name' | 'role' | 'games' | 'winrate' | 'kda' | 'damage';

export interface ChampionPlayerStat {
  name: string;
  riotId: string;
  avatarUrl: string | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  kdaRatio: string;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
}

export interface ChampionMetaRow {
  championId: number;
  name: string;
  title: string;
  iconUrl: string | null;
  role: Lane;
  roleTags: string[];
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kdaRatio: string;
  kdaNum: number;
  avgDamagePerMin: number;
  pickrate: number;
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
  // Métricas de Early Game y Economía
  laneWinrate: number;
  avgGoldAt14: number;
  avgCsAt14: number;
  avgGoldPerMin: number;
  avgCsPerMin: number;
  avgVisionScore: number;
  avgDamageShare: number;
  players: ChampionPlayerStat[];
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
 * Data Grid analítico competitivo con cajón desplegable interactivo (Deep-Dive) para
 * cada campeón, mostrando métricas de Early Game (min 14), Economía, Combate y jugadores.
 */
@Component({
  selector: 'app-tierlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NfButton, NfLaneIcon, NfAvatar],
  templateUrl: './tierlist.html',
  styleUrls: ['./tierlist.scss'],
})
export class Tierlist {
  private readonly route = inject(ActivatedRoute);
  private readonly groups = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  private readonly matchHistory = inject(MatchHistoryStore);

  readonly roleFilters = ROLE_FILTERS;

  /** Id del grupo resuelto desde la ruta (/app/grupos/:id/tierlist). */
  readonly groupId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  /** Grupo activo para el rótulo de cabecera. */
  readonly group = computed(() => this.groups.byId(this.groupId()));
  readonly groupName = computed(() => this.group()?.name ?? 'Grupo');

  /** Partidas disputadas en este grupo (con fallback a partidas disponibles en desarrollo). */
  readonly groupMatches = computed<Match[]>(() => {
    const id = this.groupId();
    if (!id) return [];
    const directMatches = this.matchHistory.matchesByGroup(id);
    if (directMatches.length > 0) return directMatches;
    // En desarrollo: si el grupo específico no tiene partidas registradas con su ID exacto,
    // usamos las partidas disponibles en el store para permitir previsualizar el metagame y la tabla.
    return this.matchHistory.allMatches();
  });

  readonly totalMatches = computed(() => this.groupMatches().length);

  /** Estado de filtros locales con signals */
  readonly searchQuery = signal('');
  readonly selectedRole = signal<Lane | 'ALL'>('ALL');
  readonly sortColumn = signal<SortColumn>('winrate');
  readonly sortAsc = signal<boolean>(false);

  /** Fila actualmente expandida con el cajón Deep-Dive (id del campeón o null). */
  readonly expandedChampId = signal<number | null>(null);

  private readonly viewMemory = inject(ViewMemoryService);

  constructor() {
    void this.groups.ensureLoaded();
    void this.gameData.ensureLoaded();

    const paramChamp = this.route.snapshot?.queryParamMap?.get('campeon');
    if (paramChamp) {
      const champId = Number(paramChamp);
      if (!isNaN(champId) && champId > 0) {
        this.expandedChampId.set(champId);
      }
    }

    afterNextRender(() => {
      const key = this.group() ? `/app/grupos/${this.group()!.id}/tierlist` : '/app/tierlist';
      // Scroll y fila desplegada describen dónde estabas: se recuperan solo al volver.
      const returning = this.viewMemory.consumeReturn(key);
      if (!returning) return;

      const y = this.viewMemory.consumeScroll(key);
      if (y !== null && y > 0) {
        window.scrollTo({ top: y, behavior: 'instant' });
      }
      if (returning.expandedIds && returning.expandedIds.length > 0) {
        const champId = Number(returning.expandedIds[0]);
        if (!isNaN(champId)) {
          this.expandedChampId.set(champId);
        }
      }
    });
  }

  /**
   * Cálculo reactivo de todas las filas de metagame del grupo a partir de las partidas reales.
   */
  readonly allRows = computed<ChampionMetaRow[]>(() => {
    const matches = this.groupMatches();
    const total = matches.length;
    if (total === 0) return [];

    const champMap = this.gameData.championById();

    interface PlayerAcc {
      name: string;
      riotId: string;
      avatarUrl: string | null;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
    }

    interface ChampAccumulator {
      championId: number;
      name: string;
      title: string;
      iconUrl: string | null;
      tags: string[];
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      damageTotal: number;
      goldTotal: number;
      goldAt14Total: number;
      csAt14Total: number;
      csPerMinTotal: number;
      visionTotal: number;
      damageShareTotal: number;
      wonLaneCount: number;
      durationMinutesTotal: number;
      roleCounts: Map<Lane, number>;
      playerStats: Map<string, PlayerAcc>;
    }

    const accumulators = new Map<number, ChampAccumulator>();

    for (const match of matches) {
      const durationMin = Math.max(1, Math.round(match.durationSeconds / 60));
      const winningTeam = match.winningTeam;
      const participants: MatchParticipant[] = [
        ...match.blueTeam.participants,
        ...match.redTeam.participants,
      ];

      for (const p of participants) {
        let acc = accumulators.get(p.championId);
        if (!acc) {
          const info = champMap.get(p.championId);
          acc = {
            championId: p.championId,
            name: info?.name ?? p.championName,
            title: info?.title ?? '',
            iconUrl: info?.iconUrl ?? null,
            tags: info?.tags ?? [],
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            damageTotal: 0,
            goldTotal: 0,
            goldAt14Total: 0,
            csAt14Total: 0,
            csPerMinTotal: 0,
            visionTotal: 0,
            damageShareTotal: 0,
            wonLaneCount: 0,
            durationMinutesTotal: 0,
            roleCounts: new Map<Lane, number>(),
            playerStats: new Map(),
          };
          accumulators.set(p.championId, acc);
        }

        const isWin = p.team === winningTeam;
        acc.games++;
        if (isWin) acc.wins++;
        acc.kills += p.stats.kills;
        acc.deaths += p.stats.deaths;
        acc.assists += p.stats.assists;
        acc.damageTotal += p.stats.totalDamageToChampions ?? 0;
        acc.goldTotal += p.stats.gold ?? 0;
        acc.goldAt14Total += p.stats.goldAt14 ?? 0;
        acc.csAt14Total += p.stats.csAt14 ?? 0;
        acc.csPerMinTotal += p.stats.csPerMin ?? 0;
        acc.visionTotal += p.stats.visionScore ?? 0;
        acc.damageShareTotal += p.stats.damageSharePercentage ?? 0;
        if (p.stats.wonLane) acc.wonLaneCount++;
        acc.durationMinutesTotal += durationMin;

        acc.roleCounts.set(p.role, (acc.roleCounts.get(p.role) ?? 0) + 1);

        // Player tracking
        const key = p.riotId || p.discordUsername || 'Jugador';
        const displayName = p.discordUsername ?? p.riotId.split('#')[0] ?? p.riotId;
        let pAcc = acc.playerStats.get(key);
        if (!pAcc) {
          pAcc = {
            name: displayName,
            riotId: key,
            avatarUrl: p.avatarUrl ?? null,
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
          };
          acc.playerStats.set(key, pAcc);
        }
        pAcc.games++;
        if (isWin) pAcc.wins++;
        pAcc.kills += p.stats.kills;
        pAcc.deaths += p.stats.deaths;
        pAcc.assists += p.stats.assists;
      }
    }

    const rows: ChampionMetaRow[] = [];

    for (const acc of accumulators.values()) {
      const winrate = Math.round((acc.wins / acc.games) * 100);
      const losses = acc.games - acc.wins;
      const avgKills = +(acc.kills / acc.games).toFixed(1);
      const avgDeaths = +(acc.deaths / acc.games).toFixed(1);
      const avgAssists = +(acc.assists / acc.games).toFixed(1);
      const kdaNum = acc.deaths === 0 ? acc.kills + acc.assists : (acc.kills + acc.assists) / acc.deaths;
      const kdaRatio = kdaNum.toFixed(2);
      const avgDamagePerMin = Math.round(acc.damageTotal / Math.max(1, acc.durationMinutesTotal));
      const pickrate = Math.round((acc.games / total) * 100);

      // Early Game & Economía
      const laneWinrate = Math.round((acc.wonLaneCount / acc.games) * 100);
      const avgGoldAt14 = Math.round(acc.goldAt14Total / acc.games);
      const avgCsAt14 = Math.round(acc.csAt14Total / acc.games);
      const avgGoldPerMin = Math.round(acc.goldTotal / Math.max(1, acc.durationMinutesTotal));
      const avgCsPerMin = +(acc.csPerMinTotal / acc.games).toFixed(1);
      const avgVisionScore = Math.round(acc.visionTotal / acc.games);
      const avgDamageShare = Math.round(acc.damageShareTotal / acc.games);

      // Determinación del rol principal en este grupo
      let primaryRole: Lane = 'MID';
      let maxRoleCount = -1;
      for (const [role, count] of acc.roleCounts.entries()) {
        if (count > maxRoleCount) {
          maxRoleCount = count;
          primaryRole = role;
        }
      }

      // Asignación de Tier
      let tier: TierRank = 'C';
      let tierWeight = 1;
      if (winrate >= 62 && acc.games >= 3) {
        tier = 'S+';
        tierWeight = 5;
      } else if (winrate >= 56 && acc.games >= 2) {
        tier = 'S';
        tierWeight = 4;
      } else if (winrate >= 50) {
        tier = 'A';
        tierWeight = 3;
      } else if (winrate >= 42) {
        tier = 'B';
        tierWeight = 2;
      } else {
        tier = 'C';
        tierWeight = 1;
      }

      // Desglose de jugadores ordenados por victorias / winrate
      const players: ChampionPlayerStat[] = [];
      for (const pStat of acc.playerStats.values()) {
        const pWr = Math.round((pStat.wins / pStat.games) * 100);
        const pKda = pStat.deaths === 0
          ? (pStat.kills + pStat.assists).toFixed(2)
          : ((pStat.kills + pStat.assists) / pStat.deaths).toFixed(2);
        players.push({
          name: pStat.name,
          riotId: pStat.riotId,
          avatarUrl: pStat.avatarUrl,
          games: pStat.games,
          wins: pStat.wins,
          losses: pStat.games - pStat.wins,
          winrate: pWr,
          kdaRatio: pKda,
          avgKills: +(pStat.kills / pStat.games).toFixed(1),
          avgDeaths: +(pStat.deaths / pStat.games).toFixed(1),
          avgAssists: +(pStat.assists / pStat.games).toFixed(1),
        });
      }
      players.sort((a, b) => b.wins - a.wins || b.winrate - a.winrate || b.games - a.games);

      // Especialista del grupo
      const specialist = players.length > 0 ? {
        name: players[0].name,
        riotId: players[0].riotId,
        avatarUrl: players[0].avatarUrl,
        wins: players[0].wins,
        games: players[0].games,
        winrate: players[0].winrate,
      } : null;

      rows.push({
        championId: acc.championId,
        name: acc.name,
        title: acc.title,
        iconUrl: acc.iconUrl,
        role: primaryRole,
        roleTags: acc.tags,
        games: acc.games,
        wins: acc.wins,
        losses,
        winrate,
        avgKills,
        avgDeaths,
        avgAssists,
        kdaRatio,
        kdaNum,
        avgDamagePerMin,
        pickrate,
        tier,
        tierWeight,
        specialist,
        laneWinrate,
        avgGoldAt14,
        avgCsAt14,
        avgGoldPerMin,
        avgCsPerMin,
        avgVisionScore,
        avgDamageShare,
        players,
      });
    }

    return rows;
  });

  /** Filas filtradas por rol y búsqueda. */
  readonly filteredRows = computed<ChampionMetaRow[]>(() => {
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
  readonly sortedRows = computed<ChampionMetaRow[]>(() => {
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

  toggleExpand(championId: number): void {
    this.expandedChampId.update((current) => {
      const next = current === championId ? null : championId;
      const key = this.group() ? `/app/grupos/${this.group()!.id}/tierlist` : '/app/tierlist';
      // La fotografía se arma aquí porque el cajón del campeón se abre en la propia tabla: no hay
      // un clic de «ir al detalle» que armarla como en el historial. Así, si desde una fila
      // abierta te vas a otra pantalla y vuelves, la tabla te devuelve donde estabas.
      this.viewMemory.save(
        key,
        {
          scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
          expandedIds: next ? [String(next)] : [],
        },
        !!next,
      );
      return next;
    });
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
