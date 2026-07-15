/**
 * Interfaces espejo de los DTOs del backend de grupos. Replican EXACTAMENTE lo que
 * viaja por HTTP (como `CurrentUser` ↔ `MeResponse`): si el backend cambia el contrato,
 * se cambia aquí, no se parchea en las vistas.
 *
 * Fuente: `com.cgc.cc.groups.adapters.in.controller` (request/ y response/) del backend.
 */

/** Región de juego. Enum cerrado en el backend (`Region`); mismos valores, mismo orden. */
export const REGIONS = [
  'EUW', 'EUNE', 'NA', 'KR', 'LAN', 'LAS', 'BR', 'OCE', 'TR', 'RU', 'JP', 'SEA',
] as const;
export type Region = (typeof REGIONS)[number];

/** Rol dentro de un grupo (`GroupRole` en el backend). */
export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/** Body de `POST /api/v1/groups`. La foto NO va aquí: se sube en un segundo paso. */
export interface CreateGroupRequest {
  name: string;
  region: Region;
}

/**
 * Respuesta de crear/subir avatar y elemento de la lista de grupos. El id público es
 * `groupId` (UUID); `avatarUrl` es null mientras el grupo no tenga foto.
 */
export interface GroupResponse {
  groupId: string;
  name: string;
  region: Region | null;
  avatarUrl: string | null;
}

/** Un elemento de `GET /api/v1/me/groups`: el grupo más el rol del llamante. */
export interface GroupMembershipResponse {
  group: GroupResponse;
  role: GroupRole;
  /** ISO-8601 tal cual lo manda el backend; formatear es cosa de la vista. */
  joinedAt: string;
}
