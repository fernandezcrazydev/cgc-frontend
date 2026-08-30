/**
 * Deterministic mock data for the personal "Perfil de jugador" and "Perfil de miembro" views.
 * Unlike the per-group stats, career figures here are AGGREGATED across all groups
 * or presented with clear group-specific contexts.
 */
import { Group, GroupRole, Member, REAL_CHAMPION_IDS } from './lobby';
import { hash, seeded } from './group-ranking';
import { LANE_ROLES, LaneRole } from './preferences';

/** A group's contribution to the aggregate, from the user's point of view. */
export interface ProfileGroupRecord {
  id: string;
  name: string;
  initials: string;
  c1: string;
  c2: string;
  role: GroupRole;
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  /** Posición en la tabla de la temporada activa del grupo */
  rankPosition: number;
  /** Puntos de liga en el grupo */
  lp: number;
  seasonName: string;
}

/** Récord agregado del jugador sumando todas sus ligas. */
export interface ProfileGlobalRecord {
  games: number;
  wins: number;
  losses: number;
  /** Porcentaje de victorias, redondeado. */
  wr: number;
}

/**
 * Récord global = la suma real de TODOS los registros por grupo, no una cifra
 * aparte. Importa que sea una suma y no un valor propio: el jugador juega en
 * varias ligas a la vez y el winrate del encabezado tiene que cuadrar con lo que
 * enseña el desglose de "Tus Grupos"; si se generase por su cuenta, ambas cifras
 * discreparían y ninguna de las dos sería creíble.
 *
 * `games === 0` (usuario sin grupos todavía) devuelve 0, no `NaN`: un perfil
 * recién creado es un caso normal, no un error de datos.
 *
 * BACKEND NOTE: este agregado lo servirá el endpoint de estadísticas del jugador
 * ya calculado (el servidor es el dueño de la regla). Cuando exista, se borran
 * los generadores semilla de arriba y esta función se queda —o desaparece— según
 * si el DTO trae el total ya sumado.
 */
export function globalRecord(records: readonly ProfileGroupRecord[]): ProfileGlobalRecord {
  const games = records.reduce((sum, r) => sum + r.games, 0);
  const wins = records.reduce((sum, r) => sum + r.wins, 0);
  const losses = Math.max(0, games - wins);
  return { games, wins, losses, wr: games ? Math.round((wins / games) * 100) : 0 };
}

/** Resultado de una partida tal y como lo modela el dominio. */
export type StreakType = 'W' | 'L';

/**
 * Etiqueta en español de un resultado. `streakType` es un enum del dominio y
 * viaja en inglés ('W' | 'L') porque así es el dato; lo que ve el usuario, no.
 * Pintarlo crudo es lo que producía el famoso "1L" en la tarjeta de racha —una
 * D con acento inglés en una interfaz en español—, y por eso toda impresión de
 * este enum pasa por aquí (mismo patrón que `groupRoleLabel()` en
 * `core/groups/group-view.ts`).
 */
export function streakLabel(type: StreakType): 'V' | 'D' {
  return type === 'W' ? 'V' : 'D';
}

/**
 * Racha en palabras: "3 victorias seguidas", "1 derrota". El singular importa
 * porque una racha de 1 es el caso más frecuente y "1 derrotas" canta.
 */
export function streakSentence(count: number, type: StreakType): string {
  const noun = type === 'W' ? 'victoria' : 'derrota';
  if (count <= 1) return `1 ${noun}`;
  return `${count} ${noun}s seguidas`;
}

/** Telemetría de fase de líneas / Early Game */
export interface PlayerLaneDna {
  wonLanePercentage: number;
  avgGoldDiffAt14: number;
  avgCsDiffAt14: number;
}

/** Telemetría de combate e impacto */
export interface PlayerCombatDna {
  damageSharePercentage: number;
  damagePerMin: number;
  killParticipation: number;
}

/** Telemetría de control de mapa y visión */
export interface PlayerVisionDna {
  visionScoreAvg: number;
  wardsPlacedAvg: number;
  wardsKilledAvg: number;
}

/** Telemetría económica y farmeo */
export interface PlayerEconomyDna {
  csPerMinAvg: number;
  goldPerMinAvg: number;
}

/** Factor determinante y clutch */
export interface PlayerClutchDna {
  mvpRate: number;
  firstBloodRate: number;
}

/** Supervivencia y absorción */
export interface PlayerSurvivalDna {
  avgDeaths: number;
  damageTakenAvg: number;
}

/** ADN completo de rendimiento en 5v5 */
export interface PlayerDna {
  lane: PlayerLaneDna;
  combat: PlayerCombatDna;
  vision: PlayerVisionDna;
  economy: PlayerEconomyDna;
  clutch: PlayerClutchDna;
  survival: PlayerSurvivalDna;
}

/** Arquetipo / Título honorífico del jugador */
export interface PlayerArchetype {
  title: string;
  subtitle: string;
  highlightMetric: string;
}

/** Desglose de rendimiento por rol */
export interface PlayerRoleStat {
  role: LaneRole;
  games: number;
  wins: number;
  losses: number;
  /**
   * `null` cuando no hay ninguna partida en esa posición. No es lo mismo que `0`: un cero es un
   * jugador que perdió todas, y pintarlo donde no hay nada que medir es inventarse el dato.
   */
  wr: number | null;
  /** Partidas de esa posición que traen el dato `wonLane`; el resto no puede medirlo. */
  wonLaneGames: number;
  /** `null` cuando `wonLaneGames` es 0, por el mismo motivo que `wr`. */
  wonLaneRate: number | null;
}

/**
 * Una partida vista desde la posición que jugó alguien. Es lo mínimo que hace falta para medir
 * el desglose por rol, y lo aporta quien llama porque el historial vive en `MatchHistoryStore`.
 *
 * BACKEND NOTE: cuando exista el endpoint de estadísticas del jugador, el desglose por rol vendrá
 * ya agregado del servidor y esto se borra junto con `buildRoleStats`.
 */
export interface RoleSample {
  role: LaneRole;
  won: boolean;
  /** `undefined` en las partidas que no registran quién ganó la línea. */
  wonLane?: boolean;
}

/** Partida reciente en formato ligero para tooltips e interacciones */
export interface PlayerRecentMatch {
  id: string;
  championId: number;
  won: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kda: string;
  lpDelta: number;
  role: LaneRole;
  dateFormatted: string;
  durationFormatted: string;
  isMvp: boolean;
}

/**
 * A most-played champion across all groups, enriched with 5v5 metrics.
 */
export interface ProfileChampion {
  championId: number;
  role: LaneRole;
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  kda: number;
  csPerMin: number;
  wonLaneRate: number;
  coreItemIds: number[];
}

/** The full aggregated career card shown on the profile screen. */
export interface PlayerProfile {
  name: string;
  tag: string;
  region: string;
  initials: string;
  hue: number;
  /** Mono "member since" stamp, e.g. "MAR 2024". */
  memberSince: string;

  // ── Global record (all groups) ──────────────────────────────────
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage, rounded. */
  wr: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  hoursPlayed: number;
  pentas: number;
  /** La posición más jugada, o `null` si todavía no hay ninguna partida que la determine. */
  mainRole: LaneRole | null;

  // ── Arquetipo & ADN ─────────────────────────────────────────────
  archetype: PlayerArchetype;
  dna: PlayerDna;
  roleStats: Record<LaneRole, PlayerRoleStat>;

  // ── Streaks + recent form ───────────────────────────────────────
  currentStreak: number;
  streakType: StreakType;
  bestStreak: number;
  /** Last ~12 results, oldest → newest. */
  recentForm: StreakType[];
  recentLpTrend: number;
  recentMatches: PlayerRecentMatch[];

  // ── Breakdowns ──────────────────────────────────────────────────
  topChampions: ProfileChampion[];
  groupCount: number;
  groups: ProfileGroupRecord[];
}

/** Perfil completo de un miembro para la vista de terceros `/app/perfil/:id` */
export interface MemberProfile extends PlayerProfile {
  targetUserId: string;
}

/*
 * NOTA: aquí vivía `mutualH2h`, un resumen del cruce entre el usuario y este miembro generado
 * con su propia semilla. Se ha borrado porque describía lo mismo que el historial cruzado y no
 * coincidía con él: la ficha del perfil decía «12 partidas juntos» y la lista de esas partidas,
 * a un clic, enseñaba siete. El cruce se deriva ahora de las partidas reales, en
 * `core/matches/cross-history.ts`, y lo sirve `MatchHistoryStore.crossWith()`.
 */

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/** "N1ghtfang#LAN" → "LAN". */
function regionFromTag(tag: string): string {
  return tag.split('#')[1]?.toUpperCase() || 'LAN';
}

/** Pick `n` distinct items from `arr` using the seeded generator. */
function pickDistinct<T>(rnd: () => number, arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  }
  return out;
}

/** Determina el arquetipo honorífico basado en las métricas de ADN */
function determineArchetype(dna: PlayerDna, wr: number, pentas: number): PlayerArchetype {
  if (pentas >= 3) {
    return {
      title: 'Cazador de Pentas',
      subtitle: 'Ejecutor implacable en peleas de equipo',
      highlightMetric: `${pentas} pentakills históricas`,
    };
  }
  if (dna.lane.wonLanePercentage >= 65) {
    return {
      title: 'Dominador de Línea',
      subtitle: 'Generador sistemático de ventaja temprana',
      highlightMetric: `${dna.lane.wonLanePercentage}% líneas ganadas`,
    };
  }
  if (dna.combat.damageSharePercentage >= 28) {
    return {
      title: 'Motor de Daño',
      subtitle: 'Principal fuente de daño del equipo',
      highlightMetric: `${dna.combat.damageSharePercentage}% del daño total`,
    };
  }
  if (dna.vision.visionScoreAvg >= 30) {
    return {
      title: 'Centinela del Mapa',
      subtitle: 'Control de objetivos y control de visión impecable',
      highlightMetric: `${dna.vision.visionScoreAvg} pts visión / part`,
    };
  }
  if (dna.economy.csPerMinAvg >= 7.5) {
    return {
      title: 'Maestro del Farmeo',
      subtitle: 'Escalado económico perfecto y consistencia en CS',
      highlightMetric: `${dna.economy.csPerMinAvg} CS / min`,
    };
  }
  if (dna.clutch.mvpRate >= 20) {
    return {
      title: 'Jugador Decisivo',
      subtitle: 'Factor diferencial en momentos clave',
      highlightMetric: `${dna.clutch.mvpRate}% tasa de MVP`,
    };
  }
  return {
    title: 'Pilar de Equipo',
    subtitle: 'Jugador versátil con gran consistencia',
    highlightMetric: `${wr}% tasa de victoria`,
  };
}

/** Common core item pools for champions */
const CORE_ITEM_POOLS: Record<LaneRole, number[][]> = {
  TOP: [[3078, 3071, 3026], [3068, 3075, 3083], [3153, 3078, 3143]],
  JUNGLA: [[3078, 3153, 3026], [3157, 3089, 3135], [3068, 3075, 3143]],
  MID: [[3089, 3157, 3135], [3142, 3158, 3814], [3078, 3071, 3153]],
  ADC: [[3031, 3085, 3072], [3031, 3094, 3072], [3153, 3031, 3026]],
  SUPPORT: [[3190, 3107, 3109], [3050, 3109, 3190], [3157, 3089, 3135]],
};

/**
 * El nombre de temporada que llevan los registros por grupo. Una sola constante porque el
 * literal estaba repetido y, cuando el backend sirva las temporadas de verdad, este es el único
 * sitio que hay que borrar.
 */
const SEASON_NAME = 'Temporada 2026-Q3';

/**
 * Aggregate the current user's career across every group they belong to.
 */
export function buildPlayerProfile(
  user: { name: string; tag: string; initials: string; region: string },
  groups: readonly Group[],
  rosterOf: (id: string) => readonly Member[],
  roleSamples: readonly RoleSample[] = [],
): PlayerProfile {
  const rnd = seeded(hash(user.tag + '::profile'));

  // Per-group records → the aggregate totals.
  const groupRecords: ProfileGroupRecord[] = groups.map((g) => {
    const grnd = seeded(hash(user.tag + '::' + g.id));
    const games = 14 + Math.floor(grnd() * 52);
    const wr = 0.4 + grnd() * 0.32;
    const wins = Math.round(games * wr);
    const losses = Math.max(0, games - wins);
    const rankPosition = 1 + (Math.floor(grnd() * Math.max(1, g.members)));
    const lp = Math.round(40 + grnd() * 210);
    return {
      id: g.id,
      name: g.name,
      initials: g.initials,
      c1: g.c1,
      c2: g.c2,
      role: g.role,
      games,
      wins,
      losses,
      wr: games ? Math.round((wins / games) * 100) : 0,
      rankPosition,
      lp,
      seasonName: SEASON_NAME,
    };
  });

  const { games, wins, losses, wr } = globalRecord(groupRecords);

  // Global KDA / career counters.
  const kills = +(4 + rnd() * 6).toFixed(1);
  const deaths = +(3 + rnd() * 4).toFixed(1);
  const assists = +(6 + rnd() * 9).toFixed(1);
  const kda = +((kills + assists) / Math.max(1, deaths)).toFixed(1);
  const hoursPlayed = Math.round((games * 32) / 60);
  const pentas = Math.floor(rnd() * 6);

  // ── Generación de ADN de Telemetría ──────────────────────────────
  const wonLanePercentage = Math.round(45 + rnd() * 32);
  const avgGoldDiffAt14 = Math.round((rnd() - 0.45) * 600);
  const avgCsDiffAt14 = +( (rnd() - 0.45) * 18 ).toFixed(1);

  const damageSharePercentage = +(18 + rnd() * 16).toFixed(1);
  const damagePerMin = Math.round(420 + rnd() * 380);
  const killParticipation = Math.round(48 + rnd() * 32);

  const visionScoreAvg = +(18 + rnd() * 24).toFixed(1);
  const wardsPlacedAvg = +(0.8 + rnd() * 1.1).toFixed(1);
  const wardsKilledAvg = +(2 + rnd() * 5).toFixed(1);

  const csPerMinAvg = +(5.8 + rnd() * 3.2).toFixed(1);
  const goldPerMinAvg = Math.round(360 + rnd() * 160);

  const mvpRate = Math.round(10 + rnd() * 22);
  const firstBloodRate = Math.round(15 + rnd() * 25);

  const damageTakenAvg = Math.round(14000 + rnd() * 12000);

  const dna: PlayerDna = {
    lane: {
      wonLanePercentage,
      avgGoldDiffAt14,
      avgCsDiffAt14: Number(avgCsDiffAt14),
    },
    combat: {
      damageSharePercentage: Number(damageSharePercentage),
      damagePerMin,
      killParticipation,
    },
    vision: {
      visionScoreAvg: Number(visionScoreAvg),
      wardsPlacedAvg: Number(wardsPlacedAvg),
      wardsKilledAvg: Number(wardsKilledAvg),
    },
    economy: {
      csPerMinAvg: Number(csPerMinAvg),
      goldPerMinAvg,
    },
    clutch: {
      mvpRate,
      firstBloodRate,
    },
    survival: {
      avgDeaths: deaths,
      damageTakenAvg,
    },
  };

  const archetype = determineArchetype(dna, wr, pentas);

  // ── Desglose por rol ─────────────────────────────────────────────
  const roleStats = buildRoleStats(roleSamples);

  // La posición principal es la más jugada, y solo si de verdad se ha jugado alguna. Con el
  // desglose vacío no hay «rol principal» que declarar: antes se caía a MID, que es exactamente
  // el tipo de valor plausible que el usuario lee como si fuese suyo.
  const bestRoleEntry = Object.values(roleStats)
    .filter((r) => r.games > 0)
    .sort((a, b) => b.games - a.games)[0];
  const mainRole = bestRoleEntry ? bestRoleEntry.role : null;

  // ── Recent form & matches preview ────────────────────────────────
  const recentForm: StreakType[] = [];
  const recentMatches: PlayerRecentMatch[] = [];
  let recentLpTrend = 0;

  for (let i = 0; i < 12; i++) {
    const mrnd = seeded(hash(user.tag + '::match::' + i));
    const won = mrnd() < wr / 100;
    recentForm.push(won ? 'W' : 'L');

    const mChamp = REAL_CHAMPION_IDS[Math.floor(mrnd() * REAL_CHAMPION_IDS.length)] || 103;
    const mKills = Math.floor(mrnd() * 12);
    const mDeaths = Math.floor(mrnd() * 8);
    const mAssists = Math.floor(mrnd() * 15);
    const mKda = `${mKills}/${mDeaths}/${mAssists}`;
    const mLp = won ? Math.round(18 + mrnd() * 8) : -Math.round(13 + mrnd() * 7);
    recentLpTrend += mLp;
    const mRole = LANE_ROLES[Math.floor(mrnd() * LANE_ROLES.length)];
    const mDurationMin = Math.round(24 + mrnd() * 18);
    const mDurationSec = Math.round(mrnd() * 59);
    const daysAgo = 12 - i;
    const isMvp = won && mrnd() > 0.65;

    recentMatches.push({
      id: `match-${i}`,
      championId: mChamp,
      won,
      kills: mKills,
      deaths: mDeaths,
      assists: mAssists,
      kda: mKda,
      lpDelta: mLp,
      role: mRole,
      dateFormatted: `Hace ${daysAgo}d`,
      durationFormatted: `${mDurationMin}:${mDurationSec.toString().padStart(2, '0')}`,
      isMvp,
    });
  }

  // Trailing streak
  const last = recentForm[recentForm.length - 1] ?? 'W';
  let currentStreak = 0;
  for (let i = recentForm.length - 1; i >= 0 && recentForm[i] === last; i--) currentStreak++;
  const bestStreak = Math.max(currentStreak, 3 + Math.floor(rnd() * 7));

  const memberSince = `${MONTHS[Math.floor(rnd() * 12)]} ${2023 + Math.floor(rnd() * 3)}`;

  // ── Enriched Top Champions ────────────────────────────────────────
  const champs = pickDistinct(rnd, REAL_CHAMPION_IDS, 6);
  const topChampions: ProfileChampion[] = champs
    .map((championId, idx) => {
      const crnd = seeded(hash(user.tag + '::champ::' + championId));
      const cgames = 14 + Math.floor(crnd() * 50);
      const cwrVal = 0.42 + crnd() * 0.35;
      const cwins = Math.round(cgames * cwrVal);
      const closses = Math.max(0, cgames - cwins);
      const cwr = Math.round((cwins / cgames) * 100);
      const ckills = +(5 + crnd() * 5).toFixed(1);
      const cdeaths = +(2.5 + crnd() * 4).toFixed(1);
      const cassists = +(5 + crnd() * 8).toFixed(1);
      const ckda = +((ckills + cassists) / Math.max(1, cdeaths)).toFixed(1);
      const ccs = +(6.2 + crnd() * 2.8).toFixed(1);
      const cwonLane = Math.round(45 + crnd() * 35);
      const crole = LANE_ROLES[idx % LANE_ROLES.length];
      const corePool = CORE_ITEM_POOLS[crole] || CORE_ITEM_POOLS.MID;
      const coreItems = corePool[Math.floor(crnd() * corePool.length)] || [3089, 3157, 3135];

      return {
        championId,
        role: crole,
        games: cgames,
        wins: cwins,
        losses: closses,
        wr: cwr,
        kda: ckda,
        csPerMin: Number(ccs),
        wonLaneRate: cwonLane,
        coreItemIds: coreItems,
      };
    })
    .sort((a, b) => b.games - a.games);

  return {
    name: user.name,
    tag: user.tag,
    region: user.region || regionFromTag(user.tag),
    initials: user.initials,
    hue: 320,
    memberSince,
    games,
    wins,
    losses,
    wr,
    kills,
    deaths,
    assists,
    kda,
    hoursPlayed,
    pentas,
    mainRole,
    archetype,
    dna,
    roleStats,
    currentStreak,
    streakType: last,
    bestStreak,
    recentForm,
    recentLpTrend,
    recentMatches,
    topChampions,
    groupCount: groups.length,
    groups: groupRecords,
  };
}

/**
 * La carrera de otro jugador, para la vista de terceros (`/app/perfil/:id`).
 *
 * Ya no recibe al usuario de la sesión: lo pedía solo para sembrar el cruce entre los dos, y
 * ese cruce se deriva ahora de las partidas reales (`MatchHistoryStore.crossWith()`). Un perfil
 * ajeno describe a ese jugador, y quién lo mira no debería cambiar sus cifras.
 */
export function buildMemberProfile(
  targetTag: string,
  groups: readonly Group[],
  rosterOf: (id: string) => readonly Member[],
  roleSamples: readonly RoleSample[] = [],
  knownFromMatches = false,
): MemberProfile | null {
  // Solo por identidad: el tag completo (`Nombre#REGION`) o el id estable del backend cuando el
  // miembro viene de él. Nunca por `name`, que es lo que hacía antes: dos jugadores cuyo nombre
  // coincidiese se habrían mezclado los perfiles, y la regla del proyecto es explícita.
  let targetMember: Member | null = null;
  for (const g of groups) {
    const found = rosterOf(g.id).find((m) => m.tag === targetTag || m.userId === targetTag);
    if (found) {
      targetMember = found;
      break;
    }
  }

  /*
   * Que no aparezca es una respuesta, no un hueco que rellenar.
   *
   * Antes se fabricaba aquí un miembro entero —`rating: 1200`, `tier: 'Gold'`, un winrate
   * sembrado con el propio texto de la URL— así que `/app/perfil/loquesea` pintaba un perfil
   * completo y creíble de alguien que no existe, mientras `/app/versus/loquesea` respondía 404.
   * Dos vistas dando respuestas opuestas a la misma entrada. Ahora devuelve `null` y la vista
   * pinta su 404, igual que las tres del cruce.
   *
   * `knownFromMatches` es la excepción justa: alguien que ya no está en ninguno de tus grupos
   * pero con quien sí has jugado existe, y sus partidas lo demuestran.
   */
  if (!targetMember && !knownFromMatches) return null;

  const tag = targetMember?.tag ?? targetTag;
  const name = targetMember?.name ?? nameFromTag(targetTag);

  const baseProfile = buildPlayerProfile(
    {
      name,
      tag,
      initials: targetMember?.initials ?? name.slice(0, 2).toUpperCase(),
      region: regionFromTag(tag),
    },
    groups,
    rosterOf,
    roleSamples,
  );

  const combinedGroups = [...baseProfile.groups, ...externalGroupsFor(tag)];

  return {
    ...baseProfile,
    groups: combinedGroups,
    groupCount: combinedGroups.length,
    targetUserId: targetMember?.userId ?? tag,
  };
}

/** `Pix3lQueen#LAN` → `Pix3lQueen`. La región se pinta aparte. */
function nameFromTag(tag: string): string {
  return tag.split('#')[0] || tag;
}

/** El pool del que salen los grupos de comunidad. Nombres, no datos: las cifras se siembran. */
const EXTERNAL_GROUP_POOL = [
  { id: 'valquirias-lan', name: 'Valquirias LAN', initials: 'VL', hue: 340 },
  { id: 'kr-bootcamp', name: 'KR Bootcamp Masters', initials: 'KB', hue: 215 },
  { id: 'esports-elite', name: 'Esports Elite Cup', initials: 'EE', hue: 45 },
  { id: 'twilight-vanguard', name: 'Twilight Vanguard', initials: 'TV', hue: 268 },
  { id: 'silent-rift', name: 'Silent Rift', initials: 'SR', hue: 190 },
  { id: 'hexdrive', name: 'Hexdrive', initials: 'HX', hue: 128 },
  { id: 'ashen-wolves', name: 'Ashen Wolves', initials: 'AW', hue: 22 },
  { id: 'meridian-cup', name: 'Meridian Cup', initials: 'MC', hue: 302 },
];

/**
 * Grupos de la comunidad en los que está ese jugador y tú no. Existen para que «Solicitar
 * unirme» tenga dónde pulsarse: sin ninguno, la mitad de la tarjeta de grupos no se puede
 * enseñar.
 *
 * Se siembran por el tag del jugador, no escritos a mano. Antes eran tres constantes literales
 * añadidas a TODO perfil ajeno, así que dos jugadores distintos salían con los mismos tres
 * grupos y las mismas cifras al LP: abrir dos perfiles seguidos delataba que el dato era falso.
 *
 * BACKEND NOTE: placeholder desechable. Cuando exista el flujo de solicitud de entrada —hoy los
 * grupos son solo por invitación, no hay endpoint ni diseño para pedir sitio— esto se sustituye
 * por la lectura real de los grupos públicos del jugador y este bloque se borra entero.
 */
function externalGroupsFor(tag: string): ProfileGroupRecord[] {
  const rnd = seeded(hash(tag + '::externos'));
  const count = 2 + Math.floor(rnd() * 2);
  const offset = Math.abs(hash(tag + '::pool')) % EXTERNAL_GROUP_POOL.length;

  return Array.from({ length: count }, (_, i) => {
    const base = EXTERNAL_GROUP_POOL[(offset + i) % EXTERNAL_GROUP_POOL.length];
    const games = 18 + Math.floor(rnd() * 40);
    const wins = Math.round(games * (0.38 + rnd() * 0.34));

    return {
      id: base.id,
      name: base.name,
      initials: base.initials,
      c1: `hsl(${base.hue},90%,62%)`,
      c2: `hsl(${(base.hue + 30) % 360},75%,35%)`,
      role: 'Miembro' as GroupRole,
      games,
      wins,
      losses: games - wins,
      // El winrate se calcula, no se sortea: es el mismo error que tenía el desglose por rol.
      wr: Math.round((wins / games) * 100),
      rankPosition: 1 + Math.floor(rnd() * 8),
      lp: 40 + Math.floor(rnd() * 280),
      seasonName: SEASON_NAME,
    };
  });
}


/**
 * El desglose por posición, contado sobre las partidas de verdad.
 *
 * Antes esto se sorteaba: se elegía un winrate al azar entre 40 y 70 y de ahí se derivaban las
 * victorias, que es exactamente al revés de como se calcula un winrate. La tabla llegaba a
 * pintar «58 % · 0 partidas», un porcentaje sobre nada. Ahora las cinco posiciones salen
 * siempre —para que la tabla no cambie de alto según lo que hayas jugado— pero las que no
 * tienen partidas dicen que no las tienen, en vez de rellenar el hueco.
 */
function buildRoleStats(samples: readonly RoleSample[]): Record<LaneRole, PlayerRoleStat> {
  const out = {} as Record<LaneRole, PlayerRoleStat>;

  for (const role of LANE_ROLES) {
    const mine = samples.filter((s) => s.role === role);
    const wins = mine.filter((s) => s.won).length;
    const lane = mine.filter((s) => s.wonLane !== undefined);
    const laneWins = lane.filter((s) => s.wonLane).length;

    out[role] = {
      role,
      games: mine.length,
      wins,
      losses: mine.length - wins,
      wr: mine.length > 0 ? Math.round((wins / mine.length) * 100) : null,
      wonLaneGames: lane.length,
      wonLaneRate: lane.length > 0 ? Math.round((laneWins / lane.length) * 100) : null,
    };
  }

  return out;
}
