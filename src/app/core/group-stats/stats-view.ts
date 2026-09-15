/**
 * De los totales que manda el backend a lo que pinta cada bloque de la pantalla.
 *
 * Este fichero es **el único sitio que divide**. El contrato son contadores y denominadores
 * (`models.ts` explica por qué), así que toda media, todo porcentaje y toda etiqueta en español
 * nacen aquí. Sustituye al generador sembrado que había en `core/group-stats.ts`: las formas que
 * salen son las mismas —los componentes no se enteraron—, pero ahora describen partidas que
 * existieron.
 *
 * Tres reglas que se rompen solas si no se escriben:
 *
 *  1. **Cada media se divide por SU denominador.** Un KDA se divide entre las partidas que alguien
 *     exportó, no entre todas: dividir por `games` reporta a un jugador peor cuanto más de su
 *     historial se haya quedado sin subir.
 *  2. **Lo que no se sabe es `null`, no `0`.** Sin una sola partida subida no hay duración media,
 *     y «—» y «0:00» no dicen lo mismo.
 *  3. **Ningún porcentaje viaja sin su denominador al lado.** Un 100% sobre dos partidas y uno
 *     sobre doscientas se escriben igual, y el que lo lee tiene derecho a distinguirlos.
 */
import { Lane } from '../matches/models';
import {
  GroupStats,
  StatChampionTally,
  StatDuoTally,
  StatObjectiveId,
  StatRecordId,
  StatsPlayer,
} from './models';

/* ===================== Identidad ===================== */

/**
 * Quién es una fila.
 *
 * Sale del propio payload y **nunca del censo del grupo**: una temporada incluye a quien ya se fue,
 * y resolver estos ids contra la lista de miembros de hoy dibujaría huecos justo en los jugadores
 * cuyo registro más hace falta explicar. Es la misma regla que trajo el historial.
 */
export interface StatsPerson {
  userId: string;
  name: string;
  /** Riot ID cuando lo hay; si no, el nombre. Es texto a pintar, nunca una clave. */
  tag: string;
  avatar: string | null;
  hue: number;
}

export function personOf(player: StatsPlayer): StatsPerson {
  const name = player.discordUsername ?? player.riotId ?? player.userId.slice(0, 8);
  return {
    userId: player.userId,
    name,
    tag: player.riotId ?? name,
    avatar: player.avatarUrl,
    hue: hueOf(player.userId),
  };
}

/**
 * Tono estable (0-359) derivado del id, para el degradado del avatar. Mismo algoritmo que
 * `GroupBridge.hueOf`, para que una persona tenga el mismo color en todas las pantallas.
 */
function hueOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

/* ===================== Jugadores ===================== */

/** Con quién le va bien —o mal— a alguien. */
export interface StatsAffinity {
  userId: string;
  name: string;
  tag: string;
  avatar: string | null;
  hue: number;
  winrate: number;
  games: number;
}

/** Una fila de la tabla de líderes, con las medias ya hechas. */
export interface PlayerStatsView {
  person: StatsPerson;
  /** El total crudo, que es de donde puntúan las medallas. */
  raw: StatsPlayer;

  games: number;
  wins: number;
  losses: number;
  /** Porcentaje de victorias, redondeado. Sobre `games`. */
  wr: number;
  /** Partidas que alguien exportó: el denominador de TODO lo que va debajo. */
  gamesWithStats: number;

  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  csPerMin: number;
  goldPerMin: number;
  /** Daño a campeones por partida, en miles. */
  dmgK: number;
  visionScore: number;
  pentas: number;

  /** Racha actual: positiva son victorias seguidas, negativa derrotas. */
  streak: number;
  bestStreak: number;
  worstStreak: number;

  mainChampionId: number | null;
  /** Victorias con su campeón, en porcentaje. Nulo si no lo ha jugado nunca. */
  mainChampWr: number | null;

  /** Su µ de Glicko, o nulo si nunca ha sido puntuado en esta modalidad. */
  rating: number | null;
  ratingRank: number | null;

  bestDuo: StatsAffinity | null;
  nemesis: StatsAffinity | null;
}

export function playersOf(stats: GroupStats): PlayerStatsView[] {
  const people = new Map(stats.players.map((p) => [p.userId, personOf(p)]));
  return stats.players.map((p) => viewOf(p, people, stats.duos));
}

function viewOf(
  player: StatsPlayer,
  people: Map<string, StatsPerson>,
  duos: readonly StatDuoTally[],
): PlayerStatsView {
  const person = people.get(player.userId) ?? personOf(player);
  const minutes = player.seconds / 60;

  return {
    person,
    raw: player,
    games: player.games,
    wins: player.wins,
    losses: player.losses,
    wr: percent(player.wins, player.games),
    gamesWithStats: player.gamesWithStats,
    kills: round1(per(player.kills, player.gamesWithStats)),
    deaths: round1(per(player.deaths, player.gamesWithStats)),
    assists: round1(per(player.assists, player.gamesWithStats)),
    // Sin una sola muerte el KDA es "perfecto" y no infinito: se divide por 1, que es la
    // convencion de todo cliente de LoL y lo que la gente espera leer.
    kda: round1((player.kills + player.assists) / Math.max(1, player.deaths)),
    csPerMin: round1(per(player.cs, minutes)),
    goldPerMin: Math.round(per(player.gold, minutes)),
    dmgK: round1(per(player.damageToChampions, player.gamesWithStats) / 1000),
    visionScore: Math.round(per(player.visionScore, player.gamesWithStats)),
    pentas: player.pentas,
    streak: player.currentStreak,
    bestStreak: player.bestStreak,
    worstStreak: player.worstStreak,
    mainChampionId: player.mainChampionId,
    mainChampWr:
      player.mainChampionGames > 0
        ? percent(player.mainChampionWins, player.mainChampionGames)
        : null,
    rating: player.rating,
    ratingRank: player.ratingRank,
    bestDuo: affinityOf(duos, player.userId, true, people, 'best'),
    nemesis: affinityOf(duos, player.userId, false, people, 'worst'),
  };
}

/**
 * Con quién gana más (`best`, aliado) y contra quién pierde más (`worst`, rival).
 *
 * Se mide siempre desde `userId`, que es como viaja `wins` en el contrato. La némesis es la persona
 * contra la que PEOR le va, así que se busca el mínimo — y se calcula sobre las filas rivales, que
 * el backend manda en las dos direcciones justo para esto.
 */
function affinityOf(
  duos: readonly StatDuoTally[],
  userId: string,
  allies: boolean,
  people: Map<string, StatsPerson>,
  pick: 'best' | 'worst',
): StatsAffinity | null {
  const mine = duos.filter((d) => d.allies === allies && d.a === userId && d.games > 0);
  if (!mine.length) return null;

  // Desempata por partidas jugadas: entre dos parejas al 100%, la que se ha repetido más veces es
  // la que de verdad dice algo. Y a igualdad de las dos, por id, para que no baile entre recargas.
  const sorted = [...mine].sort((x, y) => {
    const diff = percent(y.wins, y.games) - percent(x.wins, x.games);
    if (diff !== 0) return pick === 'best' ? diff : -diff;
    return y.games - x.games || x.b.localeCompare(y.b);
  });

  const chosen = sorted[0];
  const who = people.get(chosen.b);
  if (!who) return null;

  return {
    userId: who.userId,
    name: who.name,
    tag: who.tag,
    avatar: who.avatar,
    hue: who.hue,
    winrate: percent(chosen.wins, chosen.games),
    games: chosen.games,
  };
}

/* ===================== Telemetría de mapa ===================== */

export type ObjectiveId = 'dragon' | 'grubs' | 'herald' | 'baron' | 'tower';

/** Cuánto pesa llevarse un objetivo, dicho también en una palabra. */
export interface ObjectiveImpact {
  id: ObjectiveId;
  label: string;
  /** Porcentaje de partidas que ganó el equipo que se lo llevó. */
  winrate: number;
  wins: number;
  games: number;
  impact: 'Decisivo' | 'Alto' | 'Medio';
  iconUrl: string;
}

export interface SideBalance {
  games: number;
  blueWins: number;
  redWins: number;
  bluePct: number;
  redPct: number;
}

/**
 * Ritmo de las partidas. Todo nulo cuando nadie ha exportado nada: sin una sola subida no hay
 * duración que promediar, y «0:00» diría que duran nada.
 */
export interface PacingStats {
  averageDuration: string | null;
  killsPerMinute: number | null;
  totalKillsPerGame: number | null;
  firstBloodWinrate: number | null;
  firstBloodGames: number;
}

export interface MapTelemetry {
  side: SideBalance;
  pacing: PacingStats;
  objectives: ObjectiveImpact[];
}

/**
 * Los cinco objetivos que se pintan, y de qué tally del backend sale cada uno.
 *
 * **El dragón anciano no está**, y no es un olvido: el bloque de equipo del cliente de LoL trae un
 * `dragonKills` plano y ningún anciano de ninguna clase — los ancianos solo existen como eventos
 * del timeline. Pintar el eje con el recuento normal sería etiquetar una cifra como algo que no es.
 */
const OBJECTIVES: { id: ObjectiveId; from: StatObjectiveId; label: string; icon: string }[] = [
  { id: 'dragon', from: 'FIRST_DRAGON', label: 'Primer dragón', icon: 'dragon.png' },
  { id: 'grubs', from: 'GRUBS', label: 'Larvas del vacío', icon: 'grubs.png' },
  { id: 'herald', from: 'HERALD', label: 'Heraldo de la grieta', icon: 'herald.png' },
  { id: 'baron', from: 'FIRST_BARON', label: 'Primer barón', icon: 'baron.png' },
  { id: 'tower', from: 'FIRST_TOWER', label: 'Primera torre', icon: 'tower.png' },
];

function impactOf(winrate: number): ObjectiveImpact['impact'] {
  if (winrate >= 82) return 'Decisivo';
  if (winrate >= 70) return 'Alto';
  return 'Medio';
}

export function mapTelemetryOf(stats: GroupStats): MapTelemetry | null {
  if (!stats.matches) return null;

  const byObjective = new Map(stats.objectives.map((o) => [o.objective, o]));
  const firstBlood = byObjective.get('FIRST_BLOOD');
  const minutes = stats.totalSeconds / 60;
  const exported = stats.matchesWithStats;

  return {
    side: {
      games: stats.side.games,
      blueWins: stats.side.blueWins,
      redWins: stats.side.redWins,
      bluePct: percent(stats.side.blueWins, stats.side.games),
      redPct: percent(stats.side.redWins, stats.side.games),
    },
    pacing: {
      averageDuration: exported ? clock(stats.totalSeconds / exported) : null,
      killsPerMinute: minutes ? round1(stats.totalKills / minutes) : null,
      totalKillsPerGame: exported ? Math.round(stats.totalKills / exported) : null,
      firstBloodWinrate:
        firstBlood && firstBlood.games ? percent(firstBlood.wins, firstBlood.games) : null,
      firstBloodGames: firstBlood?.games ?? 0,
    },
    // Un objetivo que nadie se llevó nunca se cae de la rejilla: su tarjeta diría "0%" sobre cero
    // partidas, que se lee como "no sirve de nada" en vez de como "no ha pasado".
    objectives: OBJECTIVES.flatMap((spec) => {
      const tally = byObjective.get(spec.from);
      if (!tally || !tally.games) return [];
      const winrate = percent(tally.wins, tally.games);
      return [{
        id: spec.id,
        label: spec.label,
        winrate,
        wins: tally.wins,
        games: tally.games,
        impact: impactOf(winrate),
        iconUrl: `/assets/objectives/${spec.icon}`,
      }];
    }),
  };
}

/* ===================== Metagame ===================== */

export type MetagameBoardId = 'picks' | 'bans' | 'winrate' | 'worst-winrate';

export interface MetagameEntry {
  /** Id real de ddragon; la vista lo resuelve con `GameDataStore.championById()`. */
  championId: number;
  /** Cifra principal, ya escrita. */
  value: string;
  /** Cifra de apoyo. Siempre lleva el denominador. */
  sub: string;
}

export interface MetagameBoard {
  id: MetagameBoardId;
  title: string;
  note: string;
  entries: MetagameEntry[];
}

/**
 * Mínimo de partidas para entrar en un tablero de winrate.
 *
 * Dos y no una: un campeón jugado una sola vez es «100% de victorias» o «0%», y los dos tableros se
 * llenarían de gente que jugó una partida. Con el grupo recién empezado esto deja los dos tableros
 * vacíos, y eso es correcto — el componente pinta su estado vacío, que dice la verdad.
 */
const MIN_PICKS_FOR_WINRATE = 2;

const BOARD_SIZE = 5;

export function metagameOf(stats: GroupStats): MetagameBoard[] {
  const picked = stats.champions.filter((c) => c.picks > 0);
  const banned = stats.champions.filter((c) => c.bans > 0);
  const eligible = picked.filter((c) => c.picks >= MIN_PICKS_FOR_WINRATE);

  const byWinrate = (dir: 1 | -1) => (x: StatChampionTally, y: StatChampionTally) => {
    const diff = percent(y.wins, y.picks) - percent(x.wins, x.picks);
    // Desempata por partidas: entre dos al 60%, el que se ha jugado más veces dice más.
    return (diff !== 0 ? diff * dir : y.picks - x.picks) || x.championId - y.championId;
  };

  return [
    {
      id: 'picks',
      title: 'Más jugados',
      note: 'Sobre los diez asientos de cada partida',
      entries: [...picked]
        .sort((x, y) => y.picks - x.picks || x.championId - y.championId)
        .slice(0, BOARD_SIZE)
        .map((c) => ({
          championId: c.championId,
          value: plural(c.picks, 'partida', 'partidas'),
          sub: `${percent(c.wins, c.picks)}% de victorias`,
        })),
    },
    {
      id: 'bans',
      title: 'Más baneados',
      note: 'Cada equipo cuenta por separado: los dos bandos baneándolo son dos',
      entries: [...banned]
        .sort((x, y) => y.bans - x.bans || x.championId - y.championId)
        .slice(0, BOARD_SIZE)
        .map((c) => ({
          championId: c.championId,
          value: plural(c.bans, 'baneo', 'baneos'),
          sub: c.picks ? plural(c.picks, 'vez jugado', 'veces jugado') : 'nunca jugado',
        })),
    },
    {
      id: 'winrate',
      title: 'Mejor winrate',
      note: `Mínimo ${MIN_PICKS_FOR_WINRATE} partidas`,
      entries: [...eligible].sort(byWinrate(1)).slice(0, BOARD_SIZE).map(winrateEntry),
    },
    {
      id: 'worst-winrate',
      title: 'Peor winrate',
      note: `Mínimo ${MIN_PICKS_FOR_WINRATE} partidas`,
      entries: [...eligible].sort(byWinrate(-1)).slice(0, BOARD_SIZE).map(winrateEntry),
    },
  ];
}

function winrateEntry(c: StatChampionTally): MetagameEntry {
  return {
    championId: c.championId,
    value: `${percent(c.wins, c.picks)}% de victorias`,
    sub: `${c.wins}V - ${c.picks - c.wins}D en ${plural(c.picks, 'partida', 'partidas')}`,
  };
}

/* ===================== Dúos ===================== */

export interface GoldenDuo {
  player1: StatsPerson;
  player2: StatsPerson;
  winrate: number;
  games: number;
  wins: number;
  losses: number;
}

/**
 * Mínimo de partidas juntos para coronar un dúo. Con una sola, la pareja «de oro» sería quien
 * coincidió una noche y ganó — que es la definición de ruido.
 */
const MIN_GAMES_FOR_DUO = 2;

export function duosOf(stats: GroupStats): { golden: GoldenDuo | null; wooden: GoldenDuo | null } {
  const people = new Map(stats.players.map((p) => [p.userId, personOf(p)]));
  const pairs = stats.duos.filter((d) => d.allies && d.games >= MIN_GAMES_FOR_DUO);
  if (!pairs.length) return { golden: null, wooden: null };

  const ranked = [...pairs].sort(
    (x, y) =>
      percent(y.wins, y.games) - percent(x.wins, x.games) ||
      y.games - x.games ||
      (x.a + x.b).localeCompare(y.a + y.b),
  );

  return {
    golden: duoOf(ranked[0], people),
    // El peor es el último de la MISMA lista, no otra ordenación: así el dúo de oro y el de madera
    // no pueden ser la misma pareja salvo que solo haya una, que es cuando de verdad lo son.
    wooden: ranked.length > 1 ? duoOf(ranked[ranked.length - 1], people) : null,
  };
}

function duoOf(tally: StatDuoTally, people: Map<string, StatsPerson>): GoldenDuo | null {
  const one = people.get(tally.a);
  const other = people.get(tally.b);
  if (!one || !other) return null;
  return {
    player1: one,
    player2: other,
    winrate: percent(tally.wins, tally.games),
    games: tally.games,
    wins: tally.wins,
    losses: tally.games - tally.wins,
  };
}

/* ===================== Multikills y visión ===================== */

export interface GroupMultikills {
  pentas: number;
  quadras: number;
  triples: number;
  topPentaHunter?: { name: string; tag: string; count: number };
  topQuadraHunter?: { name: string; tag: string; count: number };
}

export function multikillsOf(stats: GroupStats): GroupMultikills | null {
  if (!stats.matchesWithStats) return null;

  const total = (pick: (p: StatsPlayer) => number) =>
    stats.players.reduce((sum, p) => sum + pick(p), 0);

  return {
    pentas: total((p) => p.pentas),
    quadras: total((p) => p.quadras),
    triples: total((p) => p.triples),
    topPentaHunter: hunterOf(stats.players, (p) => p.pentas),
    topQuadraHunter: hunterOf(stats.players, (p) => p.quadras),
  };
}

function hunterOf(
  players: readonly StatsPlayer[],
  pick: (p: StatsPlayer) => number,
): { name: string; tag: string; count: number } | undefined {
  const leader = [...players]
    .filter((p) => pick(p) > 0)
    .sort((x, y) => pick(y) - pick(x) || x.userId.localeCompare(y.userId))[0];
  if (!leader) return undefined;
  const person = personOf(leader);
  return { name: person.name, tag: person.tag, count: pick(leader) };
}

export interface GroupVision {
  wardsPlaced: number;
  wardsCleared: number;
  visionPerMin: number;
  topVisionary?: { name: string; tag: string; score: number };
}

export function visionOf(stats: GroupStats): GroupVision | null {
  if (!stats.matchesWithStats) return null;

  const wardsPlaced = stats.players.reduce((sum, p) => sum + p.wardsPlaced, 0);
  const wardsCleared = stats.players.reduce((sum, p) => sum + p.wardsKilled, 0);
  const visionScore = stats.players.reduce((sum, p) => sum + p.visionScore, 0);
  // Los diez juegan LA MISMA partida, así que los minutos del grupo son los de las partidas, no la
  // suma de los diez: dividir por esa suma daría un décimo de la cifra real.
  const minutes = stats.totalSeconds / 60;

  const visionary = [...stats.players]
    .filter((p) => p.gamesWithStats > 0)
    .sort(
      (x, y) =>
        per(y.visionScore, y.gamesWithStats) - per(x.visionScore, x.gamesWithStats) ||
        x.userId.localeCompare(y.userId),
    )[0];

  return {
    wardsPlaced,
    wardsCleared,
    visionPerMin: minutes ? round1(visionScore / minutes) : 0,
    topVisionary: visionary
      ? {
          name: personOf(visionary).name,
          tag: personOf(visionary).tag,
          score: Math.round(per(visionary.visionScore, visionary.gamesWithStats)),
        }
      : undefined,
  };
}

/* ===================== Líneas ===================== */

export interface LaneImpact {
  lane: Lane;
  label: string;
  /** De las veces que esta línea iba por delante en el min. 14, cuántas ganó la partida. */
  winrate: number;
  games: number;
  impactOrder: number;
  description: string;
}

const LANE_LABELS: Record<Lane, string> = {
  TOP: 'Top',
  JUNGLA: 'Jungla',
  MID: 'Mid',
  ADC: 'Bot (ADC)',
  SUPPORT: 'Soporte',
};

export function laneImpactOf(stats: GroupStats): LaneImpact[] {
  return stats.lanes
    .filter((l) => l.games > 0)
    .map((l) => ({
      lane: l.lane,
      label: LANE_LABELS[l.lane],
      winrate: percent(l.decisive, l.games),
      games: l.games,
      impactOrder: 0,
      // La ventaja media dice como de grandes son las brechas, que "quien gano" por si solo no.
      description: `+${round1(l.goldLead / l.games / 1000)}k de oro al min. 14 · ${plural(
        l.games,
        'duelo',
        'duelos',
      )}`,
    }))
    .sort((x, y) => y.winrate - x.winrate || y.games - x.games)
    .map((l, index) => ({ ...l, impactOrder: index + 1 }));
}

/* ===================== Récords ===================== */

export type EpicRecordIcon =
  | 'blood'
  | 'damage'
  | 'marathon'
  | 'speedrun'
  | 'monsters'
  | 'kills'
  | 'gold'
  | 'tank';

export interface EpicRecord {
  id: StatRecordId;
  icon: EpicRecordIcon;
  title: string;
  /** La cifra del récord, ya escrita. */
  value: string;
  /** Quién lo firmó, o qué partida fue. */
  detail: string;
  /** La partida en la que pasó. Real, así que la tarjeta puede enlazarla. */
  matchId: string;
  userId: string | null;
}

const RECORDS: Record<
  StatRecordId,
  { icon: EpicRecordIcon; title: string; format: (value: number) => string }
> = {
  MOST_KILLS: { icon: 'kills', title: 'Más asesinatos', format: (v) => plural(v, 'asesinato', 'asesinatos') },
  BIGGEST_SPREE: { icon: 'blood', title: 'Mayor racha sin morir', format: (v) => plural(v, 'seguido', 'seguidos') },
  MOST_DAMAGE: { icon: 'damage', title: 'Más daño a campeones', format: (v) => `${round1(v / 1000)}k` },
  MOST_DAMAGE_TAKEN: { icon: 'tank', title: 'Más daño aguantado', format: (v) => `${round1(v / 1000)}k` },
  MOST_GOLD: { icon: 'gold', title: 'Más oro generado', format: (v) => `${round1(v / 1000)}k` },
  MOST_MONSTERS: { icon: 'monsters', title: 'Más monstruos de jungla', format: (v) => plural(v, 'monstruo', 'monstruos') },
  LONGEST_GAME: { icon: 'marathon', title: 'La partida más larga', format: (v) => clock(v) },
  SHORTEST_GAME: { icon: 'speedrun', title: 'La partida más corta', format: (v) => clock(v) },
};

export function recordsOf(stats: GroupStats): EpicRecord[] {
  const people = new Map(stats.players.map((p) => [p.userId, personOf(p)]));

  return stats.records.map((record) => {
    const spec = RECORDS[record.id];
    const who = record.userId ? people.get(record.userId) : null;
    return {
      id: record.id,
      icon: spec.icon,
      title: spec.title,
      value: spec.format(record.value),
      // Los dos que son de la partida y no de nadie no acreditan a ningun jugador.
      detail: who ? who.name : 'En una noche del grupo',
      matchId: record.matchId,
      userId: record.userId,
    };
  });
}


/* ===================== El desglose de una fila ===================== */

/** Tinte de una cifra destacada. Se nombra por lo que significa, nunca por el color. */
export type StatAccent = 'secondary' | 'primary' | 'warning';

export type PlayerTileIcon =
  | 'games'
  | 'winrate'
  | 'kda'
  | 'kda-split'
  | 'cs'
  | 'gold'
  | 'damage'
  | 'vision'
  | 'penta'
  | 'streak'
  | 'ranking';

export interface PlayerTile {
  label: string;
  value: string;
  accent?: StatAccent;
  icon?: PlayerTileIcon;
}

/**
 * Las cifras que enseña la fila desplegada de un jugador.
 *
 * Dos cosas que no se pueden escribir con un numero a secas:
 *
 *  - **La racha lleva signo.** `+3` son tres victorias seguidas y `-2` dos derrotas. El mock
 *    escribia siempre «3V» porque su racha no podia ser negativa; la de verdad si.
 *  - **Sin puesto en el ladder se escribe «—», no «#0».** Alguien que nunca ha sido puntuado en
 *    esta modalidad no esta el ultimo: es que no esta.
 */
export function playerTiles(p: PlayerStatsView): PlayerTile[] {
  return [
    { label: 'Partidas', value: `${p.games}`, accent: 'secondary', icon: 'games' },
    { label: 'Win rate', value: `${p.wr}%`, accent: 'primary', icon: 'winrate' },
    { label: 'KDA', value: `${p.kda}`, accent: 'secondary', icon: 'kda' },
    { label: 'K / D / A', value: `${p.kills} / ${p.deaths} / ${p.assists}`, icon: 'kda-split' },
    { label: 'CS/min', value: `${p.csPerMin}`, icon: 'cs' },
    { label: 'Oro/min', value: `${p.goldPerMin}`, icon: 'gold' },
    { label: 'Daño/part.', value: `${p.dmgK}k`, accent: 'primary', icon: 'damage' },
    { label: 'Visión', value: `${p.visionScore}`, icon: 'vision' },
    { label: 'Pentas', value: `${p.pentas}`, accent: 'warning', icon: 'penta' },
    { label: 'Racha actual', value: streakOf(p.streak), accent: 'warning', icon: 'streak' },
    {
      label: 'Pos. ranking',
      value: p.ratingRank === null ? '—' : `#${p.ratingRank}`,
      accent: p.ratingRank !== null && p.ratingRank <= 2 ? 'primary' : undefined,
      icon: 'ranking',
    },
    {
      label: 'Mejor / Peor racha',
      value: `${p.bestStreak}V / ${Math.abs(p.worstStreak)}D`,
      accent: 'warning',
      icon: 'streak',
    },
  ];
}

/** «3V», «2D» o «—» sin ninguna todavia. El signo lleva el sentido, asi que no se pierde. */
function streakOf(streak: number): string {
  if (streak > 0) return `${streak}V`;
  if (streak < 0) return `${Math.abs(streak)}D`;
  return '—';
}

/* ===================== Utilidades ===================== */

/** Porcentaje redondeado. Sin denominador es 0, que es lo único que se puede decir de la nada. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function per(total: number, denominator: number): number {
  return denominator > 0 ? total / denominator : 0;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Segundos a `mm:ss`, que es como el cliente de LoL escribe la duración de una partida. */
function clock(seconds: number): string {
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${(whole % 60).toString().padStart(2, '0')}`;
}

function plural(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
