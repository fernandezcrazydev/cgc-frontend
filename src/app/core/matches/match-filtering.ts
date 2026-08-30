/**
 * Filtrado y ordenación del historial, como funciones puras.
 *
 * Vive aquí y no dentro del store por dos motivos. Uno, el estado de los filtros es estado de
 * UI y ya no puede vivir en un store de `core/` (ver `MatchHistoryUiState`): lo que sí es
 * reutilizable es *cómo* se filtra. Y dos, así las dos vistas comparten de verdad la misma
 * ordenación — antes el historial de grupo ignoraba `sortBy` por completo, y nadie lo notaba
 * porque el control ni siquiera estaba pintado.
 *
 * BACKEND NOTE: cuando exista `GET /matches`, este filtrado se manda como query params y el
 * servidor devuelve la página ya filtrada y ordenada (regla del proyecto: listas paginadas y
 * filtradas en servidor). `MatchFilterState` es justo la forma de esos parámetros, así que
 * sobrevive; las tres funciones de abajo se borran.
 */
import { CrossMatch, CrossRelation } from './cross-history';
import { Lane, Match } from './models';

export type MatchSortBy = 'date-desc' | 'date-asc' | 'duration-desc' | 'kills-desc';

/** Todas las del grupo, solo las que jugaste, o solo las que jugaron los demás. */
export type MatchParticipation = 'all' | 'mine' | 'others';

/**
 * Estado de los filtros. Algunos campos solo aplican a una de las dos vistas, y está bien
 * que sea así: son dos preguntas distintas sobre los mismos datos.
 */
export interface MatchFilterState {
  /** Solo en la vista personal: acotar a una liga. En la de grupo el contexto ya lo fija. */
  groupId: string | 'all';
  /**
   * Solo en la vista personal: la posición que jugaste TÚ. En la de grupo no existe filtro de
   * posición, y no por omisión: medido contra los diez participantes no descarta nada, porque
   * un 5v5 completo siempre cubre las cinco posiciones. El control estuvo pintado ahí, con su
   * chip de «filtro puesto» y todo, sin cambiar jamás un solo resultado.
   */
  role: Lane | 'all';
  championId: number | 'all';
  /** Solo en la vista personal: cómo TE fue. */
  outcome: 'all' | 'win' | 'loss';
  /**
   * Solo en la vista de grupo: qué bando ganó. Sustituye al `outcome` que se usaba aquí, y
   * que mentía: descartaba únicamente las partidas que habías jugado, así que «Victorias»
   * enseñaba tus victorias MÁS todas las partidas ajenas, sin decirlo.
   */
  winningSide: 'all' | 'blue' | 'red';
  /**
   * Solo en la vista de grupo: qué papel tuviste. `others` no es lo contrario trivial de
   * `mine` —sirve para repasar lo que ha jugado el resto del grupo— y por eso son tres
   * estados y no un interruptor.
   */
  participation: MatchParticipation;
  /**
   * Solo en la vista cruzada: si en esa partida fuisteis compañeros o rivales. Es la pregunta
   * propia de esa pantalla —«¿cómo nos ha ido juntos, y cómo enfrentados?»— y por eso no se
   * mezcla con `outcome`, que sigue diciendo cómo TE fue.
   */
  relation: CrossRelation | 'all';
  /** Búsqueda libre por jugador, campeón o grupo. */
  searchQuery: string;
  sortBy: MatchSortBy;
}

export const EMPTY_FILTERS: MatchFilterState = {
  groupId: 'all',
  role: 'all',
  championId: 'all',
  outcome: 'all',
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
  { value: 'kills-desc', label: 'Más bajas' },
];

/**
 * Historial personal: todo se mide contra TU participación. Filtrar por MID significa las
 * partidas en las que jugaste MID, no aquellas en las que alguien jugó MID.
 */
export function filterPersonalMatches(list: readonly Match[], f: MatchFilterState): Match[] {
  return list.filter((m) => {
    if (f.groupId !== 'all' && m.groupId !== f.groupId) return false;
    if (f.outcome !== 'all' && m.userOutcome !== f.outcome) return false;
    if (f.role !== 'all' && m.userParticipant?.role !== f.role) return false;
    if (f.championId !== 'all' && m.userParticipant?.championId !== f.championId) return false;
    return matchesQuery(m, f.searchQuery);
  });
}

/**
 * Historial de grupo: es el registro colectivo, así que el campeón se mide contra los diez
 * participantes, no contra ti. Para acotarlo por tu papel está `participation`, que lo dice.
 */
export function filterGroupMatches(list: readonly Match[], f: MatchFilterState): Match[] {
  return list.filter((m) => {
    if (f.participation === 'mine' && !m.userParticipant) return false;
    if (f.participation === 'others' && m.userParticipant) return false;
    if (f.winningSide !== 'all' && m.winningTeam !== f.winningSide) return false;

    // `role` no se mira aquí a propósito: contra los diez participantes es siempre cierto.
    // El campeón sí discrimina —no todas las partidas tienen Ahri— y por eso se queda.
    if (f.championId !== 'all' && !participantsOf(m).some((p) => p.championId === f.championId)) {
      return false;
    }
    return matchesQuery(m, f.searchQuery);
  });
}

/**
 * Historial cruzado: como el personal —todo se mide contra TU participación— más la relación,
 * que es la dimensión que solo existe cuando hay otro jugador enfrente.
 *
 * `role` mira tu posición y no la suya a propósito: filtrar por MID contesta «cuando yo jugaba
 * MID», que es la pregunta que se hace desde tu propio historial. Para el duelo de línea real
 * está `sameLane`, que ya viene resuelto en cada `CrossMatch`.
 */
export function filterCrossMatches(
  list: readonly CrossMatch[],
  f: MatchFilterState,
): CrossMatch[] {
  return list.filter((c) => {
    if (f.relation !== 'all' && c.relation !== f.relation) return false;
    if (f.groupId !== 'all' && c.match.groupId !== f.groupId) return false;
    if (f.outcome !== 'all' && c.match.userOutcome !== f.outcome) return false;
    if (f.role !== 'all' && c.me.role !== f.role) return false;
    if (f.championId !== 'all' && c.me.championId !== f.championId) return false;
    return matchesQuery(c.match, f.searchQuery);
  });
}

/**
 * Ordena partidas cruzadas con el mismo criterio que la lista normal, reutilizando
 * `sortMatches` sobre la partida que cada una envuelve: si el control de orden dice lo mismo
 * en las dos pantallas, tiene que ordenar igual.
 */
export function sortCrossMatches(
  list: readonly CrossMatch[],
  sortBy: MatchSortBy,
): CrossMatch[] {
  const byId = new Map(list.map((c) => [c.id, c]));
  return sortMatches(
    list.map((c) => c.match),
    sortBy,
  ).map((m) => byId.get(m.id)!);
}

/** Devuelve una copia ordenada: `sort` muta, y estas listas vienen de un `computed`. */
export function sortMatches(list: readonly Match[], sortBy: MatchSortBy): Match[] {
  const sorted = [...list];
  switch (sortBy) {
    case 'date-asc':
      return sorted.sort((a, b) => time(a) - time(b));
    case 'duration-desc':
      return sorted.sort((a, b) => b.durationSeconds - a.durationSeconds);
    case 'kills-desc':
      return sorted.sort((a, b) => totalKills(b) - totalKills(a));
    default:
      return sorted.sort((a, b) => time(b) - time(a));
  }
}

/**
 * Texto reducido a su esqueleto comparable: sin tildes, sin mayúsculas y sin nada que no sea
 * letra o dígito. Así «Kai'Sa» y «kaisa» son la misma cadena, y también «N1ghtfang#LAN» y
 * «n1ghtfanglan».
 *
 * Vive aquí y se exporta porque el autocompletado del buscador la necesita **exactamente igual**:
 * mientras cada lado normalizaba a su manera (aquí un `toLowerCase()` a secas, allí esto), el
 * desplegable te ofrecía «Kai'Sa» al teclear «kaisa» y pulsar Enter sin elegirla daba cero
 * resultados. Un buscador que sugiere lo que luego no encuentra es peor que uno que no sugiere.
 */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * La búsqueda libre mira jugador, campeón y grupo a la vez, y por eso el placeholder los
 * nombra los tres: un buscador que no dice sobre qué busca obliga a probar.
 */
function matchesQuery(m: Match, rawQuery: string): boolean {
  const q = normalizeForSearch(rawQuery);
  if (!q) return true;
  if (normalizeForSearch(m.group.name).includes(q)) return true;
  return participantsOf(m).some(
    (p) =>
      normalizeForSearch(p.riotId).includes(q) || normalizeForSearch(p.championName).includes(q),
  );
}

function participantsOf(m: Match) {
  return [...m.blueTeam.participants, ...m.redTeam.participants];
}

function totalKills(m: Match): number {
  return m.blueTeam.totalKills + m.redTeam.totalKills;
}

function time(m: Match): number {
  return new Date(m.decidedAt).getTime();
}
