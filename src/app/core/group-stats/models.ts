/**
 * Espejo de los DTO de `GET /groups/{id}/stats` y `GET /groups/{id}/stats/scopes`.
 *
 * Contrato, no presentación: aquí no hay ni una media ni una etiqueta en español. El backend manda
 * **totales y denominadores** a propósito —un «68%» redondeado no se puede des-redondear y esconde
 * si es sobre tres partidas o sobre trescientas—, y `stats-view.ts` es el único sitio que divide.
 *
 * La otra mitad del contrato, la que cuesta más cara olvidar: **lo que no se sabe llega `null`, y
 * `null` no es `0`.** `rating: 0` se lee como «el peor del grupo»; `null` es «nunca ha sido
 * puntuado aquí». Lo mismo con `mainChampionId` y con `riotId`.
 */
import { Lane, MatchPreset } from '../matches/models';

/** Los objetivos que deciden una partida, tal y como los nombra el backend. */
export type StatObjectiveId =
  | 'FIRST_BLOOD'
  | 'FIRST_TOWER'
  | 'FIRST_DRAGON'
  | 'FIRST_BARON'
  | 'GRUBS'
  | 'HERALD';

export type StatRecordId =
  | 'MOST_KILLS'
  | 'BIGGEST_SPREE'
  | 'MOST_DAMAGE'
  | 'MOST_DAMAGE_TAKEN'
  | 'MOST_GOLD'
  | 'MOST_MONSTERS'
  | 'LONGEST_GAME'
  | 'SHORTEST_GAME';

/**
 * Cuántas veces ganó el equipo que se llevó un objetivo.
 *
 * **No es «el winrate del grupo con el dragón»**, que en una custom no significa nada: los dos
 * equipos son el grupo, así que esa pregunta mide al grupo contra sí mismo.
 *
 * `games: 0` es legítimo y no es «nunca importó»: una noche sin ningún heraldo muerto no dice nada
 * sobre los heraldos, y esa pastilla se pinta sin cifra en vez de como un 0%.
 */
export interface StatObjectiveTally {
  objective: StatObjectiveId;
  games: number;
  wins: number;
}

/** Un campeón y su registro: elegido, ganado, baneado. */
export interface StatChampionTally {
  championId: number;
  picks: number;
  wins: number;
  /** Por equipo y por partida: los dos bandos baneándolo la misma noche son dos. */
  bans: number;
}

/**
 * Dos jugadores y cómo fue juntos —o enfrentados—.
 *
 * `wins` se mide **siempre para `a`**. Una pareja aliada viaja una vez; una rival viaja en las dos
 * direcciones, porque «cómo me va contra él» no es simétrico.
 */
export interface StatDuoTally {
  a: string;
  b: string;
  allies: boolean;
  games: number;
  wins: number;
}

/**
 * Cuánto vale ganar una línea en este grupo: de las veces que uno de los dos iba por delante en el
 * minuto 14, cuántas ganó la partida.
 *
 * **No es el winrate de la línea**, que es 50% por construcción — toda partida tiene un mid en los
 * dos bandos.
 */
export interface StatLaneTally {
  lane: Lane;
  games: number;
  decisive: number;
  /** Oro total de ventaja de quien ganó la línea, sobre `games`. */
  goldLead: number;
}

/**
 * Un récord, con la partida en la que ocurrió — que es lo que permite a la tarjeta cumplir lo que
 * promete su botón.
 *
 * `userId` es `null` en los dos que son de la partida y no de nadie (la más larga y la más corta).
 */
export interface StatRecordEntry {
  id: StatRecordId;
  matchId: string;
  userId: string | null;
  championId: number | null;
  value: number;
}

/**
 * Reparto de victorias entre los dos lados del mapa.
 *
 * `games` es **su propio denominador** y no el total de partidas: una sala que nunca decidió quién
 * vestía de azul no cuenta en ninguno de los dos lados, y no se deduce de nada.
 */
export interface StatSideBalance {
  games: number;
  blueWins: number;
  redWins: number;
}

/**
 * Todo lo que hizo un jugador en el alcance, en totales crudos.
 *
 * **Dos denominadores y no son intercambiables.** `games` son todas sus partidas —un resultado
 * tecleado contó para el LP y para el rating lo exportara alguien o no—; `gamesWithStats` son las
 * que alguien exportó, y es el denominador de todo lo que va de `kills` hacia abajo.
 */
export interface StatsPlayer {
  userId: string;
  /** El Riot ID del día de su última partida subida. `null` si no tiene ninguna. */
  riotId: string | null;
  /** Cómo se llama HOY. Llega también para quien ya se fue del grupo. */
  discordUsername: string | null;
  avatarUrl: string | null;

  games: number;
  wins: number;
  losses: number;
  gamesWithStats: number;
  /** Duración total de sus partidas subidas: el divisor de todo lo que va «por minuto». */
  seconds: number;

  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damageToChampions: number;
  damageTaken: number;
  damageMitigated: number;
  healed: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  timeCcingOthers: number;

  doubles: number;
  triples: number;
  quadras: number;
  pentas: number;

  /** Estructuras que derribó él. */
  towers: number;
  /** Objetivos que aseguró **su equipo** en partidas suyas: el cliente no los da por jugador. */
  dragons: number;
  barons: number;

  firstBloods: number;
  deathlessGames: number;
  mvps: number;

  /** Positivo son victorias seguidas, negativo derrotas. */
  currentStreak: number;
  bestStreak: number;
  worstStreak: number;

  mainChampionId: number | null;
  mainChampionGames: number;
  mainChampionWins: number;

  /**
   * Su µ de Glicko en esta modalidad. **No se mueve con el filtro de temporada** y no puede: hay un
   * rating por grupo y modalidad, no uno por temporada.
   */
  rating: number | null;
  ratingRank: number | null;
}

/** El agregado entero de un alcance. */
export interface GroupStats {
  matches: number;
  /** De esas, las que alguien exportó. Todo lo que no sea `side` es sobre este subconjunto. */
  matchesWithStats: number;
  totalSeconds: number;
  totalKills: number;
  side: StatSideBalance;
  objectives: StatObjectiveTally[];
  champions: StatChampionTally[];
  duos: StatDuoTally[];
  lanes: StatLaneTally[];
  records: StatRecordEntry[];
  players: StatsPlayer[];
}

export interface StatsSeason {
  id: string;
  name: string;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'FINISHED';
  /** `0` es real: la temporada existe, está abierta y nadie ha jugado todavía. */
  matches: number;
}

/** Una modalidad y cuánto la ha jugado el grupo. Las tres llegan siempre, jugadas o no. */
export interface StatsScope {
  preset: MatchPreset;
  matches: number;
  seasons: StatsSeason[];
}

/** El alcance que se está mirando. `leagueId` nulo es el histórico de la modalidad. */
export interface StatsQuery {
  preset: MatchPreset;
  leagueId: string | null;
}

/** Clave estable de un alcance, para cachear y para descartar respuestas obsoletas. */
export function statsKey(groupId: string, query: StatsQuery): string {
  return `${groupId}|${query.preset}|${query.leagueId ?? 'all'}`;
}

/**
 * El alcance con el que abre la pantalla: la modalidad que el grupo MAS ha jugado, y todas sus
 * temporadas.
 *
 * No la primera de la lista ni la de por defecto del grupo: la que tiene historial, que es la unica
 * que va a tener algo que ensenar. Y es el mismo criterio que usa la vitrina del hub, a proposito —
 * una medalla de la vitrina abre exactamente esa medalla del Hall of Fame, asi que las dos
 * pantallas tienen que estar mirando el mismo alcance o se contradicen.
 *
 * `null` cuando el grupo no ha jugado nada en ninguna modalidad.
 */
export function defaultScopeOf(scopes: readonly StatsScope[]): StatsQuery | null {
  const played = [...scopes]
    .filter((s) => s.matches > 0)
    .sort((x, y) => y.matches - x.matches || x.preset.localeCompare(y.preset))[0];
  return played ? { preset: played.preset, leagueId: null } : null;
}
