/**
 * Etiquetas y derivaciones de presentación del dominio de partidas.
 *
 * Mismo papel que `groupRoleLabel()` en `core/groups/group-view.ts`: los enums del backend
 * (`BLUE`, `TOP`, `BALANCED`) viajan en inglés/mayúsculas porque *son* así, y ningún componente
 * debe traducirlos a mano en su plantilla. Aquí también viven los cálculos derivados que varias
 * vistas necesitan (ratio de KDA, reparto de recursos), para que no acaben copiados en tres
 * componentes como estaban antes.
 *
 * **La regla que gobierna todo este fichero: lo que no se sabe devuelve `null`, nunca `0`.**
 * Sin subida no hay KDA, ni CS, ni duración; un cero ahí se lee como un dato medido, y esa
 * mentira no la detecta nadie mirando la pantalla. Cada función de abajo la respeta, y las
 * plantillas tienen que tratar el `null` como «no hay», no como «cero».
 */
import { MATCHMAKING_PRESET_INFO } from '../groups';
import { hash } from '../group-ranking';
import {
  Lane,
  Match,
  MatchParticipant,
  MatchPreset,
  MatchResultOutcome,
  ParticipantStats,
  TeamSide,
  TeamSlot,
  TeamSummary,
} from './models';

/**
 * `undefined` = la partida existe pero el usuario no la jugó (caso normal en el historial de
 * grupo). No es lo mismo que una derrota, y las plantillas lo trataban como tal.
 */
export function matchOutcomeLabel(outcome: MatchResultOutcome | undefined): string {
  switch (outcome) {
    case 'win':
      return 'Victoria';
    case 'loss':
      return 'Derrota';
    case 'cancelled':
      return 'Anulada';
    default:
      return 'No jugaste';
  }
}

/**
 * Cómo se nombra a un equipo.
 *
 * **Con lado decidido son «azul» y «rojo»; sin él son «Equipo A» y «Equipo B».** No es una
 * reserva ni un apaño: quién vistió de azul lo decide la sala y puede no haberse decidido
 * nunca, y ponerle un color entonces es inventarse el dato. Por eso viajan las dos cosas,
 * `slot` (siempre) y `side` (a veces).
 */
export function teamLabel(team: Pick<TeamSummary, 'slot' | 'side'>): string {
  if (team.side === 'blue') return 'Equipo azul';
  if (team.side === 'red') return 'Equipo rojo';
  return `Equipo ${team.slot}`;
}

/** Nombre corto del equipo, para cuando la caja no da para «Equipo …». */
export function teamShortLabel(team: Pick<TeamSummary, 'slot' | 'side'>): string {
  if (team.side === 'blue') return 'Azul';
  if (team.side === 'red') return 'Rojo';
  return team.slot;
}

/**
 * El bando ganador, en pasado: la partida ya terminó, y el presente («gana el equipo azul») la
 * leía como si estuviese en curso. `null` cuando no se sabe quién ganó, que también pasa.
 */
export function matchWinnerLabel(match: Pick<Match, 'winningSlot' | 'winningSide'>): string | null {
  if (!match.winningSlot) return null;
  if (match.winningSide === 'blue') return 'Ganó el equipo Azul';
  if (match.winningSide === 'red') return 'Ganó el equipo Rojo';
  return `Ganó el equipo ${match.winningSlot}`;
}

/**
 * La posición, como se escribe en español. `TOP`, `MID` y `ADC` se quedan en mayúsculas porque
 * son siglas —lo *son*, no es copy gritado—; `JUNGLA` y `SUPPORT` son palabras, y como tales se
 * pintan. Antes las plantillas volcaban el enum en crudo, y los chips de filtro decían «SUPPORT».
 */
const LANE_LABELS: Record<Lane, string> = {
  TOP: 'TOP',
  JUNGLA: 'Jungla',
  MID: 'MID',
  ADC: 'ADC',
  SUPPORT: 'Soporte',
};

export function laneLabel(lane: Lane): string {
  return LANE_LABELS[lane] ?? lane;
}

/**
 * La modalidad con la que se abrió la sala, en español. Reutiliza la traducción que ya decide
 * `core/groups`, que es donde se elige el preset al crear el grupo: una segunda traducción aquí
 * haría que la misma modalidad se llamase de dos formas en dos pantallas contiguas.
 */
export function presetLabel(preset: MatchPreset): string {
  return MATCHMAKING_PRESET_INFO[preset]?.label ?? preset;
}

/** Orden de lectura de una alineación de LoL, de calle superior a soporte. */
export const LANE_ORDER: readonly Lane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];

/** Los diez, en el orden en que viajan (equipo A y luego equipo B). */
export function participantsOf(match: Match): MatchParticipant[] {
  return [...match.teams[0].participants, ...match.teams[1].participants];
}

/** El equipo de un hueco. Siempre existe. */
export function teamBySlot(match: Match, slot: TeamSlot): TeamSummary {
  return match.teams[0].slot === slot ? match.teams[0] : match.teams[1];
}

/** El equipo de un color, o `null` si la sala nunca decidió lados. */
export function teamBySide(match: Match, side: TeamSide): TeamSummary | null {
  return match.teams.find((t) => t.side === side) ?? null;
}

/** El equipo de un participante. */
export function teamOf(match: Match, participant: MatchParticipant): TeamSummary {
  return teamBySlot(match, participant.slot);
}

/** El equipo contrario al de un participante. */
export function opposingTeam(match: Match, participant: MatchParticipant): TeamSummary {
  return teamBySlot(match, participant.slot === 'A' ? 'B' : 'A');
}

/**
 * Cómo se llama un jugador en pantalla.
 *
 * **El `riotId` primero**: es el del día que se jugó, y una partida es un registro de lo que
 * pasó. El nombre de Discord es el de HOY —sigue los cambios de nombre—, así que sirve de
 * respaldo y es lo único que hay cuando nadie exportó la partida. Los dos vienen en el asiento.
 *
 * `'Sin identificar'` solo si a esa cuenta la borraron: la partida siguió pasando igual, y su
 * hueco tiene que poder pintarse.
 */
export function participantName(p: MatchParticipant): string {
  return p.riotId ?? p.discordUsername ?? 'Sin identificar';
}

/** Lo mínimo para calcular un KDA: sirve igual con un participante o con sumas acumuladas. */
export type KdaLike = Pick<ParticipantStats, 'kills' | 'deaths' | 'assists'>;

/** `true` si el asiento trae el KDA. Sin subida no lo trae, y no es un 0/0/0. */
export function hasKda(stats: KdaLike): boolean {
  return stats.kills != null && stats.deaths != null && stats.assists != null;
}

/**
 * `(bajas + asistencias) / muertes`, o `null` si no hay KDA que dividir. Sin muertes no se
 * divide por cero: el ratio es la suma, que es la convención de LoL para una partida perfecta.
 */
export function kdaRatio(stats: KdaLike): number | null {
  if (!hasKda(stats)) return null;
  const kills = stats.kills!;
  const deaths = stats.deaths!;
  const assists = stats.assists!;
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

/** El ratio con dos decimales, o `null`. La plantilla decide qué pinta cuando no hay. */
export function formatKda(stats: KdaLike, decimals = 2): string | null {
  return kdaRatio(stats)?.toFixed(decimals) ?? null;
}

/**
 * CS por minuto. Se DERIVA de los CS y la duración en lugar de venir en el DTO: son el mismo
 * concepto, y dos copias del mismo concepto acaban contradiciéndose.
 */
export function csPerMin(stats: ParticipantStats, durationSeconds: number | null): number | null {
  if (stats.cs == null || !durationSeconds) return null;
  return +((stats.cs / durationSeconds) * 60).toFixed(1);
}

/**
 * Daño a campeones por cada 1.000 de oro. Es la métrica que separa «hizo mucho daño» de «hizo
 * mucho daño *con lo que tenía*»: el daño en bruto premia siempre al tirador, que es quien más
 * oro recibe, y esta no.
 */
export function damagePerGold(stats: ParticipantStats): number | null {
  if (stats.damageToChampions == null || !stats.gold) return null;
  return (stats.damageToChampions / stats.gold) * 1000;
}

/** El reparto de recursos de un jugador dentro de su propio equipo, en porcentaje entero. */
export interface ParticipantContribution {
  /** Del daño a campeones del equipo. */
  damage: number | null;
  /** Del oro del equipo. */
  gold: number | null;
  /** De las bajas del equipo en las que participó (kill participation). */
  killParticipation: number | null;
  /** De la puntuación de visión del equipo. */
  vision: number | null;
}

/**
 * Qué parte del daño a campeones de su equipo hizo un jugador.
 *
 * Se DERIVA de los cinco participantes, y el backend no lo sirve por eso mismo: `damageShare`
 * y un campo almacenado son el mismo concepto, y al convivir se contradecían —los cinco valores
 * almacenados de una partida llegaban a sumar 109%, y el mismo jugador leía 37% en el marcador
 * y 34% en «Tu peso en el equipo». Un concepto, un número.
 */
export function damageShare(participant: MatchParticipant, team: TeamSummary): number | null {
  return share(
    participant.stats.damageToChampions,
    sumBy(team, (s) => s.damageToChampions),
  );
}

/**
 * El porcentaje siempre se calcula contra el propio equipo, nunca contra los diez: comparar tu
 * oro con el del equipo rival no significa nada, y comparar tu daño con el de tus cuatro
 * compañeros dice exactamente quién llevaba la partida.
 */
export function contributionOf(
  participant: MatchParticipant,
  team: TeamSummary,
): ParticipantContribution {
  const stats = participant.stats;
  const kp =
    stats.kills == null || stats.assists == null ? null : stats.kills + stats.assists;

  return {
    damage: share(stats.damageToChampions, sumBy(team, (s) => s.damageToChampions)),
    gold: share(stats.gold, team.totalGold ?? sumBy(team, (s) => s.gold)),
    killParticipation: share(kp, team.totalKills ?? sumBy(team, (s) => s.kills)),
    vision: share(stats.visionScore, sumBy(team, (s) => s.visionScore)),
  };
}

/**
 * Si ganó su línea, medido por el oro del minuto 14 contra el rival de la MISMA línea.
 *
 * **Es una estimación nuestra, no un dato subido**, y por eso se llama así allí donde se pinta:
 * el backend no sirve `wonLane` a propósito. `null` cuando falta el oro de cualquiera de los
 * dos, o cuando la partida no llegó al minuto 14.
 */
export function wonLane(match: Match, participant: MatchParticipant): boolean | null {
  const mine = participant.stats.goldAt14;
  if (mine == null) return null;
  const rival = opposingTeam(match, participant).participants.find(
    (p) => p.role === participant.role,
  );
  const theirs = rival?.stats.goldAt14;
  if (theirs == null) return null;
  return mine > theirs;
}

/**
 * Degradado de reserva para una ranura de inventario.
 *
 * BACKEND NOTE: placeholder puro, y se queda esperando. Los objetos están guardados en el
 * backend dentro del bloque crudo de cada asiento, pero sus nombres de campo salen de la
 * documentación del cliente de LoL y nadie los ha visto en un payload medido, así que no se
 * sirven todavía. Cuando lleguen —con su `iconUrl`, como los campeones— esto se borra.
 */
export function itemBg(name: string): string {
  const hue = hash(name) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,46%), hsl(${hue},60%,24%))`;
}

function sumBy(
  team: TeamSummary,
  pick: (stats: ParticipantStats) => number | undefined,
): number | null {
  let total = 0;
  let seen = 0;
  for (const p of team.participants) {
    const value = pick(p.stats);
    if (value != null) {
      total += value;
      seen++;
    }
  }
  return seen === 0 ? null : total;
}

/**
 * Un equipo sin bajas (o sin visión) da 0%, que es la lectura correcta. Un equipo del que no se
 * sabe nada da `null`, que es una lectura MUY distinta y se pinta distinto.
 */
function share(value: number | null | undefined, total: number | null): number | null {
  if (value == null || total == null) return null;
  return total > 0 ? Math.min(100, Math.max(0, Math.round((value / total) * 100))) : 0;
}

export interface PlayerScoreItem {
  rank: number;
  score: string;
  display: string;
}

/**
 * Nota de cada participante en una partida.
 *
 * REGLA DE ARQUITECTURA: es la fuente única de verdad para la nota del jugador en el historial
 * (`match-lineup`), en el marcador (`match-scoreboard`) y en el detalle (`match-detail`). MVP y
 * ACE tienen suelos ponderados altos; el resto evalúa KDA, farm y victoria.
 *
 * **Devuelve un mapa vacío si la partida no está subida.** Una nota calculada sobre un KDA que
 * nadie exportó sería un número inventado con aspecto de medida, que es justo lo que §5 del
 * contrato prohíbe.
 *
 * BACKEND NOTE: placeholder. La nota es regla de negocio y acabará siendo del servidor, que es
 * quien puede compararla contra el resto de partidas del grupo.
 */
export function computeMatchScores(match: Match): Map<string, PlayerScoreItem> {
  const map = new Map<string, PlayerScoreItem>();
  if (!match.hasStats) return map;

  const rated = participantsOf(match).map((p) => {
    const isMvp = p.userId === match.mvpUserId;
    const isAce = p.userId === match.aceUserId;
    const kills = p.stats.kills ?? 0;
    const deaths = Math.max(1, p.stats.deaths ?? 0);
    const assists = p.stats.assists ?? 0;
    const cs = p.stats.cs ?? 0;
    const won = p.slot === match.winningSlot;
    let raw = isMvp
      ? 9.5 + ((p.userId.length + kills) % 5) / 10
      : isAce
        ? 8.7 + ((p.userId.length + kills) % 5) / 10
        : 4.2 + (kills * 2.2 + assists * 1.3 - deaths * 1.4) / 6 + cs / 120 + (won ? 0.8 : 0);
    raw = Math.min(9.9, Math.max(3.0, raw));
    return { id: p.userId, raw, isMvp, isAce };
  });

  rated.sort((a, b) => {
    if (a.isMvp) return -1;
    if (b.isMvp) return 1;
    return b.raw - a.raw;
  });

  rated.forEach((item, index) => {
    const rank = index + 1;
    const scoreStr = item.raw.toFixed(1);
    map.set(item.id, { rank, score: scoreStr, display: `${rank} · ${scoreStr}` });
  });
  return map;
}
