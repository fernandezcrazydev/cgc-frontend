/**
 * Piezas puras de la navegación del shell.
 *
 * Viven fuera del componente para poder probarlas sin montarlo: `Shell` arrastra sesión,
 * notificaciones SSE, grupos y media docena de stores, y montarlo entero para comprobar que una
 * URL rotula «Ranking» sería pagar un TestBed por una función de cadenas.
 */

/** Una sección navegable dentro de un grupo, tal y como se pinta en la barra lateral. */
export interface GroupNavItem {
  /** Segmento que cuelga de `/app/grupos/:id`. Cadena vacía = el hub del grupo. */
  path: string;
  label: string;
  glyph: string;
  /** Acción principal del grupo: se destaca visualmente sobre el resto. */
  primary?: boolean;
  /** Solo para OWNER/ADMIN. Es UX; el backend revalida con `@groupSecurity.isAdmin`. */
  adminOnly?: boolean;
}

/**
 * Las secciones de un grupo, en el orden en que se ofrecen.
 *
 * Solo **destinos navegables**. Invitar, borrar el grupo y salir de él son acciones, no rutas, y
 * se quedan en el hub: una barra de navegación que además borra cosas es una barra en la que da
 * miedo pinchar.
 */
export const GROUP_NAV: readonly GroupNavItem[] = [
  // El hub encabeza la lista: es la puerta del grupo, y pulsar el grupo en la barra lateral
  // despliega estas secciones en vez de entrar, así que tiene que ser lo primero que se ofrece.
  { path: '', label: 'Hub del grupo', glyph: '◇' },
  { path: 'crear-partida', label: 'Crear partida', glyph: '＋', primary: true },
  { path: 'partidas', label: 'Partidas', glyph: '▤' },
  { path: 'ranking', label: 'Ranking', glyph: '▲' },
  { path: 'tierlist', label: 'Tierlist', glyph: '⚔' },
  { path: 'estadisticas', label: 'Estadísticas', glyph: '◔' },
  { path: 'historial', label: 'Historial', glyph: '▣' },
  { path: 'discord', label: 'Discord', glyph: '◍', adminOnly: true },
];

/**
 * Rótulo de la sección actual, resuelto por la FORMA de la ruta.
 *
 * Sustituye a la resolución anterior, que tomaba el último segmento de la URL y encadenaba
 * `includes()`. Aquello dejaba casi toda sub-ruta cayendo en su `?? 'Inicio'`: estando en
 * `/app/grupos/:id/ranking` la cabecera leía «LAN Challenger · Inicio», y lo mismo en
 * estadísticas, en una sala, en el cara a cara y en todo el panel de administración.
 *
 * Un `:` en el patrón acepta cualquier segmento. Se exige **el mismo número de segmentos**, así
 * que `grupos/:id` y `grupos/:id/ranking` no pueden confundirse y el orden de la tabla da igual.
 */
export function pageTitleFor(url: string): string {
  const segments = (url ?? '')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);

  // Todo lo que rotula esta función cuelga de `/app`; fuera de ahí no hay shell que rotular.
  if (segments[0] !== 'app') return DEFAULT_TITLE;
  const path = segments.slice(1);
  if (path.length === 0) return DEFAULT_TITLE;

  for (const [pattern, title] of ROUTE_TITLES) {
    if (matches(pattern, path)) return title;
  }
  return NOT_FOUND_TITLE;
}

function matches(pattern: readonly string[], path: readonly string[]): boolean {
  if (pattern.length !== path.length) return false;
  return pattern.every((seg, i) => seg.startsWith(':') || seg === path[i]);
}

const DEFAULT_TITLE = 'Inicio';
const NOT_FOUND_TITLE = 'Página no encontrada';

/**
 * La tabla, en el mismo orden que `app.routes.ts` para poder cotejarlas de un vistazo.
 *
 * Los rótulos son los de la CABECERA, que no siempre coinciden con el `title` de la ruta: cuando
 * hay grupo activo la cabecera ya pinta su nombre encima, así que aquí sobra repetirlo y lo que
 * toca es nombrar la sección («Historial», no «Historial del grupo»).
 */
const ROUTE_TITLES: readonly (readonly [readonly string[], string])[] = [
  [['inicio'], 'Inicio'],
  [['historial'], 'Historial de partidas'],
  [['historial', ':id'], 'Partida'],
  [['tierlist'], 'Tierlist'],

  [['grupos'], 'Grupos'],
  [['grupos', ':id'], 'Hub del grupo'],
  [['grupos', ':id', 'perfil'], 'Perfil del grupo'],
  [['grupos', ':id', 'crear-partida'], 'Crear partida'],
  [['grupos', ':id', 'partidas'], 'Partidas'],
  [['grupos', ':id', 'partidas', ':roomId'], 'Sala'],
  [['grupos', ':id', 'ranking'], 'Ranking'],
  [['grupos', ':id', 'tierlist'], 'Tierlist'],
  [['grupos', ':id', 'estadisticas'], 'Estadísticas'],
  [['grupos', ':id', 'discord'], 'Discord'],
  [['grupos', ':id', 'historial'], 'Historial'],

  [['perfil'], 'Perfil'],
  [['perfil', ':id'], 'Perfil'],

  [['versus', ':playerId'], 'Cara a cara'],
  [['versus', ':playerId', ':matchId'], 'Duelo directo'],
  [['synergy', ':playerId'], 'Sinergia'],
  [['synergy', ':playerId', ':matchId'], 'Sinergia en la partida'],
  [['historial-cruzado', ':playerId'], 'Historial cruzado'],

  [['jugador', ':playerId'], 'Historial cruzado'],
  [['jugador', ':playerId', 'contra'], 'Cara a cara'],
  [['jugador', ':playerId', 'contra', ':matchId'], 'Duelo directo'],
  [['jugador', ':playerId', 'juntos'], 'Sinergia de dúo'],
  [['jugador', ':playerId', 'juntos', ':matchId'], 'Sinergia en la partida'],

  [['ajustes'], 'Ajustes'],

  [['admin'], 'Administración'],
  [['admin', 'feedback'], 'Feedback'],
  [['admin', 'feedback', ':id'], 'Reporte'],
  [['admin', 'riot-metricas'], 'Métricas de Riot'],
  [['admin', 'seguridad'], 'Seguridad'],
];

/**
 * El grupo que nombra la URL, si la ruta lleva uno (`/app/grupos/:id` y todas sus secciones).
 *
 * Existe porque el grupo activo lo fijaba **solo** `GroupDetailStore.load()`, como efecto lateral
 * de abrir el hub. Entrar por enlace directo a una sección —`/app/grupos/:id/ranking`— no pasa por
 * ese store, así que la barra lateral no marcaba el grupo ni desplegaba sus secciones: estabas
 * dentro del ranking de un grupo y la navegación no lo sabía.
 *
 * Devuelve `null` para `/app/grupos` a secas, que es el directorio y no un grupo concreto.
 */
export function groupIdFromUrl(url: string): string | null {
  const segments = (url ?? '')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);
  if (segments[0] !== 'app' || segments[1] !== 'grupos') return null;
  return segments[2] ?? null;
}

function urlSegments(url: string): string[] {
  return (url ?? '')
    .split('?')[0]
    .split('#')[0]
    .split('/')
    .filter(Boolean);
}

/**
 * ¿La ruta es el HUB de un grupo (`/app/grupos/:id`), y no una de sus secciones?
 *
 * Lo usa el banner de sala abierta del shell para callarse ahí: desde la Fase 2 el hub tiene su
 * propio bloque «Requiere tu atención» con la misma convocatoria, y las dos cosas juntas eran la
 * misma información dos veces en la misma pantalla. El banner sigue apareciendo en cualquier otra
 * pantalla, que es para lo que existe: enterarte sin que nadie te pase un enlace.
 */
export function isGroupHubUrl(url: string): boolean {
  const segments = urlSegments(url);
  return segments.length === 3 && segments[0] === 'app' && segments[1] === 'grupos';
}

/**
 * ¿La ruta es el panel de partidas de un grupo (`/app/grupos/:id/partidas`)?
 *
 * Mismo motivo que el hub, y desde §5.5.6 con más razón: esta pantalla ES el panel de
 * convocatorias, así que el banner encima repetía literalmente la tarjeta que hay debajo.
 * El detalle de una convocatoria (`/partidas/:roomId`) no cuenta: allí solo se ve UNA, y
 * el banner sigue sirviendo para enterarte de que hay otra.
 */
export function isGroupMatchesUrl(url: string): boolean {
  const segments = urlSegments(url);
  return (
    segments.length === 4 &&
    segments[0] === 'app' &&
    segments[1] === 'grupos' &&
    segments[3] === 'partidas'
  );
}
