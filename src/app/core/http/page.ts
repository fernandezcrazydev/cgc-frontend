/**
 * Contrato de paginación de la API, espejo de `PageResponse<T>` del backend
 * (`shared.adapters.in.controller.response.PageResponse`).
 *
 * **Es paginación por OFFSET, no por cursor**, y es la decisión acordada para todos los
 * endpoints paginados del proyecto: el cliente manda `?page=&size=` (con `page` 0-based) y
 * recibe la porción más los totales. Vive en `core/http` y no en el `models.ts` de un dominio
 * porque no es de ninguno: lo devuelven el panel de feedback, el roster de un grupo y lo
 * devolverán los historiales de partidas.
 *
 * `totalElements` es el total de la colección ENTERA (no de esta página): es lo que alimenta
 * el `[total]` de `<nf-pagination>` y, cuando la vista lo necesita, el contador ("24 miembros").
 */
export interface PageResponse<T> {
  content: T[];
  /** Índice de la página servida, 0-based (`<nf-pagination>` es 1-based: suma 1 al pintarlo). */
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
