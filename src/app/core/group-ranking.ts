/**
 * Leaderboard data for the per-group "Ranking" view. Members are ranked by
 * rating (desc), with sanctioned players pushed to the bottom. Each entry
 * carries the win/loss record, peak rating, LoL rank, lane, champion, streak
 * sparkline, and trophy data. Deterministic so a given group always renders
 * the same board until the backend lands.
 */
import { NfLane } from '../ui/lane-icon/nf-lane-icon';
import { MOCK_NAMES, REAL_CHAMPION_IDS } from './lobby';
import { opggUrl } from './member-detail';

/** Región de sabor por jugador. Solo decora el `Nombre#REGION` del ranking. */
const REGIONS = ['EUW', 'LAN', 'NA', 'KR', 'BR'];

/**
 * Roster name pool — se deriva de `MOCK_NAMES` (`lobby.ts`), la misma lista que
 * siembra el roster real en `group-store.ts`. Antes era una copia de 12 nombres
 * "sincronizada por convención"; con grupos de 28 miembros esa copia se quedaba
 * corta y repetía nombres, y un nombre repetido rompe los `track` de las vistas.
 */
const NAME_POOL = MOCK_NAMES.map((name, i) => ({ name, tag: REGIONS[i % REGIONS.length] }));

const LANES: readonly NfLane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];

export type LolTier = 'CHALLENGER' | 'GRANDMASTER' | 'MASTER' | 'DIAMOND' | 'EMERALD' | 'PLATINUM' | 'GOLD';

export interface LolRankInfo {
  tier: LolTier;
  queue: 'SoloQ' | 'Flex';
  /**
   * Etiqueta legible ("SoloQ: Master"). Ya no se pinta como texto suelto: es el
   * nombre accesible del escudo (`title`/`alt` de `nf-rank-emblem`).
   */
  label: string;
  color: string;
}

export interface RankEntry {
  /**
   * Id estable de la fila: clave de `@for ... track` y del acordeón.
   * BACKEND NOTE: lo generará el servidor. Nunca clavear por `name` ni por
   * `tag` (regla de oro de CLAUDE.md — y aquí `tag` es la REGIÓN, que se
   * repite entre jugadores).
   */
  playerId: string;
  rank: number;
  name: string;
  tag: string;
  initials: string;
  hue: number;
  avatar?: string;
  rating: number;
  /**
   * LP en crudo (`formattedLp` lleva separador de millares y no se puede comparar).
   * La vista ya no ordena por LP —la columna Pos ES ese orden—, pero el valor se
   * conserva porque el backend lo mandará igualmente y lo necesitan las
   * comparaciones de la clasificación.
   */
  lpValue: number;
  formattedLp: string;
  peak: number;
  wins: number;
  losses: number;
  totalGames: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  /** Participación en asesinatos media (0-100). */
  kp: number;
  /** Recent rating points (oldest → newest) for the trend sparkline. */
  spark: number[];
  /** Polilínea SVG ya calculada: evita rehacerla en cada pasada de detección. */
  sparkPath: string;
  /** Overall direction of the spark, for the line color. */
  trend: 'up' | 'down';
  /**
   * Rol principal del jugador. Ver `mainLaneFor`: hoy es un placeholder sembrado,
   * no un dato calculado sobre el historial de picks.
   */
  lane: NfLane;
  /** LoL highest rank (SoloQ or Flex). */
  lolRank: LolRankInfo;
  /** Average LP gained/lost. */
  avgLpGain: number;
  avgLpLoss: number;
  /**
   * Jugador sancionado: sale siempre al final de la tabla y fuera de
   * competición. BACKEND NOTE: la sanción (motivo y vigencia incluidos) será
   * del backend; aquí se marca de forma determinista por `hash(name)`.
   */
  banned: boolean;
  banReason?: string;
  /** Most played champion ID for the secondary icon. */
  mainChampionId: number;
  /** Trophy image for the top 3 (Trofeo1, Trofeo2, Trofeo3). */
  trophyImg?: string;
  /** Direct link to OP.GG. */
  opggUrl: string;
}

/** Tiny seeded PRNG (mulberry32) so the board is stable across renders. */
export function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a stable 32-bit seed. */
export function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Umbrales de tier sobre el rating (1800-2900 en el generador). Antes el tier
 * salía de la POSICIÓN en la tabla (`TIER_CONFIGS[min(i, len-1)]`), así que del
 * 8.º en adelante todos eran "SoloQ: Gold I": con 28 jugadores serían 21 filas
 * idénticas. Derivarlo del rating es además lo que hará el backend.
 */
const TIER_LADDER: { min: number; tier: LolTier; queue: 'SoloQ' | 'Flex'; label: string; color: string }[] = [
  { min: 2750, tier: 'CHALLENGER',  queue: 'SoloQ', label: 'SoloQ: Challenger',  color: '#3fbfdd' },
  { min: 2600, tier: 'GRANDMASTER', queue: 'SoloQ', label: 'SoloQ: Grandmaster', color: '#e43e3e' },
  { min: 2400, tier: 'MASTER',      queue: 'SoloQ', label: 'SoloQ: Master',      color: '#9d48e0' },
  { min: 2200, tier: 'DIAMOND',     queue: 'SoloQ', label: 'SoloQ: Diamante I',  color: '#5aa9e6' },
  { min: 2050, tier: 'EMERALD',     queue: 'SoloQ', label: 'SoloQ: Esmeralda I', color: '#00b894' },
  { min: 1900, tier: 'PLATINUM',    queue: 'Flex',  label: 'Flex: Platino I',    color: '#00cec9' },
  { min: 0,    tier: 'GOLD',        queue: 'SoloQ', label: 'SoloQ: Oro I',       color: '#cd8837' },
];

function tierForRating(rating: number): LolRankInfo {
  const step = TIER_LADDER.find((t) => rating >= t.min) ?? TIER_LADDER[TIER_LADDER.length - 1];
  return { tier: step.tier, queue: step.queue, label: step.label, color: step.color };
}

/** Rol que se enseña cuando no hay historial suficiente para deducir un main. */
const FALLBACK_MAIN_LANE: NfLane = 'MID';

/**
 * Rol principal ("Main Role") del jugador, el que pinta la columna "Rol".
 *
 * TODO: [AUTH/DATA] Implementar cálculo real del Main Role según historial de picks
 *
 * Hoy NO viene de ninguna fuente de datos: sale de la misma semilla determinista
 * que el resto de la fila, así que es un valor inventado que el usuario lee como
 * real. El cálculo bueno es "la línea más jugada en las últimas N clasificatorias",
 * y necesita un historial de partidas por jugador que ni la API de Riot ni nuestro
 * backend están sirviendo todavía.
 *
 * BACKEND NOTE: cuando `GET /groups/{id}/ranking` devuelva `mainLane` ya resuelta,
 * este helper y su fallback se borran y el campo se lee del DTO. El fallback
 * tipado se queda documentado aquí mientras tanto para que el día que el backend
 * mande `null` (jugador sin partidas) la vista tenga una respuesta definida en vez
 * de pintar un hueco.
 */
function mainLaneFor(rnd: () => number): NfLane {
  return LANES[Math.floor(rnd() * LANES.length)] ?? FALLBACK_MAIN_LANE;
}

/**
 * Campeón más jugado, para el icono de la columna "Main".
 *
 * TODO: [AUTH/DATA] Implementar cálculo real del Main Role según historial de picks
 * — misma deuda que `mainLaneFor`: el campeón principal se deduce del mismo
 * historial de picks y llegará en la misma respuesta (`mainChampionId`).
 */
function mainChampionFor(rnd: () => number): number {
  return REAL_CHAMPION_IDS[Math.floor(rnd() * REAL_CHAMPION_IDS.length)];
}

/** Build a leaderboard of `count` members for a group, ranked by rating desc. */
export function rankingFor(groupId: string, count: number): RankEntry[] {
  const rnd = seeded(hash(groupId));

  const rawEntries = Array.from({ length: count }, (_, i) => {
    const pick = NAME_POOL[i % NAME_POOL.length];
    const games = 15 + Math.floor(rnd() * 45);
    const wins = Math.round(games * (0.42 + rnd() * 0.4));
    const losses = Math.max(0, games - wins);
    const rating = 1800 + Math.floor(rnd() * 1100);
    const peak = rating + Math.floor(rnd() * 180);

    // Walk a short rating history ending near the current rating.
    const spark: number[] = [];
    let v = rating - 40 + Math.floor(rnd() * 80);
    for (let s = 0; s < 8; s++) {
      v += Math.floor((rnd() - 0.45) * 36);
      spark.push(v);
    }
    spark[spark.length - 1] = rating;

    const lane = mainLaneFor(rnd);
    const champId = mainChampionFor(rnd);
    const avgGain = 18 + Math.floor(rnd() * 9);
    const avgLoss = 14 + Math.floor(rnd() * 8);

    // ~1 de cada 8 sancionado (3 de los 28 del grupo semilla), estable por
    // NOMBRE y no por posición: si dependiese del orden, el baneado cambiaría
    // de persona cada vez que se reordena la tabla.
    const banned = hash('ban|' + pick.name) % 8 === 0;

    return {
      playerId: 'rk-' + groupId + '-' + i,
      name: pick.name,
      tag: pick.tag,
      initials: pick.name.slice(0, 2).toUpperCase(),
      hue: (i * 47) % 360,
      rating,
      lpValue: rating,
      peak,
      wins,
      losses,
      totalGames: wins + losses,
      wr: games ? Math.round((wins / games) * 100) : 0,
      kp: 42 + Math.floor(rnd() * 34),
      spark,
      sparkPath: sparkPoints(spark, 100, 28),
      trend: spark[spark.length - 1] >= spark[0] ? ('up' as const) : ('down' as const),
      lane,
      avgLpGain: avgGain,
      avgLpLoss: avgLoss,
      banned,
      banReason: banned ? 'Jugador sancionado - Fuera de competición' : undefined,
      mainChampionId: champId,
      opggUrl: opggUrl(pick.name + '#' + pick.tag),
    };
  });

  // Rating descendente, pero los sancionados SIEMPRE al final: están fuera de
  // competición, así que no ocupan puesto por delante de nadie activo.
  const sorted = rawEntries.sort((a, b) => {
    if (a.banned !== b.banned) return a.banned ? 1 : -1;
    return b.rating - a.rating;
  });

  return sorted.map((e, i) => {
    const rank = i + 1;
    // El trofeo es del podio activo: un sancionado nunca lo luce.
    const trophyImg = rank <= 3 && !e.banned ? '/assets/trofeos/Trofeo' + rank + '.png' : undefined;

    return {
      ...e,
      rank,
      formattedLp: e.rating.toLocaleString('es-ES') + ' LP',
      lolRank: tierForRating(e.rating),
      trophyImg,
    };
  });
}

/** Map a spark series to an SVG polyline `points` string within `w`×`h`. */
export function sparkPoints(spark: number[], w = 120, h = 32): string {
  if (spark.length < 2) return '';
  const min = Math.min(...spark);
  const max = Math.max(...spark);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (w - pad * 2) / (spark.length - 1);
  return spark
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
