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
}

/** Cuerpo de `PUT /me/settings`. Escritura completa: van todos los ajustes, no un parche. */
export type UpdateUserSettingsRequest = UserSettings;
