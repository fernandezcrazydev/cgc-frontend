/**
 * Interfaz espejo de `UserSearchResponse` del backend. Un resultado del buscador de usuarios
 * para invitar a un grupo: el `userId` (UUID público) que pide `POST /groups/{id}/invitations`,
 * más los dos campos con los que se pinta. Nunca llegan `email`, `discordId` ni `globalRole`.
 */
export interface UserSearchResult {
  userId: string;
  discordUsername: string;
  avatarUrl: string | null;
  /**
   * Si este usuario acepta invitaciones a grupos nuevos (lo apaga él desde Ajustes). Es solo
   * una pista para deshabilitar la fila del buscador: el ajuste puede cambiar entre la
   * búsqueda y el clic, así que quien decide de verdad es el POST (409
   * `INVITEE_REFUSES_INVITATIONS`).
   */
  acceptsGroupInvites: boolean;
}
