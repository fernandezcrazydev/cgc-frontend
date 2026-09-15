import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
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
import { MatchTimelineStore } from '../../../../core/matches';
import {
  Match,
  MatchParticipant,
  MatchTimelineSummary,
  TeamObjectives,
  TeamSlot,
  TeamSummary,
} from '../../../../core/matches/models';
import {
  computeMatchScores,
  damageShare,
  laneLabel,
  participantName,
  participantShortName,
  participantsOf,
  presetLabel,
  teamBySide,
  teamLabel,
} from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { NfAvatar, NfButton, NfSkeleton } from '../../../../ui';
import { MatchScoreboardComponent } from '../match-history/match-scoreboard.component';
import { MatchCommentsComponent } from './match-comments.component';
import { MatchMapComponent } from './match-map.component';
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
  /** Qué mide, en una palabra, debajo de la cifra. */
  metric: string;
  /** El color del tubo. Es la única excepción a «nombres de color nunca»: aquí la familia de
      colores ES la identidad visual de la mención, y no cambia con el tema. */
  color: string;
  userId: string;
  /** El nombre completo, para el `title`: es el que identifica sin ambigüedad. */
  playerName: string;
  /** Sin la región, que es lo que cabe en la caja del tubo. */
  shortName: string;
  value: string;
  /** Su cuota sobre los diez, que es lo que llena el tubo. */
  pct: number;
}

/** La tarjeta de una distinción (MVP o ACE), con lo que el DTO sabe de ese asiento. */
export interface DistinctionCard {
  userId: string;
  playerName: string;
  avatarUrl: string | null;
  role: string;
  teamLabel: string;
  championId: number | null;
  championName: string | null;
  championIcon: string | null;
  kda: string | null;
  score: string | null;
  damage: string | null;
  damageShare: number | null;
}

/** Un puesto del podio de daño. */
export interface PodiumRow {
  rank: number;
  userId: string;
  playerName: string;
  championName: string | null;
  championIcon: string | null;
  damage: string;
  pct: number;
  side: 'blue' | 'red' | null;
  trophy: string;
}

/** Un lado del donut de economía. */
export interface EconomySide {
  label: string;
  side: 'blue' | 'red' | null;
  gold: string;
  pct: number;
}

export interface EconomyView {
  a: EconomySide;
  b: EconomySide;
  lead: string;
}

/** Una diapositiva del reparto por equipos. */
export interface SplitSlide {
  id: string;
  title: string;
  subtitle: string;
  aLabel: string;
  bLabel: string;
  aScore: number;
  bScore: number;
  aPct: number;
}

/**
 * Quién se llevó un «primero» de la partida.
 *
 * `minute` y `playerName` llegan **solo con la timeline** (`cgc-backend#96`): el bloque de equipo
 * dice QUÉ bando y nada más. Sin timeline se pintan las pastillas de siempre, con el equipo, que es
 * lo que se podía decir hasta ahora.
 */
export interface FirstRow {
  id: string;
  label: string;
  teamLabel: string;
  side: 'blue' | 'red' | null;
  /** `null` sin timeline. Nunca 0: el minuto 0 es un minuto real y muy común en una primera sangre. */
  minute: number | null;
  /** Quién lo hizo. `null` sin timeline, y también cuando lo ejecutó el mapa (una torre). */
  playerName: string | null;
}

/** Una fila del bloque «Dominio de la grieta»: un objetivo y cómo se repartió. */
export interface ObjectiveRow {
  id: string;
  name: string;
  icon: string;
  blueScore: number;
  redScore: number;
}

/**
 * Los dragones de un bando, desglosados por elemento.
 *
 * Existe desde que la timeline dice de qué tipo era cada uno (`cgc-backend#96`). Antes solo había un
 * total del que nadie sabía qué contaba, y por eso no se pintaba ninguno.
 */
export interface DragonBreakdownRow {
  slot: TeamSlot;
  label: string;
  side: 'blue' | 'red' | null;
  total: number;
  elements: readonly { subType: string; count: number; name: string; icon: string }[];
}

/**
 * Los elementos que el cliente escribe, con su nombre en español.
 *
 * Los cinco están **medidos** en exportaciones reales. El anciano no aparece en ninguna de ellas,
 * pero se cataloga igual: cuando salga, más vale que tenga nombre a que se pinte «Dragón» a secas.
 */
const DRAGON_NAMES: Readonly<Record<string, string>> = {
  FIRE_DRAGON: 'Dragón de fuego',
  EARTH_DRAGON: 'Dragón de tierra',
  AIR_DRAGON: 'Dragón de viento',
  WATER_DRAGON: 'Dragón de agua',
  HEXTECH_DRAGON: 'Dragón hextech',
  CHEMTECH_DRAGON: 'Dragón quimtech',
  ELDER_DRAGON: 'Dragón ancestral',
};

/**
 * El icono de cada elemento. **`CHEMTECH_DRAGON` no tiene el suyo** en `public/assets/objectives/`
 * y cae al genérico: es un elemento medido en una partida real, así que la alternativa sería no
 * pintarlo. Cuando alguien añada el icono, esta línea se borra.
 */
const DRAGON_ICONS: Readonly<Record<string, string>> = {
  FIRE_DRAGON: '/assets/objectives/dragon_fire.png',
  EARTH_DRAGON: '/assets/objectives/dragon_earth.png',
  AIR_DRAGON: '/assets/objectives/dragon_air.png',
  WATER_DRAGON: '/assets/objectives/dragon_water.png',
  HEXTECH_DRAGON: '/assets/objectives/dragon_hextech.png',
  ELDER_DRAGON: '/assets/objectives/dragon_elder.png',
};

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
  imports: [
    RouterLink,
    NfAvatar,
    NfButton,
    NfSkeleton,
    MatchScoreboardComponent,
    MatchCommentsComponent,
    MatchMapComponent,
  ],
  templateUrl: './match-detail.html',
  styleUrls: ['./match-detail.scss'],
})
export class MatchDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(MatchHistoryStore);
  private readonly timeline = inject(MatchTimelineStore);
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
   * La timeline de esta partida (`cgc-backend#96`).
   *
   * **No entra en `status()`**, y es deliberado: la pantalla se pinta igual sin ella. Una partida
   * sin exportar tiene marcador y no tiene timeline, así que bloquear el detalle entero esperándola
   * sería dejar en blanco lo que sí se sabe. Lo que depende de ella aparece cuando llega.
   */
  readonly timelineSummary = computed<MatchTimelineSummary>(() => this.timeline.summary());

  /**
   * Si esta partida tiene timeline, que es lo que decide si se ofrece el bloque del mapa.
   *
   * Mientras el resumen viaja esto es `false` y el bloque no aparece: es mejor que salga un poco
   * después a que aparezca un hueco que a lo mejor nunca se llena.
   */
  readonly hasTimeline = computed(() => this.timeline.available());

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

  /**
   * Los diez que la jugaron. Lo consume el hilo de comentarios para saber si esta persona puede
   * escribir en él — leerlo lo puede todo el grupo, escribirlo solo ellos.
   */
  readonly participantIds = computed<readonly string[]>(() =>
    (this.match()?.teams ?? []).flatMap((team) => team.participants.map((p) => p.userId)),
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
    // Sin lados decididos no hay nada que colgar de «azul» y «rojo». Es la única condición que
    // tumba la lista entera: el resto se decide fila a fila.
    if (!blue || !red) return [];

    const rows: ObjectiveRow[] = [];
    // Los dragones van los PRIMEROS, y **no dependen del bloque de equipo**: salen de la timeline,
    // que es otra fuente. Una partida puede tener recorrido y no tener bloque de objetivos —son dos
    // trozos distintos del mismo payload— y entonces esta fila es la única que se puede pintar.
    const dragons = this.dragonRow(blue, red);
    if (dragons) rows.push(dragons);

    if (!blue.objectives || !red.objectives) return rows;

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

  /**
   * La fila de dragones, que **solo existe con timeline** (`cgc-backend#96`).
   *
   * Es la que llevaba ausente desde que se conectó esta pantalla: `TeamObjectives.dragonKills`
   * llegaba a secas y nadie había medido si incluye a los ancianos, así que enseñarlo bajo la
   * etiqueta «Dragones» afirmaba qué cuenta. Ahora el backend sirve el desglose por elemento, que
   * es una medición y no una interpretación, y la cifra vuelve.
   *
   * `null` sin timeline: esa fila no se rellena desde el bloque de equipo ni aunque el dato esté
   * ahí. Lo que cambió no es que haya un número nuevo, es que por fin se sabe qué cuenta.
   */
  private dragonRow(blue: TeamSummary, red: TeamSummary): ObjectiveRow | null {
    const timeline = this.timelineSummary();
    if (!timeline.available) return null;

    const totalOf = (team: TeamSummary) =>
      timeline.dragons.find((d) => d.teamSlot === team.slot)?.total ?? 0;
    const blueScore = totalOf(blue);
    const redScore = totalOf(red);
    if (blueScore === 0 && redScore === 0) return null;

    return {
      id: 'dragons',
      name: 'Dragones',
      icon: '/assets/objectives/dragon.png',
      blueScore,
      redScore,
    };
  }

  /**
   * Los dragones de cada bando, con el icono de su elemento y en el orden en que cayeron.
   *
   * Se pinta debajo de la fila de dragones, y es lo que la cifra sola no dice: cuatro dragones de
   * fuego y cuatro surtidos no son la misma partida. Los elementos son los que escribe el cliente
   * (`FIRE_DRAGON`, `EARTH_DRAGON`, `AIR_DRAGON`, `HEXTECH_DRAGON`, `CHEMTECH_DRAGON`, todos
   * medidos); uno sin icono propio cae al icono genérico en vez de desaparecer.
   *
   * **No dice nada del alma**: la timeline no trae ningún evento de alma, y deducirla de «cuatro
   * dragones» sería afirmar una regla del juego que nadie ha medido aquí.
   */
  readonly dragonBreakdown = computed<DragonBreakdownRow[]>(() => {
    const m = this.match();
    const timeline = this.timelineSummary();
    if (!m || !timeline.available) return [];

    const rows: DragonBreakdownRow[] = [];
    for (const team of m.teams) {
      const dragons = timeline.dragons.find((d) => d.teamSlot === team.slot);
      if (!dragons || dragons.total === 0) continue;
      rows.push({
        slot: team.slot,
        label: teamLabel(team),
        side: team.side,
        total: dragons.total,
        elements: Object.entries(dragons.bySubType).map(([subType, count]) => ({
          subType,
          count,
          name: DRAGON_NAMES[subType] ?? 'Dragón',
          icon: DRAGON_ICONS[subType] ?? '/assets/objectives/dragon.png',
        })),
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
   * La tarjeta del MVP y la del ACE: las dos mismas piezas, dos distinciones distintas.
   *
   * Esta franja era una maqueta: el MVP se llamaba «Adri_LoL» con Sylas y nota 9,8 en todas las
   * partidas. Vuelve leyendo `mvpUserId` / `aceUserId`, que los decide el backend y son los
   * mismos que marcan la fila del marcador — no se recalculan aquí, o la tarjeta y el marcador
   * dirían cosas distintas.
   *
   * `null` si el backend no señaló a nadie, o si ese asiento no trae cifras: la tarjeta entera
   * no se pinta antes que pintarla con huecos.
   *
   * **El nivel de campeón no está**: la insignia que lo enseñaba en la maqueta se cae, porque el
   * backend no sirve ese campo y un número inventado ahí se lee como medido.
   */
  readonly mvpCard = computed<DistinctionCard | null>(() => this.distinction(this.match()?.mvpUserId));
  readonly aceCard = computed<DistinctionCard | null>(() => this.distinction(this.match()?.aceUserId));

  private distinction(userId: string | null | undefined): DistinctionCard | null {
    const m = this.match();
    if (!m || !userId) return null;
    const team = m.teams.find((t) => t.participants.some((p) => p.userId === userId));
    const player = team?.participants.find((p) => p.userId === userId);
    if (!team || !player) return null;

    return {
      userId,
      playerName: participantName(player),
      avatarUrl: player.avatarUrl,
      role: laneLabel(player.role),
      teamLabel: teamLabel(team),
      championId: player.championId,
      championName: player.championId == null ? null : this.championName(player.championId),
      championIcon: player.championId == null ? null : this.championIcon(player.championId),
      kda:
        player.stats.kills == null
          ? null
          : `${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}`,
      score: this.scores().get(userId)?.score ?? null,
      damage: player.stats.damageToChampions == null ? null : formatCompact(player.stats.damageToChampions),
      damageShare: damageShare(player, team),
    };
  }

  /** Las notas por jugador, las mismas que pinta la columna «Nota» del marcador. */
  private readonly scores = computed(() => {
    const m = this.match();
    return m ? computeMatchScores(m) : new Map<string, { score: string }>();
  });

  /**
   * Las menciones de honor: el mejor de la partida en cada cifra.
   *
   * Antes eran cuatro nombres escritos a mano que salían idénticos en todas las partidas. Ahora
   * salen del dato, y **una mención sin dato no sale**: sin subida no hay ninguna y la franja
   * desaparece, en vez de enseñar cinco guiones.
   *
   * `pct` es la CUOTA sobre los diez, no «lo cerca que está del máximo»: el ganador siempre está
   * al 100% de sí mismo, y un tubo lleno en todas las menciones no diría nada. Así el tubo
   * responde «cuánto de la partida acaparó», que sí varía.
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
      color: string,
      pick: (p: MatchParticipant) => number | null | undefined,
      format: (value: number) => string,
    ) => {
      const best = bestBy(players, pick);
      if (!best) return;
      const total = players.reduce((acc, p) => acc + (pick(p) ?? 0), 0);
      rows.push({
        id,
        title,
        metric,
        color,
        userId: best.player.userId,
        playerName: participantName(best.player),
        shortName: participantShortName(best.player),
        value: format(best.value),
        pct: total > 0 ? Math.round((best.value / total) * 100) : 0,
      });
    };

    add('damage', 'Cañón de daño', 'daño', 'crimson', (p) => p.stats.damageToChampions, (v) => formatCompact(v));
    add('tank', 'Muro de hierro', 'mitigado', 'cyan', (p) => p.stats.damageTaken, (v) => formatCompact(v));
    add('vision', 'Ojo de águila', 'visión', 'emerald', (p) => p.stats.visionScore, (v) => String(v));
    // El farm se mide por minuto y no en bruto: en bruto lo gana siempre la partida más larga.
    if (minutes) {
      add('farm', 'Rey del farm', 'CS/min', 'indigo', (p) => p.stats.cs, (v) =>
        (v / minutes).toFixed(1).replace('.', ','));
    }
    return rows;
  });

  /**
   * El podio de daño a campeones: los tres primeros de los diez.
   *
   * Los trofeos son los de `assets/trofeos/`, los mismos del ranking del grupo. La maqueta
   * apuntaba a `/assets/ranking/trophy-gold.png`, que **no existe en el repo**: ese podio se
   * pintaba con tres imágenes rotas y nadie lo vio.
   */
  readonly topDamage = computed<PodiumRow[]>(() => {
    const m = this.match();
    if (!m) return [];
    const rows = participantsOf(m)
      .filter((p) => p.stats.damageToChampions != null)
      .sort((a, b) => (b.stats.damageToChampions ?? 0) - (a.stats.damageToChampions ?? 0))
      .slice(0, 3);
    const top = rows[0]?.stats.damageToChampions ?? 0;

    return rows.map((player, index) => ({
      rank: index + 1,
      userId: player.userId,
      playerName: participantName(player),
      championName: player.championId == null ? null : this.championName(player.championId),
      championIcon: player.championId == null ? null : this.championIcon(player.championId),
      damage: formatCompact(player.stats.damageToChampions ?? 0),
      pct: top > 0 ? Math.round(((player.stats.damageToChampions ?? 0) / top) * 100) : 0,
      side: player.side,
      trophy: `/assets/trofeos/Trofeo${index + 1}.webp`,
    }));
  });

  /** Cuánto duró y a qué ritmo se mató. `null` en cualquiera de las dos si no se sabe. */
  readonly pace = computed(() => {
    const m = this.match();
    if (!m) return null;
    const [a, b] = m.teams;
    const kills = a.totalKills != null && b.totalKills != null ? a.totalKills + b.totalKills : null;
    const minutes = m.durationSeconds ? m.durationSeconds / 60 : null;

    if (m.durationSeconds == null && kills == null) return null;
    return {
      duration: m.durationSeconds == null ? null : formatDurationUnits(m.durationSeconds),
      kills,
      killsPerMinute: kills != null && minutes ? (kills / minutes).toFixed(1).replace('.', ',') : null,
    };
  });

  /** Qué corte de la economía se está mirando: el final de la partida o el minuto 14. */
  readonly economyPhase = signal<'final' | 'at14'>('final');
  readonly hoveredEconomySide = signal<'a' | 'b' | null>(null);

  /**
   * El reparto del oro entre los dos equipos, en el corte activo.
   *
   * El del minuto 14 suma los cinco `goldAt14` de cada lado y es **estricto**: si a un asiento le
   * falta el dato no se calcula y el conmutador de «14 min» no se ofrece. Cuatro contra cinco da
   * una ventaja inventada, y se lee igual que una medida.
   *
   * La ventaja va «a favor de» quien la tenga, no siempre del azul: la maqueta tenía «a favor de
   * Azul» escrito en el HTML.
   */
  readonly economy = computed<EconomyView | null>(() => {
    const m = this.match();
    if (!m) return null;
    const [a, b] = m.teams;
    const phase = this.economyPhase();

    const values =
      phase === 'final'
        ? [a.totalGold, b.totalGold]
        : [sumOf(a.participants, (p) => p.stats.goldAt14), sumOf(b.participants, (p) => p.stats.goldAt14)];
    const [goldA, goldB] = values;
    if (goldA == null || goldB == null) return null;

    const total = goldA + goldB;
    const diff = Math.abs(goldA - goldB);
    const leader = goldA >= goldB ? a : b;

    return {
      a: { label: teamLabel(a), side: a.side, gold: formatCompact(goldA), pct: total > 0 ? Math.round((goldA / total) * 100) : 50 },
      b: { label: teamLabel(b), side: b.side, gold: formatCompact(goldB), pct: total > 0 ? Math.round((goldB / total) * 100) : 50 },
      lead: diff === 0 ? 'Empate' : `+${formatCompact(diff)} a favor de ${teamLabel(leader)}`,
    };
  });

  /** ¿Se puede ofrecer el corte del minuto 14? Solo si los diez asientos traen su oro. */
  readonly hasGoldAt14 = computed(() => {
    const m = this.match();
    if (!m) return false;
    return m.teams.every((t) => sumOf(t.participants, (p) => p.stats.goldAt14) != null);
  });

  /**
   * El carrusel de reparto por equipos. **Ya no es «guerra de visión»**: los wards y su posición
   * viven en la timeline de Riot, que no tenemos (`cgc-backend#96`), y aquella tarjeta los pintaba
   * con cifras escritas a mano.
   *
   * Lo que sí llega por asiento son tres cosas que se suman por equipo y responden a la misma
   * pregunta —quién puso qué—: visión, daño aguantado y control de masas. Una diapositiva que no
   * tenga sus dos sumas completas no entra.
   */
  readonly teamSplits = computed<SplitSlide[]>(() => {
    const m = this.match();
    if (!m) return [];
    const [a, b] = m.teams;

    const SPECS: readonly { id: string; title: string; subtitle: string; pick: (p: MatchParticipant) => number | undefined }[] = [
      { id: 'vision', title: 'Puntuación de visión', subtitle: 'Wards puestos, arrasados y tiempo de visión concedida', pick: (p) => p.stats.visionScore },
      { id: 'tanked', title: 'Daño aguantado', subtitle: 'Lo que absorbió cada equipo antes de caer', pick: (p) => p.stats.damageTaken },
      { id: 'cc', title: 'Control de masas', subtitle: 'Segundos que cada equipo dejó al rival sin poder jugar', pick: (p) => p.stats.timeCcingOthers },
    ];

    const slides: SplitSlide[] = [];
    for (const spec of SPECS) {
      const scoreA = sumOf(a.participants, spec.pick);
      const scoreB = sumOf(b.participants, spec.pick);
      if (scoreA == null || scoreB == null) continue;
      const total = scoreA + scoreB;
      slides.push({
        id: spec.id,
        title: spec.title,
        subtitle: spec.subtitle,
        aLabel: teamLabel(a),
        bLabel: teamLabel(b),
        aScore: scoreA,
        bScore: scoreB,
        aPct: total > 0 ? Math.round((scoreA / total) * 100) : 50,
      });
    }
    return slides;
  });

  readonly activeSplit = signal(0);
  readonly splitPaused = signal(false);
  /** 0-100: lo que lleva recorrido el punto activo. Es el reloj del carrusel, hecho visible. */
  readonly splitProgress = signal(0);
  readonly currentSplit = computed(() => this.teamSplits()[this.activeSplit()] ?? null);
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

    const fromTimeline = this.firstsFromTimeline(m);
    if (fromTimeline.length > 0) return fromTimeline;

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
        rows.push({
          id: spec.id,
          label: spec.label,
          teamLabel: teamLabel(winner),
          side: winner.side,
          minute: null,
          playerName: null,
        });
      }
    }
    return rows;
  });

  /**
   * Los «primeros» leídos de la timeline: con su minuto y con quién lo hizo.
   *
   * Es la mitad que el bloque de equipo no puede dar — dice QUÉ bando y nada más— y la razón por la
   * que el issue #96 existía. Cada uno es sencillamente el PRIMER evento de su clase: la timeline
   * llega ordenada por frame y, dentro de un frame, por el instante del evento.
   *
   * **Trae uno que antes no existía: el primer dragón.** `firstDragon` no llega nunca en el bloque
   * de equipo, porque el cliente lo escribe con una errata (`firstDargon`) y solo dentro del bloque
   * crudo. Aquí no hace falta: se ve caer.
   *
   * Vacío cuando no hay timeline, y entonces manda el camino de siempre.
   */
  private firstsFromTimeline(m: Match): FirstRow[] {
    const timeline = this.timelineSummary();
    if (!timeline.available) return [];

    const rows: FirstRow[] = [];
    const push = (
      id: string,
      label: string,
      minute: number,
      slot: string | null,
      userId: string | null,
    ) => {
      const team = m.teams.find((t) => t.slot === slot);
      rows.push({
        id,
        label,
        teamLabel: team ? teamLabel(team) : 'Sin equipo',
        side: team?.side ?? null,
        minute,
        playerName: userId ? this.nameOf(userId) : null,
      });
    };

    const firstKill = timeline.kills[0];
    if (firstKill) {
      push('blood', 'Primera sangre', firstKill.minute, firstKill.teamSlot, firstKill.killerUserId);
    }
    const firstTower = timeline.buildings.find((b) => b.buildingType === 'TOWER_BUILDING');
    if (firstTower) {
      push('tower', 'Primera torre', firstTower.minute, firstTower.killerTeamSlot,
        firstTower.killerUserId);
    }
    const firstDragon = timeline.monsters.find((o) => o.monsterType === 'DRAGON');
    if (firstDragon) {
      push('dragon', 'Primer dragón', firstDragon.minute, firstDragon.teamSlot,
        firstDragon.killerUserId);
    }
    const firstBaron = timeline.monsters.find((o) => o.monsterType === 'BARON_NASHOR');
    if (firstBaron) {
      push('baron', 'Primer barón', firstBaron.minute, firstBaron.teamSlot, firstBaron.killerUserId);
    }
    const firstInhibitor = timeline.buildings.find((b) => b.buildingType === 'INHIBITOR_BUILDING');
    if (firstInhibitor) {
      push('inhibitor', 'Primer inhibidor', firstInhibitor.minute, firstInhibitor.killerTeamSlot,
        firstInhibitor.killerUserId);
    }
    return rows;
  }

  /** El nombre corto de quien hizo algo, buscado entre los diez del marcador. */
  private nameOf(userId: string): string | null {
    const m = this.match();
    if (!m) return null;
    const player = participantsOf(m).find((p) => p.userId === userId);
    return player ? participantShortName(player) : null;
  }

  readonly hoveredObjectiveId = signal<string | null>(null);

  constructor() {
    this.gameData.ensureLoaded();
    this.startSplitCarousel();

    effect(() => {
      const id = this.routeId();
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      if (id) {
        untracked(() => {
          void this.store.ensureDetail(id);
          // Solo el RESUMEN. Las posiciones las pide el mapa cuando alguien lo abre: son diez
          // coordenadas por minuto y no las mira quien viene a leer el marcador.
          void this.timeline.ensureSummary(id);
        });
      }
    });
  }

  /**
   * El reloj del carrusel: un tic cada 100 ms que llena el punto activo y, al llegar al final,
   * pasa al siguiente.
   *
   * **No gira si el usuario pide movimiento reducido**, y entonces el punto aparece lleno en vez
   * de a medias: un indicador de progreso congelado a mitad se lee como algo atascado. Tampoco
   * gira con una sola diapositiva, ni mientras el puntero está encima.
   */
  private startSplitCarousel(): void {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduced) {
      this.splitProgress.set(100);
      return;
    }

    const TICK_MS = 100;
    const SLIDE_MS = 6000;
    const timer = setInterval(() => {
      if (this.splitPaused() || this.teamSplits().length < 2) return;
      const next = this.splitProgress() + (TICK_MS / SLIDE_MS) * 100;
      if (next >= 100) {
        this.splitProgress.set(0);
        this.nextSplit();
      } else {
        this.splitProgress.set(next);
      }
    }, TICK_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  setHoveredObjective(id: string | null): void {
    this.hoveredObjectiveId.set(id);
  }

  /**
   * El arco del donut, en unidades de `stroke-dasharray` sobre una circunferencia de 2π·38.
   *
   * Se calcula porque la maqueta lo llevaba escrito a mano (`"136 238"`), así que el donut
   * enseñaba el mismo 57/43 en todas las partidas.
   */
  protected donutArc(pct: number): string {
    const circumference = 2 * Math.PI * 38;
    const arc = (circumference * pct) / 100;
    return `${arc.toFixed(1)} ${circumference.toFixed(1)}`;
  }

  /** Dónde arranca el segundo arco: justo donde acabó el primero. */
  protected donutOffset(previousPct: number): string {
    const circumference = 2 * Math.PI * 38;
    return (-(circumference * previousPct) / 100).toFixed(1);
  }

  setEconomyPhase(phase: 'final' | 'at14'): void {
    this.economyPhase.set(phase);
  }

  /**
   * El carrusel gira solo, y por eso se para al pasar por encima: leer una cifra que se va a ir
   * sola en cinco segundos es peor que no tenerla. Las flechas y los puntos lo mueven a mano.
   */
  goSplit(index: number): void {
    const total = this.teamSplits().length;
    if (total === 0) return;
    this.activeSplit.set(((index % total) + total) % total);
    this.splitProgress.set(0);
  }

  nextSplit(): void {
    this.goSplit(this.activeSplit() + 1);
  }

  prevSplit(): void {
    this.goSplit(this.activeSplit() - 1);
  }

  pauseSplits(): void {
    this.splitPaused.set(true);
  }

  resumeSplits(): void {
    this.splitPaused.set(false);
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
