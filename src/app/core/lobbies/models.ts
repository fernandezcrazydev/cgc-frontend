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

export type LobbyModality = 'COMPETITIVE' | 'BALANCED' | 'CHAOS';
export type LobbyDistribution = 'ROOMS' | 'PARTY';
export type LobbySubType =
  | 'STANDARD'
  | 'CONTIGUOUS_ROOMS'
  | 'PARTY_POOL'
  | 'PARTY_ROUNDS'
  | 'TEAMS_GENERATED';

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
  /** Si fue añadido a mano por el host (FlujoJuego.md §4.3) o entró voluntariamente. */
  isAdded?: boolean;
  /** Si está activo o inactivo en banquillo tras expulsión (FlujoJuego.md §5.1, §5.2). */
  isActive?: boolean;
  /** Si es el host actual con corona de mando. */
  isHost?: boolean;
  /** Línea asignada si los equipos ya fueron generados por el balanceador. */
  assignedLane?: 'TOP' | 'JUNGLE' | 'MID' | 'BOTTOM' | 'SUPPORT';
  /** Equipo asignado al generar partida. */
  team?: 'BLUE' | 'RED';
  /** Deuda de rotación acumulada en Party (FlujoJuego.md §7). */
  rotationDebt?: number;
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
  /** Titulares de la segunda sala en caso de salas contiguas (ej. 23 personas = 2 salas de 10). */
  secondaryStarters?: LobbyParticipantResponse[];
  /** Nombre personalizado de la sala principal (ej. "Sala 1" o "Sala A"). */
  roomName?: string;
  /** Nombre de la segunda sala contigua (ej. "Sala 2" o "Sala B"). */
  secondaryRoomName?: string;
  /** Número de tanda en Party (ej. Tanda 1). */
  partyRound?: number;
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
  /** Modalidad competitiva de la partida (FlujoJuego.md §3). */
  modality?: LobbyModality;
  /** Reparto de jugadores: salas independientes o party (FlujoJuego.md §4.5). */
  distribution?: LobbyDistribution;
  /** Subtipo de presentación para preview en Tablón. */
  subType?: LobbySubType;
  /** Si hay al menos un participante con la app de escritorio emparejada (FlujoJuego.md §9.1). */
  scraperActive?: boolean;
  /** Minuto de juego si la partida está en curso. */
  matchDurationMinutes?: number;
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

/**
 * Tope de horas que se pueden proponer en una convocatoria, todas del MISMO día
 * (§5.5.6). Con más, nadie se lee la lista y no se decide nada.
 *
 * BACKEND NOTE: el backend todavía admite 8 (`LobbyPolicy.MAX_SLOTS`). Aquí se aprieta
 * a 6 porque el cliente solo puede ser más estricto, nunca más laxo; bajarlo también
 * allí, junto con la regla de «un solo día», está anotado en `Roadmap.md` §Fase 6.
 */
export const MAX_SLOTS = 6;

/**
 * Longitud máxima de la descripción. **Espejo de `LobbyPolicy.MAX_NOTE_LENGTH`**, y los dos
 * se mueven en el mismo commit: el cliente solo puede ser más estricto que el servidor,
 * nunca más laxo, o todo lo que pase del tope real vuelve como un 422.
 */
export const MAX_NOTE_LENGTH = 1000;

/**
 * Los cinco roles tal y como los nombra el backend EN ESTE contrato. Ojo: **no** es el
 * vocabulario de {@link LobbyParticipantResponse.assignedLane}, que usa el de Riot
 * (`JUNGLE`/`BOTTOM`). Aquí se replica lo que viaja, no lo que sería coherente: son dos
 * respuestas distintas del backend y unificarlas es cosa suya, no de un parche en la vista.
 *
 * Coincide, eso sí, con el `Lane` de `core/matches`. Son uniones de string idénticas y
 * TypeScript es estructural, así que siguen siendo intercambiables sin que un dominio
 * importe del otro.
 */
export type BalanceLane = 'TOP' | 'JUNGLA' | 'MID' | 'ADC' | 'SUPPORT';

/** Un duelo de línea: los dos que se enfrentan y cuánto se llevan EN ESA LÍNEA. */
export interface BalanceMatchup {
  lane: BalanceLane;
  /** `app_user.id` del jugador del equipo A. */
  playerA: string;
  playerB: string;
  /** Su fuerza EN ESA LÍNEA, que no es su rating: un ADC en soporte no vale lo mismo. */
  effectiveA: number;
  effectiveB: number;
  difference: number;
}

/** Quién comió autofill y en qué línea acabó. `lane` viene como string suelto del backend. */
export interface BalanceAutofill {
  userId: string;
  lane: string;
}

/**
 * Por qué salió ESE reparto y no otro (`GET /lobbies/{id}/balance/explanation`).
 *
 * Solo la ven los admins del grupo: la respuesta dice lo que valía cada jugador en cada
 * línea, y eso el grupo no ha acordado enseñárselo entre ellos. Para todos los demás
 * —incluido el convocante que pulsó el botón— el backend responde 403.
 *
 * Tres campos no se pueden leer sueltos sin mentir, y la vista los trata en pareja:
 * `globalDifference` no significa nada sin `uncertainty`, y `provisional` es la advertencia
 * de que la partida no se equilibró para customs sino con rangos de SoloQ y rellenos.
 */
export interface BalanceExplanationResponse {
  matchups: BalanceMatchup[];
  autofills: BalanceAutofill[];

  globalDifference: number;
  laneDifferenceSum: number;
  worstLaneDifference: number;
  /** Deuda de rol acumulada del reparto. */
  staleness: number;
  weightedCost: number;
  laneCeilingExceeded: boolean;

  /** Barras de error de `globalDifference`. Sin esto, la cifra de arriba es una suposición. */
  uncertainty: number;
  provisional: boolean;
  ratedPlayers: number;
  /** Los del reparto: 10. */
  poolSize: number;

  /** Cuántos repartos empataban con el elegido. */
  nearTies: number;
  /** La búsqueda topó con el límite de candidatos: la variedad eligió entre menos opciones. */
  searchTruncated: boolean;
  /** Desempate 1: cuánto repite parejas de compañeros. */
  repetition: number;
  /** Desempate 2: cuánto repite duelos. Ronda 0.56 por puro azar. */
  familiarity: number;
  /** Qué equipo salió en el lado azul. */
  blueTeam: 'A' | 'B';
}
