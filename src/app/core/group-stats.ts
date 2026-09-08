/**
 * Maqueta determinista de la vista de Estadísticas del grupo (`Roadmap.md` §5.5.5).
 *
 * Todo se siembra con el id del grupo + el alcance activo (sesión / temporada /
 * histórico), así que un grupo siempre pinta las mismas cifras hasta que llegue el
 * backend. Hay una única pasada de estadísticas por miembro (`statsFor`) y de ella
 * se proyecta todo lo demás, para que la pantalla no cuente dos verdades distintas:
 *   - mapTelemetryFor()  → balance de bandos e impacto de objetivos
 *   - metagameFor()      → campeones más jugados, baneados y de mayor winrate
 *   - epicRecordsFor()   → los tres récords históricos, con enlace a su partida
 *   - playerTiles()      → el desglose de la fila expandible de cada jugador
 * Las medallas del Hall of Fame viven aparte, en `core/group-medals.ts`.
 *
 * BACKEND NOTE: fichero PLACEHOLDER. Al existir los endpoints de estadísticas
 * agregadas del grupo se borra entero; los tipos de esta hoja son la forma que
 * tendrán los DTO, así que la vista no tendrá que cambiar.
 */
import { Member, REAL_CHAMPION_IDS } from './lobby';
import { hash, seeded } from './group-ranking';
import { SEEDED_MATCH_COUNT, seedMatchId } from './seed-matches';

/** Ventana temporal a la que se escala cada widget. */
export type StatScope = 'temporada' | 'historico';

/**
 * §5.5.5 fija la nomenclatura temporal para las estadísticas.
 */
export const SCOPE_OPTIONS: { id: StatScope; label: string }[] = [
  { id: 'temporada', label: 'Temporada actual' },
  { id: 'historico', label: 'Histórico total' },
];

/** Banda aproximada de partidas por alcance, para que los totales cuadren en cada zoom. */
const SCOPE_GAMES: Record<StatScope, [number, number]> = {
  temporada: [18, 44],
  historico: [70, 160],
};

export type StatModality = 'COMPETITIVE' | 'BALANCED' | 'CHAOS';

export interface GroupModalitySeason {
  id: string;
  label: string;
  played: boolean;
}

export interface GroupModalityConfig {
  modality: StatModality;
  label: string;
  played: boolean;
  seasons: GroupModalitySeason[];
}

/** Configuración determinista de modalidades y temporadas disputadas para un grupo. */
export function groupModalitiesConfig(groupId: string): GroupModalityConfig[] {
  const rnd = seeded(hash(groupId + ':modalities:v2'));
  const compHas2024 = rnd() > 0.4;
  const balHas2025 = rnd() > 0.3;
  const chaosPlayed = rnd() > 0.25;

  return [
    {
      modality: 'COMPETITIVE',
      label: 'Competitivo',
      played: true,
      seasons: [
        { id: 'current', label: 'Temporada 2026', played: true },
        { id: 'past-2025', label: 'Temporada 2025', played: true },
        { id: 'past-2024', label: 'Temporada 2024', played: compHas2024 },
      ],
    },
    {
      modality: 'BALANCED',
      label: 'Equilibrado',
      played: true,
      seasons: [
        { id: 'current', label: 'Temporada 2026', played: true },
        { id: 'past-2025', label: 'Temporada 2025', played: balHas2025 },
        { id: 'past-2024', label: 'Temporada 2024', played: false },
      ],
    },
    {
      modality: 'CHAOS',
      label: 'Caos',
      played: chaosPlayed,
      seasons: [
        { id: 'current', label: 'Temporada 2026', played: chaosPlayed },
        { id: 'past-2025', label: 'Temporada 2025', played: false },
        { id: 'past-2024', label: 'Temporada 2024', played: false },
      ],
    },
  ];
}

export interface MemberAffinity {
  name: string;
  tag: string;
  avatar: string | null;
  hue: number;
  winrate: number;
  games: number;
}

/** Per-member aggregate stats for one scope. The single source of truth. */
export interface MemberStats {
  member: Member;
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  /** Average kills / deaths / assists per game. */
  kills: number;
  deaths: number;
  assists: number;
  /** (kills + assists) / deaths, one decimal. */
  kda: number;
  csPerMin: number;
  goldPerMin: number;
  /** Average damage to champions per game, in thousands. */
  dmgK: number;
  visionScore: number;
  wardsPlaced: number;
  /** Average crowd-control time applied, in seconds. */
  ccTime: number;
  doubles: number;
  triples: number;
  quadras: number;
  pentas: number;
  bestDuo: MemberAffinity;
  nemesis: MemberAffinity;
  /**
   * This member's unofficial "main". BACKEND NOTE: id real de ddragon elegido
   * de `REAL_CHAMPION_IDS` (ver `core/lobby.ts`) mientras no exista el
   * endpoint de estadísticas; la vista resuelve `id → ChampionSummary` con
   * `GameDataStore.championById()`.
   */
  mainChampionId: number;
  mainChampWr: number;
  /** Longest current win streak within the scope. */
  streak: number;
  /** Recent form points for the trend sparkline. */
  spark: number[];
  trend: 'up' | 'down';
  /** Composite performance index (0-100) used to pick the MVP. */
  rating: number;

  /* ---- Métricas del Hall of Fame (§5.5.5) ----
     Se sortean al final de la pasada, después de todo lo anterior, para que
     añadirlas no mueva ni una cifra de las que ya se venían pintando. */

  /** Estructuras enemigas derribadas en el alcance. */
  towers: number;
  /** Dragones asegurados por su equipo con él en partida. */
  dragons: number;
  /** Barones asegurados. */
  barons: number;
  /** Objetivos épicos robados con el Smite. */
  steals: number;
  /** Primeras sangres firmadas. */
  firstBloods: number;
  /** Partidas terminadas sin morir ni una vez. */
  deathlessGames: number;
  /** Veces que se llevó el MVP de la partida. */
  mvps: number;
  /** Daño mitigado por partida, en miles. */
  mitigatedK: number;
  /** Curación y escudo repartidos a aliados por partida, en miles. */
  healShieldK: number;
  /** Daño recibido por partida, en miles. */
  damageTakenK: number;
  /** Racha de victorias más larga del alcance (`streak` es la vigente). */
  bestStreak: number;
  /** Peor racha de derrotas del alcance. */
  worstStreak: number;
  /** Posición media en el ranking del grupo en este alcance (1 a N). */
  avgRank: number;
}

/** Pick a stable item from `arr` for `seed`. */
function pick<T>(rnd: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Build the per-member base stats for a group at a given scope. */
export function statsFor(groupId: string, roster: readonly Member[], scope: StatScope): MemberStats[] {
  const [lo, hi] = SCOPE_GAMES[scope];

  return roster.map((member) => {
    const rnd = seeded(hash(member.tag + '::' + scope + '::' + groupId));

    const games = lo + Math.floor(rnd() * (hi - lo + 1));
    const wr = 0.32 + rnd() * 0.46;
    const wins = Math.round(games * wr);
    const losses = Math.max(0, games - wins);

    const kills = +(2 + rnd() * 9).toFixed(1);
    const deaths = +(2 + rnd() * 6).toFixed(1);
    const assists = +(4 + rnd() * 12).toFixed(1);
    const kda = +((kills + assists) / Math.max(1, deaths)).toFixed(1);

    const csPerMin = +(4 + rnd() * 5).toFixed(1);
    const goldPerMin = Math.round(280 + rnd() * 220);
    const dmgK = +(8 + rnd() * 28).toFixed(1);
    const visionScore = Math.round(12 + rnd() * 58);
    const wardsPlaced = Math.round(8 + rnd() * 60);
    const ccTime = Math.round(6 + rnd() * 54);

    // Multikills scale with game volume; pentas stay rare.
    const doubles = Math.round(games * (0.4 + rnd() * 1.1));
    const triples = Math.round(games * (0.05 + rnd() * 0.3));
    const quadras = Math.floor(rnd() * Math.max(1, games * 0.12));
    const pentas = rnd() < 0.35 ? Math.floor(rnd() * Math.max(1, games * 0.04)) : 0;

    const mainChampionId = pick(rnd, REAL_CHAMPION_IDS);
    const mainChampWr = Math.round(45 + rnd() * 45);

    const streak = Math.floor(rnd() * Math.min(8, wins + 1));

    // Walk a short form history ending near the win-rate, like the ranking spark.
    const base = Math.round(wr * 100);
    const spark: number[] = [];
    let v = base - 18 + Math.floor(rnd() * 36);
    for (let s = 0; s < 8; s++) {
      v += Math.floor((rnd() - 0.45) * 26);
      spark.push(v);
    }
    spark[spark.length - 1] = base;

    // Composite rating: win-rate, KDA and damage all contribute.
    const rating = Math.round(
      Math.min(100, wr * 55 + Math.min(kda, 6) * 5 + Math.min(dmgK, 40) * 0.45),
    );

    // Métricas del Hall of Fame. Van al final del flujo aleatorio a propósito:
    // así todas las cifras anteriores siguen valiendo exactamente lo que valían.
    const towers = Math.round(games * (0.8 + rnd() * 2.2));
    const dragons = Math.round(games * (0.3 + rnd() * 0.9));
    const barons = Math.round(games * (0.1 + rnd() * 0.45));
    const steals = Math.floor(rnd() * Math.max(1, games * 0.15));
    const firstBloods = Math.floor(rnd() * Math.max(1, games * 0.28));
    const deathlessGames = Math.floor(rnd() * Math.max(1, games * 0.18));
    const mvps = Math.floor(rnd() * Math.max(1, wins * 0.4));
    const mitigatedK = +(6 + rnd() * 26).toFixed(1);
    const healShieldK = +(1 + rnd() * 14).toFixed(1);
    const damageTakenK = +(14 + rnd() * 26).toFixed(1);
    const bestStreak = streak + Math.floor(rnd() * 4);
    const worstStreak = Math.max(1, Math.floor(rnd() * Math.min(6, losses + 1)));
    const avgRank = +(1 + (1 - rating / 100) * (roster.length - 1)).toFixed(1);

    const others = roster.filter((m) => m.tag !== member.tag);
    let bestDuo: MemberAffinity;
    let nemesis: MemberAffinity;

    if (others.length > 0) {
      const duoIdx = Math.floor(rnd() * others.length);
      const duoMember = others[duoIdx];
      const duoGames = Math.max(4, Math.round(games * (0.35 + rnd() * 0.3)));
      const duoWr = Math.round(68 + rnd() * 24);
      bestDuo = {
        name: duoMember.name,
        tag: duoMember.tag,
        avatar: duoMember.avatar ?? null,
        hue: duoMember.hue,
        winrate: duoWr,
        games: duoGames,
      };

      let nemIdx = Math.floor(rnd() * (others.length - (others.length > 1 ? 1 : 0)));
      if (others.length > 1 && nemIdx >= duoIdx) {
        nemIdx = (nemIdx + 1) % others.length;
      }
      const nemMember = others[nemIdx];
      const nemGames = Math.max(4, Math.round(games * (0.3 + rnd() * 0.3)));
      const nemWr = Math.round(18 + rnd() * 24);
      nemesis = {
        name: nemMember.name,
        tag: nemMember.tag,
        avatar: nemMember.avatar ?? null,
        hue: nemMember.hue,
        winrate: nemWr,
        games: nemGames,
      };
    } else {
      bestDuo = { name: member.name, tag: member.tag, avatar: member.avatar ?? null, hue: member.hue, winrate: 50, games: 0 };
      nemesis = { name: member.name, tag: member.tag, avatar: member.avatar ?? null, hue: member.hue, winrate: 50, games: 0 };
    }

    return {
      member,
      games,
      wins,
      losses,
      wr: Math.round(wr * 100),
      kills,
      deaths,
      assists,
      kda,
      csPerMin,
      goldPerMin,
      dmgK,
      visionScore,
      wardsPlaced,
      ccTime,
      doubles,
      triples,
      quadras,
      pentas,
      bestDuo,
      nemesis,
      mainChampionId,
      mainChampWr,
      streak,
      spark,
      trend: spark[spark.length - 1] >= spark[0] ? ('up' as const) : ('down' as const),
      rating,
      towers,
      dragons,
      barons,
      steals,
      firstBloods,
      deathlessGames,
      mvps,
      mitigatedK,
      healShieldK,
      damageTakenK,
      bestStreak,
      worstStreak,
      avgRank,
    };
  });
}

// ===================== Telemetría de mapa =====================

export type ObjectiveId = 'dragon' | 'grubs' | 'herald' | 'baron' | 'tower';

/** Cuánto pesa quedarse un objetivo en la victoria del grupo. */
export interface ObjectiveImpact {
  id: ObjectiveId;
  label: string;
  /** Porcentaje de victorias en las partidas en las que el grupo se lo llevó. */
  winrate: number;
  wins: number;
  games: number;
  /** El winrate dicho en una palabra, para no obligar a interpretar el número. */
  impact: 'Decisivo' | 'Alto' | 'Medio';
  /** Ruta al icono o imagen del objetivo. */
  iconUrl: string;
}

/** Reparto de victorias entre los dos lados del mapa. */
export interface SideBalance {
  games: number;
  blueWins: number;
  redWins: number;
  bluePct: number;
  redPct: number;
}

/** Métricas de ritmo, duración e intensidad de las partidas del grupo. */
export interface PacingStats {
  averageDuration: string;
  killsPerMinute: number;
  totalKillsPerGame: number;
  firstBloodWinrate: number;
}

export interface MapTelemetry {
  side: SideBalance;
  pacing: PacingStats;
  objectives: ObjectiveImpact[];
}

/** Dúo de Oro: la pareja con mayor química competitiva en el mismo equipo. */
export interface GoldenDuo {
  player1: { name: string; tag: string; avatar?: string | null; hue: number };
  player2: { name: string; tag: string; avatar?: string | null; hue: number };
  winrate: number;
  games: number;
  wins: number;
  losses: number;
}

const OBJECTIVE_LABELS: Record<ObjectiveId, string> = {
  dragon: 'Primer dragón',
  grubs: 'Larvas del vacío',
  herald: 'Heraldo de la grieta',
  baron: 'Primer barón',
  tower: 'Primera torre',
};

const OBJECTIVE_ICONS: Record<ObjectiveId, string> = {
  dragon: '/assets/objectives/dragon.png',
  grubs: '/assets/objectives/grubs.png',
  herald: '/assets/objectives/herald.png',
  baron: '/assets/objectives/baron.png',
  tower: '/assets/objectives/tower.png',
};

const OBJECTIVE_ORDER: ObjectiveId[] = ['dragon', 'grubs', 'herald', 'baron', 'tower'];

function impactOf(winrate: number): ObjectiveImpact['impact'] {
  if (winrate >= 82) return 'Decisivo';
  if (winrate >= 70) return 'Alto';
  return 'Medio';
}

/**
 * Partidas que ha jugado el grupo en el alcance. Las partidas son compartidas —los
 * diez juegan la misma—, así que el total es la media de las de cada miembro y no
 * la suma, que contaría cada partida diez veces.
 */
function groupGamesOf(stats: readonly MemberStats[]): number {
  if (!stats.length) return 0;
  return Math.round(stats.reduce((total, s) => total + s.games, 0) / stats.length);
}

/** Balance de bandos e impacto de los objetivos (§5.5.5, bloque 1). */
export function mapTelemetryFor(
  groupId: string,
  stats: readonly MemberStats[],
  scope: StatScope,
): MapTelemetry | null {
  if (!stats.length) return null;

  const games = groupGamesOf(stats);
  if (!games) return null;

  const rnd = seeded(hash(groupId + ':telemetria:' + scope));

  // El bando azul gana algo más que el rojo, como en la grieta de verdad.
  const bluePct = Math.round(46 + rnd() * 12);
  const blueWins = Math.round((games * bluePct) / 100);

  const objectives = OBJECTIVE_ORDER.map((id) => {
    const objectiveGames = Math.max(1, Math.round(games * (0.45 + rnd() * 0.35)));
    const winrate = Math.round(58 + rnd() * 34);
    return {
      id,
      label: OBJECTIVE_LABELS[id],
      winrate,
      wins: Math.round((objectiveGames * winrate) / 100),
      games: objectiveGames,
      impact: impactOf(winrate),
      iconUrl: OBJECTIVE_ICONS[id],
    };
  });

  // Métricas de ritmo, duración e intensidad
  const avgMin = Math.floor(27 + rnd() * 6);
  const avgSec = Math.floor(rnd() * 60);
  const averageDuration = `${avgMin}:${avgSec.toString().padStart(2, '0')}`;
  const totalDurationMin = avgMin + avgSec / 60;
  const killsPerMinute = Math.round((1.8 + rnd() * 0.6) * 10) / 10;
  const totalKillsPerGame = Math.round(totalDurationMin * killsPerMinute);
  const firstBloodWinrate = Math.round(63 + rnd() * 11);

  const pacing: PacingStats = {
    averageDuration,
    killsPerMinute,
    totalKillsPerGame,
    firstBloodWinrate,
  };

  return {
    side: {
      games,
      blueWins,
      redWins: games - blueWins,
      bluePct,
      redPct: 100 - bluePct,
    },
    pacing,
    objectives,
  };
}

/** Determina la pareja con mayor sinergia y porcentaje de victorias jugando juntos. */
export function goldenDuoFor(
  groupId: string,
  roster: readonly Member[],
  stats: readonly MemberStats[],
): GoldenDuo | null {
  if (roster.length < 2) return null;

  const rnd = seeded(hash(groupId + ':golden-duo'));
  const p1Idx = Math.floor(rnd() * roster.length);
  let p2Idx = Math.floor(rnd() * (roster.length - 1));
  if (p2Idx >= p1Idx) p2Idx++;

  const m1 = roster[p1Idx];
  const m2 = roster[p2Idx];

  const games = Math.max(8, Math.round(12 + rnd() * 14));
  const winrate = Math.round(74 + rnd() * 15);
  const wins = Math.round((games * winrate) / 100);
  const losses = games - wins;

  return {
    player1: { name: m1.name, tag: m1.tag, avatar: m1.avatar ?? null, hue: m1.hue },
    player2: { name: m2.name, tag: m2.tag, avatar: m2.avatar ?? null, hue: m2.hue },
    winrate,
    games,
    wins,
    losses,
  };
}

/** Determina la pareja con menor sinergia («Dúo de madera») jugando juntos. */
export function woodenDuoFor(
  groupId: string,
  roster: readonly Member[],
  stats: readonly MemberStats[],
): GoldenDuo | null {
  if (roster.length < 2) return null;

  const rnd = seeded(hash(groupId + ':wooden-duo'));
  const p1Idx = Math.floor(rnd() * roster.length);
  let p2Idx = Math.floor(rnd() * (roster.length - 1));
  if (p2Idx >= p1Idx) p2Idx++;

  const m1 = roster[p1Idx];
  const m2 = roster[p2Idx];

  const games = Math.max(7, Math.round(9 + rnd() * 11));
  const winrate = Math.round(18 + rnd() * 14);
  const wins = Math.round((games * winrate) / 100);
  const losses = games - wins;

  return {
    player1: { name: m1.name, tag: m1.tag, avatar: m1.avatar ?? null, hue: m1.hue },
    player2: { name: m2.name, tag: m2.tag, avatar: m2.avatar ?? null, hue: m2.hue },
    winrate,
    games,
    wins,
    losses,
  };
}

// ===================== Metagame =====================

export type MetagameBoardId = 'picks' | 'bans' | 'winrate' | 'worst-winrate';

export interface MetagameEntry {
  /**
   * Id real de ddragon. La vista lo resuelve a nombre e icono con
   * `GameDataStore.championById()`: aquí no se conoce el catálogo.
   */
  championId: number;
  /** Cifra principal ya formateada, p. ej. «16 partidas». */
  value: string;
  /** Cifra de apoyo, p. ej. «68% de victorias». */
  sub: string;
}

export interface MetagameBoard {
  id: MetagameBoardId;
  title: string;
  note: string;
  entries: MetagameEntry[];
}

/** Toma `count` campeones distintos del catálogo corto, de forma estable. */
function pickChampions(rnd: () => number, count: number): number[] {
  const pool = [...REAL_CHAMPION_IDS];
  const out: number[] = [];
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

/** Los tableros del metagame del grupo (§5.5.5, bloque 2). */
export function metagameFor(groupId: string, stats: readonly MemberStats[]): MetagameBoard[] {
  if (!stats.length) return [];

  const games = groupGamesOf(stats);
  const rnd = seeded(hash(groupId + ':metagame'));

  const picks = pickChampions(rnd, 3).map((championId, i) => {
    const played = Math.max(2, Math.round(games * (0.42 - i * 0.08) + rnd() * 3));
    return {
      championId,
      value: played + (played === 1 ? ' partida' : ' partidas'),
      sub: Math.round(42 + rnd() * 34) + '% de victorias',
    };
  });

  const bans = pickChampions(rnd, 3).map((championId, i) => {
    const banned = Math.max(2, Math.round(games * (0.46 - i * 0.09) + rnd() * 3));
    return {
      championId,
      value: banned + (banned === 1 ? ' ban' : ' bans'),
      sub: Math.round(38 + rnd() * 28) + '% de victorias',
    };
  });

  // Ordenado de mayor a menor: el tablero promete un ranking.
  const winrates = pickChampions(rnd, 3)
    .map((championId) => ({
      championId,
      played: 5 + Math.floor(rnd() * 9),
      wr: Math.round(62 + rnd() * 26),
    }))
    .sort((a, b) => b.wr - a.wr)
    .map((c) => ({
      championId: c.championId,
      value: c.wr + '% de victorias',
      sub: c.played + ' partidas',
    }));

  // Ordenado de menor a mayor: los picks trampa con menor winrate.
  const worstWinrates = pickChampions(rnd, 3)
    .map((championId) => ({
      championId,
      played: 4 + Math.floor(rnd() * 7),
      wr: Math.round(18 + rnd() * 22),
    }))
    .sort((a, b) => a.wr - b.wr)
    .map((c) => ({
      championId: c.championId,
      value: c.wr + '% de victorias',
      sub: c.played + ' partidas',
    }));

  return [
    {
      id: 'picks',
      title: 'Más jugados',
      note: 'Los que aparecen siempre',
      entries: picks,
    },
    {
      id: 'bans',
      title: 'Baneados',
      note: 'No se les permite aparecer',
      entries: bans,
    },
    {
      id: 'winrate',
      title: 'Mayor winrate',
      note: 'Solo campeones con cinco partidas o más.',
      entries: winrates,
    },
    {
      id: 'worst-winrate',
      title: 'Menor winrate',
      note: 'Picks trampa con cuatro partidas o más.',
      entries: worstWinrates,
    },
  ];
}

// ===================== Multikills del grupo =====================

export interface GroupMultikills {
  pentas: number;
  quadras: number;
  triples: number;
  topPentaHunter?: { name: string; tag: string; count: number };
  topQuadraHunter?: { name: string; tag: string; count: number };
}

export function multikillsFor(stats: readonly MemberStats[]): GroupMultikills {
  if (!stats.length) {
    return { pentas: 0, quadras: 0, triples: 0 };
  }
  const pentas = stats.reduce((sum, s) => sum + s.pentas, 0);
  const quadras = stats.reduce((sum, s) => sum + s.quadras, 0);
  const triples = stats.reduce((sum, s) => sum + s.triples, 0);

  const pentaLeaders = [...stats].filter((s) => s.pentas > 0).sort((a, b) => b.pentas - a.pentas);
  const quadraLeaders = [...stats].filter((s) => s.quadras > 0).sort((a, b) => b.quadras - a.quadras);

  return {
    pentas,
    quadras,
    triples,
    topPentaHunter: pentaLeaders[0]
      ? { name: pentaLeaders[0].member.name, tag: pentaLeaders[0].member.tag, count: pentaLeaders[0].pentas }
      : undefined,
    topQuadraHunter: quadraLeaders[0]
      ? { name: quadraLeaders[0].member.name, tag: quadraLeaders[0].member.tag, count: quadraLeaders[0].quadras }
      : undefined,
  };
}

// ===================== Guerra de visión =====================

export interface GroupVision {
  wardsPlaced: number;
  wardsCleared: number;
  visionPerMin: number;
  topVisionary?: { name: string; tag: string; score: number };
}

export function groupVisionFor(groupId: string, stats: readonly MemberStats[]): GroupVision {
  if (!stats.length) {
    return { wardsPlaced: 0, wardsCleared: 0, visionPerMin: 0 };
  }
  const rnd = seeded(hash(groupId + ':vision-stats'));
  const wardsPlaced = stats.reduce((acc, s) => acc + s.wardsPlaced * Math.max(1, Math.round(s.games * 0.9)), 0);
  const wardsCleared = Math.round(wardsPlaced * (0.28 + rnd() * 0.1));
  const avgVision = stats.reduce((acc, s) => acc + s.visionScore, 0) / stats.length;
  const visionPerMin = +(avgVision / 12).toFixed(1);

  const visionaryLeader = [...stats].sort((a, b) => b.visionScore - a.visionScore)[0];

  return {
    wardsPlaced,
    wardsCleared,
    visionPerMin,
    topVisionary: visionaryLeader
      ? { name: visionaryLeader.member.name, tag: visionaryLeader.member.tag, score: visionaryLeader.visionScore }
      : undefined,
  };
}

// ===================== Impacto por líneas =====================

export type LaneRole = 'TOP' | 'JUNGLA' | 'MID' | 'ADC' | 'SUPPORT';

export interface LaneImpact {
  lane: LaneRole;
  label: string;
  winrate: number;
  impactOrder: number;
  description: string;
}

export function laneImpactFor(groupId: string, scope: StatScope): LaneImpact[] {
  const rnd = seeded(hash(groupId + ':lane-impact:' + scope));
  const laneConfigs: { lane: LaneRole; label: string; base: number; desc: string }[] = [
    { lane: 'MID', label: 'Mid', base: 74, desc: 'Control de mapa y rotaciones' },
    { lane: 'JUNGLA', label: 'Jungla', base: 72, desc: 'Presión en objetivos y ganks' },
    { lane: 'ADC', label: 'Bot (ADC)', base: 69, desc: 'Poder de fuego en peleas de equipo' },
    { lane: 'TOP', label: 'Top', base: 66, desc: 'Presión dividida e iniciación' },
    { lane: 'SUPPORT', label: 'Soporte', base: 63, desc: 'Visión y protección aliada' },
  ];

  return laneConfigs
    .map((item) => {
      const winrate = Math.min(88, Math.max(54, Math.round(item.base + (rnd() - 0.5) * 14)));
      return {
        lane: item.lane,
        label: item.label,
        winrate,
        description: item.desc,
      };
    })
    .sort((a, b) => b.winrate - a.winrate)
    .map((item, index) => ({
      ...item,
      impactOrder: index + 1,
    }));
}

// ===================== Récords históricos =====================

export type EpicRecordIcon =
  | 'blood'
  | 'damage'
  | 'marathon'
  | 'comeback'
  | 'speedrun'
  | 'monsters'
  | 'kills'
  | 'gold'
  | 'tank';

export interface EpicRecord {
  id: string;
  icon: EpicRecordIcon;
  title: string;
  /** La cifra del récord, ya formateada. */
  value: string;
  /** Quién o qué lo firmó. */
  detail: string;
  /** Partida de la semilla a la que enlaza la tarjeta. */
  matchId: string;
  matchLabel: string;
}

/**
 * Los récords históricos de máxima dificultad (§5.5.5, bloque 3). A diferencia de la trivia
 * del hub, estos sí llevan `matchId`: la tarjeta promete «ver partida» y tiene que
 * aterrizar en una que exista.
 */
export function epicRecordsFor(groupId: string, stats: readonly MemberStats[]): EpicRecord[] {
  if (!stats.length) return [];

  const rnd = seeded(hash(groupId + ':records'));
  const matchOf = () => {
    const n = 1 + Math.floor(rnd() * SEEDED_MATCH_COUNT);
    return { matchId: seedMatchId(n), matchLabel: 'Partida ' + n };
  };

  const topDamage = [...stats].sort((a, b) => b.dmgK - a.dmgK)[0];
  const topKills = [...stats].sort((a, b) => b.kills - a.kills)[0];
  const topGold = [...stats].sort((a, b) => b.goldPerMin - a.goldPerMin)[0];
  const topTank = [...stats].sort((a, b) => b.mitigatedK - a.mitigatedK)[0];

  const bloodiest = matchOf();
  const hardest = matchOf();
  const longest = matchOf();
  const comebackMatch = matchOf();
  const speedrunMatch = matchOf();
  const monstersMatch = matchOf();
  const killsMatch = matchOf();
  const goldMatch = matchOf();
  const tankMatch = matchOf();

  return [
    // Lote 1
    {
      id: 'bloodiest',
      icon: 'blood',
      title: 'Partida más sangrienta',
      value: 62 + Math.floor(rnd() * 34) + ' asesinatos',
      detail: 30 + Math.floor(rnd() * 12) + ' minutos de pelea sin descanso',
      ...bloodiest,
    },
    {
      id: 'top-damage',
      icon: 'damage',
      title: 'Mayor daño individual',
      value: Math.round(topDamage.dmgK * 1000 + rnd() * 12000).toLocaleString('es-ES') + ' de daño',
      detail: topDamage.member.name + ' lo firmó en una sola partida',
      ...hardest,
    },
    {
      id: 'marathon',
      icon: 'marathon',
      title: 'Maratón de resistencia',
      value: 44 + Math.floor(rnd() * 12) + ' min ' + Math.floor(rnd() * 60) + ' s',
      detail: 'La partida más larga que ha jugado el grupo',
      ...longest,
    },
    // Lote 2
    {
      id: 'comeback',
      icon: 'comeback',
      title: 'La gran remontada',
      value: (10000 + Math.floor(rnd() * 5500)).toLocaleString('es-ES') + ' oro remontado',
      detail: 'Victoria tras perder los 3 inhibidores en base',
      ...comebackMatch,
    },
    {
      id: 'speedrun',
      icon: 'speedrun',
      title: 'Victoria relámpago',
      value: 15 + Math.floor(rnd() * 4) + ' min ' + Math.floor(rnd() * 50) + ' s',
      detail: 'Rendición rival tras asedio perfecto',
      ...speedrunMatch,
    },
    {
      id: 'monsters',
      icon: 'monsters',
      title: 'Guerra de monstruos',
      value: 7 + Math.floor(rnd() * 3) + ' objetivos épicos',
      detail: '5 dragones y 3 barones disputados en la grieta',
      ...monstersMatch,
    },
    // Lote 3
    {
      id: 'kills',
      icon: 'kills',
      title: 'Mayor masacre',
      value: Math.max(18, Math.round(topKills.kills * 2.2 + rnd() * 6)) + ' asesinatos',
      detail: topKills.member.name + ' en una exhibición legendaria',
      ...killsMatch,
    },
    {
      id: 'gold',
      icon: 'gold',
      title: 'Fortuna de Midas',
      value: (19500 + Math.floor(rnd() * 6000)).toLocaleString('es-ES') + ' de oro',
      detail: topGold.member.name + ' con ritmo de ' + topGold.goldPerMin + ' oro/min',
      ...goldMatch,
    },
    {
      id: 'tank',
      icon: 'tank',
      title: 'Bastión infranqueable',
      value: Math.round(topTank.mitigatedK * 1000 + rnd() * 25000).toLocaleString('es-ES') + ' mitigado',
      detail: topTank.member.name + ' absorbió el asedio enemigo',
      ...tankMatch,
    },
  ];
}

// ===================== PREMIOS (trophy wall) =====================

export type AwardColor = 'primary' | 'secondary' | 'warning' | 'success' | 'tertiary' | 'danger';

export interface StatAward {
  id: string;
  glyph: string;
  title: string;
  color: AwardColor;
  member: Member;
  /** The number that justifies the award. */
  value: string;
  blurb: string;
}

/** Return the member that maximizes `score`. */
function leaderBy(stats: readonly MemberStats[], score: (s: MemberStats) => number): MemberStats {
  return [...stats].sort((a, b) => score(b) - score(a))[0];
}


// ===================== JUGADORES (per-member tiles) =====================

/** Tinte de una cifra destacada. Se nombra por lo que significa, nunca por el color. */
export type StatAccent = 'secondary' | 'primary' | 'warning';

export type PlayerTileIcon =
  | 'games'
  | 'winrate'
  | 'kda'
  | 'kda-split'
  | 'cs'
  | 'gold'
  | 'damage'
  | 'vision'
  | 'penta'
  | 'streak'
  | 'ranking';

export interface PlayerTile {
  label: string;
  value: string;
  accent?: StatAccent;
  icon?: PlayerTileIcon;
}

/** The stat tiles shown in a player's expanded JUGADORES panel. */
export function playerTiles(s: MemberStats): PlayerTile[] {
  return [
    { label: 'Partidas', value: `${s.games}`, accent: 'secondary', icon: 'games' },
    { label: 'Win rate', value: `${s.wr}%`, accent: 'primary', icon: 'winrate' },
    { label: 'KDA', value: `${s.kda}`, accent: 'secondary', icon: 'kda' },
    { label: 'K / D / A', value: `${s.kills} / ${s.deaths} / ${s.assists}`, icon: 'kda-split' },
    { label: 'CS/min', value: `${s.csPerMin}`, icon: 'cs' },
    { label: 'Oro/min', value: `${s.goldPerMin}`, icon: 'gold' },
    { label: 'Daño/part.', value: `${s.dmgK}k`, accent: 'primary', icon: 'damage' },
    { label: 'Visión', value: `${s.visionScore}`, icon: 'vision' },
    { label: 'Pentas', value: `${s.pentas}`, accent: 'warning', icon: 'penta' },
    { label: 'Racha actual', value: `${s.streak}V`, accent: 'warning', icon: 'streak' },
    { label: 'Pos. ranking', value: `#${s.avgRank}`, accent: s.avgRank <= 2 ? 'primary' : undefined, icon: 'ranking' },
    { label: 'Mejor / Peor racha', value: `${s.bestStreak}V / ${s.worstStreak}D`, accent: 'warning', icon: 'streak' },
  ];
}
