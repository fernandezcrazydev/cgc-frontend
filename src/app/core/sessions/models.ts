/**
 * Una sesión viva de la cuenta: un navegador donde el usuario está dentro, o una máquina con la
 * app de escritorio (cgc-scraper). Contrato de `GET /api/v1/me/sessions` (backend:
 * `ActiveSessionResponse`).
 *
 * Sustituye a `LinkedDevice` y a `/me/devices`, que solo veía las de escritorio. El `id` es el asa
 * para cerrarla; no hay token a la vista, y no debe haberlo.
 */
export interface ActiveSession {
  /** Id de la autorización; lo que consume `DELETE /me/sessions/{id}`. */
  id: string;
  kind: SessionKind;
  /**
   * Familia del navegador ("Chrome", "Safari"), sin versión. `null` cuando el `User-Agent` no lo
   * dice o no hay navegador (la app de escritorio). **`null` significa "no se sabe", nunca "no
   * tiene"**: el backend prefiere no saber a adivinar, y la vista debe respetarlo — una etiqueta
   * equivocada sobre el portátil de alguien es lo que le hace creer que le han entrado.
   */
  browser: string | null;
  /** Familia del sistema ("Windows", "Android", "iPhone"), sin versión. `null` con el mismo criterio. */
  operatingSystem: string | null;
  /** Permisos de la sesión (`profile:read`, `matches:upload`). Vacío en las de navegador. */
  scopes: string[];
  /** ISO-8601: cuándo empezó la sesión. Formatear es cosa de la vista. */
  startedAt: string;
  /** ISO-8601: último acceso. Granularidad de refresh (~15 min), no de petición. */
  lastSeenAt: string;
  /** ISO-8601: cuándo muere sola (30 días en navegador, 90 en la app), o null si el backend no lo dio. */
  expiresAt: string | null;
  /**
   * La sesión desde la que se está mirando esta pantalla. No se puede cerrar (el backend responde
   * 409): cerrar la propia y cerrar una remota se parecen demasiado en pantalla y significan cosas
   * muy distintas. Para la propia está el botón de cerrar sesión.
   */
  current: boolean;
}

/** De dónde viene la sesión. Espejo del enum del backend. */
export type SessionKind = 'WEB' | 'DESKTOP_APP';
