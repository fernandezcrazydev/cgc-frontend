import { PageResponse } from '../http';

export type LeagueStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
export type LeagueType = 'COMPETITIVE' | 'CASUAL';
export type StreakType = 'WIN' | 'LOSS';

/**
 * Columnas por las que el servidor sabe ordenar la clasificación.
 *
 * No hay `'LANE'` a propósito: el rol principal no tiene todavía ninguna fuente de datos, así
 * que ofrecerlo sería ordenar por nada. Vuelve cuando la subida de partidas lo haga real.
 */
export type LeaderboardSort = 'RANK' | 'WINRATE';
export type SortDirection = 'ASC' | 'DESC';

/**
 * Representa una liga del backend (`LeagueResponse`).
 */
export interface LeagueResponse {
  id: string;
  groupId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: LeagueStatus;
  type: LeagueType;
  playerCount: number;
}

/**
 * Cuerpo de `POST /groups/{groupId}/leagues`.
 *
 * NO lleva `status`, y esa ausencia es deliberada: el estado de una liga es una función de sus
 * fechas y lo decide el servidor (`startsAt` en el futuro nace `NOT_STARTED` y arranca solo;
 * `startsAt` ya pasado nace `IN_PROGRESS`). Mientras el campo existió aquí, el cliente podía
 * pedir una liga en un estado que nada arrancaba y nada caducaba. El backend lo ignora.
 *
 * `startsAt` puede faltar: entonces la temporada empieza en el momento de crearla.
 */
export interface CreateLeagueRequest {
  name: string;
  startsAt?: string;
  endsAt: string;
  type?: LeagueType;
}

/**
 * Sugerencia de autocompletado devuelta por el buscador predictivo del backend.
 */
export interface LeaderboardSearchSuggestion {
  /** Puesto oficial en la liga, el mismo que pinta la columna "Pos". */
  rank: number;
  /**
   * Página en la que cae el jugador, **0-based** igual que el parámetro `page` del endpoint
   * de la tabla. El servidor la resuelve para el orden que se le pase, porque el mismo jugador
   * está en una página distinta según se ordene por puesto o por winrate.
   */
  page: number;
  userId: string;
  discordUsername: string;
  riotId: string | null;
  lp: number;
}

/**
 * Fila individual del Leaderboard devuelta por la API.
 *
 * Lo que NO está aquí importa tanto como lo que está: no hay `recentMatches`, ni `mainLane`, ni
 * `mainChampionId`. Esos datos salen de la subida de partidas, que todavía no existe, y el
 * contrato no promete lo que el servidor no tiene: las columnas que los pintaban muestran su
 * estado "sin datos" hasta entonces.
 *
 * `lpHistory`, `avgLpGain` y `avgLpLoss` SÍ están, y salen del ledger de LP: llegaron con él y
 * este javadoc seguía diciendo que no existían tres líneas por encima de sus propios campos.
 */
export interface LeaderboardEntryResponse {
  rank: number;
  userId: string;
  discordUsername: string;
  avatarUrl: string | null;
  riotId: string | null;
  /** Tier de Riot en mayúsculas (`BRONZE`), o `null` si la cuenta no está vinculada. */
  riotTier: string | null;
  /** División (`II`), o `null` en los tiers que no la tienen (Master y por encima). */
  riotRank: string | null;
  riotStrength: string | null;
  /**
   * Rango del jugador EN EL GRUPO (`OWNER` / `ADMIN` / `MEMBER`).
   *
   * Lo necesita la tabla para saber a quién puede expulsar quien mira. Antes no venía y había que
   * cruzarlo con el roster del grupo por otra vía: dos fuentes para un dato que se sirve en la
   * misma fila.
   */
  groupRole: string | null;
  lp: number;
  wins: number;
  losses: number;
  totalGames: number;
  winrate: number;
  streakCount: number;
  streakType: StreakType;
  isBanned: boolean;
  /**
   * Motivo de la sanción, o `null` si el jugador no está sancionado.
   *
   * Viene del servidor. Antes la interfaz pintaba una constante escrita a mano en el cliente
   * («Jugador sancionado - Fuera de competición»), que era lo mismo para todos porque no había
   * ningún motivo guardado en ninguna parte.
   */
  banReason: string | null;
  /** Cuándo termina la sanción, o `null` si es indefinida (o si no hay sanción). */
  bannedUntil: string | null;
  /**
   * Últimos valores de LP, del más antiguo al más reciente, para dibujar la tendencia.
   *
   * **Vacía** cuando el jugador aún no tiene movimientos. Eso es "nada que dibujar", que no es lo
   * mismo que una línea plana — un jugador que se mantiene en el mismo LP sí tiene una serie.
   */
  lpHistory: number[];
  /** Media real de LP ganados por partida, o `null` si aún no ha ganado ninguna. */
  avgLpGain: number | null;
  /** Media real de LP perdidos (magnitud positiva), o `null` si aún no ha perdido ninguna. */
  avgLpLoss: number | null;
}

/**
 * Respuesta completa del Leaderboard (`GET /api/v1/groups/{groupId}/leaderboard`).
 *
 * `entries` es una PÁGINA, no la liga entera: la paginación es de servidor. `podium` y
 * `totalPlayers` viajan fuera de esa página porque son de la liga completa — el podio es el
 * top 3 global, no el de la página que se esté viendo, y `totalPlayers` es el contador que
 * se pinta ("24 jugadores"), nunca `entries.content.length`.
 */
export interface LeaderboardResponse {
  league: LeagueResponse;
  podium: LeaderboardEntryResponse[];
  entries: PageResponse<LeaderboardEntryResponse>;
  totalPlayers: number;
  /**
   * Si quien mira puede abrir la siguiente temporada (OWNER o ADMIN del grupo).
   *
   * Lo decide el servidor, que es quien conoce el rol. Es **solo UX**: sirve para no enseñar un
   * botón que va a dar 403, no para autorizar nada — el endpoint de creación comprueba el permiso
   * por su cuenta.
   */
  canManageLeague: boolean;
  /**
   * Si al menos un jugador de la liga ha disputado alguna partida.
   *
   * No es lo mismo que "hay miembros": el creador de un grupo cuenta siempre como miembro, así
   * que `totalPlayers` nunca es cero y no sirve para detectar una liga sin competir. Esta bandera
   * mira el historial real, y es lo que distingue "liga con gente pero sin partidas todavía" de
   * "liga en marcha". Se calcula sobre la liga ENTERA en el servidor, no sobre esta página.
   */
  hasActivity: boolean;
}

/**
 * Cuerpo de `PUT /groups/{groupId}/leaderboard/{userId}/sanction`.
 *
 * `until` nulo = sanción indefinida. Es `PUT` y no `POST` porque el backend la trata como
 * idempotente: sancionar a quien ya lo está actualiza motivo y fecha, no acumula sanciones.
 */
export interface SanctionPlayerRequest {
  reason: string;
  /** ISO-8601, o `null` para una sanción sin fecha de fin. */
  until: string | null;
}
