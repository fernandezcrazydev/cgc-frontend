/**
 * Interfaz espejo de `UserSearchResponse` del backend. Un resultado del buscador de usuarios
 * para invitar a un grupo: el `userId` (UUID público) que pide `POST /groups/{id}/invitations`,
 * más los dos campos con los que se pinta. Nunca llegan `email`, `discordId` ni `globalRole`.
 */
export interface UserSearchResult {
  userId: string;
  discordUsername: string;
  avatarUrl: string | null;
}
