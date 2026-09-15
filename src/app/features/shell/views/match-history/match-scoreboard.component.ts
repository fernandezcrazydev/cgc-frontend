import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Lane, Match, MatchParticipant, TeamSummary } from '../../../../core/matches/models';
import {
  LANE_ORDER,
  computeMatchScores,
  csPerMin,
  damagePerGold,
  damageShare,
  formatKda,
  laneLabel,
  participantName,
  teamLabel,
  wonLane,
} from '../../../../core/matches/match-view';
import { GameDataStore, SummonerSpell } from '../../../../core/game-data';
import { ReactionsStore, ReactionTally } from '../../../../core/reactions';
import { playerReactionsFor } from '../../../../core/group-hub';
import { ToastService } from '../../../../core/toast';
import { NfAvatar, NfLaneIcon, NfSegmented, NfSegmentOption } from '../../../../ui';
import { formatCompact, formatNumber } from '../../../../shared/date-format';
import { Viewport } from '../../../../shared/viewport';

/**
 * El marcador de una partida: los diez, el ranking y los duelos de línea.
 *
 * ## Los dos equipos se recorren, no se escriben dos veces
 *
 * La versión anterior tenía un bloque «azul» y un bloque «rojo» copiados línea por línea, y esa
 * duplicación deja de sostenerse en cuanto un equipo puede **no tener color**: quién vistió de
 * azul lo decide la sala y puede no haberse decidido nunca. Lo que siempre existe es el hueco,
 * A o B, así que el orden y la identidad de los equipos salen de ahí y el color es solo pintura.
 *
 * ## Lo que ya no pinta
 *
 * Objetos, runas, hechizos y nivel de campeón: el backend no los sirve. Están guardados, pero
 * con nombres de campo sacados de la documentación del cliente de LoL que nadie ha visto en un
 * payload medido. Mientras tanto se pintaban con una tabla de reserva por línea que no describía
 * ninguna partida real: el jungla siempre con Smite azul, el soporte siempre con Protector.
 *
 * Y cuando la partida no está subida (`hasStats: false`) las tres pestañas lo dicen en vez de
 * enseñar ceros. Un `0/0/0` con 0 de daño se lee como una partida real en la que no pasó nada.
 */
@Component({
  selector: 'app-match-scoreboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'onDocumentClick($event)' },
  imports: [RouterLink, NfAvatar, NfLaneIcon, NfSegmented],
  styleUrl: './match-scoreboard.component.scss',
  templateUrl: './match-scoreboard.component.html',
})
export class MatchScoreboardComponent {
  readonly match = input.required<Match>();
  readonly tab = input<'overview' | 'charts' | 'lanes' | null>(null);
  readonly showTabs = input<boolean>(true);

  private readonly gameData = inject(GameDataStore);
  private readonly toasts = inject(ToastService);
  private readonly viewport = inject(Viewport);
  private readonly reactions = inject(ReactionsStore);

  private readonly internalTab = signal<'overview' | 'charts' | 'lanes'>('overview');
  readonly activeTab = computed(() => this.tab() ?? this.internalTab());

  readonly pickerFor = signal<string | null>(null);
  readonly peekFor = signal<string | null>(null);
  readonly quickEmojis = computed(() => this.reactions.mostUsed(this.reactionScope()));

  /** Vacío si la partida no está subida: una nota sobre un KDA que nadie exportó es un invento. */
  private readonly playerScores = computed(() => computeMatchScores(this.match()));

  constructor() {
    this.gameData.ensureLoaded();

    effect(() => {
      const match = this.match();
      const scope = this.reactionScope();
      for (const team of match.teams) {
        for (const p of team.participants) {
          this.reactions.seed(
            scope,
            match.id + ':' + p.userId,
            playerReactionsFor(match.id, p.userId),
          );
        }
      }
    });
  }

  setTab(tab: 'overview' | 'charts' | 'lanes'): void {
    this.internalTab.set(tab);
  }

  /**
   * Bajo qué grupo se reacciona.
   *
   * BACKEND NOTE: en el historial personal la fila no dice de qué grupo es —el DTO no trae
   * `groupId`—, así que las reacciones caen a un ámbito común. Son locales del navegador y no
   * viajan a ningún sitio (no hay tabla ni endpoint), así que el daño es que se mezclen entre
   * grupos; se arregla solo cuando la fila traiga su grupo (issue #69).
   */
  private reactionScope(): string {
    return this.match().groupId || 'group';
  }

  private targetOf(p: MatchParticipant): string {
    return this.match().id + ':' + p.userId;
  }

  protected allReactions(p: MatchParticipant): ReactionTally[] {
    return this.reactions.tally(this.reactionScope(), this.targetOf(p));
  }

  protected topReactions(p: MatchParticipant): ReactionTally[] {
    return this.allReactions(p).slice(0, 1);
  }

  protected toggleReaction(p: MatchParticipant, emoji: string, event?: Event): void {
    event?.stopPropagation();
    this.pickerFor.set(null);
    this.peekFor.set(null);
    this.reactions.toggle(this.reactionScope(), this.targetOf(p), emoji);
  }

  protected toggleReactionPicker(userId: string, event: Event): void {
    event.stopPropagation();
    this.pickerFor.update((curr) => (curr === userId ? null : userId));
  }

  protected clearPeek(): void {
    this.peekFor.set(null);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.pickerFor()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.m-player-row__reactions')) return;
    this.pickerFor.set(null);
  }

  /**
   * Los dos hechizos de invocador del asiento, ya resueltos a su icono.
   *
   * `null` —y no un par de huecos— si la partida no trae los ids o si el catálogo todavía no ha
   * cargado: un hechizo de reserva por línea describe una partida que no se jugó, que es
   * exactamente por lo que se borró la tabla de objetos que había aquí.
   *
   * Devuelve el par completo o nada: con un solo hechizo la columna queda descuadrada y no dice
   * más que sin ella.
   */
  protected spells(p: MatchParticipant): SummonerSpell[] | null {
    const { spell1Id, spell2Id } = p.stats;
    if (spell1Id == null || spell2Id == null) return null;
    const byId = this.gameData.summonerSpellById();
    const first = byId.get(spell1Id);
    const second = byId.get(spell2Id);
    return first && second ? [first, second] : null;
  }

  protected playerRankScore(p: MatchParticipant): string | null {
    return this.playerScores().get(p.userId)?.score ?? null;
  }

  protected playerRank(p: MatchParticipant): number {
    return this.playerScores().get(p.userId)?.rank ?? 10;
  }

  /**
   * Las tres etiquetas largas suman ~455px: en un móvil se repartían en tres filas y
   * dejaban el botón de compartir descolgado al final. Acortarlas cabe en una sola fila
   * sin perder de qué va cada pestaña, porque el contexto (la partida) ya está arriba.
   */
  readonly tabLabels = computed(() =>
    this.viewport.isMobile()
      ? { overview: 'Marcador', charts: 'Ranking', lanes: 'Líneas' }
      : {
          overview: 'Marcador 5v5',
          charts: 'Ranking de la partida',
          lanes: 'Duelos de línea (14 min)',
        },
  );

  /** Los dos equipos en orden de hueco, cada uno con su alineación ordenada por línea. */
  readonly teams = computed(() =>
    this.match().teams.map((t) => ({
      slot: t.slot,
      side: t.side,
      won: t.won,
      label: teamLabel(t),
      totalKills: t.totalKills,
      totalGold: t.totalGold,
      objectives: t.objectives ?? null,
      participants: [...t.participants].sort((a, b) => laneIndex(a.role) - laneIndex(b.role)),
      /** El equipo sin tocar, que es lo que necesitan las derivaciones por equipo. */
      raw: t,
    })),
  );

  readonly allPlayers = computed(() =>
    this.match().teams.flatMap((t) => t.participants),
  );

  /** El máximo real de la partida, o `null` si nadie trae la cifra: entonces no hay barra que pintar. */
  private readonly maxGold = computed(() => maxOf(this.allPlayers(), (p) => p.stats.gold));
  /** El daño máximo, para la barra del marcador, que siempre mide daño pase lo que pase arriba. */
  private readonly maxDamage = computed(() =>
    maxOf(this.allPlayers(), (p) => p.stats.damageToChampions),
  );
  /**
   * El máximo de la métrica ACTIVA. La barra ancha mide lo que ordena la lista, no siempre el
   * daño: con la lista ordenada por visión y las barras dibujando daño, la más larga no era la
   * primera y el orden parecía roto.
   */
  private readonly maxPrimary = computed(() =>
    maxOf(this.allPlayers(), (p) => primaryValue(this.metric(), p)),
  );

  /** Por qué se ordena el ranking. */
  readonly metric = signal<RankMetric>('damage');

  readonly metricOptions: readonly NfSegmentOption[] = [
    { value: 'damage', label: 'Daño' },
    { value: 'gold', label: 'Oro' },
    { value: 'efficiency', label: 'Daño por oro' },
    { value: 'tanked', label: 'Daño recibido' },
    { value: 'vision', label: 'Visión' },
    { value: 'cc', label: 'Control' },
  ];

  /**
   * Los diez ordenados por la métrica activa, **y solo los que traen las cifras**: una partida
   * sin subir da una lista vacía, y la pestaña lo explica en lugar de pintar diez ceros.
   *
   * «Daño por oro» está aquí porque es la única de las tres que no premia automáticamente al
   * tirador: el daño en bruto lo gana casi siempre quien más oro recibe, y esta separa «hizo
   * mucho daño» de «hizo mucho daño con lo que tenía».
   */
  readonly ranking = computed<RankRow[]>(() => {
    const metric = this.metric();
    const maxPrimary = this.maxPrimary();
    const maxGold = this.maxGold();

    return this.allPlayers()
      .filter((p) => hasAnyMetric(p))
      .map((player) => {
        const efficiency = damagePerGold(player.stats);
        return {
          player,
          damagePct: pct(primaryValue(metric, player), maxPrimary),
          goldPct: pct(player.stats.gold, maxGold),
          primary: primaryLabel(metric, player, efficiency),
          secondary: secondaryLabel(metric, player, efficiency),
          score: scoreOf(metric, player, efficiency),
        };
      })
      .sort((a, b) => b.score - a.score);
  });

  /** Lo que mide la barra ancha ahora mismo, para que la leyenda no mienta al cambiar de métrica. */
  readonly metricLegend = computed(() => {
    const labels: Record<RankMetric, string> = {
      damage: 'daño a campeones',
      gold: 'oro obtenido',
      efficiency: 'daño por cada 1.000 de oro',
      tanked: 'daño recibido',
      vision: 'puntuación de visión',
      cc: 'segundos de control aplicados',
    };
    return labels[this.metric()];
  });

  /**
   * Los cinco duelos, con su estimación de quién ganó la línea.
   *
   * Vacío si la partida no trae el oro del minuto 14 —porque nadie la subió, o porque terminó
   * antes de ese minuto—: sin ese dato la pestaña no responde a su propia pregunta.
   */
  readonly laneMatchups = computed(() => {
    const m = this.match();
    const hasGold = m.teams.some((t) => t.participants.some((p) => p.stats.goldAt14 != null));
    if (!hasGold) return [];

    return LANE_ORDER.map((role) => ({
      role,
      seats: m.teams
        .map((t) => t.participants.find((p) => p.role === role))
        .filter((p): p is MatchParticipant => !!p)
        .map((player) => ({
          player,
          wonLane: wonLane(m, player),
          goldAt14: player.stats.goldAt14 == null ? null : formatCompact(player.stats.goldAt14),
        })),
    })).filter((lane) => lane.seats.length > 0);
  });

  setMetric(metric: string): void {
    this.metric.set(metric as RankMetric);
  }

  championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  /** Solo el catálogo sabe el nombre: el asiento trae el id y nada más. */
  championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? `Campeón ${id}`;
  }

  playerName(p: MatchParticipant): string {
    return participantName(p);
  }

  isMvp(p: MatchParticipant): boolean {
    return p.userId === this.match().mvpUserId;
  }

  isAce(p: MatchParticipant): boolean {
    return p.userId === this.match().aceUserId;
  }

  /**
   * El reparto de daño se DERIVA de los cinco del equipo, y el backend no lo sirve por eso
   * mismo: un campo almacenado y este cálculo son el mismo concepto, y al convivir llegaron a
   * decir 37% en el marcador y 34% dos bloques más abajo.
   */
  damagePct(p: MatchParticipant, team: TeamSummary): number | null {
    return damageShare(p, team);
  }

  damageBarWidth(damage: number): number {
    return pct(damage, this.maxDamage());
  }

  laneLabel(lane: Lane): string {
    return laneLabel(lane);
  }

  /** Por `userId`, que es la identidad del asiento: la vista no compara nombres a mano. */
  isCurrentUser(p: MatchParticipant): boolean {
    return p.userId === this.match().userParticipant?.userId;
  }

  kdaRatio(p: MatchParticipant): string | null {
    return formatKda(p.stats);
  }

  /** «213 CS (6,1/m)», o solo los CS si la partida no trae duración con la que dividir. */
  csLabel(p: MatchParticipant): string | null {
    const cs = p.stats.cs;
    if (cs == null) return null;
    const perMin = csPerMin(p.stats, this.match().durationSeconds);
    return perMin == null ? `${cs} CS` : `${cs} CS (${perMin}/m)`;
  }

  formatGold(gold: number): string {
    return formatCompact(gold);
  }

  formatNumber(value: number): string {
    return formatNumber(value);
  }

  copyMatchLink(): void {
    const url = `${window.location.origin}/app/historial/${this.match().id}`;
    navigator.clipboard?.writeText(url);
    this.toasts.info('Enlace de la partida copiado al portapapeles');
  }
}

/**
 * Por qué se ordena el ranking.
 *
 * Las tres últimas existen para que `damageTaken`, `visionScore` y `timeCcingOthers` se vean en
 * alguna parte: llegan en el DTO desde que el historial es real y no los pintaba nadie. Van aquí
 * y no como tres columnas más del marcador porque la fila ya tiene ocho y estas tres solo
 * interesan cuando son la pregunta, no de fondo.
 */
type RankMetric = 'damage' | 'gold' | 'efficiency' | 'tanked' | 'vision' | 'cc';

interface RankRow {
  player: MatchParticipant;
  damagePct: number;
  goldPct: number;
  primary: string;
  secondary: string;
  score: number;
}

function laneIndex(lane: Lane): number {
  const i = LANE_ORDER.indexOf(lane);
  return i === -1 ? LANE_ORDER.length : i;
}

/** El máximo de la partida, o `null` si nadie trae esa cifra. */
function maxOf(
  players: readonly MatchParticipant[],
  pick: (p: MatchParticipant) => number | undefined,
): number | null {
  const values = players.map(pick).filter((v): v is number => v != null);
  return values.length === 0 ? null : Math.max(...values, 1);
}

/** Sin dato o sin máximo la barra mide 0: una barra vacía dice «no hay», una llena mentiría. */
function pct(value: number | undefined, max: number | null): number {
  if (value == null || max == null || max === 0) return 0;
  return (value / max) * 100;
}

/** ¿Trae este asiento alguna de las cifras que el ranking sabe ordenar? */
function hasAnyMetric(p: MatchParticipant): boolean {
  const s = p.stats;
  return (
    s.damageToChampions != null ||
    s.gold != null ||
    s.damageTaken != null ||
    s.visionScore != null ||
    s.timeCcingOthers != null
  );
}

/** La cifra que ordena Y que dibuja la barra ancha. `undefined` si este asiento no la trae. */
function primaryValue(metric: RankMetric, p: MatchParticipant): number | undefined {
  if (metric === 'gold') return p.stats.gold;
  if (metric === 'tanked') return p.stats.damageTaken;
  if (metric === 'vision') return p.stats.visionScore;
  if (metric === 'cc') return p.stats.timeCcingOthers;
  if (metric === 'efficiency') return damagePerGold(p.stats) ?? undefined;
  return p.stats.damageToChampions;
}

function scoreOf(metric: RankMetric, p: MatchParticipant, efficiency: number | null): number {
  if (metric === 'gold') return p.stats.gold ?? 0;
  if (metric === 'efficiency') return efficiency ?? 0;
  if (metric === 'tanked') return p.stats.damageTaken ?? 0;
  if (metric === 'vision') return p.stats.visionScore ?? 0;
  if (metric === 'cc') return p.stats.timeCcingOthers ?? 0;
  return p.stats.damageToChampions ?? 0;
}

/** La cifra grande es siempre la que ordena: si no, el orden parece arbitrario. */
function primaryLabel(metric: RankMetric, p: MatchParticipant, efficiency: number | null): string {
  if (metric === 'gold') return `${amount(p.stats.gold)} de oro`;
  if (metric === 'efficiency') {
    return efficiency == null ? 'Sin datos' : `${Math.round(efficiency)} por 1.000`;
  }
  if (metric === 'tanked') return `${amount(p.stats.damageTaken)} recibido`;
  if (metric === 'vision') return `${plain(p.stats.visionScore)} de visión`;
  // El control llega en segundos, y en segundos se lee: «18 s de control» dice cuánto tiempo
  // estuvo el rival sin poder jugar, que es la pregunta. Un índice normalizado no la responde.
  if (metric === 'cc') return `${plain(p.stats.timeCcingOthers)} s de control`;
  return `${amount(p.stats.damageToChampions)} de daño`;
}

function secondaryLabel(metric: RankMetric, p: MatchParticipant, efficiency: number | null): string {
  if (metric === 'gold') return `${amount(p.stats.damageToChampions)} de daño`;
  if (metric === 'efficiency') {
    return `${amount(p.stats.damageToChampions)} con ${amount(p.stats.gold)}`;
  }
  if (metric === 'tanked') return `${amount(p.stats.damageToChampions)} infligido`;
  if (metric === 'vision') return `${amount(p.stats.gold)} de oro`;
  if (metric === 'cc') return `${amount(p.stats.damageToChampions)} de daño`;
  return `${amount(p.stats.gold)} de oro`;
}

/** «—» y no «0»: lo que no se midió no es cero. */
function amount(value: number | undefined): string {
  return value == null ? '—' : formatCompact(value);
}

/** Igual, para las cifras que no se abrevian: visión y segundos de control son de dos dígitos. */
function plain(value: number | undefined): string {
  return value == null ? '—' : String(value);
}
