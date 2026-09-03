import { LolTier } from '../group-ranking';

/**
 * Resultado individual de búsqueda de jugador para el buscador global.
 *
 * BACKEND NOTE: Al migrar a backend real (Fase 6), esta interfaz será el
 * contrato espejo de `PlayerSearchResponse` de `GET /api/v1/players/search`.
 */
export interface PlayerSearchResult {
  type: 'player';
  /** UUID del usuario en el sistema si está registrado */
  userId?: string;
  /** Nombre de usuario de Discord */
  discordUsername: string;
  /** Riot ID del LoL en formato Nombre#TAG */
  riotId: string;
  /** Avatar de Discord (URL absoluta) o null para fallback con iniciales */
  avatarUrl: string | null;
  /** Iniciales para el avatar cuando no hay avatarUrl */
  initials: string;
  /** Tonalidad (0-360) para el degradado del avatar */
  hue: number;
  /** Tier competitivo de LoL (para el escudo vectorial) */
  rankTier: LolTier;
  /** División (I, II, III, IV) o null para Master+ */
  rankDivision: string | null;
  /** Abreviatura legible del rango (ej. "G2", "D4", "S1", "E2", "CH") */
  rankBadge: string;
  /** Nombre completo accesible del rango (ej. "Oro II", "Diamante IV") */
  rankLabel?: string;
  /** Número de grupos que comparte con el usuario actual */
  commonGroupsCount: number;
  /**
   * Si el perfil es privado.
   * Regla de privacidad: un perfil privado solo aparece en búsquedas si
   * comparte al menos un grupo con quien busca (commonGroupsCount > 0).
   */
  isPrivate?: boolean;
}

/**
 * Resultado de búsqueda de un grupo en el buscador global.
 */
export interface GroupSearchResultItem {
  type: 'group';
  id: string;
  name: string;
  tag: string;
  region: string;
  initials: string;
  c1: string;
  c2: string;
  avatarUrl: string | null;
  membersCount: number;
  isMember: boolean;
}

/** Elemento unificado del buscador global (puede ser jugador o grupo) */
export type GlobalSearchItem = PlayerSearchResult | GroupSearchResultItem;
