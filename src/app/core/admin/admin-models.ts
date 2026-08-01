/** Contratos de las acciones puntuales de administración (directorio `/app/admin`). */

/**
 * Resumen de una sincronización manual de iconos de perfil de Riot. Espejo de
 * `RiotProfileIconSyncReportResponse` del backend (`total`/`updated`/`failed`, todos `int`).
 */
export interface RiotProfileIconSyncReport {
  total: number;
  updated: number;
  failed: number;
}

/**
 * Foto de la ventana deslizante del rate limit de Riot. Espejo de `RiotApiUsageResponse`.
 *
 * Los instantes vienen en ISO y son del SERVIDOR: la cuenta atrás se calcula contra
 * `serverTime`, nunca contra `Date.now()`. Un portátil con el reloj desviado enseñaría si no
 * un "quedan 41 s" tranquilamente equivocado.
 *
 * `riotCount` es lo que dice Riot para la misma ventana, y puede ser MAYOR que `used`:
 * compartimos la API key con la app antigua de chiringuicustom, así que la diferencia entre
 * los dos números es justo lo que se está gastando la otra app. `null` si no hay lectura fresca.
 */
export interface RiotApiUsage {
  used: number;
  limit: number;
  windowSeconds: number;
  rateLimited: number;
  riotCount: number | null;
  riotCountAt: string | null;
  /** Cuándo se libera el primer hueco. `null` si no estamos reteniendo nada. */
  nextSlotAt: string | null;
  /** Cuándo la ventana vuelve a cero del todo. `null` si ya lo está. */
  windowClearAt: string | null;
  serverTime: string;
}

/** Cabecera de la pantalla de métricas. `calls === interactive + background`, siempre. */
export interface RiotApiTotals {
  calls: number;
  rateLimited: number;
  failed: number;
  interactive: number;
  background: number;
  avgDurationMs: number;
  maxDurationMs: number;
}

/** `endpoint` es la PLANTILLA (`/lol/summoner/v4/summoners/by-puuid/{puuid}`), no una URI real. */
export interface RiotEndpointUsage {
  endpoint: string;
  calls: number;
  rateLimited: number;
  avgDurationMs: number;
}

/** Un punto de la gráfica. Las horas sin tráfico llegan con `calls: 0`, nunca ausentes. */
export interface RiotHourlyPoint {
  hour: string;
  calls: number;
  rateLimited: number;
}

/** Una de las 24 franjas horarias, agrupadas en la zona que configura el backend. */
export interface RiotPeakHour {
  hourOfDay: number;
  calls: number;
}

/** `discordUsername` y `avatarUrl` son null para un usuario que ya no existe. */
export interface RiotUserUsage {
  userId: string;
  discordUsername: string | null;
  avatarUrl: string | null;
  calls: number;
}

/** Todo lo que pinta la pantalla de métricas. Las listas llegan vacías, nunca ausentes. */
export interface RiotApiMetrics {
  windowHours: number;
  totals: RiotApiTotals;
  topEndpoints: RiotEndpointUsage[];
  hourly: RiotHourlyPoint[];
  peakHours: RiotPeakHour[];
  topUsers: RiotUserUsage[];
}
