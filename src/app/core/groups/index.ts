/* Superficie pública del dominio de grupos. El resto de la app importa de aquí
 * (`core/groups`) y nunca de los ficheros sueltos: así los `*Api` quedan privados y pueden
 * cambiar sin arrastrar a nadie. */
export { GroupsStore, type CreateGroupInput, type GroupsStatus } from './groups-store';
export { GroupDetailStore, type GroupDetailStatus } from './group-detail-store';
export { InvitationsStore, type InvitationsStatus } from './invitations-store';
export { groupView, groupViewFrom, initialsOf, bannerColors, type GroupView } from './group-view';
export {
  REGIONS,
  type Region,
  type GroupRole,
  type CreateGroupRequest,
  type GroupResponse,
  type GroupMembershipResponse,
  type GroupMemberResponse,
  type InvitationResponse,
  type InvitationStatus,
  type InviteRequest,
  type ChangeRoleRequest,
  type TransferOwnershipRequest,
} from './models';
