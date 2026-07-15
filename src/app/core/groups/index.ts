/* Superficie pública del dominio de grupos. El resto de la app importa de aquí
 * (`core/groups`) y nunca de los ficheros sueltos: así `GroupsApi` queda privado y puede
 * cambiar sin arrastrar a nadie. */
export { GroupsStore, type CreateGroupInput } from './groups-store';
export {
  REGIONS,
  type Region,
  type GroupRole,
  type CreateGroupRequest,
  type GroupResponse,
  type GroupMembershipResponse,
} from './models';
