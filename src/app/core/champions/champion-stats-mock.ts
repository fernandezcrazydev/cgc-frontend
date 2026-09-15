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
import { banRateFor } from '../group-stats-mock';
import { REAL_CHAMPION_IDS } from '../lobby';
import { Lane } from '../matches/models';
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

/**
 * EL CORPUS DEL SUPLENTE, Y POR QUE ES SUYO Y NO DEL HISTORIAL.
 *
 * Esto se alimentaba de `MatchHistoryStore`, cuando el historial era una semilla local que lo
 * tenia todo. Ya no lo es: lo sirve `GET /groups/{id}/matches`, paginado, y una fila de ese
 * listado trae KDA y oro y se acaba ahi — ni objetos, ni runas, ni vision, ni cs, ni reparto de
 * dano. La mitad de lo que este fichero agrega no existe en el contrato, y no va a existir hasta
 * que lleguen sus propios endpoints.
 *
 * Asi que el suplente se queda con su corpus, en vez de agregar sobre datos reales a los que les
 * falta la mitad de las columnas. Rellenar esos huecos con ceros seria lo peor de las dos
 * opciones: cifras con aspecto de medida —un 0% de reparto de dano, una racha de linea perdida—
 * calculadas sobre partidas de verdad, que es exactamente la mentira que nadie detecta mirando
 * la pantalla.
 *
 * Es determinista: el mismo grupo da siempre el mismo tablero, o la tier list cambiaria de orden
 * en cada recarga.
 *
 * BACKEND NOTE: muere entero con el fichero, el dia de los tres endpoints de la cabecera.
 */
interface MockStats {
  kills: number;
  deaths: number;
  assists: number;
  gold: number;
  /** Subditos. El agregador no lo lee (usa `csPerMin`), pero las partidas a medida lo traen. */
  cs?: number;
  damageTaken?: number;
  wardsPlaced?: number;
  wardsKilled?: number;
  spells?: number[];
  goldAt14: number;
  csAt14: number;
  csPerMin: number;
  visionScore: number;
  totalDamageToChampions: number;
  damageSharePercentage: number;
  wonLane: boolean;
  /** Ranuras de inventario. Objetos y no ids sueltos: el agregador lee `item.id`. */
  items: { id: number; name?: string; iconUrl?: string | null }[];
  primaryRuneId: number;
  primaryTreeId: number;
  primaryRuneIds: number[];
  secondaryRuneTreeId: number;
  secondaryRuneIds: number[];
  statShardIds: number[];
}

interface MockParticipant {
  id: string;
  championId: number;
  team: 'blue' | 'red';
  role: Lane;
  riotId: string;
  discordUsername: string | null;
  avatarUrl: string | null;
  stats: MockStats;
}

interface MockMatch {
  id: string;
  decidedAt: string;
  durationSeconds: number;
  winningTeam: 'blue' | 'red';
  blueTeam: { participants: MockParticipant[] };
  redTeam: { participants: MockParticipant[] };
  milestones: { firstBloodParticipantId: string; firstTowerTeam: 'blue' | 'red' };
}

const MOCK_LANES: readonly Lane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];
const MOCK_MATCHES_PER_GROUP = 60;
const MOCK_PLAYERS = 14;

/** Arboles, piedras angulares y fragmentos reales de LoL: no se inventan ids. */
const RUNE_TREES = [8000, 8100, 8200, 8300, 8400];
const KEYSTONES = [8005, 8010, 8112, 8124, 8214, 8229, 8351, 8437, 8439, 9923];
const SHARDS = [5005, 5008, 5011];

/** Un entero estable en [0, max) a partir de una semilla de texto. */
function pick(seed: string, max: number): number {
  return hash(seed) % max;
}

function mockStats(seed: string, won: boolean, durationMin: number): MockStats {
  const cs = 60 + pick(seed + ':cs', 180);
  return {
    kills: pick(seed + ':k', 14) + (won ? 2 : 0),
    deaths: pick(seed + ':d', 9) + (won ? 0 : 2),
    assists: pick(seed + ':a', 18),
    gold: 7000 + pick(seed + ':g', 9000),
    goldAt14: 3000 + pick(seed + ':g14', 3500),
    csAt14: 40 + pick(seed + ':cs14', 80),
    csPerMin: Math.round((cs / durationMin) * 10) / 10,
    visionScore: 10 + pick(seed + ':v', 50),
    totalDamageToChampions: 8000 + pick(seed + ':dmg', 28000),
    damageSharePercentage: 8 + pick(seed + ':share', 30),
    wonLane: pick(seed + ':lane', 100) < (won ? 58 : 42),
    items: [0, 1, 2, 3, 4, 5].map((i) => ({ id: 3000 + pick(seed + ':i' + i, 200) })),
    primaryRuneId: KEYSTONES[pick(seed + ':ks', KEYSTONES.length)],
    primaryTreeId: RUNE_TREES[pick(seed + ':pt', RUNE_TREES.length)],
    primaryRuneIds: [0, 1, 2].map((i) => 8100 + pick(seed + ':pr' + i, 60)),
    secondaryRuneTreeId: RUNE_TREES[pick(seed + ':st', RUNE_TREES.length)],
    secondaryRuneIds: [0, 1].map((i) => 8200 + pick(seed + ':sr' + i, 60)),
    statShardIds: [0, 1, 2].map((i) => SHARDS[pick(seed + ':sh' + i, SHARDS.length)]),
  };
}

const corpusCache = new Map<string, MockMatch[]>();

function mockCorpus(groupId: string | null): MockMatch[] {
  const key = groupId ?? '__all__';
  const cached = corpusCache.get(key);
  if (cached) return cached;

  const matches: MockMatch[] = [];
  for (let n = 0; n < MOCK_MATCHES_PER_GROUP; n++) {
    const id = key + ':m' + n;
    const durationSeconds = 1500 + pick(id + ':dur', 1500);
    const durationMin = Math.max(1, Math.round(durationSeconds / 60));
    const winningTeam: 'blue' | 'red' = pick(id + ':w', 2) === 0 ? 'blue' : 'red';

    const seatOf = (team: 'blue' | 'red', lane: Lane, i: number): MockParticipant => {
      const seed = id + ':' + team + ':' + lane;
      const player = pick(seed + ':p', MOCK_PLAYERS);
      return {
        id: id + ':' + team + ':' + i,
        championId: REAL_CHAMPION_IDS[pick(seed + ':c', REAL_CHAMPION_IDS.length)],
        team,
        role: lane,
        riotId: 'Jugador' + player + '#EUW',
        discordUsername: 'jugador' + player,
        avatarUrl: null,
        stats: mockStats(seed, team === winningTeam, durationMin),
      };
    };

    matches.push({
      id,
      decidedAt: new Date(Date.UTC(2026, 0, 1) + n * 86400000).toISOString(),
      durationSeconds,
      winningTeam,
      blueTeam: { participants: MOCK_LANES.map((lane, i) => seatOf('blue', lane, i)) },
      redTeam: { participants: MOCK_LANES.map((lane, i) => seatOf('red', lane, i)) },
      milestones: {
        firstBloodParticipantId: id + ':' + winningTeam + ':' + pick(id + ':fb', 5),
        firstTowerTeam: pick(id + ':ft', 2) === 0 ? 'blue' : 'red',
      },
    });
  }

  corpusCache.set(key, matches);
  return matches;
}

/**
 * Una partida del corpus, a medida, para los tests.
 *
 * Las agregaciones de este fichero son la UNICA parte del frontend que calcula metagame, asi que
 * se prueban contra partidas elegidas a mano y no contra el corpus generado: un winrate del 67%
 * solo demuestra algo si eres tu quien ha puesto las tres partidas.
 */
export function mockMatchFixture(init: {
  id: string;
  /** Por defecto gana el azul: la mayoria de los tests solo quieren un ganador cualquiera. */
  winningTeam?: 'blue' | 'red';
  blue?: MockParticipant[];
  red?: MockParticipant[];
  decidedAt?: string;
  durationSeconds?: number;
}): MockMatch {
  const winningTeam = init.winningTeam ?? 'blue';
  return {
    id: init.id,
    decidedAt: init.decidedAt ?? '2026-09-01T10:00:00Z',
    durationSeconds: init.durationSeconds ?? 1800,
    winningTeam,
    blueTeam: { participants: init.blue ?? [] },
    redTeam: { participants: init.red ?? [] },
    milestones: { firstBloodParticipantId: '', firstTowerTeam: winningTeam },
  };
}

/** Un asiento del corpus, a medida. Lo que no se diga toma un valor neutro. */
export function mockParticipantFixture(
  init: Omit<Partial<MockParticipant>, 'stats'> & {
    id: string;
    team: 'blue' | 'red';
    /** Solo lo que el test quiera fijar; el resto va a un valor neutro. */
    stats?: Partial<MockStats>;
  },
): MockParticipant {
  const { stats, ...rest } = init;
  return {
    championId: 103,
    role: 'MID',
    riotId: 'Jugador#EUW',
    discordUsername: null,
    avatarUrl: null,
    ...rest,
    stats: {
      kills: 0,
      deaths: 0,
      assists: 0,
      gold: 0,
      goldAt14: 0,
      csAt14: 0,
      csPerMin: 0,
      visionScore: 0,
      totalDamageToChampions: 0,
      damageSharePercentage: 0,
      wonLane: false,
      items: [],
      primaryRuneId: 8010,
      primaryTreeId: 8000,
      primaryRuneIds: [],
      secondaryRuneTreeId: 8300,
      secondaryRuneIds: [],
      statShardIds: [],
      ...(stats ?? {}),
    },
  };
}

export class ChampionStatsMockSource implements ChampionStatsSource {
  /**
   * Corpus a medida, o `null` para el generado. Existe para los tests y solo para ellos: es lo
   * que permite afirmar "tres partidas, dos ganadas, 67%" sobre partidas que alguien ha puesto
   * a mano. En la app nadie lo llama y la fuente se queda con `mockCorpus`.
   */
  private corpus: readonly MockMatch[] | null = null;

  useCorpus(matches: readonly MockMatch[]): void {
    this.corpus = matches;
  }

  private getMatches(groupId: string | null): readonly MockMatch[] {
    if (this.corpus) return this.corpus;
    // Todas las del corpus traen telemetria por construccion. El filtro por `hasStats` que habia
    // aqui descartaba las partidas registradas a mano del historial REAL, y el historial real ya
    // no es de donde sale esto.
    return mockCorpus(groupId);
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
      const participants: MockParticipant[] = [
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

/**
 * Instala la fuente suplente en el store de estadisticas de campeones.
 *
 * Aqui habia un `effect` que miraba `matchHistory.allMatches()` y invalidaba la cache del store
 * cada vez que la semilla cambiaba. Se ha ido con la semilla: el corpus de este fichero es
 * constante durante toda la sesion, asi que no hay nada que observar y una invalidacion
 * periodica solo tiraria trabajo ya hecho.
 */
export function installChampionStatsMock(injector: EnvironmentInjector): void {
  injector.get(ChampionStatsStore).useSource(new ChampionStatsMockSource());
}
