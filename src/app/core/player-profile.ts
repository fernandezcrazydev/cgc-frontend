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

/** A head-to-head highlight against another real player (user's perspective). */
export interface ProfileMatchup {
  name: string;
  tag: string;
  initials: string;
  /** Hue (0-360) for the avatar gradient. */
  hue: number;
  games: number;
  wins: number;
  losses: number;
  /** Win-rate percentage from the user's perspective, rounded. */
  wr: number;
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
  icon: string;
  highlightMetric: string;
}

/** Desglose de rendimiento por rol */
export interface PlayerRoleStat {
  role: LaneRole;
  games: number;
  wins: number;
  losses: number;
  wr: number;
  wonLaneRate: number;
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
  mainRole: string;

  // ── Arquetipo & ADN ─────────────────────────────────────────────
  archetype: PlayerArchetype;
  dna: PlayerDna;
  roleStats: Record<LaneRole, PlayerRoleStat>;

  // ── Streaks + recent form ───────────────────────────────────────
  currentStreak: number;
  streakType: 'W' | 'L';
  bestStreak: number;
  /** Last ~12 results, oldest → newest. */
  recentForm: ('W' | 'L')[];
  recentLpTrend: number;
  recentMatches: PlayerRecentMatch[];

  // ── Head-to-head highlights ─────────────────────────────────────
  /** Teammate you win the most alongside ("con la que más ganas"). */
  bestAlly: ProfileMatchup | null;
  /** Opponent who beats you the most ("contra la que más pierdes"). */
  nemesis: ProfileMatchup | null;
  /** Opponent you beat the most ("a la que más ganas"). */
  favoriteVictim: ProfileMatchup | null;

  // ── Breakdowns ──────────────────────────────────────────────────
  topChampions: ProfileChampion[];
  groupCount: number;
  groups: ProfileGroupRecord[];
}

/** Comparativa mutua directa entre el usuario actual y el miembro ("Tú vs Él") */
export interface MutualH2hSummary {
  targetName: string;
  targetTag: string;
  targetInitials: string;
  targetHue: number;
  gamesTogether: number;
  winsTogether: number;
  lossesTogether: number;
  wrTogether: number;
  gamesVersus: number;
  winsVersus: number;
  lossesVersus: number;
  wrVersus: number;
  h2hDiff: number; // >0: el usuario va ganando; <0: el rival va ganando
  statsComparison: {
    kdaUser: number;
    kdaTarget: number;
    wonLaneUser: number;
    wonLaneTarget: number;
    csPerMinUser: number;
    csPerMinTarget: number;
    damageShareUser: number;
    damageShareTarget: number;
    visionAvgUser: number;
    visionAvgTarget: number;
  };
}

/** Perfil completo de un miembro para la vista de terceros `/app/perfil/:id` */
export interface MemberProfile extends PlayerProfile {
  targetUserId: string;
  mutualH2h: MutualH2hSummary;
}

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

/** Build a head-to-head record vs `foe`, seeded so it's stable per opponent. */
function matchup(userTag: string, foe: Member, facet: 'ally' | 'enemy'): ProfileMatchup {
  const rnd = seeded(hash(userTag + '::' + facet + '::' + foe.tag));
  const games = 6 + Math.floor(rnd() * 19); // 6–24 customs shared
  const wr = rnd();
  const wins = Math.round(games * wr);
  const losses = Math.max(0, games - wins);
  return {
    name: foe.name,
    tag: foe.tag,
    initials: foe.initials,
    hue: foe.hue,
    games,
    wins,
    losses,
    wr: games ? Math.round((wins / games) * 100) : 0,
  };
}

/** Determina el arquetipo honorífico basado en las métricas de ADN */
function determineArchetype(dna: PlayerDna, wr: number, pentas: number): PlayerArchetype {
  if (pentas >= 3) {
    return {
      title: 'Cazador de Pentas',
      subtitle: 'Ejecutor implacable en peleas de equipo',
      icon: '🩸',
      highlightMetric: `${pentas} pentakills históricas`,
    };
  }
  if (dna.lane.wonLanePercentage >= 65) {
    return {
      title: 'Dominador de Línea',
      subtitle: 'Generador sistemático de ventaja temprana',
      icon: '⚔️',
      highlightMetric: `${dna.lane.wonLanePercentage}% líneas ganadas`,
    };
  }
  if (dna.combat.damageSharePercentage >= 28) {
    return {
      title: 'Motor de Daño',
      subtitle: 'Principal fuente de daño del equipo',
      icon: '💥',
      highlightMetric: `${dna.combat.damageSharePercentage}% del daño total`,
    };
  }
  if (dna.vision.visionScoreAvg >= 30) {
    return {
      title: 'Centinela del Mapa',
      subtitle: 'Control de objetivos y control de visión impecable',
      icon: '👁️',
      highlightMetric: `${dna.vision.visionScoreAvg} pts visión / part`,
    };
  }
  if (dna.economy.csPerMinAvg >= 7.5) {
    return {
      title: 'Maestro del Farmeo',
      subtitle: 'Escalado económico perfecto y consistencia en CS',
      icon: '🌾',
      highlightMetric: `${dna.economy.csPerMinAvg} CS / min`,
    };
  }
  if (dna.clutch.mvpRate >= 20) {
    return {
      title: 'Jugador Decisivo',
      subtitle: 'Factor diferencial en momentos clave',
      icon: '👑',
      highlightMetric: `${dna.clutch.mvpRate}% tasa de MVP`,
    };
  }
  return {
    title: 'Pilar de Equipo',
    subtitle: 'Jugador versátil con gran consistencia',
    icon: '🛡️',
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
 * Aggregate the current user's career across every group they belong to.
 */
export function buildPlayerProfile(
  user: { name: string; tag: string; initials: string; region: string },
  groups: readonly Group[],
  rosterOf: (id: string) => readonly Member[],
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
      seasonName: 'Temporada 2026-Q3',
    };
  });

  const games = groupRecords.reduce((s, r) => s + r.games, 0);
  const wins = groupRecords.reduce((s, r) => s + r.wins, 0);
  const losses = Math.max(0, games - wins);
  const wr = games ? Math.round((wins / games) * 100) : 0;

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
  const roleStats: Record<LaneRole, PlayerRoleStat> = {} as any;
  let remainingGames = games;
  LANE_ROLES.forEach((role, idx) => {
    const isLast = idx === LANE_ROLES.length - 1;
    const rGames = isLast ? remainingGames : Math.max(2, Math.floor(remainingGames * (0.15 + rnd() * 0.25)));
    remainingGames = Math.max(0, remainingGames - rGames);
    const rWr = Math.round(40 + rnd() * 30);
    const rWins = Math.round((rGames * rWr) / 100);
    const rLosses = Math.max(0, rGames - rWins);
    const rWonLane = Math.round(42 + rnd() * 35);
    roleStats[role] = {
      role,
      games: rGames,
      wins: rWins,
      losses: rLosses,
      wr: rWr,
      wonLaneRate: rWonLane,
    };
  });

  const bestRoleEntry = Object.values(roleStats).sort((a, b) => b.games - a.games)[0];
  const mainRole = bestRoleEntry ? bestRoleEntry.role : 'MID';

  // ── Recent form & matches preview ────────────────────────────────
  const recentForm: ('W' | 'L')[] = [];
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

  // ── Real teammates / rivals (head-to-head) ────────────────────────
  const seen = new Set<string>();
  const others: Member[] = [];
  for (const g of groups) {
    for (const m of rosterOf(g.id)) {
      if (m.tag === user.tag || seen.has(m.tag)) continue;
      seen.add(m.tag);
      others.push(m);
    }
  }

  const allyRecords = others.map((m) => matchup(user.tag, m, 'ally'));
  const enemyRecords = others.map((m) => matchup(user.tag, m, 'enemy'));

  const bestAlly = allyRecords.length
    ? [...allyRecords].sort((a, b) => b.wr - a.wr || b.games - a.games)[0]
    : null;
  const nemesis = enemyRecords.length
    ? [...enemyRecords].sort((a, b) => a.wr - b.wr || b.games - a.games)[0]
    : null;
  const favoriteVictim = enemyRecords.length
    ? [...enemyRecords].sort((a, b) => b.wr - a.wr || b.games - a.games)[0]
    : null;

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
    bestAlly,
    nemesis,
    favoriteVictim,
    topChampions,
    groupCount: groups.length,
    groups: groupRecords,
  };
}

/**
 * Build a member's profile for third-party view (`/app/perfil/:id`) with mutual H2H.
 */
export function buildMemberProfile(
  targetTag: string,
  currentUser: { name: string; tag: string; initials: string; region: string },
  groups: readonly Group[],
  rosterOf: (id: string) => readonly Member[],
): MemberProfile | null {
  // Find member in any roster
  let targetMember: Member | null = null;
  for (const g of groups) {
    const found = rosterOf(g.id).find((m) => m.tag === targetTag || m.name.toLowerCase() === targetTag.toLowerCase());
    if (found) {
      targetMember = found;
      break;
    }
  }

  // Fallback if not found in active rosters
  const safeTarget = targetMember ?? {
    id: targetTag,
    name: targetTag.split('#')[0] || targetTag,
    tag: targetTag.includes('#') ? targetTag : `${targetTag}#EUW`,
    role: 'Miembro' as GroupRole,
    initials: targetTag.slice(0, 2).toUpperCase(),
    hue: Math.abs(hash(targetTag)) % 360,
    rating: 1200,
    peakRating: 1250,
    rank: 1,
    tier: 'Gold',
    perks: [],
  };

  const baseProfile = buildPlayerProfile(
    {
      name: safeTarget.name,
      tag: safeTarget.tag,
      initials: safeTarget.initials,
      region: regionFromTag(safeTarget.tag),
    },
    groups,
    rosterOf,
  );

  // Generar comparación mutua "Tú vs Él"
  const mrnd = seeded(hash(currentUser.tag + '::mutual::' + safeTarget.tag));
  const gamesTogether = 4 + Math.floor(mrnd() * 16);
  const wrTogether = Math.round(35 + mrnd() * 45);
  const winsTogether = Math.round((gamesTogether * wrTogether) / 100);
  const lossesTogether = Math.max(0, gamesTogether - winsTogether);

  const gamesVersus = 5 + Math.floor(mrnd() * 18);
  const wrVersus = Math.round(30 + mrnd() * 50); // WR del usuario actual contra este miembro
  const winsVersus = Math.round((gamesVersus * wrVersus) / 100);
  const lossesVersus = Math.max(0, gamesVersus - winsVersus);
  const h2hDiff = winsVersus - lossesVersus;

  const currentUserProfile = buildPlayerProfile(currentUser, groups, rosterOf);

  const mutualH2h: MutualH2hSummary = {
    targetName: safeTarget.name,
    targetTag: safeTarget.tag,
    targetInitials: safeTarget.initials,
    targetHue: safeTarget.hue,
    gamesTogether,
    winsTogether,
    lossesTogether,
    wrTogether,
    gamesVersus,
    winsVersus,
    lossesVersus,
    wrVersus,
    h2hDiff,
    statsComparison: {
      kdaUser: currentUserProfile.kda,
      kdaTarget: baseProfile.kda,
      wonLaneUser: currentUserProfile.dna.lane.wonLanePercentage,
      wonLaneTarget: baseProfile.dna.lane.wonLanePercentage,
      csPerMinUser: currentUserProfile.dna.economy.csPerMinAvg,
      csPerMinTarget: baseProfile.dna.economy.csPerMinAvg,
      damageShareUser: currentUserProfile.dna.combat.damageSharePercentage,
      damageShareTarget: baseProfile.dna.combat.damageSharePercentage,
      visionAvgUser: currentUserProfile.dna.vision.visionScoreAvg,
      visionAvgTarget: baseProfile.dna.vision.visionScoreAvg,
    },
  };

  return {
    ...baseProfile,
    targetUserId: safeTarget.tag,
    mutualH2h,
  };
}

