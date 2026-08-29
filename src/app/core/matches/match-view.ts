/**
 * Etiquetas y derivaciones de presentación del dominio de partidas.
 *
 * Mismo papel que `groupRoleLabel()` en `core/groups/group-view.ts`: los enums del backend
 * (`win`, `blue`, `TOP`) viajan en inglés/mayúsculas porque *son* así, y ningún componente
 * debe traducirlos a mano en su plantilla. Aquí también viven los cálculos derivados que
 * varias vistas necesitan (ratio de KDA, reparto de recursos), para que no acaben copiados
 * en tres componentes como estaban antes.
 */
import { hash } from '../group-ranking';
import {
  Lane,
  MatchParticipant,
  MatchResultOutcome,
  ParticipantStats,
  TeamSide,
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

export function teamSideLabel(side: TeamSide): string {
  return side === 'blue' ? 'Equipo azul' : 'Equipo rojo';
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
 * El bando ganador, en pasado: la partida ya terminó, y el presente («gana el equipo azul»)
 * la leía como si estuviese en curso. «Azul» y «Rojo» van en mayúscula inicial porque aquí
 * nombran al bando, no son copy en mayúsculas.
 */
export function matchWinnerLabel(side: TeamSide): string {
  return side === 'blue' ? 'Ganó el equipo Azul' : 'Ganó el equipo Rojo';
}

/** Lo mínimo para calcular un KDA: sirve igual con un participante o con sumas acumuladas. */
export type KdaLike = Pick<ParticipantStats, 'kills' | 'deaths' | 'assists'>;

/**
 * `(bajas + asistencias) / muertes`. Sin muertes no se divide por cero: el ratio es la suma,
 * que es la convención de LoL para una partida perfecta.
 */
export function kdaRatio(stats: KdaLike): number {
  const { kills, deaths, assists } = stats;
  return deaths === 0 ? kills + assists : (kills + assists) / deaths;
}

/** El ratio con dos decimales, como se pinta en el marcador. */
export function formatKda(stats: KdaLike, decimals = 2): string {
  return kdaRatio(stats).toFixed(decimals);
}

/**
 * Daño a campeones por cada 1.000 de oro gastado. Es la métrica que separa «hizo mucho daño»
 * de «hizo mucho daño *con lo que tenía*»: el daño en bruto premia siempre al tirador, que es
 * quien más oro recibe, y esta no.
 */
export function damagePerGold(stats: ParticipantStats): number {
  return stats.gold > 0 ? (stats.totalDamageToChampions / stats.gold) * 1000 : 0;
}

/** El reparto de recursos de un jugador dentro de su propio equipo, en porcentaje entero. */
export interface ParticipantContribution {
  /** Del daño a campeones del equipo. */
  damage: number;
  /** Del oro del equipo. */
  gold: number;
  /** De las bajas del equipo en las que participó (kill participation). */
  killParticipation: number;
  /** De la puntuación de visión del equipo. */
  vision: number;
}

/**
 * Qué parte del daño a campeones de su equipo hizo un jugador.
 *
 * Se DERIVA de los cinco participantes en lugar de leer `stats.damageSharePercentage`, que es un
 * campo almacenado del DTO. Ese campo y este cálculo son el mismo concepto, y al convivir se
 * contradecían: los cinco valores almacenados de una partida llegaban a sumar 109%, y el mismo
 * jugador leía 37% en el marcador y 34% en «Tu peso en el equipo». Un concepto, un número.
 */
export function damageShare(participant: MatchParticipant, team: TeamSummary): number {
  return share(
    participant.stats.totalDamageToChampions,
    sumBy(team, (s) => s.totalDamageToChampions),
  );
}

/**
 * El porcentaje siempre se calcula contra el propio equipo, nunca contra los diez: comparar
 * tu oro con el del equipo rival no significa nada, y comparar tu daño con el de tus cuatro
 * compañeros dice exactamente quién llevaba la partida.
 */
export function contributionOf(
  participant: MatchParticipant,
  team: TeamSummary,
): ParticipantContribution {
  const totalDamage = sumBy(team, (s) => s.totalDamageToChampions);
  const totalVision = sumBy(team, (s) => s.visionScore);
  const stats = participant.stats;

  return {
    damage: share(stats.totalDamageToChampions, totalDamage),
    gold: share(stats.gold, team.totalGold),
    killParticipation: share(stats.kills + stats.assists, team.totalKills),
    vision: share(stats.visionScore, totalVision),
  };
}

/**
 * Degradado de reserva para una ranura de inventario.
 *
 * BACKEND NOTE: placeholder puro. No hay catálogo de objetos cacheado en el front
 * (`GameDataApi.items()` es un buscador paginado, no un índice), así que lo único que se
 * puede pintar hoy es un tinte derivado del nombre. El endpoint de historial deberá embeber
 * cada objeto con su `iconUrl` —igual que hace con los campeones— y entonces esto se borra.
 */
export function itemBg(name: string): string {
  const hue = hash(name) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,46%), hsl(${hue},60%,24%))`;
}

function sumBy(team: TeamSummary, pick: (stats: ParticipantStats) => number): number {
  return team.participants.reduce((acc, p) => acc + pick(p.stats), 0);
}

/** Un equipo sin bajas (o sin visión) da 0%, no `NaN`: el 0 es la lectura correcta. */
function share(value: number, total: number): number {
  return total > 0 ? Math.min(100, Math.max(0, Math.round((value / total) * 100))) : 0;
}
