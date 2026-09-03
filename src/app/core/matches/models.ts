/**
 * Líneas de LoL. Se declara aquí y no se importa de `ui/lane-icon`: `Lane` es dominio
 * —el backend lo manda en los DTOs— y `core/` no puede depender de `ui/`. `NfLane` es la
 * misma unión declarada del lado del UI kit; TypeScript es estructural, así que las dos
 * siguen siendo intercambiables sin que ninguna capa importe de la otra. Si el backend
 * añade una línea, este es el sitio que manda, y `NfLane` la sigue.
 */
export type Lane = 'TOP' | 'JUNGLA' | 'MID' | 'ADC' | 'SUPPORT';
export type TeamSide = 'blue' | 'red';
export type MatchResultOutcome = 'win' | 'loss' | 'cancelled';
export type MatchSource = 'manual' | 'import';

/** Referencia de un objeto en el inventario */
export interface MatchItemSlot {
  id: number;
  name: string;
  iconUrl?: string | null;
  description?: string;
  gold?: number;
}

/** Estadísticas de telemetría y desempeño de un participante */
export interface ParticipantStats {
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  gold: number;
  totalDamageToChampions: number;
  damageSharePercentage: number;
  damageTaken: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  /** 6 ranuras de inventario + 1 accesorio/trinket (índice 6) */
  items: (MatchItemSlot | null)[];
  /** IDs de Summoner Spells (D y F) */
  spells: [number, number];
  /**
   * BACKEND NOTE: sin uso todavía. No hay endpoint ni catálogo de runas en el proyecto
   * (`GameDataApi` solo sirve campeones, hechizos y objetos), así que no hay forma de
   * resolver estos ids a nombre e icono sin inventarse un catálogo estático, que sería
   * fabricar datos de dominio en cliente. Se pintarán cuando exista `GET /game-data/runes`.
   */
  primaryRuneId?: number;
  secondaryRuneTreeId?: number;
  goldAt14?: number;
  csAt14?: number;
  wonLane?: boolean;
  isMvp?: boolean;
}

/** Participante individual dentro del roster 5v5 */
export interface MatchParticipant {
  id: string;
  userId: string | null;
  riotId: string;
  discordUsername?: string;
  avatarUrl?: string;
  isGuest: boolean;
  team: TeamSide;
  role: Lane;
  championId: number;
  championName: string;
  championLevel: number;
  wasAutofill: boolean;
  /**
   * Puntos de Liga ganados o perdidos en el ranking visible de la liga/grupo (ej: +22 o -15).
   * REGLA DE DOMINIO: El MMR interno y tabla de poder NUNCA se exponen al usuario.
   */
  lpDelta: number;
  /**
   * Posición en la clasificación del grupo ANTES y DESPUÉS de esta partida. Es el dato que
   * convierte un `lpDelta` en algo que importa: «+22 LP» no dice nada, «3.º → 2.º» sí.
   * Opcionales: una partida amistosa o un grupo sin clasificación no los trae.
   */
  rankBefore?: number;
  rankAfter?: number;
  stats: ParticipantStats;
}

/** Contexto del grupo al que pertenece la partida */
export interface GroupContext {
  id: string;
  name: string;
  tag: string;
  initials: string;
  color1: string;
  color2: string;
  seasonName?: string;
}

/** Resumen de objetivos y estadísticas de una escuadra (Azul o Rojo) */
export interface TeamSummary {
  side: TeamSide;
  won: boolean;
  totalKills: number;
  totalDeaths: number;
  totalAssists: number;
  totalGold: number;
  totalDamage: number;
  dragons: number;
  barons: number;
  towers: number;
  participants: MatchParticipant[];
}

/**
 * Hitos de la partida. Cuentan cómo se decidió sin necesitar telemetría por minuto, que es
 * justo el dato que no tenemos (haría falta la Match Timeline API de Riot).
 */
export interface MatchMilestones {
  /** Quién hizo la primera sangre. */
  firstBloodParticipantId?: string;
  firstTowerTeam?: TeamSide;
  firstDragonTeam?: TeamSide;
  firstBaronTeam?: TeamSide;
}

/** Entidad completa de una partida disputada */
export interface Match {
  id: string;
  code?: string;
  groupId: string;
  group: GroupContext;
  source: MatchSource;
  durationSeconds: number;
  /** ISO-8601. El formato lo decide la presentación (`shared/date-format.ts`), nunca el DTO. */
  decidedAt: string;
  winningTeam: TeamSide;
  blueTeam: TeamSummary;
  redTeam: TeamSummary;
  mvpParticipantId?: string;
  milestones?: MatchMilestones;

  /** Metadatos resueltos para el usuario logueado en la sesión actual */
  userParticipant?: MatchParticipant;
  userOutcome?: MatchResultOutcome;
}

/** Resumen analítico del historial de un usuario */
export interface UserMatchHistorySummary {
  totalMatches: number;
  wins: number;
  losses: number;
  winrate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  avgKdaRatio: string;
  mostPlayedRole: Lane | null;
  mostPlayedRoleCount: number;
  mostPlayedChampionId: number | null;
  mostPlayedChampionName: string | null;
}

/** Resumen analítico del historial de un grupo */
export interface GroupMatchHistorySummary {
  totalMatches: number;
  blueSideWins: number;
  redSideWins: number;
  blueWinrate: number;
  avgDurationMinutes: number;
  topMvpName: string | null;
  topMvpCount: number;
}
