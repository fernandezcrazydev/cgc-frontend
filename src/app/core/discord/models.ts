/**
 * Espejo de `GroupDiscordLinkResponse`: a qué servidor y canal de Discord escribe un grupo.
 *
 * Tiene **tres** estados, no dos, porque conectar exige una ida y vuelta a Discord:
 *
 * - sin `guildId` → no se ha hecho nada. El asistente arranca en el paso 1.
 * - con `guildId` y sin `channelId` → el bot ya está en el servidor pero nadie ha dicho dónde
 *   escribe. El asistente retoma en el paso 2, sin repetir el viaje a Discord.
 * - con los dos (`linked: true`) → los avisos salen.
 *
 * `linked` responde solo a "¿llegan los avisos?", que es lo único que pregunta el resto de la
 * pantalla. El estado intermedio se distingue por `guildId`, así que ningún booleano tiene que
 * significar dos cosas a la vez.
 *
 * Un grupo sin conectar no es un error: el backend responde 200 para que la pantalla pinte el vacío
 * con su llamada a la acción en vez de un 404 que parecería una avería.
 */
export interface GroupDiscordLink {
  linked: boolean;
  guildId: string | null;
  /** Nombre del servidor, para pintar. Foto del momento de vincular: puede quedarse viejo. */
  guildName: string | null;
  channelId: string | null;
  /** Nombre del canal, sin el `#`. Misma foto que `guildName`. */
  channelName: string | null;
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

/**
 * Cuerpo de `PUT /groups/{id}/discord-link`. **Solo el canal**: el servidor lo fijó Discord al
 * autorizar al bot y lo lee el backend de su propia fila. Mandarlo desde aquí devolvería justo la
 * capacidad que el asistente quita —nombrar un servidor que nadie ha demostrado administrar—.
 */
export interface LinkDiscordChannelRequest {
  channelId: string;
}

/** Espejo de `DiscordAuthorizationStartResponse`. */
export interface DiscordAuthorizationStart {
  /** A dónde llevar el navegador para que Discord pregunte en qué servidor va el bot. */
  authorizationUrl: string;
}

/** Una opción del desplegable de canales. */
export interface DiscordGuildChannel {
  id: string;
  name: string;
  /** Categoría de la que cuelga, o null si está suelto arriba del todo. */
  categoryName: string | null;
}

/** Espejo de `DiscordGuildChannelsResponse`. Lista vacía = servidor sin canales escribibles. */
export interface DiscordGuildChannels {
  guildId: string;
  guildName: string | null;
  /** Solo los canales donde el bot puede ver Y escribir. El backend ya ha filtrado el resto. */
  channels: DiscordGuildChannel[];
  /**
   * Cómo se llama el rol del bot en ese servidor, o null si no se pudo averiguar. Viaja hasta
   * aquí porque es lo que hay que teclear en el diálogo de permisos de Discord: "dale acceso al
   * rol del bot" no se puede seguir sin saber cómo se llama.
   */
  botRoleName: string | null;
  /** Canales de texto que se han quedado fuera por permisos. Explica una lista corta o vacía. */
  hiddenChannels: number;
}

/** Espejo de `DiscordBotInfoResponse`. */
export interface DiscordBotInfo {
  /** False si la integración está apagada en este servidor: no hay nada que conectar. */
  enabled: boolean;
}
