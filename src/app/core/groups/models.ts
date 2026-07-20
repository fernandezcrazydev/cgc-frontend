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

/**
 * Campos de texto de `POST /api/v1/groups`. La foto viaja en la MISMA petición como parte
 * multipart `file` (opcional) —no en un segundo paso—, así que no cabe en esta interfaz: el
 * `GroupsApi.create` la recibe aparte como `Blob` y arma el `FormData`.
 */
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

/**
 * Un miembro del roster de un grupo (`GroupMemberResponse` del backend). El `userId` es el UUID
 * que necesitan expulsar / cambiar rol / transferir; `discordUsername` y `avatarUrl` son para
 * pintar la fila. `role` es el nombre del enum; `joinedAt` es ISO-8601 (antigüedad).
 */
export interface GroupMemberResponse {
  userId: string;
  discordUsername: string;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt: string;
}

/** Estado de una invitación (`InvitationStatus` en el backend). `REVOKED` = el grupo la retiró. */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED';

/**
 * Una invitación a un grupo (`InvitationResponse` del backend). El invitado se referencia
 * por su `userId` (UUID de `app_user.id`), nunca por nombre. No trae `groupName` ni quién
 * invitó: para pintar la tarjeta se usan los `data` de la notificación asociada.
 */
export interface InvitationResponse {
  id: string;
  groupId: string;
  inviteeUserId: string;
  status: InvitationStatus;
  /** ISO-8601 tal cual lo manda el backend; formatear es cosa de la vista. */
  createdAt: string;
}

/** Body de `POST /groups/{groupId}/invitations`: a quién se invita, por su UUID. */
export interface InviteRequest {
  inviteeUserId: string;
}

/**
 * Una invitación pendiente vista desde el grupo (`GroupInvitationResponse` del backend): lo que pinta
 * la pestaña "Invitados". A diferencia de `InvitationResponse` (la vista del invitado), trae el
 * `discordUsername` y `avatarUrl` del invitado para dibujar la fila sin un segundo lookup, y no lleva
 * `status` (aquí todas son PENDING por construcción) ni `groupId` (ya está en la ruta). El `id` es el de
 * la invitación —el que pide `DELETE /groups/{groupId}/invitations/{id}` para cancelarla—.
 */
export interface GroupInvitationResponse {
  id: string;
  inviteeUserId: string;
  discordUsername: string | null;
  avatarUrl: string | null;
  /** ISO-8601 tal cual lo manda el backend; formatear es cosa de la vista. */
  createdAt: string;
}

/**
 * Body de `PUT /groups/{groupId}/members/{userId}/role`. `OWNER` no es asignable por esta
 * vía (el backend responde 409: la propiedad se mueve por transferencia), pero el tipo lo
 * admite porque el enum es el mismo; la restricción es de dominio, no de forma.
 */
export interface ChangeRoleRequest {
  role: GroupRole;
}

/** Body de `PUT /groups/{groupId}/owner`: el nuevo owner, por su UUID de miembro. */
export interface TransferOwnershipRequest {
  newOwnerId: string;
}
