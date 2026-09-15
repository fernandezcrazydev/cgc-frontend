/**
 * Catálogo de medallas del Hall of Fame del grupo (`Roadmap.md` §5.5.5, pestaña 2).
 *
 * **El catálogo vive aquí y no en el backend, y es deliberado.** Un tablero de medalla es una
 * ordenación de los jugadores que ya llegan en el payload, y lo que lo define —qué ids existen, qué
 * premia cada uno, cómo se escribe su cifra— es a la vez contrato de URL (`?medalla=<id>`) y texto
 * en español. Servirlo desde el backend obligaría a servir también la traducción.
 *
 * Lo que sí cambió al llegar el endpoint: cada medalla puntúa sobre cifras **de partidas que
 * existieron**, y ya no sobre una siembra determinista. Y una se cayó por el camino —ver abajo—,
 * porque premiaba algo que el cliente de LoL no publica.
 */
import { PlayerStatsView, StatsPerson } from './stats-view';

/**
 * Clave del icono vectorial. La vista dibuja el SVG; aquí solo viaja la clave, igual que en
 * `HubTrophyIcon`: este fichero no sabe de plantillas.
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
   * Puntuación con la que se ordena el grupo. Más alto siempre gana la medalla, también en las de
   * la familia `humor`: ahí ganarla es justo la gracia.
   */
  score: (p: PlayerStatsView) => number;
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

/** Media por partida SUBIDA, que es el único denominador con el que estas cifras existen. */
function perGame(total: number, games: number): number {
  return games > 0 ? total / games : 0;
}

/**
 * Las diecinueve medallas. El orden es el de la rejilla: primero combate, luego objetivos,
 * economía, equipo, constancia y, al final, las dos que se ganan por motivos poco honrosos.
 *
 * **Eran veinte.** «El ladrón» premiaba objetivos épicos robados con el Smite, y el volcado de fin
 * de partida del cliente de LoL **no publica esa cifra en ninguna forma** — no es que llegue a cero,
 * es que el campo no existe. Se retiró en vez de dejarla en gris para siempre. Su id sigue pudiendo
 * aparecer en un enlace viejo (`?medalla=thief`): `medalById` devuelve `null` y no se abre nada, que
 * es lo que tiene que pasar.
 */
export const MEDALS: readonly MedalDefinition[] = [
  // ---- Combate ----
  {
    id: 'penta-king',
    icon: 'penta',
    title: 'Rey del penta',
    description: 'Premia a quien más pentakills ha conseguido.',
    family: 'combate',
    score: (p) => p.raw.pentas,
    format: counted('pentakill', 'pentakills'),
  },
  {
    id: 'almost-penta',
    icon: 'quadra',
    title: 'Casi penta',
    description: 'Premia a quien más veces se ha quedado a un asesinato del penta.',
    family: 'combate',
    score: (p) => p.raw.quadras,
    format: counted('cuádruple', 'cuádruples'),
  },
  {
    id: 'first-blood',
    icon: 'first-blood',
    title: 'Gatillo fácil',
    description: 'Premia a quien más primeras sangres ha firmado.',
    family: 'combate',
    score: (p) => p.raw.firstBloods,
    format: counted('primera sangre', 'primeras sangres'),
  },
  {
    id: 'immortal',
    icon: 'immortal',
    title: 'El inmortal',
    description: 'Premia a quien más partidas ha terminado sin morir ni una vez.',
    family: 'combate',
    score: (p) => p.raw.deathlessGames,
    format: counted('partida sin morir', 'partidas sin morir'),
  },
  {
    id: 'silent-carry',
    icon: 'silent-carry',
    title: 'Carry silencioso',
    description: 'Premia a quien más victorias suma sin haberse llevado nunca el MVP.',
    family: 'combate',
    score: (p) => Math.max(0, p.raw.wins - p.raw.mvps),
    format: counted('victoria sin MVP', 'victorias sin MVP'),
  },

  // ---- Objetivos ----
  {
    id: 'demolisher',
    icon: 'tower',
    title: 'El demoledor',
    description: 'Premia a quien más estructuras enemigas ha derribado.',
    family: 'objetivos',
    score: (p) => p.raw.towers,
    format: counted('torre', 'torres'),
  },
  {
    id: 'dragon-hunter',
    icon: 'dragon',
    title: 'Cazador de dragones',
    // El cliente de LoL no publica objetivos por jugador: lo que existe es el recuento del EQUIPO.
    // La frase lo dice, porque la medalla no premia lo que parece si no se dice.
    description: 'Premia a quien más dragones ha asegurado su equipo con él en partida.',
    family: 'objetivos',
    score: (p) => p.raw.dragons,
    format: counted('dragón', 'dragones'),
  },
  {
    id: 'baron-slayer',
    icon: 'baron',
    title: 'Verdugo de barones',
    description: 'Premia a quien más barones ha asegurado su equipo con él en partida.',
    family: 'objetivos',
    score: (p) => p.raw.barons,
    format: counted('barón', 'barones'),
  },

  // ---- Economía y daño ----
  {
    id: 'farmer',
    icon: 'farm',
    title: 'El granjero',
    description: 'Premia a quien más súbditos remata por minuto.',
    family: 'economia',
    score: (p) => p.csPerMin,
    format: decimal('súbditos por minuto'),
  },
  {
    id: 'banker',
    icon: 'gold',
    title: 'El banquero',
    description: 'Premia a quien más oro genera por minuto.',
    family: 'economia',
    score: (p) => p.goldPerMin,
    format: flat('de oro por minuto'),
  },
  {
    id: 'damage-cannon',
    icon: 'damage',
    title: 'Cañón de daño',
    description: 'Premia a quien más daño reparte a campeones en cada partida.',
    family: 'economia',
    score: (p) => p.dmgK,
    format: decimal('k de daño por partida'),
  },

  // ---- Aguante y equipo ----
  {
    id: 'iron-wall',
    icon: 'shield',
    title: 'Muro de hierro',
    description: 'Premia a quien más daño mitiga por partida.',
    family: 'equipo',
    score: (p) => perGame(p.raw.damageMitigated, p.gamesWithStats) / 1000,
    format: decimal('k de daño mitigado por partida'),
  },
  {
    id: 'guardian-angel',
    icon: 'heal',
    title: 'Ángel guardián',
    // Solo curación: el volcado de fin de partida trae `totalHeal` y NO trae el escudo repartido a
    // aliados, así que la medalla dice curación y nada más. El título anterior prometía las dos.
    description: 'Premia a quien más curación reparte por partida.',
    family: 'equipo',
    score: (p) => perGame(p.raw.healed, p.gamesWithStats) / 1000,
    format: decimal('k de curación por partida'),
  },
  {
    id: 'cc-lord',
    icon: 'freeze',
    title: 'Señor del control',
    description: 'Premia a quien más segundos de control de masas acumula por partida.',
    family: 'equipo',
    score: (p) => perGame(p.raw.timeCcingOthers, p.gamesWithStats),
    format: counted('segundo de control', 'segundos de control'),
  },
  {
    id: 'sauron',
    icon: 'vision',
    title: 'Ojo de Sauron',
    description: 'Premia a quien mayor puntuación de visión firma por partida.',
    family: 'equipo',
    score: (p) => p.visionScore,
    format: counted('punto de visión', 'puntos de visión'),
  },

  // ---- Constancia ----
  {
    id: 'lionheart',
    icon: 'streak',
    title: 'Corazón de león',
    description: 'Premia a quien ha encadenado la racha de victorias más larga.',
    family: 'constancia',
    score: (p) => p.bestStreak,
    format: counted('victoria seguida', 'victorias seguidas'),
  },
  {
    id: 'anchor',
    icon: 'anchor',
    title: 'El ancla',
    description: 'Premia a quien más partidas ha disputado con el grupo.',
    family: 'constancia',
    score: (p) => p.games,
    format: counted('partida', 'partidas'),
  },

  // ---- Con cariño ----
  {
    id: 'pinata',
    icon: 'pinata',
    title: 'La piñata',
    description: 'Premia a quien más daño recibe en cada partida.',
    family: 'humor',
    score: (p) => perGame(p.raw.damageTaken, p.gamesWithStats) / 1000,
    format: decimal('k de daño recibido por partida'),
  },
  {
    id: 'donor',
    icon: 'skull',
    title: 'El donante',
    description: 'Premia a quien más veces muere por partida.',
    family: 'humor',
    score: (p) => p.deaths,
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
  person: StatsPerson;
  /** La puntuación en crudo, para poder comparar. */
  raw: number;
  /** La misma puntuación ya escrita, para pintarla. */
  value: string;
}

/** Una medalla con su clasificación resuelta. */
export interface MedalBoard {
  medal: MedalDefinition;
  /** Nulo mientras nadie la haya ganado: ver `boardOf`. */
  leader: MedalStanding | null;
  /** Los tres primeros, o los que haya si el grupo es más pequeño. */
  podium: MedalStanding[];
  /** El usuario activo, si ha jugado en este alcance. */
  me: MedalStanding | null;
  /** Cuánto ha recorrido el usuario hacia el líder, de 0 a 100. */
  progress: number | null;
  /** Lo que le falta para el primer puesto, ya escrito. Nulo si ya lo ocupa. */
  gap: string | null;
}

/** Resuelve la clasificación de una medalla sobre los jugadores del alcance. */
function boardOf(
  medal: MedalDefinition,
  players: readonly PlayerStatsView[],
  meUserId: string | null,
): MedalBoard {
  const ranked = [...players]
    // Desempata por id para que la misma temporada no corone a dos personas distintas en dos
    // recargas: arbitrario, y arbitrario es justo el requisito.
    .sort(
      (a, b) =>
        medal.score(b) - medal.score(a) || a.person.userId.localeCompare(b.person.userId),
    )
    .map((p, i) => ({
      rank: i + 1,
      person: p.person,
      raw: medal.score(p),
      value: medal.format(medal.score(p)),
    }));

  const top = ranked[0] ?? null;

  // Nadie ha marcado todavía: la medalla se queda sin dueño. Coronar al primero de una lista de
  // ceros diría «rey del penta: 0 pentakills», que no premia nada y además señala a alguien al
  // azar, porque a igualdad de cero el orden es arbitrario.
  if (!top || top.raw <= 0) {
    return { medal, leader: null, podium: [], me: null, progress: null, gap: null };
  }

  const leader = top;
  const me = meUserId ? (ranked.find((r) => r.person.userId === meUserId) ?? null) : null;

  const progress = me ? Math.min(100, Math.round((me.raw / leader.raw) * 100)) : null;
  const gap = me && me.rank > 1 ? medal.format(leader.raw - me.raw) : null;

  return { medal, leader, podium: ranked.slice(0, 3), me, progress, gap };
}

/**
 * Las diecinueve medallas con su clasificación.
 *
 * `meUserId` es el id del usuario activo, o nulo si no ha jugado en este alcance: entonces las
 * tarjetas enseñan al líder y el podio, y ni inventan un «tu puesto» ni fingen un progreso.
 */
export function medalBoardsOf(
  players: readonly PlayerStatsView[],
  meUserId: string | null = null,
): MedalBoard[] {
  if (!players.length) return [];
  return MEDALS.map((medal) => boardOf(medal, players, meUserId));
}

/**
 * Las cuatro medallas que se asoman en la vitrina del hub del grupo (§5.5.4). Son un subconjunto
 * del catálogo a propósito: la tarjeta del hub y la medalla del Hall of Fame tienen que decir lo
 * mismo, porque al pulsarla se abre exactamente esa.
 */
export const SHOWCASE_MEDAL_IDS = [
  'penta-king',
  'demolisher',
  'damage-cannon',
  'dragon-hunter',
] as const;
