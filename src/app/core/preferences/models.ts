/**
 * Preferencias globales del jugador (a nivel de cuenta, no de grupo).
 *
 * Contrato: estas interfaces son el espejo del DTO que devolverá el backend en
 * `GET /api/v1/me/preferences`. Si el backend cambia, cambia esto.
 */

/** Los cinco roles jugables. Mismas claves que `MATCH_ROLES` de `core/matchmaking`. */
export type LaneRole = 'TOP' | 'JUNGLA' | 'MID' | 'ADC' | 'SUPPORT';

export const LANE_ROLES = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'] as const satisfies readonly LaneRole[];

/**
 * Roles que el jugador quiere jugar, elegidos una sola vez a nivel global.
 *
 * BACKEND NOTE: al aceptar la invitación a un grupo, el servidor siembra los
 * roles del nuevo miembro con estas preferencias (el grupo puede luego
 * ajustarlos sin tocar el perfil global). Esa propagación es del backend: el
 * front solo lee/escribe la preferencia.
 */
export interface RolePreferences {
  /**
   * Roles que el jugador está dispuesto a jugar, sin orden. Los cinco = FLEX
   * (equivale al `roles: []` que el matchmaking interpreta como "cualquiera").
   */
  roles: LaneRole[];
  /**
   * Rol favorito. Siempre contenido en `roles`, o `null` si no hay ninguno
   * seleccionado. El matchmaking lo usará como desempate, no como restricción.
   */
  primary: LaneRole | null;
}
