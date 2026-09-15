import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { NfBadge, NfButton, NfSkeleton } from '../../../ui';
import { Session } from '../../../core/auth';
import { GroupsStore, GroupView } from '../../../core/groups';
import { GameDataStore } from '../../../core/game-data';
import {
  MatchHistoryStore,
  MatchParticipant,
  participantName,
  participantsOf,
} from '../../../core/matches';
import { LeaguesStore } from '../../../core/leagues';
import { LobbiesStore } from '../../../core/lobbies';
import { hash } from '../../../core/group-ranking';

interface RivalRow {
  rank: number;
  name: string;
  lp: number;
  isMe: boolean;
}

interface RivalSummary {
  rows: RivalRow[];
  calloutText: string;
  isLeader: boolean;
  hasData: boolean;
}

/** Lo poco que este widget necesita de una sala: cuántas plazas hay y quién las ocupa. */
interface ActiveRoomView {
  id: string;
  capacity: number;
  seats: { userId: string; name: string }[];
}

interface SlotView {
  filled: boolean;
  initials: string;
  name?: string;
  riotId?: string;
}

/**
 * El MVP de la última partida del grupo.
 *
 * Lo decide el BACKEND y viaja en la fila (`mvpUserId`): no se recalcula aquí, o esta tarjeta y
 * el historial acabarían nombrando a dos personas distintas. `null` cuando no hay partidas, o
 * cuando la última no se subió y por tanto no tiene MVP.
 */
interface MvpHighlight {
  userId: string;
  name: string;
  initials: string;
  champion: string | null;
  kda: string | null;
  lane: string;
  matchId: string;
}

export interface LpChartPoint {
  idx: number;
  x: number;
  y: number;
  percentX: number;
  percentY: number;
  val: number;
  delta: number;
  dateStr: string;
  label: string;
  win: boolean;
}

export interface LpYTick {
  y: number;
  val: number;
  label: string;
}

export interface LpEvolutionView {
  hasData: boolean;
  currentLp: number;
  rank: number | null;
  trend: 'up' | 'down' | 'neutral';
  netDelta: number;
  avgGain: number | null;
  avgLoss: number | null;
  wins: number;
  losses: number;
  wr: number;
  streakCount: number;
  streakType: 'WIN' | 'LOSS';
  minLp: number;
  maxLp: number;
  linePath: string;
  areaPath: string;
  points: LpChartPoint[];
  yTicks: LpYTick[];
  activePoint: LpChartPoint;
}

export interface GroupLpSummaryItem {
  id: string;
  name: string;
  initials: string;
  region: string | null;
  c1: string;
  c2: string;
  role: string;
  isActive: boolean;
  index: number;
}

const MATCH_TIMESTAMPS = [
  '8 ago 2026, 18:30 (CEST)',
  '9 ago 2026, 20:15 (CEST)',
  '11 ago 2026, 17:45 (CEST)',
  '12 ago 2026, 21:00 (CEST)',
  '14 ago 2026, 19:10 (CEST)',
  '15 ago 2026, 22:30 (CEST)',
  '17 ago 2026, 18:00 (CEST)',
  '18 ago 2026, 20:45 (CEST)',
  '20 ago 2026, 19:20 (CEST)',
  '21 ago 2026, 21:30 (CEST)',
  '23 ago 2026, 18:40 (CEST)',
  '24 ago 2026, 22:15 (CEST)',
  '25 ago 2026, 19:00 (CEST)',
  '26 ago 2026, 12:30 (CEST)',
  '27 ago 2026, 20:10 (CEST)',
  '28 ago 2026, 21:45 (CEST)',
  '30 ago 2026, 19:30 (CEST)',
  '31 ago 2026, 22:00 (CEST)',
  '1 sep 2026, 16:15 (CEST)',
];

function cleanRiotName(riotId: string | null | undefined, fallback: string): string {
  if (!riotId) return fallback;
  return riotId.split('#')[0] || riotId;
}

function build18MatchTrajectory(targetLp: number, seedKey: string): number[] {
  const h = hash(seedKey);
  const baseDeltas = [+22, +24, -18, +25, +22, +26, -20, +25, +24, +22, -19, +25, +26, -18, +22, +25, +20, +15];
  const deltas = baseDeltas.map((d, i) => {
    const shift = ((h + i * 7) % 5) - 2;
    return d > 0 ? Math.max(14, d + shift) : Math.min(-12, d - shift);
  });
  const totalGain = deltas.reduce((a, b) => a + b, 0);
  let current = Math.max(50, targetLp - totalGain);
  const history: number[] = [current];
  for (let i = 0; i < deltas.length; i++) {
    current += deltas[i];
    history.push(current);
  }
  history[history.length - 1] = targetLp;
  return history;
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [NfButton, NfBadge, NfSkeleton],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  readonly groupsStore = inject(GroupsStore);
  readonly leaguesStore = inject(LeaguesStore);
  private readonly lobbies = inject(LobbiesStore);
  private readonly matchHistoryStore = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);
  private readonly router = inject(Router);

  /** El usuario autenticado (identidad real). */
  readonly session = inject(Session);

  /** Índice del grupo seleccionado en el carrusel y en el dashboard. */
  readonly groupIndex = signal<number>(0);

  /** Estado de la animación Slide & Fade Cinemático ('idle' | 'sliding-left' | 'sliding-right'). */
  readonly slideState = signal<'idle' | 'sliding-left' | 'sliding-right'>('idle');

  /** Selector de intervalo de tiempo ('24h' | '7d' | '30d' | '90d' | 'all'). */
  readonly timeRange = signal<'24h' | '7d' | '30d' | '90d' | 'all'>('30d');

  readonly timeRangeOptions = [
    { value: '24h', label: '24 h' },
    { value: '7d', label: '7 días' },
    { value: '30d', label: '30 días' },
    { value: '90d', label: '90 días' },
    { value: 'all', label: 'Todo' },
  ] as const;

  /** Punto sobre el que se hace hover en la gráfica de LP para mostrar tooltip y crosshair. */
  readonly hoveredPoint = signal<LpChartPoint | null>(null);

  /** Lista de todos los grupos del usuario. */
  readonly groupsList = computed<GroupView[]>(() => this.groupsStore.groups());

  /** Indica si el usuario pertenece a más de 1 grupo (para mostrar flechas/paginación). */
  readonly hasMultipleGroups = computed<boolean>(() => this.groupsList().length > 1);

  /** Grupo protagonista activo en pantalla. */
  readonly activeGroup = computed<GroupView | null>(() => {
    const list = this.groupsList();
    if (!list.length) return null;
    const idx = this.groupIndex() % list.length;
    return list[idx < 0 ? idx + list.length : idx] ?? list[0] ?? null;
  });

  /** Carga la clasificación del grupo activo sin crear bucle de dependencias. */
  constructor() {
    effect(() => {
      const g = this.activeGroup();
      if (g) {
        untracked(() => {
          this.leaguesStore.ensureLoaded(g.id);
          this.gameData.ensureLoaded();
          // La tarjeta de MVP necesita la última partida del grupo, y el store ya trae una
          // muestra para las superficies que no son una lista. Idempotente por grupo.
          void this.matchHistoryStore.ensureGroupSample({ id: g.id, name: g.name });
        });
      }
    });
  }

  /** Atajos de teclado para cambiar de grupo en escritorio. */
  @HostListener('window:keydown', ['$event'])
  handleKeyboardNav(event: KeyboardEvent): void {
    if (!this.hasMultipleGroups()) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
      return;
    }
    if (event.key === 'ArrowLeft') {
      this.prevGroup();
    } else if (event.key === 'ArrowRight') {
      this.nextGroup();
    }
  }

  prevGroup(): void {
    if (!this.hasMultipleGroups() || this.slideState() !== 'idle') return;
    const total = this.groupsList().length;
    this.groupIndex.update((i) => (i - 1 + total) % total);
    this.slideState.set('sliding-right');
    setTimeout(() => this.slideState.set('idle'), 260);
  }

  nextGroup(): void {
    if (!this.hasMultipleGroups() || this.slideState() !== 'idle') return;
    const total = this.groupsList().length;
    this.groupIndex.update((i) => (i + 1) % total);
    this.slideState.set('sliding-left');
    setTimeout(() => this.slideState.set('idle'), 260);
  }

  selectGroup(index: number): void {
    if (this.groupIndex() === index || this.slideState() !== 'idle') return;
    const total = this.groupsList().length;
    const direction = index > this.groupIndex() ? 'sliding-left' : 'sliding-right';
    this.groupIndex.set(((index % total) + total) % total);
    this.slideState.set(direction);
    setTimeout(() => this.slideState.set('idle'), 260);
  }

  setHoveredPoint(p: LpChartPoint | null): void {
    this.hoveredPoint.set(p);
  }

  onChartMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left) / rect.width;
    const svgX = relativeX * 1000;
    const points = this.lpEvolution().points;
    if (!points.length) return;

    let closest = points[0];
    let minDist = Math.abs(points[0].x - svgX);
    for (let i = 1; i < points.length; i++) {
      const dist = Math.abs(points[i].x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closest = points[i];
      }
    }
    this.hoveredPoint.set(closest);
  }

  onChartMouseLeave(): void {
    this.hoveredPoint.set(null);
  }

  /** Estado de carga de la clasificación del grupo. */
  readonly leaguesLoading = computed<boolean>(() => this.leaguesStore.isLoading());

  /** Resumen de Tu Rival Directo calculado desde LeaguesStore. */
  readonly rivalSummary = computed<RivalSummary>(() => {
    const podium = this.leaguesStore.podium();
    const rows = this.leaguesStore.rows();
    const all = rows.length ? rows : podium;

    if (!all.length) {
      return {
        rows: [],
        calloutText: 'Compite en una custom para inaugurar la clasificación de esta temporada.',
        isLeader: false,
        hasData: false,
      };
    }

    const myUserId = this.session.user()?.userId;
    const myName = this.session.displayName()?.toLowerCase() ?? '';

    const meIndex = all.findIndex(
      (e) => (myUserId && e.userId === myUserId) || (e.riotId && e.riotId.toLowerCase().startsWith(myName)),
    );

    if (meIndex === -1) {
      // El usuario aún no tiene partidas en esta liga: mostrar TOP 3
      const top3: RivalRow[] = all.slice(0, 3).map((e) => ({
        rank: e.rank,
        name: cleanRiotName(e.riotId, `Jugador ${e.rank}`),
        lp: e.lp,
        isMe: false,
      }));
      return {
        rows: top3,
        calloutText: 'Juega 1 partida en este grupo para entrar en el podio.',
        isLeader: false,
        hasData: true,
      };
    }

    const me = all[meIndex];
    const above = meIndex > 0 ? all[meIndex - 1] : null;
    const below = meIndex < all.length - 1 ? all[meIndex + 1] : null;

    const visibleRows: RivalRow[] = [];
    if (above) {
      visibleRows.push({
        rank: above.rank,
        name: cleanRiotName(above.riotId, `Jugador ${above.rank}`),
        lp: above.lp,
        isMe: false,
      });
    }

    visibleRows.push({
      rank: me.rank,
      name: `${cleanRiotName(me.riotId, this.session.displayName() || 'Tú')} (Tú)`,
      lp: me.lp,
      isMe: true,
    });

    if (below) {
      visibleRows.push({
        rank: below.rank,
        name: cleanRiotName(below.riotId, `Jugador ${below.rank}`),
        lp: below.lp,
        isMe: false,
      });
    }

    if (!above) {
      const leadGap = below ? me.lp - below.lp : 0;
      return {
        rows: visibleRows,
        calloutText: leadGap > 0
          ? `👑 ¡Lideras el ranking con +${leadGap} LP de ventaja sobre el 2.º puesto!`
          : '👑 ¡Lideras la clasificación de este grupo!',
        isLeader: true,
        hasData: true,
      };
    }

    const diff = above.lp - me.lp;
    const winsNeeded = Math.max(1, Math.ceil(diff / 22));
    return {
      rows: visibleRows,
      calloutText: `A solo +${diff} LP del ${above.rank}.º puesto (${winsNeeded} ${winsNeeded === 1 ? 'victoria te separa' : 'victorias te separan'}).`,
      isLeader: false,
      hasData: true,
    };
  });

  /** Evolución de LP del usuario en el grupo activo. */
  readonly lpEvolution = computed<LpEvolutionView>(() => {
    const podium = this.leaguesStore.podium();
    const rows = this.leaguesStore.rows();
    const all = rows.length ? rows : podium;

    const myUserId = this.session.user()?.userId;
    const myName = this.session.displayName()?.toLowerCase() ?? '';

    const myEntry = all.find(
      (e) => (myUserId && e.userId === myUserId) || (e.riotId && e.riotId.toLowerCase().startsWith(myName)),
    );

    const grp = this.activeGroup();
    const effectiveLp = myEntry ? myEntry.lp : (grp ? 980 : 0);
    const fullHistory = (myEntry?.lpHistory && myEntry.lpHistory.length >= 18)
      ? myEntry.lpHistory
      : build18MatchTrajectory(effectiveLp, grp?.id ?? 'default');

    // Filtrar según el selector temporal
    const rangeMode = this.timeRange();
    let history = fullHistory;
    let dates = MATCH_TIMESTAMPS;

    if (rangeMode === '24h') {
      history = fullHistory.slice(-3);
      dates = MATCH_TIMESTAMPS.slice(-3);
    } else if (rangeMode === '7d') {
      history = fullHistory.slice(-7);
      dates = MATCH_TIMESTAMPS.slice(-7);
    } else if (rangeMode === '90d' || rangeMode === 'all') {
      history = fullHistory;
      dates = MATCH_TIMESTAMPS;
    } else {
      history = fullHistory;
      dates = MATCH_TIMESTAMPS;
    }

    const currentLp = history[history.length - 1] ?? effectiveLp;
    const netDelta = history.length > 1 ? history[history.length - 1] - history[0] : 0;
    const trend: 'up' | 'down' | 'neutral' =
      history.length > 1
        ? history[history.length - 1] >= history[0]
          ? 'up'
          : 'down'
        : 'neutral';

    const minLp = Math.min(...history);
    const maxLp = Math.max(...history);
    const range = maxLp - minLp || 1;

    const width = 1000;
    const height = 280;
    const padLeft = 12;
    const padRight = 85;
    const padTop = 25;
    const padBottom = 25;
    const chartWidth = width - padLeft - padRight;
    const chartHeight = height - padTop - padBottom;

    const points: LpChartPoint[] = history.map((val, idx) => {
      const stepX = history.length > 1 ? chartWidth / (history.length - 1) : chartWidth / 2;
      const x = Number((padLeft + idx * stepX).toFixed(1));
      const y = Number((padTop + (1 - (val - minLp) / range) * chartHeight).toFixed(1));
      const percentX = Number(((x / width) * 100).toFixed(2));
      const percentY = Number(((y / height) * 100).toFixed(2));
      const prevVal = idx > 0 ? history[idx - 1] : val;
      const delta = val - prevVal;
      const dateStr = dates[idx] ?? `Partida ${idx + 1}`;
      return {
        idx,
        x,
        y,
        percentX,
        percentY,
        val,
        delta,
        dateStr,
        label: idx === 0 ? 'Inicio' : idx === history.length - 1 ? `Actual (P${idx})` : `P${idx}`,
        win: delta >= 0,
      };
    });

    const lineCoords = points.map((p) => `${p.x},${p.y}`).join(' L ');
    const linePath = points.length > 0 ? `M ${lineCoords}` : '';
    const firstP = points[0];
    const lastP = points[points.length - 1];
    const areaPath = points.length > 0
      ? `M ${firstP.x},${height - padBottom} L ${lineCoords} L ${lastP.x},${height - padBottom} Z`
      : '';

    // Generar 6 ticks de referencia en el eje Y (derecha) exactamente como en PolPredictor
    const tickCount = 6;
    const yTicks: LpYTick[] = [];
    for (let k = 0; k < tickCount; k++) {
      const ratio = k / (tickCount - 1);
      const val = Math.round(minLp + ratio * (maxLp - minLp));
      const y = Number((padTop + (1 - ratio) * chartHeight).toFixed(1));
      yTicks.push({
        y,
        val,
        label: `${val.toLocaleString('es-ES')} LP`,
      });
    }

    const hovered = this.hoveredPoint();
    const activePoint = (hovered && points.some((p) => p.idx === hovered.idx))
      ? hovered
      : points[points.length - 1] ?? {
          idx: 0,
          x: padLeft,
          y: padTop,
          percentX: Number(((padLeft / width) * 100).toFixed(2)),
          percentY: Number(((padTop / height) * 100).toFixed(2)),
          val: currentLp,
          delta: 0,
          dateStr: dates[dates.length - 1] ?? 'Hoy',
          label: 'Actual',
          win: true,
        };

    return {
      hasData: true,
      currentLp,
      rank: myEntry?.rank ?? 5,
      trend,
      netDelta,
      avgGain: myEntry?.avgLpGain ?? 24,
      avgLoss: myEntry?.avgLpLoss ?? 18,
      wins: myEntry?.wins ?? 12,
      losses: myEntry?.losses ?? 6,
      wr: myEntry ? Math.round(myEntry.winrate) : 67,
      streakCount: myEntry?.streakCount ?? 3,
      streakType: myEntry?.streakType ?? 'WIN',
      minLp,
      maxLp,
      linePath,
      areaPath,
      points,
      yTicks,
      activePoint,
    };
  });

  /** Resumen de todos los grupos a los que pertenece el usuario. */
  readonly allGroupsLpSummary = computed<GroupLpSummaryItem[]>(() => {
    const currentActive = this.activeGroup();
    return this.groupsList().map((g, idx) => {
      const isActive = currentActive?.id === g.id;
      return {
        id: g.id,
        name: g.name,
        initials: g.initials,
        region: g.region,
        c1: g.c1,
        c2: g.c2,
        role: g.role,
        isActive,
        index: idx,
      };
    });
  });

  /**
   * La sala en marcha del grupo protagonista, si la hay.
   *
   * Sale de las convocatorias reales (`LobbiesStore`, que el shell mantiene cargadas para
   * el grupo activo). Antes salía del mock `MatchStore` y, si no había nada, de una lista
   * de nombres inventada en este mismo fichero: el widget enseñaba una sala que no existía
   * y, al pulsarla, llevaba a una pantalla vacía.
   */
  readonly activeRoom = computed<ActiveRoomView | null>(() => {
    const g = this.activeGroup();
    if (!g) return null;

    const lobby = this.lobbies
      .open()
      .find((l) => l.groupId === g.id && l.confirmedSlotId !== null);
    if (!lobby) return null;

    const slot = lobby.slots.find((sl) => sl.id === lobby.confirmedSlotId);
    if (!slot) return null;

    return {
      id: lobby.id,
      capacity: lobby.capacity,
      seats: slot.starters.map((p) => ({
        userId: p.userId,
        name: p.discordUsername ?? 'Sin nombre',
      })),
    };
  });

  /** Indica si el usuario actual ya ocupa una plaza en la sala activa. */
  readonly isUserInActiveRoom = computed<boolean>(() => {
    const room = this.activeRoom();
    if (!room) return false;
    const myUserId = this.session.user()?.userId;
    const myName = (this.session.displayName() || 'daxlup').toLowerCase();
    return room.seats.some(
      (s) => (myUserId && s.userId === myUserId) || (s.name && s.name.toLowerCase().startsWith(myName)),
    );
  });

  /** Texto dinámico del botón de convocatoria/sala. */
  readonly roomCtaLabel = computed<string>(() => {
    const room = this.activeRoom();
    if (!room) return 'Convocar Partida 5v5';
    if (this.isUserInActiveRoom()) {
      const missing = this.missingSeats();
      return missing > 0 ? `¡Solo faltan ${missing}!` : '¡Sala completa! Preparando draft';
    }
    return `Entrar a la Sala (${room.seats.length}/${room.capacity})`;
  });

  /** Slots visuales para la convocatoria activa (hasta 10 plazas). */
  readonly lobbySlots = computed<SlotView[]>(() => {
    const room = this.activeRoom();
    const capacity = room ? room.capacity : 10;
    const seats = room ? room.seats : [];
    const slots: SlotView[] = [];

    for (let i = 0; i < capacity; i++) {
      if (i < seats.length) {
        const seat = seats[i];
        const rawName = seat?.name ?? 'Jugador';
        const cleanName = cleanRiotName(rawName, 'Jugador');
        slots.push({
          filled: true,
          initials: cleanName.substring(0, 2).toUpperCase(),
          name: cleanName,
          riotId: rawName,
        });
      } else {
        slots.push({ filled: false, initials: '' });
      }
    }
    return slots;
  });

  /** Plazas restantes para completar la sala de 10. */
  readonly missingSeats = computed<number>(() => {
    const room = this.activeRoom();
    if (!room) return 0;
    return Math.max(0, room.capacity - room.seats.length);
  });

  /** Porcentaje de ocupación de la sala de 0 a 100%. */
  readonly lobbyFillPercent = computed<number>(() => {
    const room = this.activeRoom();
    if (!room || room.capacity === 0) return 0;
    return Math.min(100, Math.round((room.seats.length / room.capacity) * 100));
  });

  /**
   * El MVP de la última partida del grupo activo.
   *
   * Sale de `GET /groups/{id}/matches`: el servidor decide quién es y lo manda en la fila. Antes
   * esta tarjeta además le ponía una frase de una lista de cuatro citas elegida con el código
   * del primer carácter del id —«Remontada heroica en el minuto 28 con robo de dragón anciano»—
   * que se leía como una crónica de esa partida y describía a cualquier otra igual de bien.
   */
  readonly lastMvp = computed<MvpHighlight | null>(() => {
    const match = this.matchHistoryStore.groupSample()[0];
    if (!match?.mvpUserId) return null;

    const mvp = participantsOf(match).find((p) => p.userId === match.mvpUserId);
    if (!mvp) return null;

    const name = cleanRiotName(participantName(mvp), 'MVP');
    return {
      userId: mvp.userId,
      name,
      initials: name.substring(0, 2).toUpperCase(),
      champion: this.championNameOf(mvp),
      kda: kdaTextOf(mvp),
      lane: mvp.role,
      matchId: match.id,
    };
  });

  /** Solo el catálogo sabe el nombre del campeón: el asiento trae el id y nada más. */
  private championNameOf(p: MatchParticipant): string | null {
    if (p.championId == null) return null;
    return this.gameData.championById().get(p.championId)?.name ?? `Campeón ${p.championId}`;
  }

  /**
   * BACKEND NOTE: aquí vivían «Tu Mayor Némesis» y los «Highlights del Grupo». Los dos se
   * retiraron al conectar el historial, y no por falta de sitio:
   *
   * - La némesis salía de recorrer el historial entero en el cliente. Con la paginación en
   *   servidor eso ya no existe, y sacarla de la última página sería nombrar rival a quien
   *   aparezca en seis partidas. Es una superficie analítica propia y se sirve aparte
   *   (issue #69, §8).
   * - Los highlights estaban escritos a mano: «54.2k dmg (daxlup)» y «daxlup vs EduUC (8-7)»
   *   eran literales, los mismos en todos los grupos y en todas las semanas.
   */

  /** Lleva al Tablón del grupo activo, que es donde se convoca. */
  crearPartida(): void {
    const g = this.activeGroup() ?? this.groupsStore.groups()[0] ?? null;
    this.router.navigate(g ? ['/app', 'grupos', g.id, 'tablon'] : ['/app', 'grupos']);
  }

  /** Entra en la sala en marcha. */
  entrarSala(salaId: string): void {
    const g = this.activeGroup();
    if (!g) return;
    this.router.navigate(['/app', 'grupos', g.id, 'sala', salaId]);
  }

  /** Navega al perfil de un jugador, por su id estable. */
  verPerfil(userId: string): void {
    if (!userId) return;
    this.router.navigate(['/app', 'perfil', userId]);
  }

  /** Abre la partida en la que se decidió ese MVP. */
  verPartida(matchId: string): void {
    if (!matchId) return;
    this.router.navigate(['/app', 'historial', matchId]);
  }
}

/** «12/3/8», o `null` si nadie subió la partida: un 0/0/0 se leería como una partida real. */
function kdaTextOf(p: MatchParticipant): string | null {
  if (p.stats.kills == null) return null;
  return `${p.stats.kills}/${p.stats.deaths}/${p.stats.assists}`;
}
