/**
 * Preferencias de juego del jugador, a nivel de CUENTA (no de grupo).
 *
 * Contrato: estas interfaces son el espejo de los DTOs de
 * `GET/PUT /api/v1/me/preferences`. Si el backend cambia, cambia esto.
 *
 * Ojo con el vecino: `core/settings` (`/me/settings`) son los interruptores de
 * producto que el usuario toca en Ajustes. Esto es su perfil de juego, que edita
 * en Perfil. Mismo dueño, dos pantallas, dos endpoints.
 */

/** Los cinco roles jugables. Mismas claves que `MATCH_ROLES` de `core/matchmaking`. */
export type LaneRole = 'TOP' | 'JUNGLA' | 'MID' | 'ADC' | 'SUPPORT';

export const LANE_ROLES = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'] as const satisfies readonly LaneRole[];

/**
 * Roles que el jugador quiere jugar, elegidos una sola vez a nivel global.
 *
 * No dan ni quitan permisos: su único efecto es **sembrar** los roles del jugador
 * la primera vez que entra en un grupo. A partir de ahí manda la copia del grupo,
 * que editan él o un administrador; cambiar esto no toca los grupos en los que ya
 * está. Esa siembra es del servidor: el front solo lee y escribe la preferencia.
 */
export interface RolePreferences {
  /**
   * Roles que el jugador está dispuesto a jugar. Llegan siempre en orden de línea
   * (top → support), lo pinte como lo pinte la vista. Los cinco = FLEX (equivale al
   * `roles: []` que el matchmaking interpreta como "cualquiera").
   */
  roles: LaneRole[];
  /**
   * Rol favorito. Siempre contenido en `roles`, o `null` si no hay ninguno
   * marcado. El matchmaking lo usará como desempate, no como restricción.
   */
  primary: LaneRole | null;
}

/**
 * Cuerpo del `PUT`: la selección completa, no un parche. `roles` vacío es un 422
 * (`VALIDATION_FAILED` con `field: 'roles'`, `code: 'NOT_EMPTY'`): el conjunto vacío
 * es como el servidor guarda "todavía no ha elegido", así que nadie puede escribirlo.
 * Un `primary` que no esté en `roles` es un 400 `PRIMARY_LANE_NOT_CHOSEN`.
 */
export type UpdateRolePreferencesRequest = RolePreferences;
