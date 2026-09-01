/**
 * Interfaces espejo de los DTOs del backend de grupos. Replican EXACTAMENTE lo que
 * viaja por HTTP (como `CurrentUser` ↔ `MeResponse`): si el backend cambia el contrato,
 * se cambia aquí, no se parchea en las vistas.
 *
 * Fuente: `com.cgc.cc.groups.adapters.in.controller` (request/ y response/) del backend.
 */
import type { RiotLinkStrength } from '../riot';

/** Región de juego. Enum cerrado en el backend (`Region`); mismos valores, mismo orden. */
export const REGIONS = [
  'EUW', 'EUNE', 'NA', 'KR', 'LAN', 'LAS', 'BR', 'OCE', 'TR', 'RU', 'JP', 'SEA',
] as const;
export type Region = (typeof REGIONS)[number];

/** Rol dentro de un grupo (`GroupRole` en el backend). */
export type GroupRole = 'OWNER' | 'ADMIN' | 'MEMBER';

/**
 * Cómo quiere el grupo que se equilibren sus partidas. Enum cerrado en el backend
 * (`MatchmakingPreset`); mismos valores, mismo orden.
 *
 * Se elige AL CREAR el grupo y **no se puede cambiar después**: no hay endpoint que lo
 * actualice, y no es un olvido. Cambiarlo a mitad de vida contaminaría el rating sin arreglo
 * (`docs/diseno-matchmaking.md` §14.1 del backend). Por eso el diálogo de creación tiene que
 * avisarlo — es la única oportunidad que tiene el usuario de acertar.
 *
 * "Capitanes" no está: el draft por capitanes es un modo de sala, no un algoritmo.
 */
export const MATCHMAKING_PRESETS = ['BALANCED', 'PRECISION', 'CHAOS'] as const;
export type MatchmakingPreset = (typeof MATCHMAKING_PRESETS)[number];

/**
 * El nombre y la explicación que se enseñan de cada preset. Vive aquí y no en la vista porque
 * es la traducción del enum del backend, igual que `REGIONS`: la vista pinta, no decide qué
 * significa `CHAOS`. Los textos salen de la issue #32.
 */
export const MATCHMAKING_PRESET_INFO: Record<MatchmakingPreset, { label: string; description: string }> = {
  BALANCED: {
    label: 'Equilibrado',
    description:
      'Busca la partida más balanceada posible mientras rota posiciones, incluso forzando ' +
      'autofill si hace falta. Partidas más variadas: distintos matchups, líneas y equipos.',
  },
  PRECISION: {
    label: 'Competitivo',
    description:
      'Busca el matchup más ajustado posible, tanto en MMR total como en el cara a cara por ' +
      'línea. Puede repetir equipos a menudo, pero todas las partidas salen igualadas.',
  },
  CHAOS: {
    label: 'Caos',
    description:
      'Asigna a cada jugador su peor rol y fuerza matchups descompensados a propósito, ' +
      'como handicap.',
  },
};

/**
 * Campos de texto de `POST /api/v1/groups`. La foto viaja en la MISMA petición como parte
 * multipart `file` (opcional) —no en un segundo paso—, así que no cabe en esta interfaz: el
 * `GroupsApi.create` la recibe aparte como `Blob` y arma el `FormData`.
 */
export interface CreateGroupRequest {
  name: string;
  tag?: string;
  region: Region;
  /** Inmutable una vez creado el grupo: no hay ningún otro request que lo lleve. */
  matchmakingPreset: MatchmakingPreset;
}

/**
 * Respuesta de crear/subir avatar y elemento de la lista de grupos. El id público es
 * `groupId` (UUID); `avatarUrl` es null mientras el grupo no tenga foto.
 */
export interface GroupResponse {
  groupId: string;
  name: string;
  tag?: string | null;
  region: Region | null;
  /** El preset elegido al crear. El backend NO manda el algoritmo que lo sirve: es interno. */
  matchmakingPreset: MatchmakingPreset;
  avatarUrl: string | null;
  /** Nombre opcional de la liga activa si el backend lo proporciona */
  leagueName?: string | null;
}

/** Resultado de búsqueda pública de grupos (`GET /api/v1/groups/search`). */
export interface GroupSearchResult {
  id: string;
  name: string;
  tag: string;
  region: Region | null;
  avatarUrl: string | null;
  memberCount: number;
  isMember: boolean;
  joinRequestStatus: 'NONE' | 'PENDING' | 'ACCEPTED' | 'DECLINED';
}

/** Estado de una solicitud de ingreso a un grupo. */
export type JoinRequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

/**
 * Solicitud de ingreso a un grupo (`JoinRequestResponse` del backend).
 */
export interface JoinRequestResponse {
  id: string;
  groupId: string;
  groupName: string;
  groupTag?: string | null;
  groupRegion?: Region | null;
  groupAvatarUrl?: string | null;
  userId: string;
  username: string;
  userAvatarUrl?: string | null;
  status: JoinRequestStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
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
 *
 * `riotId` (`Nombre#TAG`) y `riotStrength` van los dos a null o los dos con valor: null cuando el
 * miembro no tiene cuenta de Riot enlazada. `riotStrength` reutiliza los mismos tres valores que
 * `RiotAccount.strength` de `core/riot/models.ts` (`RiotLinkStrength`), así que el semáforo del
 * roster puede compartir el mismo switch que ya pinta el chip del perfil.
 */
export interface GroupMemberResponse {
  userId: string;
  discordUsername: string;
  avatarUrl: string | null;
  role: GroupRole;
  joinedAt: string;
  riotId: string | null;
  riotStrength: RiotLinkStrength | null;
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
