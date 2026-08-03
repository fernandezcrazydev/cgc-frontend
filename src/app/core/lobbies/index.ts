/* Superficie pública del dominio de convocatorias. El resto de la app importa de aquí
 * (`core/lobbies`) y nunca de los ficheros sueltos: así `LobbiesApi` queda privado y puede
 * cambiar sin arrastrar a nadie. */
export { LobbiesStore, type LobbiesStatus } from './lobbies-store';
export { LobbyDetailStore, type LobbyDetailStatus } from './lobby-detail-store';
export {
  MAX_SLOTS,
  MAX_NOTE_LENGTH,
  type LobbyMode,
  type LobbyStatus,
  type LobbyResponse,
  type LobbySlotResponse,
  type LobbyParticipantResponse,
  type CreateLobbyRequest,
} from './models';
