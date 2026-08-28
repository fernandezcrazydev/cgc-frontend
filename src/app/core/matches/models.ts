import { NfLane } from '../../ui/lane-icon/nf-lane-icon';

export type Lane = NfLane;
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

/** Entidad completa de una partida disputada */
export interface Match {
  id: string;
  code?: string;
  groupId: string;
  group: GroupContext;
  source: MatchSource;
  mode: string;
  durationSeconds: number;
  durationFormatted: string;
  decidedAt: string;
  dateFormatted: string;
  winningTeam: TeamSide;
  blueTeam: TeamSummary;
  redTeam: TeamSummary;
  mvpParticipantId?: string;

  /** Metadatos resueltos para el usuario logueado en la sesión actual */
  userParticipant?: MatchParticipant;
  userOutcome?: MatchResultOutcome;
}

/** Estado de filtrado de partidas */
export interface MatchFilterState {
  groupId: string | 'all';
  role: Lane | 'all';
  championId: number | 'all';
  outcome: 'all' | 'win' | 'loss';
  searchQuery?: string;
  sortBy: 'date-desc' | 'date-asc' | 'duration-desc' | 'kills-desc';
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
