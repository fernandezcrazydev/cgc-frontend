/**
 * Contrato de `GET /api/v1/me`.
 *
 * Es un espejo EXACTO del `MeResponse` del backend, no del `AppUser` de la BD:
 * `email` y `globalRole` no se exponen al navegador a propósito. Si añades un
 * campo aquí sin añadirlo allí, llegará `undefined` en runtime sin que el
 * compilador diga nada.
 *
 * El rol NO viaja en esta respuesta: viaja en el claim `roles` del access token
 * (ver `Auth.isAdmin`).
 */
export interface CurrentUser {
  /**
   * UUID del usuario en NUESTRA base de datos (no el snowflake de Discord). Es el
   * id estable con el que el backend referenciará al jugador en el resto de
   * dominios (miembros, partidas, ranking); nunca referenciar por `discordUsername`.
   */
  userId: string;
  discordUsername: string;
  /** URL absoluta al CDN de Discord. Null si el usuario no tiene avatar puesto. */
  avatarUrl: string | null;
  /** Alta en la plataforma. ISO-8601 UTC (`Instant` de Java); se formatea en presentación. */
  createdAt: string;
}

/**
 * Iniciales para el avatar de reserva: las dos primeras letras/dígitos del nombre.
 * Discord permite nombres de un solo carácter y con símbolos, así que se filtra
 * antes de recortar en vez de hacer `slice(0, 2)` a pelo.
 */
export function initialsOf(username: string | null | undefined): string {
  const alnum = (username ?? '').replace(/[^\p{L}\p{N}]/gu, '');
  return alnum.slice(0, 2).toUpperCase() || '??';
}
