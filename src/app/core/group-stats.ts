/**
 * Maqueta determinista de la vista de Estadísticas del grupo (`Roadmap.md` §5.5.5).
 *
 * Todo se siembra con el id del grupo + el alcance activo (sesión / temporada /
 * histórico), así que un grupo siempre pinta las mismas cifras hasta que llegue el
 * backend. Hay una única pasada de estadísticas por miembro (`statsFor`) y de ella
 * se proyecta todo lo demás, para que la pantalla no cuente dos verdades distintas:
 *   - mapTelemetryFor()  → balance de bandos e impacto de objetivos
 *   - metagameFor()      → campeones más jugados, más baneados y de mayor winrate
 *   - epicRecordsFor()   → los tres récords históricos, con enlace a su partida
 *   - playerTiles()      → el desglose de la fila expandible de cada jugador
 *   - awardsFor()        → los seis premios que consume `core/group-badges.ts`
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
export type StatScope = 'sesion' | 'temporada' | 'historico';

/**
 * §5.5.5 fija la nomenclatura: «Sesión» y «Temporada actual». El histórico solo se
 * ofrece cuando hay más de una temporada, porque con una sola repetiría cifras
 * idénticas a las de la temporada actual; de esa criba se encarga la vista.
 */
export const SCOPE_OPTIONS: { id: StatScope; label: string }[] = [
  { id: 'sesion', label: 'Sesión' },
  { id: 'temporada', label: 'Temporada actual' },
  { id: 'historico', label: 'Histórico total' },
];

/** Banda aproximada de partidas por alcance, para que los totales cuadren en cada zoom. */
const SCOPE_GAMES: Record<StatScope, [number, number]> = {
  sesion: [3, 6],
  temporada: [18, 44],
  historico: [70, 160],
};

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
  /** Objetivos épicos robados con el castigo. */
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
    };
  });
}

// ===================== Telemetría de mapa =====================

export type ObjectiveId = 'dragon' | 'herald' | 'baron' | 'tower';

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
}

/** Reparto de victorias entre los dos lados del mapa. */
export interface SideBalance {
  games: number;
  blueWins: number;
  redWins: number;
  bluePct: number;
  redPct: number;
}

export interface MapTelemetry {
  side: SideBalance;
  objectives: ObjectiveImpact[];
}

const OBJECTIVE_LABELS: Record<ObjectiveId, string> = {
  dragon: 'Primer dragón',
  herald: 'Heraldo de la grieta',
  baron: 'Primer barón',
  tower: 'Primera torre',
};

const OBJECTIVE_ORDER: ObjectiveId[] = ['dragon', 'herald', 'baron', 'tower'];

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
export function groupGamesOf(stats: readonly MemberStats[]): number {
  if (!stats.length) return 0;
  return Math.round(stats.reduce((total, s) => total + s.games, 0) / stats.length);
}

/** Balance de bandos e impacto de los cuatro objetivos (§5.5.5, bloque 1). */
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
    };
  });

  return {
    side: {
      games,
      blueWins,
      redWins: games - blueWins,
      bluePct,
      redPct: 100 - bluePct,
    },
    objectives,
  };
}

// ===================== Metagame =====================

export type MetagameBoardId = 'picks' | 'bans' | 'winrate';

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

/** Los tres tableros del metagame del grupo (§5.5.5, bloque 2). */
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
      value: banned + (banned === 1 ? ' baneo' : ' baneos'),
      sub: Math.round(38 + rnd() * 28) + '% de victorias cuando juega',
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

  return [
    {
      id: 'picks',
      title: 'Más jugados',
      note: 'Los campeones que más pisan la grieta en este grupo.',
      entries: picks,
    },
    {
      id: 'bans',
      title: 'Más baneados',
      note: 'A quién no se le deja salir del banquillo.',
      entries: bans,
    },
    {
      id: 'winrate',
      title: 'Mayor winrate',
      note: 'Solo campeones con cinco partidas o más.',
      entries: winrates,
    },
  ];
}

// ===================== Récords históricos =====================

export type EpicRecordIcon = 'blood' | 'damage' | 'marathon';

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
 * Los tres hitos de máxima dificultad (§5.5.5, bloque 3). A diferencia de la trivia
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

  const bloodiest = matchOf();
  const hardest = matchOf();
  const longest = matchOf();

  return [
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

/** Build the PREMIOS trophy wall ("métricas para reírse"). */
export function awardsFor(stats: readonly MemberStats[]): StatAward[] {
  if (!stats.length) return [];

  const farmer = leaderBy(stats, (s) => s.csPerMin - s.kda * 0.6);
  const silentCarry = leaderBy(stats, (s) => s.dmgK - s.deaths * 1.5);
  const wardSimp = leaderBy(stats, (s) => s.visionScore + s.wardsPlaced * 0.4);
  const pentaHunter = leaderBy(stats, (s) => s.pentas * 100 + s.quadras * 10 + s.triples);
  const ccLord = leaderBy(stats, (s) => s.ccTime);
  const feeder = leaderBy(stats, (s) => s.deaths - s.kda);

  return [
    {
      id: 'farmer',
      glyph: '🌾',
      title: 'El granjero',
      color: 'success',
      member: farmer.member,
      value: `${farmer.csPerMin} cs/min`,
      blurb: 'Mucho minion, poca sangre.',
    },
    {
      id: 'silent-carry',
      glyph: '🥷',
      title: 'Carry silencioso',
      color: 'primary',
      member: silentCarry.member,
      value: `${silentCarry.dmgK}k daño`,
      blurb: `Solo ${silentCarry.deaths} muertes de media.`,
    },
    {
      id: 'ward-simp',
      glyph: '👁',
      title: 'Ward simp',
      color: 'secondary',
      member: wardSimp.member,
      value: `${wardSimp.wardsPlaced} wards`,
      blurb: `Visión ${wardSimp.visionScore}, el más cotilla.`,
    },
    {
      id: 'penta-hunter',
      glyph: '🎯',
      title: 'Penta hunter',
      color: 'warning',
      member: pentaHunter.member,
      value: `${pentaHunter.pentas}P · ${pentaHunter.quadras}Q`,
      blurb: 'Cazador de multikills.',
    },
    {
      id: 'cc-lord',
      glyph: '🧊',
      title: 'Señor del CC',
      color: 'tertiary',
      member: ccLord.member,
      value: `${ccLord.ccTime}s CC`,
      blurb: 'Nadie se mueve cuando él juega.',
    },
    {
      id: 'feeder',
      glyph: '💀',
      title: 'El donante',
      color: 'danger',
      member: feeder.member,
      value: `${feeder.deaths} muertes`,
      blurb: 'Reparte oro al enemigo con cariño.',
    },
  ];
}

// ===================== JUGADORES (per-member tiles) =====================

/** Tinte de una cifra destacada. Se nombra por lo que significa, nunca por el color. */
export type StatAccent = 'secondary' | 'primary' | 'warning';

export interface PlayerTile {
  label: string;
  value: string;
  accent?: StatAccent;
}

/** The stat tiles shown in a player's expanded JUGADORES panel. */
export function playerTiles(s: MemberStats): PlayerTile[] {
  return [
    { label: 'Partidas', value: `${s.games}`, accent: 'secondary' },
    { label: 'Win rate', value: `${s.wr}%`, accent: 'primary' },
    { label: 'KDA', value: `${s.kda}`, accent: 'secondary' },
    { label: 'K / D / A', value: `${s.kills} / ${s.deaths} / ${s.assists}` },
    { label: 'CS/min', value: `${s.csPerMin}` },
    { label: 'Oro/min', value: `${s.goldPerMin}` },
    { label: 'Daño/part.', value: `${s.dmgK}k`, accent: 'primary' },
    { label: 'Visión', value: `${s.visionScore}` },
    { label: 'Pentas', value: `${s.pentas}`, accent: 'warning' },
    { label: 'Racha', value: `${s.streak}W`, accent: 'warning' },
  ];
}
