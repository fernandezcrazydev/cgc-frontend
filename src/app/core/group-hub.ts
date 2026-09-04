/**
 * Datos del hub de grupo (`/app/grupos/:id`) — PLACEHOLDER DESECHABLE.
 *
 * Todo lo de aquí es maqueta determinista sembrada por el id del grupo, igual que
 * `group-stats.ts`: un mismo grupo pinta siempre los mismos números hasta que exista el
 * endpoint. No es lógica de negocio que haya que cuidar; es el hueco con la forma exacta
 * de la respuesta futura, para que la interfaz se pueda diseñar y probar.
 *
 * BACKEND NOTE: al migrar, cada bloque tiene su endpoint y este fichero se borra entero
 * (`CLAUDE.md` § estrategia mock → backend: nunca conviven mock y real para el mismo dato):
 *   - `GET /groups/{id}/lp-history?leagueId=` → evolución de LP del grupo.
 *   - `GET /groups/{id}/trophies`            → vitrina de hitos comunitarios.
 *   - `GET /groups/{id}/comments`            → muro de comentarios y reacciones.
 *   - `GET /groups/{id}/duels`               → rivalidades y dúos.
 *   - `GET /groups/{id}/trivia`              → telemetría curiosa.
 *   - `GET /groups/{id}/profile`             → ficha pública del grupo.
 */
import { hash, seeded } from './group-ranking';
import { Member } from './lobby';
import { SEEDED_MATCH_COUNT, seedMatchId } from './seed-matches';

// ===================== Evolución de LP =====================

export interface HubLpPoint {
  /** Etiqueta del eje X ya formateada ("1 feb"). */
  label: string;
  lp: number;
}

export interface HubSeason {
  id: string;
  label: string;
}

export interface HubLpSeries {
  points: HubLpPoint[];
  /** Puesto del grupo al cierre de la serie. */
  rank: number;
  lp: number;
  /** Diferencial neto de LP en la ventana: puede ser negativo, y entonces se pinta como tal. */
  netLp: number;
  winrate: number;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Temporadas disponibles. Con una sola, la vista oculta el selector (§5.5.4): un desplegable
 * de un elemento es un control que no decide nada.
 */
export function hubSeasonsFor(groupId: string): HubSeason[] {
  const rnd = seeded(hash(groupId + ':seasons'));
  const seasons: HubSeason[] = [{ id: 'current', label: 'Temporada 2026' }];
  if (rnd() > 0.45) seasons.push({ id: 'past-2025', label: 'Temporada 2025' });
  return seasons;
}

/** Serie de LP del grupo en la temporada pedida. */
export function lpSeriesFor(groupId: string, seasonId = 'current'): HubLpSeries {
  const rnd = seeded(hash(groupId + ':lp:' + seasonId));
  const count = 14;
  let lp = 180 + Math.floor(rnd() * 220);
  const points: HubLpPoint[] = [];
  for (let i = 0; i < count; i++) {
    // Tendencia suavemente ascendente con recaídas: una recta perfecta no se lee como una liga.
    lp = Math.max(60, Math.round(lp + (rnd() - 0.36) * 90));
    const day = 1 + Math.round((i * 27) / (count - 1));
    const month = MONTHS[1 + Math.floor(i / 7)] ?? MONTHS[2];
    points.push({ label: day + ' ' + month, lp });
  }
  const first = points[0].lp;
  const last = points[points.length - 1].lp;
  return {
    points,
    rank: 1 + Math.floor(rnd() * 4),
    lp: last,
    netLp: last - first,
    winrate: 48 + Math.floor(rnd() * 26),
  };
}

// ===================== Vitrina de trofeos =====================

/* La vitrina del hub ya no vive aquí: sus cuatro hitos son cuatro medallas del
   catálogo del Hall of Fame (`core/group-medals.ts`, §5.5.5), y tenerlos por
   duplicado era la vía rápida a que la tarjeta del hub prometiera un trofeo que
   en el Hall of Fame se llamaba de otra forma. Ver `SHOWCASE_MEDAL_IDS`. */

// ===================== Voces del vestuario =====================

export interface HubReaction {
  emoji: string;
  count: number;
}

export interface HubComment {
  id: string;
  author: string;
  avatar?: string;
  hue: number;
  /**
   * Id real de la partida comentada: la tarjeta entera lleva a `/app/historial/:matchId`, así
   * que tiene que existir de verdad en el historial y no ser un número decorativo.
   */
  matchId: string;
  /** Cómo se nombra esa partida en la píldora ("Partida 12"). */
  matchLabel: string;
  text: string;
  reactions: HubReaction[];
}

const COMMENT_TEXTS = [
  'El robo de barón a ciegas nos salvó la partida, pero nadie habla de los tres flashes contra el muro.',
  'Veinte minutos sin pasar nada y de repente un ace en la jungla enemiga. Así se juega.',
  'Pedí visión en el río toda la partida y la guardia apareció justo cuando ya nos habían matado.',
  'La remontada empezó con un alma de dragón robada con dos de vida. Sigo temblando.',
  'Ese último teleport a la torre inhibidora fue una obra de arte y nadie lo aplaudió.',
  'Perdimos la partida en el minuto tres, en la línea de arriba, como siempre.',
];

/** Las reacciones son la única excepción a "cero emojis" que aprueba §5.5.4. */
const REACTION_EMOJIS = ['🔥', '💀', '👑', '🤡'];

/** Comentarios del muro con sus reacciones. Rotan solos en la tarjeta fija del hub. */
export function hubCommentsFor(groupId: string, roster: readonly Member[]): HubComment[] {
  if (!roster.length) return [];
  const rnd = seeded(hash(groupId + ':comments'));
  const total = Math.min(5, Math.max(3, roster.length));
  return Array.from({ length: total }, (_, i) => {
    const member = roster[Math.floor(rnd() * roster.length)];
    const reactions = REACTION_EMOJIS.map((emoji) => ({ emoji, count: Math.floor(rnd() * 15) })).filter(
      (r) => r.count > 0,
    );
    // BACKEND NOTE: con el dominio de partidas real, el id lo manda el comentario.
    const matchNumber = 1 + Math.floor(rnd() * SEEDED_MATCH_COUNT);
    return {
      id: groupId + '-c' + i,
      author: member.name,
      avatar: member.avatar,
      hue: member.hue,
      matchId: seedMatchId(matchNumber),
      matchLabel: 'Partida ' + matchNumber,
      text: COMMENT_TEXTS[Math.floor(rnd() * COMMENT_TEXTS.length)],
      reactions,
    };
  });
}

/**
 * Reacciones que ya tiene un jugador en una partida del grupo, para que el marcador no arranque
 * vacío. Deterministas por partida y participante: la misma fila enseña siempre lo mismo.
 *
 * BACKEND NOTE: vendrán con el marcador (`GET /matches/{id}` incluye las reacciones por
 * participante) y esta función desaparece.
 */
export function playerReactionsFor(matchId: string, participantId: string): HubReaction[] {
  const rnd = seeded(hash(matchId + ':' + participantId + ':reactions'));
  // Bastantes filas se quedan sin reacciones a propósito: si todas tuvieran, no se distinguiría
  // a quién le llovieron de verdad.
  if (rnd() < 0.45) return [];
  // Se baraja y se corta: así hay filas con una sola reacción y filas con seis distintas, que
  // son las que ponen a prueba el resumen en «+N».
  const pool = ['🔥', '💀', '👑', '🤡', '😂', '🫡', '🧊', '🐐', '🎯', '🧠'];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const total = 1 + Math.floor(rnd() * 6);
  return pool.slice(0, total).map((emoji) => ({ emoji, count: 1 + Math.floor(rnd() * 6) }));
}

// ===================== Rivalidades y dúos =====================

export type HubDuelKind = 'clasico' | 'duo';

export interface HubDuelSide {
  name: string;
  avatar?: string;
  hue: number;
  /** Id estable del jugador cuando el roster viene del backend; sin él no hay enlace. */
  playerId?: string;
  score: number;
}

export interface HubDuel {
  id: string;
  kind: HubDuelKind;
  title: string;
  a: HubDuelSide;
  b: HubDuelSide;
  /** Lo que va en el centro del enfrentamiento: el marcador, o el winrate del dúo. */
  centerValue: string;
  /** Qué mide ese número, en una palabra ("victorias directas", "juntos"). */
  centerLabel: string;
  /** Frase que resume el estado del duelo ("llega con dos victorias seguidas"). */
  note: string;
  ctaLabel?: string;
}

/** El clásico del grupo y el dúo dinámico: las dos caras de la tarjeta izquierda. */
export function duelsFor(groupId: string, roster: readonly Member[]): HubDuel[] {
  if (roster.length < 2) return [];
  const rnd = seeded(hash(groupId + ':duels'));
  const pick = (skip?: Member): Member => {
    const pool = skip ? roster.filter((m) => m.tag !== skip.tag) : roster;
    return pool[Math.floor(rnd() * pool.length)];
  };
  const side = (m: Member, score: number): HubDuelSide => ({
    name: m.name,
    avatar: m.avatar,
    hue: m.hue,
    playerId: m.userId,
    score,
  });

  const rivalA = pick();
  const rivalB = pick(rivalA);
  const duoA = pick();
  const duoB = pick(duoA);
  const winsA = 8 + Math.floor(rnd() * 9);
  const winsB = 8 + Math.floor(rnd() * 9);
  const leader = winsA >= winsB ? rivalA.name : rivalB.name;
  const duoWr = 60 + Math.floor(rnd() * 20);
  const duoGames = 12 + Math.floor(rnd() * 18);

  return [
    {
      id: groupId + '-clasico',
      kind: 'clasico',
      title: 'El clásico del grupo',
      a: side(rivalA, winsA),
      b: side(rivalB, winsB),
      centerValue: winsA + ' — ' + winsB,
      centerLabel: 'enfrentamientos directos',
      note:
        winsA === winsB
          ? 'Empate técnico: el siguiente enfrentamiento desempata.'
          : leader + ' llega con dos victorias seguidas.',
      ctaLabel: 'Abrir cara a cara',
    },
    {
      id: groupId + '-duo',
      kind: 'duo',
      title: 'Dúo dinámico',
      a: side(duoA, duoWr),
      b: side(duoB, duoWr),
      centerValue: duoWr + '%',
      centerLabel: 'victorias juntos',
      note: 'Han jugado ' + duoGames + ' partidas en el mismo bando.',
    },
  ];
}

// ===================== Trivia y telemetría =====================

export interface HubTrivia {
  id: string;
  /** Clave del icono vectorial que dibuja la vista. */
  icon: 'tower' | 'farm' | 'blood' | 'dragon';
  /** Familia del dato, para la píldora de la esquina ("Control de mapa"). */
  kicker: string;
  /** La cifra protagonista, ya formateada: es lo que se lee primero. */
  value: string;
  /** Qué significa esa cifra. Va justo debajo, en frase corta. */
  headline: string;
  /** La letra pequeña: quién, cuándo o sobre cuántas partidas. */
  detail: string;
  /**
   * Cuánto llena la barra del dato (0-100). No siempre es un porcentaje real: en los récords es
   * la proporción respecto al techo del grupo, y por eso siempre viaja con `meterLabel`.
   */
  meter: number;
  meterLabel: string;
}

/** Micro-datos que rotan en la tarjeta derecha. */
export function triviaFor(groupId: string, roster: readonly Member[]): HubTrivia[] {
  const rnd = seeded(hash(groupId + ':trivia'));
  const someone = (): string =>
    roster.length ? roster[Math.floor(rnd() * roster.length)].name : 'alguien del grupo';

  const towerWr = 70 + Math.floor(rnd() * 20);
  const towerGames = 24 + Math.floor(rnd() * 14);
  const cs = 320 + Math.floor(rnd() * 90);
  const kills = 70 + Math.floor(rnd() * 25);
  const minutes = 34 + Math.floor(rnd() * 12);
  const souls = 2 + Math.floor(rnd() * 5);

  return [
    {
      id: groupId + '-t1',
      icon: 'tower',
      kicker: 'Control de mapa',
      value: towerWr + '%',
      headline: 'de victorias cuando tiráis la primera torre',
      detail: 'Sobre ' + towerGames + ' partidas con primera torre a vuestro favor',
      meter: towerWr,
      meterLabel: towerWr + '% de victorias',
    },
    {
      id: groupId + '-t2',
      icon: 'farm',
      kicker: 'Récord de farmeo',
      value: cs + ' CS',
      headline: 'el mayor botín de súbditos en una sola partida',
      detail: 'Lo firmó ' + someone() + ' y nadie se ha acercado desde entonces',
      // El techo simbólico del grupo son 450 súbditos: la barra dice cuánto falta para rozarlo.
      meter: Math.min(100, Math.round((cs / 450) * 100)),
      meterLabel: cs + ' de 450 CS',
    },
    {
      id: groupId + '-t3',
      icon: 'blood',
      kicker: 'La más sangrienta',
      value: kills + ' bajas',
      headline: 'en la partida más caótica del mes',
      detail: minutes + ' minutos sin una sola tregua',
      meter: Math.min(100, Math.round((kills / 100) * 100)),
      meterLabel: kills + ' bajas en ' + minutes + ' min',
    },
    {
      id: groupId + '-t4',
      icon: 'dragon',
      kicker: 'Alma de dragón',
      value: souls + ' de 10',
      headline: 'partidas decididas por el alma del dragón',
      detail: 'Quien la consigue rara vez suelta la ventaja',
      meter: souls * 10,
      meterLabel: souls + ' de vuestras últimas 10 partidas',
    },
  ];
}

// ===================== Ficha pública del grupo =====================

export interface HubProfileStat {
  label: string;
  value: string;
}

export interface HubGroupProfile {
  /** Frase corta bajo el nombre, en la ficha institucional. */
  tagline: string;
  description: string;
  rules: string[];
  stats: HubProfileStat[];
  /** Mes y año de fundación, ya formateados. */
  foundedAt: string;
}

const TAGLINES = [
  'Customs cada semana, sin excusas.',
  'Aquí se viene jugado de casa.',
  'La liga interna más ruidosa de la región.',
  'Diez personas, cinco roles y ninguna paciencia.',
];

/**
 * Ficha pública del grupo. El DTO real (`GroupResponse`) todavía no tiene descripción, reglas
 * ni banner: en cuanto los tenga, esta función desaparece y la vista los lee del grupo.
 */
export function groupProfileFor(groupId: string, memberCount: number): HubGroupProfile {
  const rnd = seeded(hash(groupId + ':profile'));
  return {
    tagline: TAGLINES[Math.floor(rnd() * TAGLINES.length)],
    description:
      'Grupo de partidas personalizadas de League of Legends. Organizamos customs 5v5 con equipos ' +
      'equilibrados por el sistema, clasificación propia por temporadas e historial completo de cada ' +
      'partida para poder discutirlo después con los datos delante.',
    rules: [
      'Apuntarse a una convocatoria es un compromiso: avisar si al final no se puede.',
      'Los equipos los forma el sistema; las quejas, después de la partida.',
      'Cero toxicidad en la sala de espera y en el muro del grupo.',
    ],
    stats: [
      { label: 'Partidas jugadas', value: String(40 + Math.floor(rnd() * 160)) },
      { label: 'Miembros', value: String(memberCount) },
      { label: 'Duración media', value: 29 + Math.floor(rnd() * 8) + ' min' },
      { label: 'Bando azul', value: 46 + Math.floor(rnd() * 12) + '% de victorias' },
    ],
    foundedAt: MONTHS[Math.floor(rnd() * 12)] + ' de 202' + (4 + Math.floor(rnd() * 2)),
  };
}
