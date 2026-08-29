/* Superficie pública del dominio de grupos. El resto de la app importa de aquí
 * (`core/groups`) y nunca de los ficheros sueltos: así los `*Api` quedan privados y pueden
 * cambiar sin arrastrar a nadie. */
export { GroupsStore, MOCK_GROUP_VIEWS, type CreateGroupInput, type GroupsStatus } from './groups-store';
export { GroupDetailStore, type GroupDetailStatus } from './group-detail-store';
export { GroupBridge, type GroupBridgeStatus } from './group-bridge';
export { InvitationsStore, type InvitationsStatus } from './invitations-store';
export {
  GroupInvitationsStore,
  type GroupInvitationsStatus,
} from './group-invitations-store';
export {
  groupView,
  groupViewFrom,
  groupRoleLabel,
  initialsOf,
  bannerColors,
  type GroupView,
} from './group-view';
export {
  REGIONS,
  MATCHMAKING_PRESETS,
  MATCHMAKING_PRESET_INFO,
  type Region,
  type MatchmakingPreset,
  type GroupRole,
  type CreateGroupRequest,
  type GroupResponse,
  type GroupMembershipResponse,
  type GroupMemberResponse,
  type InvitationResponse,
  type InvitationStatus,
  type InviteRequest,
  type GroupInvitationResponse,
  type ChangeRoleRequest,
  type TransferOwnershipRequest,
} from './models';
