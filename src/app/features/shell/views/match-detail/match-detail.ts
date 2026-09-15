import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import {
  Match,
  MatchParticipant,
  TeamObjectives,
  TeamSummary,
} from '../../../../core/matches/models';
import {
  participantName,
  participantsOf,
  presetLabel,
  teamBySide,
  teamLabel,
} from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { NfButton, NfSkeleton } from '../../../../ui';
import { MatchScoreboardComponent } from '../match-history/match-scoreboard.component';
import {
  formatCompact,
  formatDurationUnits,
  formatMatchDate,
} from '../../../../shared/date-format';

/** Una mención de honor: quién fue el mejor de la partida en una cifra concreta. */
export interface HonorRow {
  id: string;
  /** El apodo de la mención. Es el gancho: «Muro de hierro» se recuerda, «Daño recibido» no. */
  title: string;
  /** Qué mide, dicho en llano, porque el apodo por sí solo no lo dice. */
  metric: string;
  userId: string;
  playerName: string;
  value: string;
}

/** Una cifra de la franja de ritmo y economía. */
export interface PaceStat {
  id: string;
  label: string;
  value: string;
  /** La aclaración de debajo; `null` cuando la cifra se explica sola. */
  hint: string | null;
}

/** Quién se llevó un «primero» de la partida. */
export interface FirstRow {
  id: string;
  label: string;
  teamLabel: string;
  side: 'blue' | 'red' | null;
}

/** Una fila del bloque «Dominio de la grieta»: un objetivo y cómo se repartió. */
export interface ObjectiveRow {
  id: string;
  name: string;
  icon: string;
  blueScore: number;
  redScore: number;
}

/** Un vértice de la huella táctica: dónde cae cada bando sobre ese eje y dónde va el icono. */
export interface RadarAxis {
  id: string;
  name: string;
  icon: string;
  blueX: number;
  blueY: number;
  redX: number;
  redY: number;
  iconX: number;
  iconY: number;
}

export interface TacticalRadar {
  /** Mallas concéntricas, de fuera a dentro. */
  rings: string[];
  bluePoints: string;
  redPoints: string;
  iconSize: number;
  axes: RadarAxis[];
}

const RADAR_CX = 120;
const RADAR_CY = 118;
const RADAR_MAX_R = 72;
/** Un bando que no se llevó nada no puede caer en el centro: el polígono se volvería un punto. */
const RADAR_MIN_R = 8;
const RADAR_ICON_GAP = 26;
const RADAR_ICON_SIZE = 24;

/**
 * Los objetivos que se pintan, en el orden en que se leen.
 *
 * **Los dragones no están, y es a propósito.** `MatchTeamObjectives` trae `dragonKills` a secas,
 * y nadie sabe todavía si esa cifra incluye a los ancianos: producción está a cero partidas y no
 * hay ni un bloque de equipo medido. Enseñarla como «Dragones» sería afirmar qué cuenta, que es
 * la misma mentira que evita la regla de los nulos, un nivel más abajo. Los tipos de dragón y el
 * alma tampoco: no viven en el bloque de equipo en ninguna versión del contrato, sino en los
 * eventos del timeline.
 *
 * **No se pierde nada esperando**: el backend guarda el bloque de equipo entero y el timeline en
 * crudo, así que el día que se mida se tipa y se rellena hacia atrás — con las partidas viejas
 * incluidas. Entonces se añaden aquí y el polígono crece solo.
 *
 * Mientras tanto el radar es un pentágono de cinco objetivos que sí sabemos leer.
 */
const OBJECTIVE_SPECS: readonly { id: string; name: string; icon: string; pick: (o: TeamObjectives) => number | null }[] = [
  { id: 'grubs', name: 'Larvas', icon: '/assets/objectives/grubs.png', pick: (o) => o.voidgrubs },
  { id: 'herald', name: 'Heraldo', icon: '/assets/objectives/herald.png', pick: (o) => o.heralds },
  { id: 'baron', name: 'Barón', icon: '/assets/objectives/baron.png', pick: (o) => o.barons },
  { id: 'inhibitors', name: 'Inhibidores', icon: '/assets/objectives/tower.png', pick: (o) => o.inhibitors },
  { id: 'towers', name: 'Torres', icon: '/assets/objectives/tower.png', pick: (o) => o.towers },
];

/**
 * Geometría de la huella táctica. El número de lados sale de los objetivos que le pasen
 * —hoy seis, o sea un hexágono—, y el radio de cada vértice es el reparto de ESE objetivo
 * entre los dos equipos, no su cifra bruta: las torres se cuentan por ocho y el barón por
 * uno, así que sin normalizar el polígono solo dibujaría cuál es el objetivo más numeroso.
 */
export function tacticalRadarOf(objectives: readonly ObjectiveRow[]): TacticalRadar {
  const sides = objectives.length;
  const round = (v: number) => Math.round(v * 10) / 10;
  const pointAt = (i: number, r: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    return { x: round(RADAR_CX + r * Math.cos(angle)), y: round(RADAR_CY + r * Math.sin(angle)) };
  };
  const radiusOf = (mine: number, rival: number) => {
    const total = mine + rival;
    const share = total ? mine / total : 0.5;
    return RADAR_MIN_R + share * (RADAR_MAX_R - RADAR_MIN_R);
  };

  const axes: RadarAxis[] = objectives.map((o, i) => {
    const blue = pointAt(i, radiusOf(o.blueScore, o.redScore));
    const red = pointAt(i, radiusOf(o.redScore, o.blueScore));
    const icon = pointAt(i, RADAR_MAX_R + RADAR_ICON_GAP);
    return {
      id: o.id,
      name: o.name,
      icon: o.icon,
      blueX: blue.x,
      blueY: blue.y,
      redX: red.x,
      redY: red.y,
      iconX: round(icon.x - RADAR_ICON_SIZE / 2),
      iconY: round(icon.y - RADAR_ICON_SIZE / 2),
    };
  });

  const ring = (factor: number) =>
    objectives
      .map((_, i) => {
        const p = pointAt(i, RADAR_MAX_R * factor);
        return `${p.x},${p.y}`;
      })
      .join(' ');

  return {
    rings: [ring(1), ring(0.66), ring(0.33)],
    bluePoints: axes.map((a) => `${a.blueX},${a.blueY}`).join(' '),
    redPoints: axes.map((a) => `${a.redX},${a.redY}`).join(' '),
    iconSize: RADAR_ICON_SIZE,
    axes,
  };
}

/**
 * El detalle de una partida: `GET /api/v1/matches/{matchId}`.
 *
 * ## Lo que se borró al conectarla, y por qué
 *
 * Esta pantalla era una MAQUETA: el MVP se llamaba «Adri_LoL» con Sylas y nota 9,8 en todas las
 * partidas, los objetivos eran «4 dragones a 1» fijos, y había un mapa de calor con posiciones,
 * wards y un desglose de zonas que no salía de ningún dato —la Match Timeline API de Riot no la
 * tenemos, y el backend no sirve wards ni posiciones (issue #69, §8)—. Nada de eso cambiaba al
 * abrir una partida distinta.
 *
 * Lo que queda es lo que el endpoint sirve de verdad: el marcador, los objetivos de cada equipo
 * y los duelos de línea. Menos pantalla, pero toda ella cierta.
 *
 * ## Dos cosas del contrato que mandan sobre el layout
 *
 * - **Los objetivos vienen vacíos si la sala no decidió lados.** Son del equipo 100/200, y sin
 *   saber cuál era azul colgarlos de A o de B sería inventar. Entonces el bloque de la grieta y
 *   el radar no se pintan: no hay nada honesto que dibujar.
 * - **`summary` es literalmente la fila del listado.** El ganador, los lados y el MVP se deciden
 *   en un sitio y no se recalculan aquí, o la tarjeta y la partida que abre dirían cosas
 *   distintas.
 */
@Component({
  selector: 'app-match-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton, NfSkeleton, MatchScoreboardComponent],
  templateUrl: './match-detail.html',
  styleUrls: ['./match-detail.scss'],
})
export class MatchDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);

  private readonly routeId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  /** De dónde se vino, para que el enlace de vuelta no mande siempre al historial personal. */
  private readonly returnTo = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('volver'))),
    { initialValue: this.route.snapshot.queryParamMap.get('volver') },
  );

  readonly match = computed<Match | null>(() => this.store.detailMatch());
  readonly gameVersion = computed(() => this.store.detail()?.gameVersion ?? null);

  /**
   * Los cuatro estados que exige el proyecto, distinguidos: cargando, error de red, «no existe»
   * y listo. El 404 tiene pantalla propia porque un fallo de conexión no puede pintarse como una
   * partida inexistente, que era el bug clásico del `@if (dato) … @else { 404 }`.
   */
  readonly status = computed<'loading' | 'error' | 'not-found' | 'ready'>(() => {
    const own = this.store.detailStatus();
    if (own === 'error') return this.store.detailNotFound() ? 'not-found' : 'error';
    const champs = this.gameData.status();
    if (own === 'idle' || own === 'loading' || champs === 'idle' || champs === 'loading') {
      return 'loading';
    }
    return 'ready';
  });

  readonly skeletonRows = [1, 2, 3, 4, 5];

  readonly backLink = computed(() => {
    const to = this.returnTo();
    if (to?.startsWith('grupo:')) {
      const groupId = to.slice('grupo:'.length);
      if (groupId) return ['/app', 'grupos', groupId, 'historial'];
    }
    return ['/app', 'historial'];
  });

  readonly backLabel = computed(() =>
    this.returnTo()?.startsWith('grupo:') ? 'Volver al historial del grupo' : 'Volver al historial',
  );

  /** Los dos equipos con su nombre ya resuelto: con color si lo tienen, por hueco si no. */
  readonly teams = computed(() =>
    (this.match()?.teams ?? []).map((t) => ({ ...t, label: teamLabel(t) })),
  );

  readonly metaLine = computed(() => {
    const m = this.match();
    if (!m) return [];
    const parts: string[] = [formatMatchDate(m.decidedAt), presetLabel(m.preset)];
    if (m.durationSeconds != null) parts.push(formatDurationUnits(m.durationSeconds));
    if (m.leagueName) parts.push(m.leagueName);
    const version = this.gameVersion();
    if (version) parts.push(`Parche ${version}`);
    return parts;
  });

  /**
   * El reparto de cada objetivo entre azul y rojo.
   *
   * Vacío si la sala no decidió lados (el backend no manda objetivos entonces) o si ningún
   * objetivo trae cifra. Un objetivo que nadie apuntó no entra como `0`: `null` es «nadie lo
   * escribió» y cero es «no se llevaron ninguno», y el radio del radar los dibujaría igual.
   */
  readonly objectives = computed<ObjectiveRow[]>(() => {
    const m = this.match();
    if (!m) return [];
    const blue = teamBySide(m, 'blue');
    const red = teamBySide(m, 'red');
    if (!blue?.objectives || !red?.objectives) return [];

    const rows: ObjectiveRow[] = [];
    for (const spec of OBJECTIVE_SPECS) {
      const blueScore = spec.pick(blue.objectives);
      const redScore = spec.pick(red.objectives);
      if (blueScore == null && redScore == null) continue;
      rows.push({
        id: spec.id,
        name: spec.name,
        icon: spec.icon,
        blueScore: blueScore ?? 0,
        redScore: redScore ?? 0,
      });
    }
    return rows;
  });

  /** La huella táctica sale de la lista de arriba, no de coordenadas escritas a mano. */
  readonly tacticalRadar = computed(() => tacticalRadarOf(this.objectives()));

  /** Los baneos de cada equipo, cuando la partida tuvo draft. Vacío es normal en una custom. */
  readonly bans = computed(() =>
    this.teams()
      .map((t) => ({ label: t.label, side: t.side, champions: t.objectives?.bans ?? [] }))
      .filter((t) => t.champions.length > 0),
  );

  /**
   * Las menciones de honor: el mejor de la partida en cada cifra, con su nombre y su número.
   *
   * Esta franja existió antes como una maqueta con cuatro nombres inventados («Adri_LoL, 34.2k»)
   * que salían igual en todas las partidas. Vuelve calculada sobre los diez asientos reales, y
   * con la regla de siempre: **una mención sin dato no sale**. Si nadie subió la partida no hay
   * ninguna, y la franja entera desaparece en vez de enseñar cinco guiones.
   *
   * No hay empate que resolver: con diez jugadores el máximo exacto de una cifra de cinco dígitos
   * no se repite, y si se repitiera, quedarse con el primero es tan bueno como cualquier regla.
   */
  readonly honors = computed<HonorRow[]>(() => {
    const m = this.match();
    if (!m) return [];
    const players = participantsOf(m);
    const minutes = m.durationSeconds ? m.durationSeconds / 60 : null;

    const rows: HonorRow[] = [];
    const add = (
      id: string,
      title: string,
      metric: string,
      pick: (p: MatchParticipant) => number | null | undefined,
      format: (value: number) => string,
    ) => {
      const best = bestBy(players, pick);
      if (best) {
        rows.push({
          id,
          title,
          metric,
          userId: best.player.userId,
          playerName: participantName(best.player),
          value: format(best.value),
        });
      }
    };

    add('damage', 'Cañón de daño', 'Más daño a campeones', (p) => p.stats.damageToChampions, (v) => `${formatCompact(v)} de daño`);
    add('tank', 'Muro de hierro', 'Más daño aguantado', (p) => p.stats.damageTaken, (v) => `${formatCompact(v)} recibidos`);
    add('vision', 'Ojo de águila', 'Mejor puntuación de visión', (p) => p.stats.visionScore, (v) => `${v} de visión`);
    add('cc', 'Cadena de control', 'Más tiempo dejando al rival sin jugar', (p) => p.stats.timeCcingOthers, (v) => `${v} s de control`);
    // El farm se mide por minuto y no en bruto: en una partida larga gana siempre el mismo, y
    // lo que distingue a quien farmea bien es el ritmo, no el reloj.
    if (minutes) {
      add('farm', 'Rey del farm', 'Más súbditos por minuto', (p) => p.stats.cs, (v) =>
        `${(v / minutes).toFixed(1).replace('.', ',')} CS/min`);
    }
    return rows;
  });

  /**
   * Ritmo y economía: cuánto duró, cuánto se mató y quién tuvo el oro.
   *
   * Todo sale del DTO. La ventaja al minuto 14 se suma de los cinco `goldAt14` de cada equipo,
   * que es el mismo dato con el que la pestaña de duelos estima quién ganó su línea; sin él —una
   * partida que no llegó al 14, o sin subir— esa fila no aparece.
   */
  readonly pace = computed<PaceStat[]>(() => {
    const m = this.match();
    if (!m) return [];
    const [a, b] = m.teams;
    const rows: PaceStat[] = [];

    if (m.durationSeconds != null) {
      rows.push({ id: 'duration', label: 'Duración', value: formatDurationUnits(m.durationSeconds), hint: null });
    }

    if (a.totalKills != null && b.totalKills != null) {
      const kills = a.totalKills + b.totalKills;
      const perMinute = m.durationSeconds ? (kills / (m.durationSeconds / 60)).toFixed(1).replace('.', ',') : null;
      rows.push({
        id: 'kills',
        label: 'Bajas totales',
        value: String(kills),
        hint: perMinute ? `${perMinute} por minuto` : null,
      });
    }

    if (a.totalGold != null && b.totalGold != null) {
      const leader = a.totalGold >= b.totalGold ? a : b;
      const diff = Math.abs(a.totalGold - b.totalGold);
      rows.push({
        id: 'gold',
        label: 'Oro al final',
        value: `${formatCompact(a.totalGold)} · ${formatCompact(b.totalGold)}`,
        // Cero es un dato: un empate exacto al final de una partida se cuenta, no se esconde.
        hint: diff === 0 ? 'Empate' : `+${formatCompact(diff)} para ${teamLabel(leader)}`,
      });
    }

    const gold14 = m.teams.map((t) => sumOf(t.participants, (p) => p.stats.goldAt14));
    if (gold14[0] != null && gold14[1] != null) {
      const diff = Math.abs(gold14[0] - gold14[1]);
      const leader = gold14[0] >= gold14[1] ? a : b;
      rows.push({
        id: 'gold14',
        label: 'Ventaja al minuto 14',
        value: diff === 0 ? 'Ninguna' : `+${formatCompact(diff)}`,
        hint: diff === 0 ? 'Salieron empatados de líneas' : `Para ${teamLabel(leader)}`,
      });
    }

    return rows;
  });

  /**
   * Quién se llevó cada «primero». Salen de los `first*` de cada equipo, que llegan desde que el
   * historial es real y no los leía nadie.
   *
   * Vacío si la sala no decidió lados: esos campos viajan dentro de `objectives`, y sin lados el
   * backend no manda objetivos. Un «primero» que ninguno de los dos reclama tampoco sale —pasa
   * con el primer barón en una partida sin barones—, porque `false` en los dos es «no ocurrió»,
   * no «lo hizo el otro».
   */
  readonly firsts = computed<FirstRow[]>(() => {
    const m = this.match();
    if (!m) return [];

    const SPECS: readonly { id: string; label: string; pick: (o: TeamObjectives) => boolean | null }[] = [
      { id: 'blood', label: 'Primera sangre', pick: (o) => o.firstBlood },
      { id: 'tower', label: 'Primera torre', pick: (o) => o.firstTower },
      { id: 'baron', label: 'Primer barón', pick: (o) => o.firstBaron },
      { id: 'inhibitor', label: 'Primer inhibidor', pick: (o) => o.firstInhibitor },
    ];

    const rows: FirstRow[] = [];
    for (const spec of SPECS) {
      const winner = m.teams.find((t) => t.objectives && spec.pick(t.objectives) === true);
      if (winner) {
        rows.push({ id: spec.id, label: spec.label, teamLabel: teamLabel(winner), side: winner.side });
      }
    }
    return rows;
  });

  readonly hoveredObjectiveId = signal<string | null>(null);

  constructor() {
    this.gameData.ensureLoaded();

    effect(() => {
      const id = this.routeId();
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      if (id) untracked(() => void this.store.ensureDetail(id));
    });
  }

  setHoveredObjective(id: string | null): void {
    this.hoveredObjectiveId.set(id);
  }

  championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? `Campeón ${id}`;
  }

  championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  /** `null` es «no subida»: el marcador no se pinta a cero. */
  teamKills(team: TeamSummary): string {
    return team.totalKills == null ? '—' : String(team.totalKills);
  }

  retry(): void {
    const id = this.routeId();
    if (id) void this.store.reloadDetail(id);
  }
}

/** El asiento con el valor más alto de una cifra, o `null` si nadie la trae. */
function bestBy(
  players: readonly MatchParticipant[],
  pick: (p: MatchParticipant) => number | null | undefined,
): { player: MatchParticipant; value: number } | null {
  let best: { player: MatchParticipant; value: number } | null = null;
  for (const player of players) {
    const value = pick(player);
    if (value == null) continue;
    if (!best || value > best.value) best = { player, value };
  }
  return best;
}

/**
 * La suma de una cifra entre los cinco de un equipo, o `null` si le falta a alguno.
 *
 * Es estricto a propósito: sumar cuatro `goldAt14` y compararlos con cinco del otro equipo da
 * una ventaja inventada, y se leería como medida igual que si estuviera bien.
 */
function sumOf(
  players: readonly MatchParticipant[],
  pick: (p: MatchParticipant) => number | null | undefined,
): number | null {
  let total = 0;
  for (const player of players) {
    const value = pick(player);
    if (value == null) return null;
    total += value;
  }
  return players.length > 0 ? total : null;
}
