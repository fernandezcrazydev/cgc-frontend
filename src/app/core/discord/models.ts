/**
 * Espejo de `GroupDiscordLinkResponse`: a qué servidor y canal de Discord escribe un grupo.
 *
 * Un grupo sin conectar no es un error, es el estado de partida: el backend responde 200 con
 * `linked: false` para que la pantalla pueda pintar el vacío con su llamada a la acción en vez
 * de un 404 que parecería una avería.
 */
export interface GroupDiscordLink {
  linked: boolean;
  guildId: string | null;
  channelId: string | null;
  linkedAt: string | null;
  /** Nombre de quien lo configuró. Vacío si esa cuenta ya no existe: el vínculo la sobrevive. */
  linkedByName: string | null;
  /**
   * En false, los últimos envíos han fallado seguidos —al bot lo han echado del servidor, o han
   * borrado el canal—. El vínculo sigue guardado y parece correcto, así que sin esto la pantalla
   * diría "conectado" mientras no llega nada.
   */
  linkHealthy: boolean;
}

/** Cuerpo de `PUT /groups/{id}/discord-link`. Los dos ids se copian a mano desde Discord. */
export interface LinkDiscordRequest {
  guildId: string;
  channelId: string;
}

/** Espejo de `DiscordBotInfoResponse`. */
export interface DiscordBotInfo {
  /** False si la integración está apagada en este servidor: no hay nada que conectar. */
  enabled: boolean;
  /** URL que añade el bot a un servidor, con los permisos justos. La construye el backend. */
  botInviteUrl: string;
}
