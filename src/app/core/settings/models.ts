/**
 * Interfaz espejo de `UserSettingsResponse` del backend: los ajustes que el usuario controla
 * de su propia cuenta. No lleva `userId` — los únicos ajustes que se pueden leer o escribir
 * son los del token, así que no hay a quién más apuntar.
 *
 * `allowGroupInvites` en false significa que nadie puede invitar a esta persona a un grupo
 * nuevo: `POST /groups/{id}/invitations` responde 409 `INVITEE_REFUSES_INVITATIONS`.
 */
export interface UserSettings {
  allowGroupInvites: boolean;
  /**
   * En false, esta persona sigue apareciendo mencionada en los mensajes de Discord —la lista de
   * quién juega no es secreta y media lista se leería como un fallo— pero queda fuera de
   * `allowed_mentions`, así que no le llega notificación. Y no recibe el privado de "subes a
   * titular". La campanita de la web sigue igual: este interruptor solo apaga Discord.
   */
  discordNotifications: boolean;
  /**
   * Quién puede ver las **agregaciones sobre ti**: hoy el cruce con otro jugador, y el día que
   * existan el perfil y la tier list personal.
   *
   * En `GROUP_ADMINS` solo pasan tú y los admins (OWNER o ADMIN) de un grupo que compartáis;
   * `GET /me/matches?with={tú}` y su resumen responden `403 PROFILE_PRIVATE` a todos los demás.
   *
   * **No tapa las partidas.** Sigues saliendo en el historial del grupo con tu nombre y tu
   * campeón, y en los diez asientos de cada una que jugaste: esa partida es del grupo, no tuya, y
   * esconderla dejaría una clasificación que el historial no puede explicar. La línea es «las
   * agregaciones sobre una persona», y esa es toda la línea.
   */
  profileVisibility: ProfileVisibility;
}

/**
 * Los dos estados de la visibilidad del perfil, tal y como los nombra el backend.
 *
 * Un enum de dos y no un booleano: `profilePrivate: true` habría que renombrarlo el día que
 * aparezca un tercer público (una lista blanca, o una preferencia por grupo), y el nombre de un
 * campo es la parte del contrato que más cuesta cambiar.
 */
export type ProfileVisibility = 'PUBLIC' | 'GROUP_ADMINS';

/** Cuerpo de `PUT /me/settings`. Escritura completa: van todos los ajustes, no un parche. */
export type UpdateUserSettingsRequest = UserSettings;
