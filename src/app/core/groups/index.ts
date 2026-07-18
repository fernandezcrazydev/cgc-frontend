/* Superficie pública del dominio de grupos. El resto de la app importa de aquí
 * (`core/groups`) y nunca de los ficheros sueltos: así los `*Api` quedan privados y pueden
 * cambiar sin arrastrar a nadie. */
export { GroupsStore, type CreateGroupInput } from './groups-store';
export { InvitationsStore, type InvitationsStatus } from './invitations-store';
export {
  REGIONS,
  type Region,
  type GroupRole,
  type CreateGroupRequest,
  type GroupResponse,
  type GroupMembershipResponse,
  type InvitationResponse,
  type InvitationStatus,
  type InviteRequest,
  type ChangeRoleRequest,
  type TransferOwnershipRequest,
} from './models';
