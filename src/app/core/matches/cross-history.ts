/**
 * El cruce entre el usuario de la sesión y otro jugador, derivado de las partidas reales.
 *
 * Existe porque hasta ahora esa relación se contaba dos veces y con dos números distintos: la
 * cabecera del historial cruzado leía un `mutualH2h` sembrado en `player-profile.ts` mientras
 * la lista de debajo salía del historial de verdad, así que la misma pantalla afirmaba «12
 * partidas juntos» encima de una lista de siete. Aquí hay un solo origen para las tres
 * superficies (lista cruzada, medias en contra, medias juntos) y para el detalle de una partida.
 *
 * Dos reglas que no se pueden relajar, porque relajarlas es lo que produjo el problema anterior:
 *
 * 1. **La identidad se compara por igualdad exacta** (`participantKey`). La versión anterior
 *    hacía `riotId.includes(nombre)`, y con eso «Nef» casaba con «Nefarian».
 * 2. **No hay valores de reserva.** Si no habéis coincidido, la lista es vacía y la vista pinta
 *    su estado vacío. La versión anterior devolvía seis partidas cualesquiera del usuario y las
 *    presentaba como enfrentamientos, y decidía aliado o enemigo con la paridad de un carácter
 *    del id cuando no encontraba al rival.
 *
 * BACKEND NOTE: todo lo de este fichero es placeholder desechable del endpoint del cruce
 * (`GET /players/{id}/cross/{otherId}`, paginado y agregado en servidor). Cuando exista, la
 * proyección y `aggregateCross` se borran enteras y solo sobrevive la forma de los tipos.
 * Además el jugador viaja hoy como tag `Nombre#REGION` porque es el único identificador
 * compartido del mock; debe pasar al id estable del backend (CLAUDE.md, § "Datos").
 */
import { Lane, Match, MatchParticipant, TeamSide, TeamSummary } from './models';
import { damageShare, kdaRatio } from './match-view';

/** Cómo coincidisteis en una partida: en el mismo equipo o en bandos opuestos. */
export type CrossRelation = 'ally' | 'enemy';

/** Una partida en la que coincidisteis, ya resuelta desde los dos lados. */
export interface CrossMatch {
  /** El id de la partida: sirve de clave de `@for` y de parámetro de ruta. */
  id: string;
  match: Match;
  /** Derivado del bando de ambos participantes. Nunca se adivina. */
  relation: CrossRelation;
  me: MatchParticipant;
  them: MatchParticipant;
  myTeam: TeamSummary;
  theirTeam: TeamSummary;
  /** Misma posición: es lo que convierte «coincidimos» en «nos enfrentamos de verdad». */
  sameLane: boolean;
}

/** Un emparejamiento de campeones repetido entre los dos, con su récord. */
export interface CrossChampionMatchup {
  myChampionId: number;
  myChampionName: string;
  theirChampionId: number;
  theirChampionName: string;
  games: number;
  wins: number;
}

/** Una combinación de posiciones repetida entre los dos, con su récord. */
export interface CrossRolePair {
  mine: Lane;
  theirs: Lane;
  games: number;
  wins: number;
}

/** Racha viva del cruce, contada desde la partida más reciente hacia atrás. */
export interface CrossStreak {
  count: number;
  type: 'win' | 'loss';
}

/**
 * Las medias de un conjunto de partidas cruzadas. Se usa igual para el total, para el
 * subconjunto «en contra» y para el subconjunto «juntos»: es la misma pregunta sobre listas
 * distintas, así que es una sola función y no tres.
 */
export interface CrossAggregate {
  games: number;
  wins: number;
  losses: number;
  /** Sobre partidas decididas: una anulada no cuenta ni como victoria ni como derrota. */
  winrate: number;

  /** De las partidas del conjunto, las que además jugasteis en la misma posición. */
  laneGames: number;
  laneWins: number;
  laneWinrate: number;

  /** Partidas del conjunto que traen el dato `wonLane`, y en cuántas ganaste tú la línea. */
  wonLaneGames: number;
  wonLaneRate: number;

  kdaMe: number;
  kdaThem: number;
  /** Positivo = tu KDA medio es mejor. */
  kdaDiff: number;

  /** Cuota de daño de cada uno dentro de SU equipo, en porcentaje entero. */
  damageShareMe: number;
  damageShareThem: number;

  csPerMinMe: number;
  csPerMinThem: number;

  visionMe: number;
  visionThem: number;

  /**
   * Diferencia media de oro en el minuto 14, positiva a tu favor. El modelo trae `goldAt14`
   * (no 15), así que la etiqueta de la interfaz dice @14: inventar el minuto 15 sería
   * fabricar un dato que nadie ha medido.
   */
  goldAt14Diff: number;
  /** Cuántas partidas del conjunto traían el dato; si es 0, `goldAt14Diff` no se pinta. */
  goldAt14Games: number;

  topMatchups: CrossChampionMatchup[];
  rolePairs: CrossRolePair[];
  streak: CrossStreak | null;
}

/**
 * Identidad estable de un participante: el `userId` cuando existe (los invitados no tienen) y
 * si no el Riot ID normalizado. Nunca el nombre a secas, porque `Nombre#REGION` es la clave
 * completa y el mock la escribe con mayúsculas inconsistentes.
 */
export function participantKey(p: MatchParticipant): string {
  return p.userId ?? p.riotId.toLowerCase();
}

/** La misma normalización, aplicada al parámetro de ruta (que hoy es un tag). */
export function normalizePlayerKey(raw: string): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Las partidas del usuario en las que también jugó `playerKey`, ordenadas de más reciente a más
 * antigua. Si no hay ninguna, devuelve una lista vacía: eso ES la respuesta.
 */
export function buildCrossMatches(personal: readonly Match[], playerKey: string): CrossMatch[] {
  const key = normalizePlayerKey(playerKey);
  if (!key) return [];

  const out: CrossMatch[] = [];

  for (const match of personal) {
    const me = match.userParticipant;
    if (!me) continue;

    const them = participantsOf(match).find((p) => matchesKey(p, key));
    // Que el jugador buscado seas tú mismo no es un cruce, es tu propio historial.
    if (!them || them.id === me.id) continue;

    out.push({
      id: match.id,
      match,
      relation: them.team === me.team ? 'ally' : 'enemy',
      me,
      them,
      myTeam: teamOf(match, me.team),
      theirTeam: teamOf(match, them.team),
      sameLane: me.role === them.role,
    });
  }

  return out.sort((a, b) => time(b.match) - time(a.match));
}

/** Todo lo que has cruzado con un jugador, agrupado para poder comparar unos con otros. */
export interface CrossPartner {
  /** La clave estable con la que se le identifica (`userId` o Riot ID normalizado). */
  key: string;
  /** El Riot ID tal y como se pinta y como viaja hoy en las rutas del cruce. */
  riotId: string;
  allies: CrossMatch[];
  enemies: CrossMatch[];
}

/**
 * Cuántas partidas hacen falta para que un récord signifique algo.
 *
 * Sin un mínimo, «tu némesis» acaba siendo quien te ganó la única vez que coincidisteis, con un
 * rotundo 0% de victorias. Tres es lo bastante bajo para que el mock lo alcance y lo bastante
 * alto para que la etiqueta no dependa de una sola partida.
 */
export const CROSS_MIN_SAMPLE = 3;

/** Todos los jugadores con los que has coincidido, cada uno con sus dos listas. */
export function buildCrossPartners(personal: readonly Match[]): CrossPartner[] {
  const byKey = new Map<string, CrossPartner>();

  for (const match of personal) {
    const me = match.userParticipant;
    if (!me) continue;

    for (const them of participantsOf(match)) {
      if (them.id === me.id) continue;

      const key = participantKey(them);
      let partner = byKey.get(key);
      if (!partner) {
        partner = { key, riotId: them.riotId, allies: [], enemies: [] };
        byKey.set(key, partner);
      }

      const entry: CrossMatch = {
        id: match.id,
        match,
        relation: them.team === me.team ? 'ally' : 'enemy',
        me,
        them,
        myTeam: teamOf(match, me.team),
        theirTeam: teamOf(match, them.team),
        sameLane: me.role === them.role,
      };

      if (entry.relation === 'ally') partner.allies.push(entry);
      else partner.enemies.push(entry);
    }
  }

  return [...byKey.values()];
}

/** El compañero con el que mejor te va, entre los que llegan a la muestra mínima. */
export function bestAllyOf(partners: readonly CrossPartner[]): CrossPartner | null {
  return pick(partners, (p) => p.allies, (a, b) => b.wr - a.wr || b.games - a.games);
}

/**
 * El rival contra el que peor te va. Se ordena por winrate ASCENDENTE a propósito: una némesis
 * no es contra quien más juegas, es contra quien más pierdes.
 */
export function nemesisOf(partners: readonly CrossPartner[]): CrossPartner | null {
  return pick(partners, (p) => p.enemies, (a, b) => a.wr - b.wr || b.games - a.games);
}

/** El rival al que mejor se le gana: la némesis del otro, medida desde tu lado. */
export function favoriteVictimOf(partners: readonly CrossPartner[]): CrossPartner | null {
  return pick(partners, (p) => p.enemies, (a, b) => b.wr - a.wr || b.games - a.games);
}

interface Ranked {
  partner: CrossPartner;
  games: number;
  wr: number;
}

function pick(
  partners: readonly CrossPartner[],
  side: (p: CrossPartner) => CrossMatch[],
  order: (a: Ranked, b: Ranked) => number,
): CrossPartner | null {
  const ranked: Ranked[] = [];

  for (const partner of partners) {
    const list = side(partner);
    if (list.length < CROSS_MIN_SAMPLE) continue;
    const a = aggregateCross(list);
    ranked.push({ partner, games: a.games, wr: a.winrate });
  }

  if (ranked.length === 0) return null;
  return ranked.sort(order)[0].partner;
}

/** Medias del conjunto. Una lista vacía da ceros, nunca `NaN`. */
export function aggregateCross(list: readonly CrossMatch[]): CrossAggregate {
  const games = list.length;
  // Copia con arrays propios: el spread es superficial, así que sin esto todos los agregados
  // vacíos compartirían las MISMAS dos listas y una mutación en cualquiera las tocaría todas.
  if (games === 0) return { ...EMPTY_CROSS_AGGREGATE, topMatchups: [], rolePairs: [] };

  let wins = 0;
  let losses = 0;
  let laneGames = 0;
  let laneWins = 0;
  let wonLaneGames = 0;
  let wonLaneWins = 0;

  let myKills = 0;
  let myDeaths = 0;
  let myAssists = 0;
  let theirKills = 0;
  let theirDeaths = 0;
  let theirAssists = 0;

  let myShare = 0;
  let theirShare = 0;
  let myCsPerMin = 0;
  let theirCsPerMin = 0;
  let myVision = 0;
  let theirVision = 0;

  let goldDiff = 0;
  let goldAt14Games = 0;

  const matchups = new Map<string, CrossChampionMatchup>();
  const rolePairs = new Map<string, CrossRolePair>();

  for (const c of list) {
    const won = c.match.userOutcome === 'win';
    if (won) wins++;
    else if (c.match.userOutcome === 'loss') losses++;

    if (c.sameLane) {
      laneGames++;
      if (won) laneWins++;
    }

    if (c.me.stats.wonLane !== undefined) {
      wonLaneGames++;
      if (c.me.stats.wonLane) wonLaneWins++;
    }

    myKills += c.me.stats.kills;
    myDeaths += c.me.stats.deaths;
    myAssists += c.me.stats.assists;
    theirKills += c.them.stats.kills;
    theirDeaths += c.them.stats.deaths;
    theirAssists += c.them.stats.assists;

    myShare += damageShare(c.me, c.myTeam);
    theirShare += damageShare(c.them, c.theirTeam);
    myCsPerMin += c.me.stats.csPerMin;
    theirCsPerMin += c.them.stats.csPerMin;
    myVision += c.me.stats.visionScore;
    theirVision += c.them.stats.visionScore;

    if (c.me.stats.goldAt14 !== undefined && c.them.stats.goldAt14 !== undefined) {
      goldDiff += c.me.stats.goldAt14 - c.them.stats.goldAt14;
      goldAt14Games++;
    }

    const matchupKey = c.me.championId + ':' + c.them.championId;
    const matchup = matchups.get(matchupKey);
    if (matchup) {
      matchup.games++;
      if (won) matchup.wins++;
    } else {
      matchups.set(matchupKey, {
        myChampionId: c.me.championId,
        myChampionName: c.me.championName,
        theirChampionId: c.them.championId,
        theirChampionName: c.them.championName,
        games: 1,
        wins: won ? 1 : 0,
      });
    }

    const roleKey = c.me.role + ':' + c.them.role;
    const pair = rolePairs.get(roleKey);
    if (pair) {
      pair.games++;
      if (won) pair.wins++;
    } else {
      rolePairs.set(roleKey, { mine: c.me.role, theirs: c.them.role, games: 1, wins: won ? 1 : 0 });
    }
  }

  const myKda = kdaRatio({ kills: myKills, deaths: myDeaths, assists: myAssists });
  const theirKda = kdaRatio({ kills: theirKills, deaths: theirDeaths, assists: theirAssists });

  return {
    games,
    wins,
    losses,
    winrate: percent(wins, wins + losses),
    laneGames,
    laneWins,
    laneWinrate: percent(laneWins, laneGames),
    wonLaneGames,
    wonLaneRate: percent(wonLaneWins, wonLaneGames),
    kdaMe: round2(myKda),
    kdaThem: round2(theirKda),
    kdaDiff: round2(myKda - theirKda),
    damageShareMe: Math.round(myShare / games),
    damageShareThem: Math.round(theirShare / games),
    csPerMinMe: round1(myCsPerMin / games),
    csPerMinThem: round1(theirCsPerMin / games),
    visionMe: Math.round(myVision / games),
    visionThem: Math.round(theirVision / games),
    goldAt14Diff: goldAt14Games > 0 ? Math.round(goldDiff / goldAt14Games) : 0,
    goldAt14Games,
    topMatchups: [...matchups.values()].sort((a, b) => b.games - a.games || b.wins - a.wins),
    rolePairs: [...rolePairs.values()].sort((a, b) => b.games - a.games || b.wins - a.wins),
    streak: streakOf(list),
  };
}

/**
 * Racha viva contada desde la partida más reciente. Una partida anulada la corta sin abrir
 * otra: no fue ni victoria ni derrota, así que no puede continuar ninguna de las dos.
 */
function streakOf(list: readonly CrossMatch[]): CrossStreak | null {
  const first = list[0]?.match.userOutcome;
  if (first !== 'win' && first !== 'loss') return null;

  let count = 0;
  for (const c of list) {
    if (c.match.userOutcome !== first) break;
    count++;
  }
  return { count, type: first };
}

const EMPTY_CROSS_AGGREGATE: CrossAggregate = {
  games: 0,
  wins: 0,
  losses: 0,
  winrate: 0,
  laneGames: 0,
  laneWins: 0,
  laneWinrate: 0,
  wonLaneGames: 0,
  wonLaneRate: 0,
  kdaMe: 0,
  kdaThem: 0,
  kdaDiff: 0,
  damageShareMe: 0,
  damageShareThem: 0,
  csPerMinMe: 0,
  csPerMinThem: 0,
  visionMe: 0,
  visionThem: 0,
  goldAt14Diff: 0,
  goldAt14Games: 0,
  topMatchups: [],
  rolePairs: [],
  streak: null,
};

function matchesKey(p: MatchParticipant, key: string): boolean {
  return participantKey(p) === key || p.riotId.toLowerCase() === key;
}

function participantsOf(m: Match): MatchParticipant[] {
  return [...m.blueTeam.participants, ...m.redTeam.participants];
}

function teamOf(m: Match, side: TeamSide): TeamSummary {
  return side === 'blue' ? m.blueTeam : m.redTeam;
}

function time(m: Match): number {
  return new Date(m.decidedAt).getTime();
}

/** Un denominador de cero da 0%, que es la lectura correcta, no `NaN`. */
function percent(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function round1(value: number): number {
  return +value.toFixed(1);
}

function round2(value: number): number {
  return +value.toFixed(2);
}
