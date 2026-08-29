import { Injectable, computed, inject } from '@angular/core';
import {
  GroupMatchHistorySummary,
  Lane,
  Match,
  MatchParticipant,
  UserMatchHistorySummary,
} from './models';
import { kdaRatio } from './match-view';
import { MockHistoryGroup, buildMockHistory } from './match-history-seed';
import { Session } from '../auth';
import { GroupsStore, MOCK_GROUP_VIEWS } from '../groups';
import { GroupStore } from '../group-store';
import { RiotAccountStore } from '../riot';

/** Rendimiento del usuario con un campeón concreto, para comparar contra una partida suelta. */
export interface ChampionAverages {
  games: number;
  wins: number;
  winrate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKdaRatio: string;
  avgCsPerMin: number;
}

/** Récord del usuario contra un rival concreto, global y en el duelo de línea. */
export interface HeadToHead {
  riotId: string;
  /** Partidas en las que os habéis enfrentado (bandos opuestos). */
  games: number;
  wins: number;
  losses: number;
  /** De esas, las que además jugasteis en la misma línea. */
  laneGames: number;
  laneWins: number;
}

/**
 * Identidad estable de un participante. `userId` cuando existe (invitados no tienen), y si no
 * el `riotId` normalizado. Nunca se compara por nombre a secas: `Nombre#REGION` es la clave
 * completa, y el mock la escribe con mayúsculas inconsistentes.
 */
function participantKey(p: MatchParticipant): string {
  return p.userId ?? p.riotId.toLowerCase();
}

/**
 * Estado de dominio del historial. Solo datos y derivaciones sobre ellos: los filtros, la
 * página y qué filas están desplegadas son estado de UI y viven en `MatchHistoryUiState`,
 * provisto por cada vista (regla de oro: estado de UI ≠ estado de dominio). Antes estaban
 * aquí, y el efecto secundario era que los filtros del historial personal se colaban en el
 * de grupo sin que nada lo indicase.
 *
 * BACKEND NOTE: la lista entera es placeholder desechable: sale de proyectar la semilla sobre
 * las ligas reales del usuario (`buildMockHistory`, en `match-history-seed.ts`). Cuando exista
 * `GET /matches` este store pasa al patrón `Session` (status/ensureLoaded/reload/clear), la
 * semilla y su proyección se borran enteras, y los agregados de abajo se sustituyen por los que
 * calcule el servidor.
 */
@Injectable({ providedIn: 'root' })
export class MatchHistoryStore {
  private readonly session = inject(Session);
  private readonly groupsStore = inject(GroupsStore);
  private readonly groupStore = inject(GroupStore);
  private readonly riotAccount = inject(RiotAccountStore);

  /**
   * Todas las partidas del sistema.
   *
   * Es un `computed` y no una constante porque sus tres entradas llegan por red y en cualquier
   * orden: las ligas del usuario (`GroupsStore`), su identidad (`Session` + cuenta de Riot) y el
   * roster de cada grupo, que `GroupBridge` siembra al entrar en él. Recalcular en vez de
   * congelar la lista al arrancar es lo que hace que, al abrir un grupo, sus partidas pasen de
   * enseñar nombres de la semilla a enseñar a tus compañeros de verdad sin recargar nada.
   */
  readonly allMatches = computed<Match[]>(() =>
    buildMockHistory(this.leagues(), this.viewer(), (id) => this.groupStore.rosterOf(id)),
  );

  /**
   * Las ligas sobre las que se reparte el historial. Mientras la lista real está en vuelo (o si
   * falla, o si el usuario aún no tiene ninguna) se usa la mock, para que el historial personal
   * no aparezca vacío por una carga a medias —que se leería como «no has jugado nada»—.
   */
  private readonly leagues = computed<MockHistoryGroup[]>(() => {
    const real = this.groupsStore.groups();
    const source = real.length > 0 ? real : MOCK_GROUP_VIEWS;
    return source.map((g) => ({
      id: g.id,
      name: g.name,
      region: g.region ?? 'LAN',
      initials: g.initials,
      c1: g.c1,
      c2: g.c2,
    }));
  });

  /**
   * Quién mira. El `userId` de `/me` es la identidad estable; el Riot ID es solo lo que se
   * pinta, y si no hay cuenta de LoL vinculada se cae al nombre de Discord antes que a un hueco.
   */
  private readonly viewer = computed(() => {
    const user = this.session.user();
    return {
      userId: user?.userId ?? 'mock:viewer',
      riotId: this.riotAccount.account()?.riotId ?? user?.discordUsername ?? 'Yo',
    };
  });

  /** Partidas en las que participó el usuario actual. */
  readonly allPersonalMatches = computed(() => this.allMatches().filter((m) => !!m.userParticipant));

  /** Resumen analítico de las partidas del usuario actual. */
  readonly personalSummary = computed<UserMatchHistorySummary>(() => {
    const matches = this.allPersonalMatches();
    const total = matches.length;
    if (total === 0) return EMPTY_PERSONAL_SUMMARY;

    let wins = 0;
    let totalKills = 0;
    let totalDeaths = 0;
    let totalAssists = 0;
    const roleCounts = new Map<Lane, number>();
    const champCounts = new Map<number, { count: number; name: string }>();

    for (const m of matches) {
      if (m.userOutcome === 'win') wins++;
      const p = m.userParticipant;
      if (!p) continue;

      totalKills += p.stats.kills;
      totalDeaths += p.stats.deaths;
      totalAssists += p.stats.assists;

      roleCounts.set(p.role, (roleCounts.get(p.role) ?? 0) + 1);
      const current = champCounts.get(p.championId);
      champCounts.set(p.championId, {
        count: (current?.count ?? 0) + 1,
        name: current?.name ?? p.championName,
      });
    }

    const [mostPlayedRole, mostPlayedRoleCount] = topEntry(roleCounts, (v) => v);
    const [mostPlayedChampionId] = topEntry(champCounts, (v) => v.count);

    return {
      totalMatches: total,
      wins,
      losses: total - wins,
      winrate: Math.round((wins / total) * 100),
      avgKills: round1(totalKills / total),
      avgDeaths: round1(totalDeaths / total),
      avgAssists: round1(totalAssists / total),
      avgKdaRatio: ratioOf(totalKills, totalDeaths, totalAssists),
      mostPlayedRole,
      mostPlayedRoleCount,
      mostPlayedChampionId,
      mostPlayedChampionName:
        mostPlayedChampionId === null ? null : champCounts.get(mostPlayedChampionId)!.name,
    };
  });

  /** IDs únicos de campeones que el usuario actual ha jugado. */
  readonly playedChampionIdsInPersonal = computed(() => {
    const ids = new Set<number>();
    for (const m of this.allPersonalMatches()) {
      if (m.userParticipant) ids.add(m.userParticipant.championId);
    }
    return Array.from(ids);
  });

  /** IDs únicos de campeones jugados en las partidas de un grupo concreto. */
  playedChampionIdsInGroup(groupId: string): number[] {
    const ids = new Set<number>();
    for (const m of this.matchesByGroup(groupId)) {
      for (const p of participantsOf(m)) ids.add(p.championId);
    }
    return Array.from(ids);
  }

  /** Partidas de un grupo específico. */
  matchesByGroup(groupId: string): Match[] {
    return this.allMatches().filter((m) => m.groupId === groupId);
  }

  /** Resumen de métricas de un grupo específico. */
  groupSummary(groupId: string): GroupMatchHistorySummary {
    const matches = this.matchesByGroup(groupId);
    const total = matches.length;
    if (total === 0) return EMPTY_GROUP_SUMMARY;

    let blueWins = 0;
    let totalDuration = 0;
    const mvpCounts = new Map<string, number>();

    for (const m of matches) {
      if (m.winningTeam === 'blue') blueWins++;
      totalDuration += m.durationSeconds;

      const mvp = participantsOf(m).find((p) => p.id === m.mvpParticipantId);
      if (mvp) mvpCounts.set(mvp.riotId, (mvpCounts.get(mvp.riotId) ?? 0) + 1);
    }

    const [topMvpName, topMvpCount] = topEntry(mvpCounts, (v) => v);

    return {
      totalMatches: total,
      blueSideWins: blueWins,
      redSideWins: total - blueWins,
      blueWinrate: Math.round((blueWins / total) * 100),
      avgDurationMinutes: Math.round(totalDuration / total / 60),
      topMvpName,
      topMvpCount,
    };
  }

  /** Busca una partida por ID. */
  matchById(id: string): Match | undefined {
    return this.allMatches().find((m) => m.id === id);
  }

  /**
   * Partida anterior y siguiente dentro del mismo contexto, en el orden natural del historial
   * (más reciente primero). Sin esto, la página de detalle es una vía muerta: para ver la
   * partida de al lado había que volver a la lista y buscarla.
   */
  neighboursOf(matchId: string, groupId?: string): { prev: Match | null; next: Match | null } {
    const scope = groupId ? this.matchesByGroup(groupId) : this.allPersonalMatches();
    const ordered = [...scope].sort(
      (a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime(),
    );
    const i = ordered.findIndex((m) => m.id === matchId);
    if (i === -1) return { prev: null, next: null };
    return { prev: ordered[i - 1] ?? null, next: ordered[i + 1] ?? null };
  }

  /**
   * Medias del usuario con un campeón. Es lo que convierte «12/3/8» en un juicio: un KDA
   * suelto no dice si fue una buena partida, comparado con tu media sí.
   */
  championAverages(championId: number): ChampionAverages | null {
    const matches = this.allPersonalMatches().filter(
      (m) => m.userParticipant?.championId === championId,
    );
    if (matches.length === 0) return null;

    let wins = 0;
    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let csPerMin = 0;

    for (const m of matches) {
      if (m.userOutcome === 'win') wins++;
      const stats = m.userParticipant!.stats;
      kills += stats.kills;
      deaths += stats.deaths;
      assists += stats.assists;
      csPerMin += stats.csPerMin;
    }

    const games = matches.length;
    return {
      games,
      wins,
      winrate: Math.round((wins / games) * 100),
      avgKills: round1(kills / games),
      avgDeaths: round1(deaths / games),
      avgAssists: round1(assists / games),
      avgKdaRatio: ratioOf(kills, deaths, assists),
      avgCsPerMin: round1(csPerMin / games),
    };
  }

  /**
   * Récord del usuario contra un rival, calculado sobre las partidas reales del historial y
   * no con un generador aparte: si la lista enseña que perdiste esas dos partidas, la tarjeta
   * de rivalidad no puede decir otra cosa.
   */
  headToHead(opponent: MatchParticipant): HeadToHead {
    const key = participantKey(opponent);
    let games = 0;
    let wins = 0;
    let laneGames = 0;
    let laneWins = 0;

    for (const m of this.allPersonalMatches()) {
      const me = m.userParticipant!;
      const rival = participantsOf(m).find((p) => participantKey(p) === key);
      // Solo cuentan los enfrentamientos: coincidir en el mismo equipo no es una rivalidad.
      if (!rival || rival.team === me.team) continue;

      const won = m.userOutcome === 'win';
      games++;
      if (won) wins++;
      if (rival.role === me.role) {
        laneGames++;
        if (won) laneWins++;
      }
    }

    return { riotId: opponent.riotId, games, wins, losses: games - wins, laneGames, laneWins };
  }
}

function participantsOf(m: Match): MatchParticipant[] {
  return [...m.blueTeam.participants, ...m.redTeam.participants];
}

/** La entrada con mayor puntuación de un mapa, o `[null, 0]` si está vacío. */
function topEntry<K, V>(map: Map<K, V>, score: (value: V) => number): [K | null, number] {
  let bestKey: K | null = null;
  let bestScore = 0;
  for (const [key, value] of map) {
    const s = score(value);
    if (s > bestScore) {
      bestKey = key;
      bestScore = s;
    }
  }
  return [bestKey, bestScore];
}

function round1(value: number): number {
  return +value.toFixed(1);
}

function ratioOf(kills: number, deaths: number, assists: number): string {
  return kdaRatio({ kills, deaths, assists }).toFixed(2);
}

const EMPTY_PERSONAL_SUMMARY: UserMatchHistorySummary = {
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

const EMPTY_GROUP_SUMMARY: GroupMatchHistorySummary = {
  totalMatches: 0,
  blueSideWins: 0,
  redSideWins: 0,
  blueWinrate: 0,
  avgDurationMinutes: 0,
  topMvpName: null,
  topMvpCount: 0,
};
