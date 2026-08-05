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
}

/** Cuerpo de `PUT /me/settings`. Escritura completa: van todos los ajustes, no un parche. */
export type UpdateUserSettingsRequest = UserSettings;
