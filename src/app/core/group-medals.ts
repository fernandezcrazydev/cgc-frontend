/**
 * Catálogo de medallas del Hall of Fame del grupo (`Roadmap.md` §5.5.5, pestaña 2).
 *
 * Veinte títulos comunitarios, todos derivados de la MISMA pasada de estadísticas
 * que alimenta el resto de la pantalla (`statsFor`), para que el grupo no cuente dos
 * verdades distintas: la medalla que dice que alguien es el granjero y la tabla de
 * líderes que lo desmiente serían el mismo bug que ya arrastran el ranking y las
 * estadísticas entre sí.
 *
 * Cada medalla es una definición declarativa —cómo se puntúa y cómo se escribe la
 * cifra— y de ahí sale sola la clasificación: líder, podio, tu puesto y cuánto te
 * falta para arrebatarle el primero. Añadir una medalla es añadir una entrada, no
 * escribir una pantalla.
 *
 * BACKEND NOTE: fichero PLACEHOLDER. El día que exista el endpoint de estadísticas
 * agregadas, `MEDALS` se conserva como catálogo (es contrato: los ids viajan en la
 * URL, `?medalla=<id>`) y la clasificación la calcula y pagina el servidor, que es
 * quien tiene las partidas. Este fichero se queda entonces solo con el catálogo.
 */
import { Member } from './lobby';
import { MemberStats, StatScope, statsFor } from './group-stats';

/**
 * Clave del icono vectorial. La vista dibuja el SVG; aquí solo viaja la clave, igual
 * que en `HubTrophyIcon`: este fichero no sabe de plantillas.
 */
export type MedalIcon =
  | 'penta'
  | 'quadra'
  | 'first-blood'
  | 'immortal'
  | 'silent-carry'
  | 'tower'
  | 'dragon'
  | 'baron'
  | 'steal'
  | 'farm'
  | 'gold'
  | 'damage'
  | 'shield'
  | 'heal'
  | 'freeze'
  | 'vision'
  | 'streak'
  | 'anchor'
  | 'pinata'
  | 'skull';

/** Familia temática, para que la rejilla agrupe en vez de amontonar. */
export type MedalFamily = 'combate' | 'objetivos' | 'economia' | 'equipo' | 'constancia' | 'humor';

export const MEDAL_FAMILY_LABELS: Record<MedalFamily, string> = {
  combate: 'Combate',
  objetivos: 'Objetivos',
  economia: 'Economía y daño',
  equipo: 'Aguante y equipo',
  constancia: 'Constancia',
  humor: 'Con cariño',
};

export interface MedalDefinition {
  id: string;
  icon: MedalIcon;
  title: string;
  /** A quién premia, en una frase. Es el subtítulo del modal. */
  description: string;
  family: MedalFamily;
  /**
   * Puntuación con la que se ordena el grupo. Más alto siempre gana la medalla,
   * también en las de la familia `humor`: ahí ganarla es justo la gracia.
   */
  score: (s: MemberStats) => number;
  /** Cómo se escribe esa puntuación en pantalla. */
  format: (raw: number) => string;
}

/** Formateador para las medallas que se cuentan en unidades enteras. */
function counted(singular: string, plural: string): (raw: number) => string {
  return (raw) => {
    const n = Math.round(raw);
    return n + ' ' + (n === 1 ? singular : plural);
  };
}

/** Formateador para las que llevan un decimal (medias por partida o por minuto). */
function decimal(unit: string): (raw: number) => string {
  return (raw) => raw.toFixed(1) + ' ' + unit;
}

/** Formateador para las cifras que no cambian de forma en singular ni en plural. */
function flat(unit: string): (raw: number) => string {
  return (raw) => Math.round(raw) + ' ' + unit;
}

/**
 * Las veinte medallas. El orden es el de la rejilla: primero combate, luego
 * objetivos, economía, equipo, constancia y, al final, las dos que se ganan por
 * motivos poco honrosos.
 */
export const MEDALS: readonly MedalDefinition[] = [
  // ---- Combate ----
  {
    id: 'penta-king',
    icon: 'penta',
    title: 'Rey del penta',
    description: 'Premia a quien más pentakills ha conseguido.',
    family: 'combate',
    score: (s) => s.pentas,
    format: counted('pentakill', 'pentakills'),
  },
  {
    id: 'almost-penta',
    icon: 'quadra',
    title: 'Casi penta',
    description: 'Premia a quien más veces se ha quedado a un asesinato del penta.',
    family: 'combate',
    score: (s) => s.quadras,
    format: counted('cuádruple', 'cuádruples'),
  },
  {
    id: 'first-blood',
    icon: 'first-blood',
    title: 'Gatillo fácil',
    description: 'Premia a quien más primeras sangres ha firmado.',
    family: 'combate',
    score: (s) => s.firstBloods,
    format: counted('primera sangre', 'primeras sangres'),
  },
  {
    id: 'immortal',
    icon: 'immortal',
    title: 'El inmortal',
    description: 'Premia a quien más partidas ha terminado sin morir ni una vez.',
    family: 'combate',
    score: (s) => s.deathlessGames,
    format: counted('partida sin morir', 'partidas sin morir'),
  },
  {
    id: 'silent-carry',
    icon: 'silent-carry',
    title: 'Carry silencioso',
    description: 'Premia a quien más victorias suma sin haberse llevado nunca el MVP.',
    family: 'combate',
    score: (s) => Math.max(0, s.wins - s.mvps),
    format: counted('victoria sin MVP', 'victorias sin MVP'),
  },

  // ---- Objetivos ----
  {
    id: 'demolisher',
    icon: 'tower',
    title: 'El demoledor',
    description: 'Premia a quien más estructuras enemigas ha derribado.',
    family: 'objetivos',
    score: (s) => s.towers,
    format: counted('torre', 'torres'),
  },
  {
    id: 'dragon-hunter',
    icon: 'dragon',
    title: 'Cazador de dragones',
    description: 'Premia a quien más dragones ha ayudado a asegurar.',
    family: 'objetivos',
    score: (s) => s.dragons,
    format: counted('dragón', 'dragones'),
  },
  {
    id: 'baron-slayer',
    icon: 'baron',
    title: 'Verdugo de barones',
    description: 'Premia a quien más barones ha ayudado a asegurar.',
    family: 'objetivos',
    score: (s) => s.barons,
    format: counted('barón', 'barones'),
  },
  {
    id: 'thief',
    icon: 'steal',
    title: 'El ladrón',
    description: 'Premia a quien más objetivos épicos ha robado con el castigo.',
    family: 'objetivos',
    score: (s) => s.steals,
    format: counted('robo', 'robos'),
  },

  // ---- Economía y daño ----
  {
    id: 'farmer',
    icon: 'farm',
    title: 'El granjero',
    description: 'Premia a quien más súbditos remata por minuto.',
    family: 'economia',
    score: (s) => s.csPerMin,
    format: decimal('súbditos por minuto'),
  },
  {
    id: 'banker',
    icon: 'gold',
    title: 'El banquero',
    description: 'Premia a quien más oro genera por minuto.',
    family: 'economia',
    score: (s) => s.goldPerMin,
    format: flat('de oro por minuto'),
  },
  {
    id: 'damage-cannon',
    icon: 'damage',
    title: 'Cañón de daño',
    description: 'Premia a quien más daño reparte a campeones en cada partida.',
    family: 'economia',
    score: (s) => s.dmgK,
    format: decimal('k de daño por partida'),
  },

  // ---- Aguante y equipo ----
  {
    id: 'iron-wall',
    icon: 'shield',
    title: 'Muro de hierro',
    description: 'Premia a quien más daño mitiga por partida.',
    family: 'equipo',
    score: (s) => s.mitigatedK,
    format: decimal('k de daño mitigado por partida'),
  },
  {
    id: 'guardian-angel',
    icon: 'heal',
    title: 'Ángel guardián',
    description: 'Premia a quien más cura y escuda a los suyos.',
    family: 'equipo',
    score: (s) => s.healShieldK,
    format: decimal('k de curación por partida'),
  },
  {
    id: 'cc-lord',
    icon: 'freeze',
    title: 'Señor del control',
    description: 'Premia a quien más segundos de control de masas acumula.',
    family: 'equipo',
    score: (s) => s.ccTime,
    format: counted('segundo de control', 'segundos de control'),
  },
  {
    id: 'sauron',
    icon: 'vision',
    title: 'Ojo de Sauron',
    description: 'Premia a quien mayor puntuación de visión firma por partida.',
    family: 'equipo',
    score: (s) => s.visionScore,
    format: counted('punto de visión', 'puntos de visión'),
  },

  // ---- Constancia ----
  {
    id: 'lionheart',
    icon: 'streak',
    title: 'Corazón de león',
    description: 'Premia a quien ha encadenado la racha de victorias más larga.',
    family: 'constancia',
    score: (s) => s.bestStreak,
    format: counted('victoria seguida', 'victorias seguidas'),
  },
  {
    id: 'anchor',
    icon: 'anchor',
    title: 'El ancla',
    description: 'Premia a quien más partidas ha disputado con el grupo.',
    family: 'constancia',
    score: (s) => s.games,
    format: counted('partida', 'partidas'),
  },

  // ---- Con cariño ----
  {
    id: 'pinata',
    icon: 'pinata',
    title: 'La piñata',
    description: 'Premia a quien más daño recibe en cada partida.',
    family: 'humor',
    score: (s) => s.damageTakenK,
    format: decimal('k de daño recibido por partida'),
  },
  {
    id: 'donor',
    icon: 'skull',
    title: 'El donante',
    description: 'Premia a quien más veces muere por partida.',
    family: 'humor',
    score: (s) => s.deaths,
    format: decimal('muertes por partida'),
  },
];

/** Busca una medalla por su id. El id viaja en la URL (`?medalla=`), así que puede no existir. */
export function medalById(id: string | null | undefined): MedalDefinition | null {
  if (!id) return null;
  return MEDALS.find((m) => m.id === id) ?? null;
}

/** Un puesto de la clasificación de una medalla. */
export interface MedalStanding {
  rank: number;
  member: Member;
  /** La puntuación en crudo, para poder comparar. */
  raw: number;
  /** La misma puntuación ya escrita, para pintarla. */
  value: string;
}

/** Una medalla con su clasificación resuelta para un grupo. */
export interface MedalBoard {
  medal: MedalDefinition;
  /** Nulo mientras nadie la haya ganado: ver `boardOf`. */
  leader: MedalStanding | null;
  /** Los tres primeros, o los que haya si el grupo es más pequeño. */
  podium: MedalStanding[];
  /** El usuario activo, si está en el roster de este grupo. */
  me: MedalStanding | null;
  /** Cuánto ha recorrido el usuario hacia el líder, de 0 a 100. */
  progress: number | null;
  /** Lo que le falta para el primer puesto, ya escrito. Nulo si ya lo ocupa. */
  gap: string | null;
}

/** Resuelve la clasificación de una medalla sobre una pasada de estadísticas ya hecha. */
function boardOf(
  medal: MedalDefinition,
  stats: readonly MemberStats[],
  meTag: string | null,
): MedalBoard {
  const ranked = [...stats]
    .sort((a, b) => medal.score(b) - medal.score(a))
    .map((s, i) => ({
      rank: i + 1,
      member: s.member,
      raw: medal.score(s),
      value: medal.format(medal.score(s)),
    }));

  const top = ranked[0] ?? null;

  // Nadie ha marcado todavía: la medalla se queda sin dueño. Coronar al primero de
  // una lista de ceros diría «rey del penta: 0 pentakills», que no premia nada y
  // además señala a alguien al azar, porque a igualdad de cero el orden es
  // arbitrario. Vale para cualquier medalla, no solo para las raras.
  if (!top || top.raw <= 0) {
    return { medal, leader: null, podium: [], me: null, progress: null, gap: null };
  }

  const leader = top;
  const me = meTag ? (ranked.find((r) => r.member.tag === meTag) ?? null) : null;

  // Sin líder o sin ti en el grupo no hay progreso que enseñar, y con el líder a
  // cero tampoco: dividir por su marca daría infinito.
  const progress = me ? Math.min(100, Math.round((me.raw / leader.raw) * 100)) : null;

  const gap = me && me.rank > 1 ? medal.format(leader.raw - me.raw) : null;

  return { medal, leader, podium: ranked.slice(0, 3), me, progress, gap };
}

/**
 * Las veinte medallas con su clasificación para un grupo y un alcance.
 *
 * `meTag` es el `Member.tag` del usuario activo dentro de ESTE roster (la vista lo
 * resuelve cruzando `Session.user().userId` con `Member.userId`), o nulo si no
 * pertenece al grupo: entonces las tarjetas enseñan al líder y el podio, y ni
 * inventan un «tu puesto» ni fingen un progreso.
 */
export function medalBoardsFor(
  groupId: string,
  roster: readonly Member[],
  scope: StatScope,
  meTag: string | null = null,
): MedalBoard[] {
  if (!roster.length) return [];
  const stats = statsFor(groupId, roster, scope);
  return MEDALS.map((medal) => boardOf(medal, stats, meTag));
}

/**
 * Las cuatro medallas que se asoman en la vitrina del hub del grupo (§5.5.4). Son
 * un subconjunto del catálogo a propósito: la tarjeta del hub y la medalla del Hall
 * of Fame tienen que decir lo mismo, porque al pulsarla se abre exactamente esa.
 */
export const SHOWCASE_MEDAL_IDS = [
  'penta-king',
  'demolisher',
  'damage-cannon',
  'dragon-hunter',
] as const;
