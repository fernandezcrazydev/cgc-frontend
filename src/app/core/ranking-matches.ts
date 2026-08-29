/**
 * Historial de partidas del acordeón del ranking: las últimas partidas de un
 * jugador del grupo, cruzadas contra OTROS jugadores del mismo ranking.
 *
 * No vive en `match-history.ts` a propósito: aquel es el historial del usuario
 * actual (6 partidas escritas a mano, otra forma y otros consumidores). Aquí
 * hace falta un generador por jugador con oponente, hechizos, runas y build.
 *
 * BACKEND NOTE: placeholder completo (categoría desechable de CLAUDE.md). El
 * endpoint real de historial devolverá esto embebido —con las `iconUrl` ya
 * montadas por el servidor, como hace `game-data`— y este fichero se borra
 * entero. Nada de aquí debe sobrevivir a la migración.
 *
 * De campeones, hechizos y runas ya solo quedan los ids: nombres e iconos los sirve
 * `core/game-data` contra el backend, y la vista los resuelve por id. Lo que sobrevive
 * aquí es únicamente el sorteo determinista, que es lo que sustituirá el endpoint.
 */
import { NfLane } from '../ui/lane-icon/nf-lane-icon';
import { MatchRecord } from './match-history';
import { RankEntry, hash, seeded } from './group-ranking';

/**
 * Ids reales de ddragon de los hechizos de invocador que sortea el generador.
 *
 * Solo los ids: el NOMBRE lo sirve el backend (`GET /game-data/summoner-spells`), igual que
 * el icono, y la vista lo resuelve por `GameDataStore.spellById()`. Aquí había una tabla
 * `id -> nombre` escrita a mano que ya no pinta nada.
 */
const SPELL_IDS = [1, 3, 4, 7, 11, 12, 14, 21];

/**
 * Ids reales de las runas clave y de los cinco árboles secundarios.
 *
 * Mismo criterio que los hechizos, con una vuelta de tuerca: las runas ya NO están en Data
 * Dragon (Riot las retiró, `runesReactive.json` responde 403), así que el backend las importa
 * de CommunityDragon y las sirve por `GET /game-data/perks`. Para el front eso es invisible:
 * sigue siendo un id que se resuelve por `GameDataStore.perkById()`.
 */
const KEYSTONE_IDS = [8005, 8010, 8021, 8112, 8128, 8214, 8229, 8351, 8369, 8437];
const TREE_IDS = [8000, 8100, 8200, 8300, 8400];

/**
 * Objetos con su id real de ddragon. Se tipa el id desde ya aunque hoy no se
 * pinte: NO hay catálogo de objetos por id en la app (`GameDataApi.items()` es
 * un buscador paginado, no una resolución por id), así que la vista dibuja el
 * hueco con un degradado derivado del nombre —la convención que ya usan
 * `.mh-item` (`grupo-historial.ts`) y `partida-detalle.ts`—. Vendorizar iconos
 * de objeto sería traerse 300+ ficheros que Riot rota cada parche.
 */
export interface RankMatchItem {
  id: number;
  name: string;
}

const ITEMS: RankMatchItem[] = [
  { id: 3031, name: 'Filo del Infinito' },
  { id: 6672, name: 'Matakrákens' },
  { id: 3072, name: 'Sediento de Sangre' },
  { id: 3036, name: 'Saludos de Lord Dominik' },
  { id: 6692, name: 'Eclipse' },
  { id: 3142, name: 'Guadaña Fantasmal de Youmuu' },
  { id: 3814, name: 'Filo de la Noche' },
  { id: 3089, name: 'Sombrero Mortal de Rabadon' },
  { id: 3157, name: 'Reloj de Arena de Zhonya' },
  { id: 6653, name: 'Tormento de Liandry' },
  { id: 3135, name: 'Vacío Anulador' },
  { id: 3068, name: 'Égida Solar' },
  { id: 3075, name: 'Cota de Espinas' },
  { id: 3143, name: 'Presagio de Randuin' },
  { id: 3065, name: 'Visage Espiritual' },
  { id: 3006, name: 'Grebas del Berserker' },
  { id: 3020, name: 'Zapatos de Hechicero' },
  { id: 3047, name: 'Tabis de Acero' },
];

const TRINKETS: RankMatchItem[] = [
  { id: 3340, name: 'Tótem de Guardián' },
  { id: 3364, name: 'Lente de Oráculo' },
  { id: 3363, name: 'Alteración de Visión Lejana' },
];

/** Un lado del "VS": el jugador de la fila, o su oponente directo de línea. */
export interface RankMatchSide {
  playerId: string;
  name: string;
  /** Región, para pintar "Nombre#REGION". */
  tag: string;
  /** Tinte del avatar de reserva cuando no hay icono de campeón. */
  hue: number;
  /** Id real de ddragon; la vista lo resuelve con `GameDataStore.championById()`. */
  championId: number;
  spellIds: readonly [number, number];
  /** Runa clave + árbol secundario. */
  perkIds: readonly [number, number];
}

export interface RankMatch {
  /**
   * Direccionable: `rkm_<idA>_<idB>_<i>`, ver `rankMatchById`. Separador `_`
   * porque los `playerId` YA llevan guiones (`rk-lan-challenger-3`) y un
   * `split('-')` no podría reconstruirlos.
   */
  id: string;
  win: boolean;
  durationMin: number;
  /** ISO-8601. La vista lo formatea a "hace 2 d" con `timeAgo` de `core/notifications`. */
  playedAt: string;
  lane: NfLane;
  player: RankMatchSide;
  opponent: RankMatchSide;
  kills: number;
  deaths: number;
  assists: number;
  /** Participación en asesinatos, 0-100. */
  kp: number;
  cs: number;
  /** Exactamente 6 huecos; los finales pueden ser `null` (build sin acabar). */
  items: (RankMatchItem | null)[];
  trinket: RankMatchItem | null;
  /** LP ganados (+) o perdidos (−) en esta partida. */
  lpDelta: number;
}

const pick = <T>(rnd: () => number, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

function sideOf(entry: RankEntry, rnd: () => number): RankMatchSide {
  const a = pick(rnd, SPELL_IDS);
  let b = pick(rnd, SPELL_IDS);
  if (b === a) b = SPELL_IDS[(SPELL_IDS.indexOf(a) + 1) % SPELL_IDS.length];
  return {
    playerId: entry.playerId,
    name: entry.name,
    tag: entry.tag,
    hue: entry.hue,
    championId: entry.mainChampionId,
    spellIds: [a, b],
    perkIds: [pick(rnd, KEYSTONE_IDS), pick(rnd, TREE_IDS)],
  };
}

/** Seis objetos, los últimos posiblemente vacíos, sin repetir dentro de la build. */
function buildItems(rnd: () => number): (RankMatchItem | null)[] {
  const pool = [...ITEMS];
  const filled = 4 + Math.floor(rnd() * 3); // 4-6
  const out: (RankMatchItem | null)[] = [];
  for (let i = 0; i < 6; i++) {
    if (i < filled && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    else out.push(null);
  }
  return out;
}

/**
 * Cuántas veces se han enfrentado dos jugadores. SIMÉTRICA por construcción
 * (se siembra con los dos ids ordenados), que es lo que hace que el historial
 * de A y el de B cuenten las mismas partidas y no dos versiones distintas.
 *
 * Solo se cruzan jugadores de nivel parecido —±6 puestos— o de la misma línea:
 * un Challenger contra un Oro no es un "rival directo" creíble.
 */
function encounterCount(groupId: string, a: RankEntry, b: RankEntry): number {
  const near = Math.abs(a.rank - b.rank) <= 6;
  const sameLane = a.lane === b.lane;
  if (!near && !sameLane) return 0;

  const [lo, hi] = [a.playerId, b.playerId].sort();
  const n = hash(groupId + '|pair|' + lo + '|' + hi) % 4;
  // 0-3, pero los de la misma línea se ven más a menudo.
  return sameLane ? Math.max(1, n) : Math.max(0, n - 1);
}

/**
 * Últimas `count` partidas de `entry`, cruzadas contra otros jugadores del
 * mismo ranking, de la más reciente a la más antigua.
 *
 * Se construye el CALENDARIO COMPLETO de enfrentamientos del jugador (cada
 * pareja aporta `encounterCount` partidas) y luego se recortan las 5 últimas.
 * Como el calendario y cada partida se siembran por la clave canónica de la
 * pareja —los dos ids ordenados, nunca quien mira—, el enfrentamiento A-B sale
 * idéntico desde las dos filas: mismo id, misma duración, misma fecha y el
 * resultado invertido. Generarlo desde el punto de vista del que mira daría
 * dos versiones contradictorias de la misma partida.
 */
export function rankMatchesFor(
  groupId: string,
  entry: RankEntry,
  board: readonly RankEntry[],
  count = 5,
): RankMatch[] {
  const foes = board.filter((o) => o.playerId !== entry.playerId && !o.banned);
  const all: RankMatch[] = [];

  for (const foe of foes) {
    const n = encounterCount(groupId, entry, foe);
    for (let i = 0; i < n; i++) all.push(buildMatch(groupId, entry, foe, i));
  }

  return all
    .sort((x, y) => (x.playedAt < y.playedAt ? 1 : x.playedAt > y.playedAt ? -1 : 0))
    .slice(0, count);
}

/** Construye la partida `i` entre `entry` y `foe` desde la semilla de la pareja. */
function buildMatch(groupId: string, entry: RankEntry, foe: RankEntry, i: number): RankMatch {
  const [lo, hi] = [entry.playerId, foe.playerId].sort();
  const rnd = seeded(hash(groupId + '|' + lo + '|' + hi + '|' + i));

  // El resultado se decide para el jugador CANÓNICO (`lo`) y se invierte para
  // el otro: así las dos filas cuentan la misma partida.
  const loWins = rnd() < 0.5;
  const win = entry.playerId === lo ? loWins : !loWins;

  const durationMin = 22 + Math.floor(rnd() * 22);
  // BACKEND NOTE: `Date.now()` como ancla es la única excepción consciente a
  // "cero Date.now() para datos de dominio" (CLAUDE.md): la copy pedida es
  // relativa ("hace 2 d") y una fecha fija se leería "hace 300 d" en un mes.
  // El backend mandará el `playedAt` real y esto desaparece.
  // El día sale del hash de la PAREJA, no del índice: si dependiese de `i`,
  // los 27 rivales caerían todos en los mismos tres días.
  const daysAgo = (hash(lo + '|' + hi) % 26) + i * 2;
  const playedAt = new Date(Date.now() - daysAgo * 86400000 - Math.floor(rnd() * 82800000)).toISOString();

  const kills = win ? 4 + Math.floor(rnd() * 12) : 1 + Math.floor(rnd() * 7);
  const deaths = win ? 1 + Math.floor(rnd() * 5) : 4 + Math.floor(rnd() * 8);
  const assists = 2 + Math.floor(rnd() * 14);

  // El LP concuerda con la columna "LP prom." de la tabla: si no, la fila dice
  // +23 mientras la tabla promete +19 y el usuario nota el desajuste.
  const jitter = Math.floor(rnd() * 5) - 2;
  const lpDelta = win ? entry.avgLpGain + jitter : -(entry.avgLpLoss + jitter);

  return {
    id: 'rkm_' + lo + '_' + hi + '_' + i,
    win,
    durationMin,
    playedAt,
    lane: entry.lane,
    player: sideOf(entry, rnd),
    opponent: sideOf(foe, rnd),
    kills,
    deaths,
    assists,
    kp: Math.min(99, entry.kp + Math.floor(rnd() * 12) - 6),
    cs: Math.round(durationMin * (4.6 + rnd() * 3.4)),
    items: buildItems(rnd),
    trinket: pick(rnd, TRINKETS),
    lpDelta,
  };
}

/**
 * Regenera una partida desde su id para que `/app/historial/:id` no dé 404.
 * El id lleva dentro los dos jugadores y el índice, y el `groupId` se recupera
 * del propio `playerId` (`rk-<groupId>-<n>`), así que basta reparsear y volver
 * a sembrar con la misma clave de pareja. Devuelve `undefined` si el id no es
 * de este generador o si los jugadores ya no están en el ranking del grupo.
 */
export function rankMatchById(id: string, board: readonly RankEntry[]): RankMatch | undefined {
  const parts = id.split('_');
  if (parts.length !== 4 || parts[0] !== 'rkm') return undefined;

  const [, loId, hiId, rawIndex] = parts;
  const i = Number(rawIndex);
  if (!Number.isInteger(i) || i < 0) return undefined;

  const lo = board.find((e) => e.playerId === loId);
  const hi = board.find((e) => e.playerId === hiId);
  if (!lo || !hi || lo.playerId === hi.playerId) return undefined;

  // `rk-<groupId>-<n>` → `<groupId>` (el groupId puede llevar guiones).
  const groupId = loId.slice(3, loId.lastIndexOf('-'));
  return buildMatch(groupId, lo, hi, i);
}

/**
 * Recupera el `groupId` de un id de partida del ranking, para poder rehacer el
 * `board` que necesita `rankMatchById`. El id lleva dentro `rk-<groupId>-<n>`,
 * y el `groupId` puede tener guiones, así que se corta por el ÚLTIMO.
 */
export function groupIdFromRankMatchId(id: string): string | null {
  const parts = id.split('_');
  if (parts.length !== 4 || parts[0] !== 'rkm') return null;
  const playerId = parts[1];
  if (!playerId.startsWith('rk-')) return null;
  const groupId = playerId.slice(3, playerId.lastIndexOf('-'));
  return groupId || null;
}

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/**
 * Adapta una partida del ranking a la forma que ya consume `partida-detalle`
 * (`MatchRecord`), para que los enlaces del acordeón lleven a un detalle real
 * en vez de al 404. Se adapta en vez de reescribir la vista porque el DTO
 * bueno lo definirá el backend: cuando llegue, sobra este puente y la vista se
 * conecta directa.
 */
export function rankMatchAsRecord(m: RankMatch, groupId: string, groupName: string): MatchRecord {
  const d = new Date(m.playedAt);
  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    id: m.id,
    championId: m.player.championId,
    win: m.win,
    mode: '5v5 · CUSTOM',
    date: `${pad(d.getDate())} ${MONTHS[d.getMonth()]} · ${pad(d.getHours())}:${pad(d.getMinutes())}`,
    durationMin: m.durationMin,
    groupId,
    groupName,
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
    cs: m.cs,
    // Oro estimado a partir de farmeo y kills: el backend mandará el real.
    gold: Math.round(m.cs * 21 + m.kills * 320 + m.assists * 95 + m.durationMin * 118),
    items: m.items.map((it) => it?.name ?? null),
  };
}
