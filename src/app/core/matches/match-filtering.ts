/**
 * Los filtros del historial, y su traducción a los query params de cada endpoint.
 *
 * **Filtrar y ordenar ya no se hace aquí.** Lo hace el servidor, que es el único que tiene la
 * colección entera: `filterPersonalMatches`, `filterGroupMatches`, `sortMatches`,
 * `filterCrossMatches` y `sortCrossMatches` se borraron al conectar el historial. Lo que queda
 * es el estado de los controles y cómo se escribe en la URL.
 *
 * ## Por qué hay DOS tipos de consulta y no uno
 *
 * Un mismo filtro no significa lo mismo en las dos listas, así que mandar el mismo objeto a los
 * dos endpoints sería mandar la pregunta equivocada:
 *
 * | | Lista de grupo | Lista personal |
 * |---|---|---|
 * | `championId` | el campeón de **cualquiera** de los diez | el campeón que jugué **yo** |
 * | `outcome` | **no existe** | cómo me fue **a mí** |
 * | `winningSide` | qué bando ganó | **no existe** |
 * | `lane` | **no existe** | la línea que jugué **yo** |
 * | `participation` | todas / mías / de los demás | **no existe** (todas son mías) |
 *
 * `outcome` y `winningSide` **no son la misma pregunta**, y confundirlas ya costó un bug: el
 * `outcome` de la lista de grupo descartaba solo las partidas que habías jugado, así que
 * «Victorias» enseñaba tus victorias MÁS todas las partidas ajenas, sin decirlo.
 *
 * `GroupMatchQuery` y `PersonalMatchQuery` son los dos tipos partidos, y son los que aceptan
 * `MatchesApi.groupMatches()` y `MatchesApi.myMatches()`: el compilador impide mandar
 * `winningSide` a `/me/matches`. `MatchFilterState` sigue siendo uno solo porque describe el
 * PANEL DE CONTROLES, que es una sola pieza de interfaz con dos modos; quien decide qué viaja
 * son las dos funciones de traducción del final, nunca la vista.
 *
 * **No hay filtro de posición en la lista de grupo**, y no por omisión: medido contra los diez
 * participantes no descarta nada nunca, porque un 5v5 completo siempre cubre las cinco. El
 * control llegó a estar pintado ahí, con su chip de «filtro puesto», sin cambiar jamás un
 * resultado.
 *
 * **No hay `gameMode` ni `lobbyType`.** Lo que existe es `preset`, la modalidad con la que se
 * abrió la sala. «Room»/«Party» no tiene equivalente en el backend: ese concepto no existe.
 */
import { Lane, MatchPreset } from './models';

export type MatchSortBy = 'date-desc' | 'date-asc' | 'duration-desc' | 'kills-desc';

/** Todas las del grupo, solo las que jugaste, o solo las que jugaron los demás. */
export type MatchParticipation = 'all' | 'mine' | 'others';

/** En una partida cruzada: si fuisteis compañeros o rivales. Lo decide el servidor. */
export type CrossRelation = 'ally' | 'enemy';

/**
 * Estado de los controles de filtrado. Algunos campos solo aplican a uno de los modos, y está
 * bien que sea así: son preguntas distintas sobre los mismos datos, y el panel es el mismo
 * componente. Lo que NO puede pasar es que un campo del modo equivocado llegue a viajar; de
 * eso se encargan `groupMatchQuery()` y `personalMatchQuery()`.
 */
export interface MatchFilterState {
  /** La modalidad con la que se abrió la sala. Sustituye a los antiguos `gameMode`/`lobbyType`. */
  preset: MatchPreset | 'all';
  /** Acota a una liga. Sustituye a los antiguos `groupId` y `season`: el endpoint filtra por liga. */
  leagueId: string | 'all';
  championId: number | 'all';
  /** Personal y cruzado: cómo TE fue. */
  outcome: 'all' | 'win' | 'loss';
  /** Personal y cruzado: la posición que jugaste TÚ. */
  lane: Lane | 'all';
  /** Solo grupo: qué bando ganó. No es `outcome`, y por eso son dos campos. */
  winningSide: 'all' | 'blue' | 'red';
  /**
   * Solo grupo: qué papel tuviste. `others` no es lo contrario trivial de `mine` —sirve para
   * repasar lo que ha jugado el resto del grupo— y por eso son tres estados y no un interruptor.
   */
  participation: MatchParticipation;
  /** Solo cruzado: «¿cómo nos ha ido juntos, y cómo enfrentados?». */
  relation: CrossRelation | 'all';
  /** Búsqueda libre por jugador o campeón; la resuelve el servidor. */
  searchQuery: string;
  sortBy: MatchSortBy;
}

export const EMPTY_FILTERS: MatchFilterState = {
  preset: 'all',
  leagueId: 'all',
  championId: 'all',
  outcome: 'all',
  lane: 'all',
  winningSide: 'all',
  participation: 'all',
  relation: 'all',
  searchQuery: '',
  sortBy: 'date-desc',
};

/** Etiquetas del control de ordenación, en el orden en que se ofrecen. */
export const SORT_OPTIONS: readonly { value: MatchSortBy; label: string }[] = [
  { value: 'date-desc', label: 'Más recientes' },
  { value: 'date-asc', label: 'Más antiguas' },
  { value: 'duration-desc', label: 'Más largas' },
  { value: 'kills-desc', label: 'Más Kills' },
];

/**
 * El `sort` que entiende el servidor: `campo,dir` con `playedAt`, `duration` o `kills`.
 * **Cualquier otra cosa es un 400 `UNSORTABLE_MATCH_FIELD`**, no un silencio que devuelva otro
 * orden — que es exactamente por lo que esta traducción vive en un solo sitio y es total sobre
 * `MatchSortBy`: añadir una opción al desplegable obliga a decidir su campo aquí.
 */
const SORT_PARAM: Record<MatchSortBy, string> = {
  'date-desc': 'playedAt,desc',
  'date-asc': 'playedAt,asc',
  'duration-desc': 'duration,desc',
  'kills-desc': 'kills,desc',
};

export function sortParam(sortBy: MatchSortBy): string {
  return SORT_PARAM[sortBy] ?? SORT_PARAM['date-desc'];
}

/**
 * Tope duro del servidor para `size`. Pedir más no devuelve más: se recorta, y la vista se
 * quedaría creyendo que ha pintado una página entera.
 */
export const MAX_PAGE_SIZE = 60;

/** Lo que viaja a `GET /groups/{id}/matches`. `page` es 0-based. */
export interface GroupMatchQuery {
  page: number;
  size: number;
  sort: string;
  preset?: MatchPreset;
  leagueId?: string;
  championId?: number;
  winningSide?: 'BLUE' | 'RED';
  participation?: 'ALL' | 'MINE' | 'OTHERS';
  q?: string;
}

/** Lo que viaja a `GET /me/matches` y a `GET /me/matches/summary`. */
export interface PersonalMatchQuery {
  page: number;
  size: number;
  sort: string;
  preset?: MatchPreset;
  leagueId?: string;
  championId?: number;
  outcome?: 'WIN' | 'LOSS';
  lane?: Lane;
  /**
   * El cruce **es un filtro, no un endpoint**: son las partidas en las que coincidisteis.
   * Con `relation` encima, en las que fuisteis compañeros o rivales. La relación la decide el
   * servidor leyendo los dos equipos; nunca se adivina.
   */
  with?: string;
  relation?: 'ALLY' | 'ENEMY';
  q?: string;
}

/** Los mismos parámetros del listado personal, sin paginación: `GET /me/matches/summary`. */
export type PersonalSummaryQuery = Omit<PersonalMatchQuery, 'page' | 'size' | 'sort'>;

/** Estado de controles → query del historial de grupo. Lo que no aplica aquí, no viaja. */
export function groupMatchQuery(
  f: MatchFilterState,
  page: number,
  size: number,
): GroupMatchQuery {
  return {
    page,
    size: Math.min(size, MAX_PAGE_SIZE),
    sort: sortParam(f.sortBy),
    ...(f.preset !== 'all' && { preset: f.preset }),
    ...(f.leagueId !== 'all' && { leagueId: f.leagueId }),
    ...(f.championId !== 'all' && { championId: f.championId }),
    ...(f.winningSide !== 'all' && { winningSide: upper(f.winningSide) }),
    ...(f.participation !== 'all' && { participation: upper(f.participation) }),
    ...(f.searchQuery.trim() && { q: f.searchQuery.trim() }),
  };
}

/**
 * Estado de controles → query del historial personal. `with`/`relation` no salen del panel:
 * los fija la pantalla del cruce, que es la única que sabe con quién se está comparando.
 */
export function personalMatchQuery(
  f: MatchFilterState,
  page: number,
  size: number,
  cross?: { with: string; relation?: CrossRelation | 'all' },
): PersonalMatchQuery {
  return {
    page,
    size: Math.min(size, MAX_PAGE_SIZE),
    sort: sortParam(f.sortBy),
    ...personalSummaryQuery(f, cross),
  };
}

/** La misma traducción sin paginación, para el resumen (que acepta los mismos filtros). */
export function personalSummaryQuery(
  f: MatchFilterState,
  cross?: { with: string; relation?: CrossRelation | 'all' },
): PersonalSummaryQuery {
  const relation = cross?.relation ?? f.relation;
  return {
    ...(f.preset !== 'all' && { preset: f.preset }),
    ...(f.leagueId !== 'all' && { leagueId: f.leagueId }),
    ...(f.championId !== 'all' && { championId: f.championId }),
    ...(f.outcome !== 'all' && { outcome: f.outcome === 'win' ? ('WIN' as const) : ('LOSS' as const) }),
    ...(f.lane !== 'all' && { lane: f.lane }),
    ...(cross && { with: cross.with }),
    ...(cross && relation !== 'all' && { relation: relation === 'ally' ? ('ALLY' as const) : ('ENEMY' as const) }),
    ...(f.searchQuery.trim() && { q: f.searchQuery.trim() }),
  };
}

/** Cuántos controles hay puestos: es el número del chip de «filtros activos». */
export function activeFilterCount(f: MatchFilterState, mode: 'personal' | 'group' | 'cross'): number {
  let count = 0;
  if (f.preset !== 'all') count++;
  if (f.leagueId !== 'all') count++;
  if (f.championId !== 'all') count++;
  if (f.searchQuery.trim()) count++;
  if (mode === 'group') {
    if (f.winningSide !== 'all') count++;
    if (f.participation !== 'all') count++;
  } else {
    if (f.outcome !== 'all') count++;
    if (f.lane !== 'all') count++;
    if (mode === 'cross' && f.relation !== 'all') count++;
  }
  return count;
}

/**
 * Texto reducido a su esqueleto comparable: sin tildes, sin mayúsculas y sin nada que no sea
 * letra o dígito. Así «Kai'Sa» y «kaisa» son la misma cadena, y también «N1ghtfang#LAN» y
 * «n1ghtfanglan».
 *
 * Sobrevive a la migración porque el autocompletado del buscador es de cliente: compara lo que
 * tecleas contra el catálogo de campeones que ya está cargado, antes de mandar nada. Mientras
 * cada lado normalizaba a su manera, el desplegable te ofrecía «Kai'Sa» al teclear «kaisa» y
 * pulsar Enter sin elegirla daba cero resultados. Un buscador que sugiere lo que luego no
 * encuentra es peor que uno que no sugiere.
 */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function upper<T extends string>(value: T): Uppercase<T> {
  return value.toUpperCase() as Uppercase<T>;
}
