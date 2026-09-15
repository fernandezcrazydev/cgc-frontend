/**
 * Interfaces espejo de los DTOs del historial de partidas
 * (`com.cgc.cc.matches.adapters.in.controller.response`). Contrástalas con
 * `core/http/api-types.d.ts`, que es el contrato generado.
 *
 * Dos reglas del contrato mandan sobre toda la forma de este fichero, y las dos vienen de
 * decisiones del backend que no se pueden deshacer desde aquí:
 *
 * 1. **El lado (azul/rojo) puede no existir.** Quién vistió de azul lo decide la sala, y puede
 *    no haberse decidido nunca. Lo que siempre existe es el hueco: `slot` A o B. Por eso `side`
 *    es `TeamSide | null` en los dos equipos y en el ganador, y por eso NADIE lo rellena por su
 *    cuenta: derivar el lado del orden de entrada a la sala es literalmente el bug que produjo
 *    un jugador 14-0 «en azul» sin que nadie lo hubiera elegido.
 * 2. **`hasStats: false` es un estado real.** El grupo jugó, alguien tecleó el resultado y nadie
 *    exportó la partida desde el cliente de LoL. Contó para el LP y para el rating, así que la
 *    partida sale igual. Todo lo que dependía de esa subida llega `null`, **jamás cero**: un
 *    `kills: 0` se lee como una partida en la que un equipo no mató a nadie, y esa mentira no la
 *    detecta nadie mirando la pantalla.
 */
import type { MatchmakingPreset } from '../groups';

/**
 * Líneas de LoL. Se declara aquí y no se importa de `ui/lane-icon`: `Lane` es dominio
 * —el backend lo manda en los DTOs— y `core/` no puede depender de `ui/`. `NfLane` es la
 * misma unión declarada del lado del UI kit; TypeScript es estructural, así que las dos
 * siguen siendo intercambiables sin que ninguna capa importe de la otra. Si el backend
 * añade una línea, este es el sitio que manda, y `NfLane` la sigue.
 */
export type Lane = 'TOP' | 'JUNGLA' | 'MID' | 'ADC' | 'SUPPORT';

/** El color con el que jugó un equipo. `null` cuando la sala nunca lo decidió. */
export type TeamSide = 'blue' | 'red';

/** El hueco del equipo dentro de la partida. Este SIEMPRE existe, tenga color o no. */
export type TeamSlot = 'A' | 'B';

export type MatchResultOutcome = 'win' | 'loss' | 'cancelled';

/**
 * La modalidad con la que se abrió la sala. Es el vocabulario que existe en el backend; no hay
 * `gameMode` ni `lobbyType`. Sus etiquetas en español ya las decide `MATCHMAKING_PRESET_INFO`
 * de `core/groups`, que es donde se traducen desde que se crea el grupo: traducirlas otra vez
 * aquí produciría dos nombres para el mismo enum en dos pantallas contiguas.
 */
export type MatchPreset = MatchmakingPreset;

/**
 * Lo que se sabe de un jugador dentro de una partida.
 *
 * Todo opcional salvo lo que la app reparte ella misma (`lane`, `wasAutofill`) y lo que sale
 * del libro de LP. Ver la regla 2 de la cabecera: sin subida no hay campeón ni KDA, y el hueco
 * se pinta como hueco.
 *
 * Los campos del segundo bloque solo llegan en el DETALLE (`SeatDetailResponse`): en el listado
 * ni siquiera viajan, así que una fila del historial nunca los tiene.
 */
export interface ParticipantStats {
  kills?: number;
  deaths?: number;
  assists?: number;
  /** `goldEarned` del asiento. */
  gold?: number;

  // ── Solo en el detalle ────────────────────────────────────────────────────
  cs?: number;
  damageToChampions?: number;
  damageTaken?: number;
  visionScore?: number;
  /** Segundos de control de masas aplicados a rivales. */
  timeCcingOthers?: number;
  /** Ausente en una partida que no llegó al minuto 14. */
  goldAt14?: number;
  csAt14?: number;
  spell1Id?: number;
  spell2Id?: number;
  /**
   * Lo que dijo el CLIENTE DE LoL, sin traducir (`TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `NONE`).
   * No es `role`: `role` es la línea que repartió la app. Que discrepen es un dato real.
   */
  clientLane?: string;
  clientRole?: string;
}

/**
 * Uno de los diez.
 *
 * **La identidad es `userId`**: no hay número de asiento, y con la regla nueva del backend los
 * diez son diez usuarios distintos, así que el id del usuario identifica el asiento sin
 * ambigüedad.
 */
export interface MatchParticipant {
  userId: string;
  /**
   * Cómo se llamaba esa cuenta **el día que se jugó**. `null` sin subida, y eso es la respuesta
   * honesta: el único Riot ID disponible entonces sería el de hoy, que puede ser ya de otra
   * persona. Para pintarlo, `participantName()` de `match-view.ts`.
   */
  riotId: string | null;
  /**
   * El nombre de Discord de **hoy**, y llega siempre: con subida o sin ella.
   *
   * La asimetría con `riotId` es deliberada y del backend: uno sirve para reconocer a alguien en
   * una lista, así que sigue los cambios de nombre; el otro es parte de lo que pasó y no se
   * reescribe. `null` solo si a esa cuenta la borraron — la partida siguió pasando igual.
   */
  discordUsername: string | null;
  avatarUrl: string | null;
  slot: TeamSlot;
  /** El color de su equipo, o `null` si la sala no lo decidió. */
  side: TeamSide | null;
  /** La línea que le repartió la app. */
  role: Lane;
  championId: number | null;
  wasAutofill: boolean;
  /**
   * Puntos de Liga que movió la partida en la clasificación visible.
   * REGLA DE DOMINIO: el MMR interno y la tabla de poder NUNCA se exponen al usuario.
   *
   * `null` cuando no contó para ninguna liga abierta, que **no es cero**: cero es una partida
   * que sí contó y no movió nada porque el jugador ya estaba en el suelo.
   */
  lpDelta: number | null;
  /**
   * Posición en la clasificación ANTES y DESPUÉS. Es lo que convierte un `lpDelta` en algo que
   * importa: «+22 LP» no dice nada, «3.º → 2.º» sí. Ausentes en partidas anteriores a que el
   * libro empezase a registrarlo.
   */
  rankBefore?: number;
  rankAfter?: number;
  stats: ParticipantStats;
}

/**
 * Lo que un EQUIPO le hizo al mapa: bans y objetivos. Solo llega en el detalle, y **solo si la
 * sala decidió lados**: sin saber cuál de los dos era el equipo 100, colgar los objetivos de A
 * o de B sería inventar.
 *
 * Todo es anulable a propósito, y `null` no es `0`: los nombres de estos campos salen de la
 * documentación del cliente de LoL y no de un payload medido, así que uno que el cliente
 * escriba distinto llega vacío. Un `false` afirmaría «este equipo no cogió el primer barón»,
 * que es otra cosa distinta de «nadie lo apuntó».
 */
export interface TeamObjectives {
  /** Campeones baneados, en orden. Vacío es normal: una custom sin draft no tiene ninguno. */
  bans: number[];
  barons: number | null;
  /**
   * **Mapeado pero NO pintado en ninguna pantalla.** Llega a secas y nadie ha medido todavía si
   * incluye a los dragones ancianos, así que enseñarlo bajo la etiqueta «Dragones» afirmaría qué
   * cuenta. Se conserva el campo para no perder el dato el día que se resuelva; el ancla de la
   * decisión está en `OBJECTIVE_SPECS` de `match-detail.ts`.
   */
  dragons: number | null;
  heralds: number | null;
  /** Larvas del vacío (`hordeKills`). */
  voidgrubs: number | null;
  towers: number | null;
  inhibitors: number | null;
  firstBlood: boolean | null;
  firstTower: boolean | null;
  firstBaron: boolean | null;
  firstDragon: boolean | null;
  firstInhibitor: boolean | null;
}

/** Uno de los dos equipos de una partida. */
export interface TeamSummary {
  /** Siempre presente. Es lo que permite hablar de «Equipo A» cuando no hay color. */
  slot: TeamSlot;
  side: TeamSide | null;
  won: boolean;
  /** `null` sin subida, nunca cero. */
  totalKills: number | null;
  totalGold: number | null;
  participants: MatchParticipant[];
  /** Solo en el detalle, y solo con lados decididos. */
  objectives?: TeamObjectives;
}

/**
 * El grupo en el que se disputó la partida.
 *
 * Viaja en la fila (`groupId` + `groupName`) y en las DOS listas, también en la del propio
 * grupo donde es redundante: la fila tiene la misma forma en las dos, y esa igualdad es lo que
 * permite pintarlas con un solo componente.
 *
 * Las iniciales y los colores del banner se derivan aquí, igual que en `core/groups`: mismo
 * grupo → mismo gradiente en toda la app, sin que el backend tenga que guardar un color.
 */
export interface GroupContext {
  id: string;
  name: string;
  initials: string;
  color1: string;
  color2: string;
}

/** Una partida ya disputada, tal y como la sirve el historial. */
export interface Match {
  id: string;
  groupId: string | null;
  group: GroupContext | null;
  /**
   * Si alguien exportó la partida desde el cliente de LoL. **Es el primer campo que hay que
   * leer**: en `false` no hay campeones, ni KDA, ni duración, ni MVP.
   */
  hasStats: boolean;
  /**
   * Anulada: una anulación explícita rebobinó el rating y reconstruyó el LP como si la partida
   * no hubiera existido. Ni victoria ni derrota — su `userOutcome` es `'cancelled'`.
   *
   * **Sale en el listado y NO cuenta en ningún resumen.** La fila conserva su alineación para
   * que una sala terminada siga teniendo explicación; los recuentos la descartan. De ahí que el
   * `totalElements` de una lista y el `totalMatches` de su resumen no tengan por qué coincidir:
   * la lista es el registro de lo que pasó, el resumen es lo que cuenta.
   */
  voided: boolean;
  preset: MatchPreset;
  /** `null` sin subida: solo una partida subida tiene duración. */
  durationSeconds: number | null;
  /** ISO-8601. El formato lo decide la presentación (`shared/date-format.ts`), nunca el DTO. */
  decidedAt: string;
  winningSlot: TeamSlot | null;
  /** `null` cuando la sala no decidió lados. Ver la regla 1 de la cabecera. */
  winningSide: TeamSide | null;
  /** Siempre dos, en orden de hueco: A y luego B. */
  teams: readonly [TeamSummary, TeamSummary];
  /** Mejor KDA del equipo ganador; `null` sin subida. Lo decide el backend, no se recalcula. */
  mvpUserId: string | null;
  aceUserId: string | null;
  leagueId: string | null;
  leagueName: string | null;

  /** Resuelto en el cliente buscando al usuario de la sesión entre los diez. */
  userParticipant?: MatchParticipant;
  userOutcome?: MatchResultOutcome;
}

/** El detalle de una partida: la fila del listado más lo que solo se sabe al abrirla. */
export interface MatchDetail {
  /**
   * `match` es LITERALMENTE la fila del listado, ya con los objetivos pegados a cada equipo y
   * el detalle de cada asiento dentro de su `stats`. El ganador, los lados y el MVP se deciden
   * en un sitio: no se recalculan aquí, o la tarjeta y la partida que abre dirían cosas distintas.
   */
  match: Match;
  /** Parche del cliente con el que se jugó; `null` sin subida. */
  gameVersion: string | null;
}

/**
 * Un comentario del hilo de una partida (`GET /matches/{id}/comments`).
 *
 * **Trae a su autor pegado**, igual que los diez asientos del marcador y por el mismo motivo: esta
 * pantalla se abre también desde el historial personal, que cruza grupos, así que no hay ningún
 * censo contra el que resolver un id — y puede que ni sigas siendo miembro de ese grupo.
 * `discordUsername` y `avatarUrl` son los de HOY: sirven para reconocer a alguien, no para
 * registrar lo que pasó. Llegan `null` para una cuenta borrada, y entonces el hueco se pinta como
 * hueco: lo que alguien dijo sobrevive a su cuenta.
 *
 * No hay `updatedAt`, y su ausencia es la funcionalidad: un comentario no se edita. Tampoco hay
 * `riotId` —ese vive en el asiento y es el del día que se jugó— ni `reactions`, que no existen
 * todavía en ningún sitio (`cgc-backend#95`).
 */
export interface MatchComment {
  id: string;
  userId: string;
  discordUsername: string | null;
  avatarUrl: string | null;
  text: string;
  /** ISO-8601. Lo pone el servidor: si viajara en el cuerpo, cualquiera diría que habló antes. */
  createdAt: string;
}

/**
 * Lo que pasó durante una partida, minuto a minuto (`GET /matches/{id}/timeline/summary`).
 *
 * Sale de la timeline que el cliente de LoL manda dentro de la subida y que el backend guarda en
 * crudo desde la `V60` (`cgc-backend#96`).
 *
 * **`available: false` es un estado real**, igual que `hasStats: false`: la partida existe y se abre,
 * lo que falta es que alguien la exportara. No es un error y no es «no pasó nada».
 *
 * **Lo que NO trae, y está medido, no pendiente:** el control de visión (wards) y los objetos
 * comprados. La timeline del cliente lleva exactamente tres tipos de evento —muertes, edificios y
 * monstruos grandes— y la visión no es uno. La de `match-v5` de Riot sí los trae, pero esa API no
 * indexa customs. Cualquier pantalla de wards construida sobre esto sería la maqueta otra vez.
 */
export interface MatchTimelineSummary {
  available: boolean;
  frameCount: number;
  kills: readonly TimelineKill[];
  buildings: readonly TimelineBuilding[];
  monsters: readonly TimelineMonster[];
  /** Cuántos dragones se llevó cada equipo, desglosados por elemento. Ver `TeamDragons`. */
  dragons: readonly TeamDragons[];
}

/** Una muerte. `killerUserId` es `null` cuando ejecutó el mapa (una torre, un monstruo). */
export interface TimelineKill {
  minute: number;
  killerUserId: string | null;
  victimUserId: string | null;
  teamSlot: TeamSlot | null;
  assistUserIds: readonly string[];
  x: number;
  y: number;
}

/**
 * Un edificio cayendo.
 *
 * Los dos equipos con su nombre porque el payload del cliente solo trae el segundo, bajo un `teamId`
 * a secas, y es el campo que todo el mundo lee al revés exactamente una vez: **`lostByTeamSlot` es
 * quien lo tenía**, `killerTeamSlot` quien lo tiró.
 */
export interface TimelineBuilding {
  minute: number;
  killerUserId: string | null;
  killerTeamSlot: TeamSlot | null;
  lostByTeamSlot: TeamSlot | null;
  /** `TOWER_BUILDING` o `INHIBITOR_BUILDING`, tal y como lo escribe el cliente. */
  buildingType: string | null;
  /** `OUTER_TURRET`, `INNER_TURRET`, `BASE_TURRET`, `NEXUS_TURRET`; `null` en un inhibidor. */
  towerType: string | null;
  laneType: string | null;
  x: number;
  y: number;
}

/**
 * Un dragón, un barón, un heraldo o unas larvas.
 *
 * `monsterSubType` es el elemento del dragón (`FIRE_DRAGON`, `EARTH_DRAGON`, `AIR_DRAGON`,
 * `HEXTECH_DRAGON`, `CHEMTECH_DRAGON` están todos medidos) y es `null` para todo lo demás.
 */
export interface TimelineMonster {
  minute: number;
  killerUserId: string | null;
  teamSlot: TeamSlot | null;
  monsterType: string | null;
  monsterSubType: string | null;
  x: number;
  y: number;
}

/**
 * Los dragones de un equipo, por elemento.
 *
 * **Es lo que destapa el contador de dragones que esta app tenía escondido.** Ya no hace falta saber
 * qué cuenta `TeamObjectives.dragonKills`: esto dice qué dragones cayeron y de qué tipo.
 *
 * **No hay alma**, y no es un olvido: la timeline medida no tiene evento de alma, y deducirla de
 * «cuatro dragones» sería afirmar una regla del juego que nadie ha medido aquí.
 */
export interface TeamDragons {
  teamSlot: TeamSlot;
  total: number;
  /** Cuántos de cada elemento, en el orden en que cayeron. */
  bySubType: Readonly<Record<string, number>>;
}

/**
 * Dónde estaban los diez, una foto por minuto (`GET /matches/{id}/timeline/positions`).
 *
 * **Las coordenadas son las del juego, sin normalizar**, con el origen abajo a la izquierda: sobre
 * las exportaciones medidas van de 130 a 14589 en `x` y de 135 a 14673 en `y`. Quien las dibuje
 * sobre una imagen **tiene que voltear la `y`**. El backend no las normaliza a propósito: el número
 * que importa para dibujar es el de la imagen, y la imagen es de este lado.
 */
export interface MatchTimelinePositions {
  available: boolean;
  frames: readonly TimelinePositionFrame[];
}

export interface TimelinePositionFrame {
  minute: number;
  positions: readonly ParticipantPosition[];
}

/** Un jugador en ese minuto. Viene por `userId`, no por el número de participante del cliente. */
export interface ParticipantPosition {
  userId: string;
  teamSlot: TeamSlot | null;
  x: number;
  y: number;
  totalGold: number | null;
  level: number | null;
}

/** Resumen del historial del usuario (`GET /me/matches/summary`). */
export interface PersonalHistorySummary {
  totalMatches: number;
  wins: number;
  losses: number;
  /**
   * Cuántas de esas están subidas. **Es el denominador del KDA**, y deja de ser `totalMatches`
   * en cuanto una noche se queda sin exportar.
   */
  matchesWithStats: number;
  // Ninguna cifra de este resumen incluye partidas anuladas; ver `Match.voided`.
  kills: number;
  deaths: number;
  assists: number;
  mostPlayedLane: Lane | null;
  mostPlayedLaneCount: number;
  /** `null` hasta que haya alguna subida; la línea existe sin ellas porque la repartimos nosotros. */
  mostPlayedChampionId: number | null;
  mostPlayedChampionCount: number;
}

/** Resumen del historial de un grupo (`GET /groups/{id}/matches/summary`). */
export interface GroupHistorySummary {
  totalMatches: number;
  /**
   * Partidas con lado decidido. **Es el denominador de los winrates por bando**, y no es
   * `totalMatches`: una sala sin lado no está ni en `blueWins` ni en `redWins`.
   */
  matchesWithSide: number;
  blueWins: number;
  redWins: number;
  /** Denominador de la duración media: solo una partida subida tiene duración. */
  matchesWithStats: number;
  averageDurationSeconds: number | null;
  /** `null` = todavía no hay ningún MVP porque nadie ha exportado nada. No es un empate a cero. */
  topMvpUserId: string | null;
  topMvpCount: number;
}
