import { Injectable, computed, signal } from '@angular/core';
import {
  GroupMatchHistorySummary,
  Lane,
  Match,
  MatchFilterState,
  UserMatchHistorySummary,
} from './models';
import { SEED_MATCHES, enrichMatchesForUser } from './match-history-seed';

@Injectable({ providedIn: 'root' })
export class MatchHistoryStore {
  private readonly _rawMatches = signal<Match[]>(enrichMatchesForUser(SEED_MATCHES));

  readonly filters = signal<MatchFilterState>({
    groupId: 'all',
    role: 'all',
    championId: 'all',
    outcome: 'all',
    searchQuery: '',
    sortBy: 'date-desc',
  });

  readonly expandedMatchId = signal<string | null>(null);

  /** Todas las partidas del sistema */
  readonly allMatches = this._rawMatches.asReadonly();

  /** Partidas en las que participó el usuario actual */
  readonly allPersonalMatches = computed(() => {
    return this._rawMatches().filter((m) => !!m.userParticipant);
  });

  /** Partidas personales filtradas y ordenadas */
  readonly filteredPersonalMatches = computed(() => {
    const list = this.allPersonalMatches();
    const f = this.filters();
    return this.applyFilters(list, f);
  });

  /** Resumen analítico de las partidas del usuario actual */
  readonly personalSummary = computed<UserMatchHistorySummary>(() => {
    const matches = this.allPersonalMatches();
    const total = matches.length;
    if (total === 0) {
      return {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        winrate: 0,
        avgKills: 0,
        avgDeaths: 0,
        avgAssists: 0,
        avgKdaRatio: '0.00',
        mostPlayedRole: null,
        mostPlayedRoleCount: 0,
        mostPlayedChampionId: null,
        mostPlayedChampionName: null,
      };
    }

    let wins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    const roleCounts = new Map<Lane, number>();
    const champCounts = new Map<number, { count: number; name: string }>();

    for (const m of matches) {
      if (m.userOutcome === 'win') wins++;
      if (m.userParticipant) {
        const stats = m.userParticipant.stats;
        totalKills += stats.kills;
        totalDeaths += stats.deaths;
        totalAssists += stats.assists;

        const r = m.userParticipant.role;
        roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);

        const cid = m.userParticipant.championId;
        const current = champCounts.get(cid) ?? { count: 0, name: m.userParticipant.championName };
        champCounts.set(cid, { count: current.count + 1, name: m.userParticipant.championName });
      }
    }

    const losses = total - wins;
    const winrate = Math.round((wins / total) * 100);
    const avgK = +(totalKills / total).toFixed(1);
    const avgD = +(totalDeaths / total).toFixed(1);
    const avgA = +(totalAssists / total).toFixed(1);
    const kdaRatio = totalDeaths === 0 ? (totalKills + totalAssists).toFixed(2) : ((totalKills + totalAssists) / totalDeaths).toFixed(2);

    let mostPlayedRole: Lane | null = null;
    let mostPlayedRoleCount = 0;
    for (const [role, count] of roleCounts.entries()) {
      if (count > mostPlayedRoleCount) {
        mostPlayedRole = role;
        mostPlayedRoleCount = count;
      }
    }

    let mostPlayedChampionId: number | null = null;
    let mostPlayedChampionName: string | null = null;
    let maxChampCount = 0;
    for (const [cid, data] of champCounts.entries()) {
      if (data.count > maxChampCount) {
        mostPlayedChampionId = cid;
        mostPlayedChampionName = data.name;
        maxChampCount = data.count;
      }
    }

    return {
      totalMatches: total,
      wins,
      losses,
      winrate,
      avgKills: avgK,
      avgDeaths: avgD,
      avgAssists: avgA,
      avgKdaRatio: kdaRatio,
      mostPlayedRole,
      mostPlayedRoleCount,
      mostPlayedChampionId,
      mostPlayedChampionName,
    };
  });

  /** IDs únicos de campeones que el usuario actual ha jugado */
  readonly playedChampionIdsInPersonal = computed(() => {
    const ids = new Set<number>();
    for (const m of this.allPersonalMatches()) {
      if (m.userParticipant) {
        ids.add(m.userParticipant.championId);
      }
    }
    return Array.from(ids);
  });

  /** IDs únicos de campeones que han sido jugados en las partidas de un grupo concreto */
  playedChampionIdsInGroup(groupId: string): number[] {
    const ids = new Set<number>();
    for (const m of this.matchesByGroup(groupId)) {
      for (const p of [...m.blueTeam.participants, ...m.redTeam.participants]) {
        ids.add(p.championId);
      }
    }
    return Array.from(ids);
  }

  /** IDs únicos de campeones en todas las partidas registradas */
  readonly allPlayedChampionIds = computed(() => {
    const ids = new Set<number>();
    for (const m of this._rawMatches()) {
      for (const p of [...m.blueTeam.participants, ...m.redTeam.participants]) {
        ids.add(p.championId);
      }
    }
    return Array.from(ids);
  });

  /** Obtiene las partidas de un grupo específico */
  matchesByGroup(groupId: string): Match[] {
    return this._rawMatches().filter((m) => m.groupId === groupId);
  }

  /** Obtiene las partidas de un grupo específico aplicando los filtros activos */
  filteredGroupMatches(groupId: string): Match[] {
    const list = this.matchesByGroup(groupId);
    const f = this.filters();
    return list.filter((m) => {
      if (f.championId !== 'all') {
        const hasChamp = [...m.blueTeam.participants, ...m.redTeam.participants].some(
          (p) => p.championId === f.championId,
        );
        if (!hasChamp) return false;
      }
      if (f.role !== 'all') {
        const hasRole = [...m.blueTeam.participants, ...m.redTeam.participants].some(
          (p) => p.role === f.role,
        );
        if (!hasRole) return false;
      }
      if (f.outcome !== 'all') {
        if (m.userOutcome && m.userOutcome !== f.outcome) return false;
      }
      if (f.searchQuery && f.searchQuery.trim().length > 0) {
        const q = f.searchQuery.toLowerCase();
        const playerMatch = [...m.blueTeam.participants, ...m.redTeam.participants].some(
          (p) => p.riotId.toLowerCase().includes(q) || p.championName.toLowerCase().includes(q),
        );
        if (!playerMatch) return false;
      }
      return true;
    });
  }

  /** Resumen de métricas de un grupo específico */
  groupSummary(groupId: string): GroupMatchHistorySummary {
    const matches = this.matchesByGroup(groupId);
    const total = matches.length;
    if (total === 0) {
      return {
        totalMatches: 0,
        blueSideWins: 0,
        redSideWins: 0,
        blueWinrate: 0,
        avgDurationMinutes: 0,
        topMvpName: null,
        topMvpCount: 0,
      };
    }

    let blueWins = 0;
    let redWins = 0;
    let totalDuration = 0;
    const mvpCounts = new Map<string, number>();

    for (const m of matches) {
      if (m.winningTeam === 'blue') blueWins++;
      if (m.winningTeam === 'red') redWins++;
      totalDuration += m.durationSeconds;

      if (m.mvpParticipantId) {
        const allP = [...m.blueTeam.participants, ...m.redTeam.participants];
        const mvp = allP.find((p) => p.id === m.mvpParticipantId);
        if (mvp) {
          mvpCounts.set(mvp.riotId, (mvpCounts.get(mvp.riotId) ?? 0) + 1);
        }
      }
    }

    let topMvpName: string | null = null;
    let topMvpCount = 0;
    for (const [name, count] of mvpCounts.entries()) {
      if (count > topMvpCount) {
        topMvpName = name;
        topMvpCount = count;
      }
    }

    return {
      totalMatches: total,
      blueSideWins: blueWins,
      redSideWins: redWins,
      blueWinrate: Math.round((blueWins / total) * 100),
      avgDurationMinutes: Math.round(totalDuration / total / 60),
      topMvpName,
      topMvpCount,
    };
  }

  /** Busca una partida por ID */
  matchById(id: string): Match | undefined {
    return this._rawMatches().find((m) => m.id === id);
  }

  /** Toggle de expansión del acordeón de una partida */
  toggleExpand(matchId: string): void {
    this.expandedMatchId.update((curr) => (curr === matchId ? null : matchId));
  }

  /** Modifica los filtros actuales */
  updateFilters(partial: Partial<MatchFilterState>): void {
    this.filters.update((curr) => ({ ...curr, ...partial }));
  }

  /** Restablece todos los filtros a sus valores por defecto */
  resetFilters(): void {
    this.filters.set({
      groupId: 'all',
      role: 'all',
      championId: 'all',
      outcome: 'all',
      searchQuery: '',
      sortBy: 'date-desc',
    });
  }

  private applyFilters(list: Match[], f: MatchFilterState): Match[] {
    let result = list.filter((m) => {
      if (f.groupId !== 'all' && m.groupId !== f.groupId) return false;
      if (f.outcome !== 'all' && m.userOutcome !== f.outcome) return false;

      if (f.role !== 'all') {
        if (!m.userParticipant || m.userParticipant.role !== f.role) return false;
      }

      if (f.championId !== 'all') {
        if (!m.userParticipant || m.userParticipant.championId !== f.championId) return false;
      }

      if (f.searchQuery && f.searchQuery.trim().length > 0) {
        const q = f.searchQuery.toLowerCase();
        const champMatch = m.userParticipant?.championName.toLowerCase().includes(q);
        const groupMatch = m.group.name.toLowerCase().includes(q);
        const playerMatch = [...m.blueTeam.participants, ...m.redTeam.participants].some((p) =>
          p.riotId.toLowerCase().includes(q),
        );
        if (!champMatch && !groupMatch && !playerMatch) return false;
      }

      return true;
    });

    // Ordenación
    result = [...result].sort((a, b) => {
      if (f.sortBy === 'date-asc') {
        return new Date(a.decidedAt).getTime() - new Date(b.decidedAt).getTime();
      }
      if (f.sortBy === 'duration-desc') {
        return b.durationSeconds - a.durationSeconds;
      }
      if (f.sortBy === 'kills-desc') {
        const killsA = a.userParticipant?.stats.kills ?? 0;
        const killsB = b.userParticipant?.stats.kills ?? 0;
        return killsB - killsA;
      }
      // date-desc
      return new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime();
    });

    return result;
  }
}
