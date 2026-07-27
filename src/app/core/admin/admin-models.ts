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
