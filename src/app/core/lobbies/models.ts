/**
 * Interfaces espejo de los DTOs del backend de convocatorias. Replican EXACTAMENTE lo que viaja
 * por HTTP: si el backend cambia el contrato, se cambia aquí, no se parchea en las vistas.
 *
 * Fuente: `com.cgc.cc.lobbies.adapters.in.controller` (request/ y response/) del backend.
 */

/**
 * Cómo se eligen los diez. Enum cerrado en el backend (`LobbyMode`).
 *
 * `MANUAL` (el admin los elige a mano) está declarado pero el backend todavía no lo escribe:
 * llega con el wizard de restricciones.
 */
export type LobbyMode = 'OPEN' | 'MANUAL';

/**
 * En qué punto de su vida está una convocatoria (`LobbyStatus` del backend).
 *
 * Esta fase solo produce los tres primeros; `DRAFTING`/`LIVE`/`FINISHED` los pondrá el wizard y
 * la resolución de resultado, y están aquí porque el enum del backend ya los tiene.
 */
export type LobbyStatus =
  | 'POLLING'
  | 'CONFIRMED'
  | 'DRAFTING'
  | 'LIVE'
  | 'FINISHED'
  | 'CANCELLED';

/**
 * Una persona en una franja. `userId` es el UUID público de `app_user`: es la clave con la que
 * se decide si una fila eres tú, nunca el nombre de Discord.
 *
 * `discordUsername` y `avatarUrl` pueden venir a null si la cuenta desapareció y su marca
 * sobrevivió; el asiento se sigue mandando para que el contador y la lista no se contradigan.
 */
export interface LobbyParticipantResponse {
  userId: string;
  discordUsername: string | null;
  avatarUrl: string | null;
  /** ISO-8601. El orden de llegada: es lo único que decide quién juega y quién espera. */
  joinedAt: string;
}

/**
 * Una franja horaria candidata con quién puede a esa hora.
 *
 * **El reparto titulares/suplentes lo hace el servidor**, no esta app: "los diez primeros en
 * llegar juegan" es regla de negocio, y reimplementarla aquí sería una segunda versión que
 * mantener en sintonía. La vista pinta las listas que le dan.
 *
 * `signedUp` es titulares + suplentes, o sea el "8/10" de la pantalla. Viene dado y no se deriva
 * para que el número en pantalla no pueda discrepar del que cree el servidor.
 */
export interface LobbySlotResponse {
  id: string;
  /** ISO-8601 en UTC. Formatear en la zona del que mira es cosa de la vista. */
  startsAt: string;
  signedUp: number;
  starters: LobbyParticipantResponse[];
  bench: LobbyParticipantResponse[];
}

/**
 * Una convocatoria completa (`LobbyResponse` del backend). Una sola forma para los dos estados:
 * mientras se recoge disponibilidad hay varias franjas, y al confirmarse queda exactamente una
 * con `confirmedSlotId` apuntando a ella.
 *
 * `capacity` viaja en vez de darse por supuesto que son 10: es el denominador de cada "8/10", y
 * fijarlo en el cliente sería una segunda fuente de verdad.
 */
export interface LobbyResponse {
  id: string;
  groupId: string;
  /** Código corto tipo "WX4K", único dentro del grupo. */
  code: string;
  mode: LobbyMode;
  status: LobbyStatus;
  capacity: number;
  note: string | null;
  /** Quien convocó. `joinedAt` aquí es la fecha de creación: convocar no es apuntarse. */
  openedBy: LobbyParticipantResponse;
  /** La franja que se llenó, o null mientras se recoge disponibilidad. */
  confirmedSlotId: string | null;
  createdAt: string;
  slots: LobbySlotResponse[];
}

/**
 * Body de `POST /groups/{groupId}/lobbies`. Entre 1 y {@link MAX_SLOTS} instantes ISO-8601.
 *
 * Una sola franja es una convocatoria perfectamente válida: significa que la hora ya está
 * decidida y no hay nada que votar.
 */
export interface CreateLobbyRequest {
  slotStartTimes: string[];
  note?: string | null;
}

/** Tope de franjas por convocatoria. Espejo de `LobbyPolicy.MAX_SLOTS` en el backend. */
export const MAX_SLOTS = 8;

/** Longitud máxima de la nota. Espejo de `LobbyPolicy.MAX_NOTE_LENGTH`. */
export const MAX_NOTE_LENGTH = 200;
