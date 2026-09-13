/**
 * SUPLENTE DE ESTADÍSTICAS DE CAMPEONES — FICHERO CONDENADO A MORIR.
 *
 * Existe ÚNICAMENTE porque el backend todavía no tiene módulo de telemetría de campeón ni DTOs
 * agregados (no hay columnas de telemetría por participante en la base de datos). Es la ÚNICA parte
 * del frontend que calcula estadísticas y metagame.
 *
 * BACKEND NOTE: Este fichero SE BORRA ENTERO junto con su registro en `app.config.ts` el día que
 * existan los endpoints:
 * - GET /api/v1/groups/{groupId}/champions
 * - GET /api/v1/groups/{groupId}/champions/{championId}
 * - GET /api/v1/me/champions/{championId}
 */

import { EnvironmentInjector, effect, runInInjectionContext, untracked } from '@angular/core';
import { Observable, of } from 'rxjs';
import { hash } from '../group-ranking';
import { banRateFor } from '../group-stats';
import { MatchHistoryStore } from '../matches/match-history-store';
import { Lane, Match, MatchParticipant } from '../matches/models';
import { ChampionStatsSource } from './champion-stats-api';
import { ChampionStatsStore } from './champion-stats-store';
import {
  ChampionBoard,
  ChampionItemStats,
  ChampionPairing,
  ChampionPlayerStats,
  ChampionRow,
  ChampionRunePage,
  ChampionStats,
  TierRank,
} from './models';

const SKILL_ORDERS: readonly ('Q' | 'W' | 'E')[][] = [
  ['Q', 'W', 'E'],
  ['Q', 'E', 'W'],
  ['W', 'Q', 'E'],
  ['W', 'E', 'Q'],
  ['E', 'Q', 'W'],
  ['E', 'W', 'Q'],
];

/** Orden determinista de subida de habilidades no definitivas. */
export function skillOrderFor(championId: number): ('Q' | 'W' | 'E')[] {
  const idx = hash(String(championId)) % SKILL_ORDERS.length;
  return [...SKILL_ORDERS[idx]];
}

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

export class ChampionStatsMockSource implements ChampionStatsSource {
  constructor(private readonly matchHistory: MatchHistoryStore) {}

  private getMatches(groupId: string | null): Match[] {
    if (groupId) {
      const direct = this.matchHistory.matchesByGroup(groupId);
      return direct.length > 0 ? direct : this.matchHistory.allMatches();
    }
    return this.matchHistory.allMatches();
  }

  board(groupId: string | null): Observable<ChampionBoard> {
    const matches = this.getMatches(groupId);
    const totalMatches = matches.length;
    if (totalMatches === 0) {
      return of({ totalMatches: 0, rows: [] });
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
          acc = {
            championId: p.championId,
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

    const rows: ChampionRow[] = [];

    for (const acc of accumulators.values()) {
      const winrate = Math.round((acc.wins / acc.games) * 100);
      const losses = acc.games - acc.wins;
      const avgKills = +(acc.kills / acc.games).toFixed(1);
      const avgDeaths = +(acc.deaths / acc.games).toFixed(1);
      const avgAssists = +(acc.assists / acc.games).toFixed(1);
      const kdaNum = acc.deaths === 0 ? acc.kills + acc.assists : (acc.kills + acc.assists) / acc.deaths;
      const kdaRatio = kdaNum.toFixed(2);
      const avgDamagePerMin = Math.round(acc.damageTotal / Math.max(1, acc.durationMinutesTotal));
      const pickrate = Math.round((acc.games / totalMatches) * 100);

      const laneWinrate = Math.round((acc.wonLaneCount / acc.games) * 100);
      const avgGoldAt14 = Math.round(acc.goldAt14Total / acc.games);
      const avgCsAt14 = Math.round(acc.csAt14Total / acc.games);
      const avgGoldPerMin = Math.round(acc.goldTotal / Math.max(1, acc.durationMinutesTotal));
      const avgCsPerMin = +(acc.csPerMinTotal / acc.games).toFixed(1);
      const avgVisionScore = Math.round(acc.visionTotal / acc.games);
      const avgDamageShare = Math.round(acc.damageShareTotal / acc.games);

      let primaryRole: Lane = 'MID';
      let maxRoleCount = -1;
      for (const [role, count] of acc.roleCounts.entries()) {
        if (count > maxRoleCount) {
          maxRoleCount = count;
          primaryRole = role;
        }
      }

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

      const players: ChampionPlayerStats[] = [];
      for (const pStat of acc.playerStats.values()) {
        const pWr = Math.round((pStat.wins / pStat.games) * 100);
        const pKda = pStat.deaths === 0
          ? (pStat.kills + pStat.assists).toFixed(2)
          : ((pStat.kills + pStat.assists) / pStat.deaths).toFixed(2);
        players.push({
          displayName: pStat.name,
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

      const specialist = players.length > 0 ? players[0] : null;

      rows.push({
        championId: acc.championId,
        role: primaryRole,
        tier,
        tierWeight,
        games: acc.games,
        wins: acc.wins,
        losses,
        winrate,
        pickrate,
        avgKills,
        avgDeaths,
        avgAssists,
        kdaRatio,
        kdaNum,
        avgDamagePerMin,
        laneWinrate,
        avgGoldAt14,
        avgCsAt14,
        avgGoldPerMin,
        avgCsPerMin,
        avgVisionScore,
        avgDamageShare,
        specialist,
      });
    }

    return of({ totalMatches, rows });
  }

  stats(groupId: string | null, championId: number): Observable<ChampionStats | null> {
    const matches = this.getMatches(groupId);
    const champMatches = matches.filter((m) =>
      m.blueTeam.participants.some((p) => p.championId === championId) ||
      m.redTeam.participants.some((p) => p.championId === championId),
    );

    if (champMatches.length === 0) {
      return of(null);
    }

    const totalMatches = matches.length;
    let games = 0;
    let wins = 0;
    let kills = 0;
    let deaths = 0;
    let assists = 0;
    let damageTotal = 0;
    let goldTotal = 0;
    let goldAt14Total = 0;
    let csAt14Total = 0;
    let csPerMinTotal = 0;
    let visionTotal = 0;
    let damageShareTotal = 0;
    let wonLaneCount = 0;
    let durationMinutesTotal = 0;
    let fbCount = 0;
    let ftCount = 0;

    const roleCounts = new Map<Lane, number>();
    const playerStats = new Map<string, PlayerAcc>();
    const synergyCounts = new Map<number, { games: number; wins: number }>();
    const counterCounts = new Map<number, { games: number; wins: number; losses: number }>();
    const itemCounts = new Map<number, { games: number; wins: number }>();
    const runePageCounts = new Map<
      string,
      {
        primaryTreeId: number;
        secondaryTreeId: number;
        keystoneId: number;
        primaryRuneIds: number[];
        secondaryRuneIds: number[];
        statShardIds: number[];
        lastDecidedAt: string;
        games: number;
        wins: number;
      }
    >();

    for (const match of champMatches) {
      const durationMin = Math.max(1, Math.round(match.durationSeconds / 60));
      const winningTeam = match.winningTeam;
      const allParticipants = [
        ...match.blueTeam.participants,
        ...match.redTeam.participants,
      ];
      const apariciones = allParticipants.filter((pt) => pt.championId === championId);
      for (const p of apariciones) {
        const isWin = p.team === winningTeam;

        games++;
        if (isWin) wins++;
        kills += p.stats.kills;
        deaths += p.stats.deaths;
        assists += p.stats.assists;
        damageTotal += p.stats.totalDamageToChampions ?? 0;
        goldTotal += p.stats.gold ?? 0;
        goldAt14Total += p.stats.goldAt14 ?? 0;
        csAt14Total += p.stats.csAt14 ?? 0;
        csPerMinTotal += p.stats.csPerMin ?? 0;
        visionTotal += p.stats.visionScore ?? 0;
        damageShareTotal += p.stats.damageSharePercentage ?? 0;
        if (p.stats.wonLane) wonLaneCount++;
        durationMinutesTotal += durationMin;

        roleCounts.set(p.role, (roleCounts.get(p.role) ?? 0) + 1);

        if (match.milestones?.firstBloodParticipantId === p.id) {
          fbCount++;
        }
        if (match.milestones?.firstTowerTeam === p.team) {
          ftCount++;
        }

        // Player stats
        const key = p.riotId || p.discordUsername || 'Jugador';
        const displayName = p.discordUsername ?? p.riotId.split('#')[0] ?? p.riotId;
        let pAcc = playerStats.get(key);
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
          playerStats.set(key, pAcc);
        }
        pAcc.games++;
        if (isWin) pAcc.wins++;
        pAcc.kills += p.stats.kills;
        pAcc.deaths += p.stats.deaths;
        pAcc.assists += p.stats.assists;

        // Synergies (allies in same team except champion itself)
        const myTeamParticipants = p.team === 'blue' ? match.blueTeam.participants : match.redTeam.participants;
        for (const ally of myTeamParticipants) {
          if (ally.id === p.id) continue;
          let sAcc = synergyCounts.get(ally.championId);
          if (!sAcc) {
            sAcc = { games: 0, wins: 0 };
            synergyCounts.set(ally.championId, sAcc);
          }
          sAcc.games++;
          if (isWin) sAcc.wins++;
        }

        // Counters (opponent in other team with same role)
        const enemyTeamParticipants = p.team === 'blue' ? match.redTeam.participants : match.blueTeam.participants;
        const rival = enemyTeamParticipants.find((ep) => ep.role === p.role);
        if (rival) {
          let cAcc = counterCounts.get(rival.championId);
          if (!cAcc) {
            cAcc = { games: 0, wins: 0, losses: 0 };
            counterCounts.set(rival.championId, cAcc);
          }
          cAcc.games++;
          if (isWin) {
            cAcc.wins++;
          } else {
            cAcc.losses++;
          }
        }

        // Items (slots 0 to 5)
        const buildItems = (p.stats.items ?? []).slice(0, 6);
        for (const item of buildItems) {
          if (!item || !item.id) continue;
          let itAcc = itemCounts.get(item.id);
          if (!itAcc) {
            itAcc = { games: 0, wins: 0 };
            itemCounts.set(item.id, itAcc);
          }
          itAcc.games++;
          if (isWin) itAcc.wins++;
        }

        // Rune page
        if (p.stats.primaryTreeId && p.stats.primaryRuneId) {
          const primTree = p.stats.primaryTreeId;
          const secTree = p.stats.secondaryRuneTreeId ?? 8000;
          const keystone = p.stats.primaryRuneId;
          const primRunes = p.stats.primaryRuneIds ?? [];
          const secRunes = p.stats.secondaryRuneIds ?? [];
          const shards = p.stats.statShardIds ?? [];
          const groupKey = `${keystone}:${secTree}`;
          const decidedAt = match.decidedAt ?? '';

          let rAcc = runePageCounts.get(groupKey);
          if (!rAcc) {
            rAcc = {
              primaryTreeId: primTree,
              secondaryTreeId: secTree,
              keystoneId: keystone,
              primaryRuneIds: primRunes,
              secondaryRuneIds: secRunes,
              statShardIds: shards,
              lastDecidedAt: decidedAt,
              games: 0,
              wins: 0,
            };
            runePageCounts.set(groupKey, rAcc);
          } else if (!rAcc.lastDecidedAt || decidedAt >= rAcc.lastDecidedAt) {
            rAcc.primaryTreeId = primTree;
            rAcc.primaryRuneIds = primRunes;
            rAcc.secondaryRuneIds = secRunes;
            rAcc.statShardIds = shards;
            rAcc.lastDecidedAt = decidedAt;
          }
          rAcc.games++;
          if (isWin) rAcc.wins++;
        }
      }
    }

    const winrate = Math.round((wins / games) * 100);
    const losses = games - wins;
    const avgKills = +(kills / games).toFixed(1);
    const avgDeaths = +(deaths / games).toFixed(1);
    const avgAssists = +(assists / games).toFixed(1);
    const kdaNum = deaths === 0 ? kills + assists : (kills + assists) / deaths;
    const kdaRatio = kdaNum.toFixed(2);
    const avgDamagePerMin = Math.round(damageTotal / Math.max(1, durationMinutesTotal));
    const pickrate = Math.round((games / totalMatches) * 100);

    const laneWinrate = Math.round((wonLaneCount / games) * 100);
    const avgGoldAt14 = Math.round(goldAt14Total / games);
    const avgCsAt14 = Math.round(csAt14Total / games);
    const avgGoldPerMin = Math.round(goldTotal / Math.max(1, durationMinutesTotal));
    const avgCsPerMin = +(csPerMinTotal / games).toFixed(1);
    const avgVisionScore = Math.round(visionTotal / games);
    const avgDamageShare = Math.round(damageShareTotal / games);

    let primaryRole: Lane = 'MID';
    let maxRoleCount = -1;
    for (const [role, count] of roleCounts.entries()) {
      if (count > maxRoleCount) {
        maxRoleCount = count;
        primaryRole = role;
      }
    }

    let tier: TierRank = 'C';
    let tierWeight = 1;
    if (winrate >= 62 && games >= 3) {
      tier = 'S+';
      tierWeight = 5;
    } else if (winrate >= 56 && games >= 2) {
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

    const specialists: ChampionPlayerStats[] = [];
    for (const pStat of playerStats.values()) {
      const pWr = Math.round((pStat.wins / pStat.games) * 100);
      const pKda = pStat.deaths === 0
        ? (pStat.kills + pStat.assists).toFixed(2)
        : ((pStat.kills + pStat.assists) / pStat.deaths).toFixed(2);
      specialists.push({
        displayName: pStat.name,
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
    specialists.sort((a, b) => b.wins - a.wins || b.winrate - a.winrate || b.games - a.games);

    const specialist = specialists.length > 0 ? specialists[0] : null;

    // Sinergias: orden wins desc, luego winrate desc, luego games desc
    const synergies: ChampionPairing[] = Array.from(synergyCounts.entries())
      .map(([champId, s]) => ({
        championId: champId,
        games: s.games,
        wins: s.wins,
        winrate: Math.round((s.wins / s.games) * 100),
      }))
      .sort((a, b) => b.wins - a.wins || b.winrate - a.winrate || b.games - a.games);

    // Counters: orden losses desc, luego winrate asc, luego games desc
    const counters: ChampionPairing[] = Array.from(counterCounts.entries())
      .map(([champId, c]) => ({
        championId: champId,
        games: c.games,
        wins: c.wins,
        winrate: Math.round((c.wins / c.games) * 100),
      }))
      .sort((a, b) => (b.games - b.wins) - (a.games - a.wins) || a.winrate - b.winrate || b.games - a.games);

    // Items: ranuras 0 a 5, orden wins desc, luego winrate desc. Se devuelven seis.
    const items: ChampionItemStats[] = Array.from(itemCounts.entries())
      .map(([itemId, it]) => ({
        itemId,
        games: it.games,
        wins: it.wins,
        winrate: Math.round((it.wins / it.games) * 100),
      }))
      .sort((a, b) => b.wins - a.wins || b.winrate - a.winrate)
      .slice(0, 6);

    // Rune page
    let runePage: ChampionRunePage | null = null;
    if (runePageCounts.size > 0) {
      const sortedPages = Array.from(runePageCounts.values()).sort(
        (a, b) => b.wins - a.wins || b.games - a.games,
      );
      const top = sortedPages[0];
      runePage = {
        primaryTreeId: top.primaryTreeId,
        secondaryTreeId: top.secondaryTreeId,
        keystoneId: top.keystoneId,
        primaryRuneIds: top.primaryRuneIds,
        secondaryRuneIds: top.secondaryRuneIds,
        statShardIds: top.statShardIds,
        games: top.games,
        wins: top.wins,
        winrate: Math.round((top.wins / top.games) * 100),
      };
    }

    const firstBloodRate = Math.round((fbCount / games) * 100);
    const firstTowerRate = Math.round((ftCount / games) * 100);
    const banRate = banRateFor(groupId ?? 'global', championId);
    const skillOrder = skillOrderFor(championId);

    const statsResult: ChampionStats = {
      championId,
      role: primaryRole,
      tier,
      tierWeight,
      games,
      wins,
      losses,
      winrate,
      pickrate,
      avgKills,
      avgDeaths,
      avgAssists,
      kdaRatio,
      kdaNum,
      avgDamagePerMin,
      laneWinrate,
      avgGoldAt14,
      avgCsAt14,
      avgGoldPerMin,
      avgCsPerMin,
      avgVisionScore,
      avgDamageShare,
      specialist,
      scope: groupId ? 'group' : 'global',
      firstBloodRate,
      firstTowerRate,
      banRate,
      skillOrder,
      specialists,
      synergies,
      counters,
      items,
      runePage,
    };

    return of(statsResult);
  }
}

/** Instala la fuente mock en el store de estadísticas de campeones. */
export function installChampionStatsMock(injector: EnvironmentInjector): void {
  const store = injector.get(ChampionStatsStore);
  const matchHistory = injector.get(MatchHistoryStore);
  store.useSource(new ChampionStatsMockSource(matchHistory));
  runInInjectionContext(injector, () => {
    effect(
      () => {
        // La ÚNICA dependencia de este effect es la semilla de partidas: cuando cambia, se recalcula
        // todo lo cacheado. `invalidate()` va dentro de `untracked` a propósito — escribe en las
        // señales de la caché, y si además leyera alguna se reinvalidaría a sí mismo y giraría para
        // siempre. `allowSignalWrites: true` permite la escritura pero no protege de ese bucle.
        matchHistory.allMatches();
        untracked(() => store.invalidate());
      },
      { allowSignalWrites: true },
    );
  });
}
