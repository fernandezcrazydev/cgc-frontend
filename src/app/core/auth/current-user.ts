/**
 * Contrato de `GET /api/v1/me`.
 *
 * Es un espejo EXACTO del `MeResponse` del backend, no del `AppUser` de la BD:
 * `id`, `email` y `globalRole` no se exponen al navegador a propósito. Si añades
 * un campo aquí sin añadirlo allí, llegará `undefined` en runtime sin que el
 * compilador diga nada.
 *
 * El rol NO viaja en esta respuesta: viaja en el claim `roles` del access token
 * (ver `Auth.isAdmin`).
 */
export interface CurrentUser {
  discordUsername: string;
  /** URL absoluta al CDN de Discord. Null si el usuario no tiene avatar puesto. */
  avatarUrl: string | null;
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
