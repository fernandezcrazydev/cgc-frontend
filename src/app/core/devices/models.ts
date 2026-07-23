/**
 * Un dispositivo de escritorio vinculado: una sesión viva de la app (cgc-scraper) para esta
 * cuenta. Contrato de `GET /api/v1/me/devices` (backend: `DeviceResponse`).
 *
 * Es la sesión que la app obtuvo al emparejar (o por el deep-link): con ella sube partidas y lee
 * el perfil. Aquí se listan y se revocan — cortar una máquina perdida o compartida. El `id` es el
 * asa para revocarla; no hay token a la vista, y no debe haberlo.
 */
export interface LinkedDevice {
  /** Id de la autorización; lo que consume `DELETE /me/devices/{id}`. */
  id: string;
  /** Permisos concedidos a la sesión (`profile:read`, `matches:upload`). */
  scopes: string[];
  /** ISO-8601: cuándo se vinculó la sesión. Formatear es cosa de la vista. */
  linkedAt: string;
  /** ISO-8601: cuándo caduca del todo (a los 90 días), o null si el backend no lo dio. */
  expiresAt: string | null;
}
