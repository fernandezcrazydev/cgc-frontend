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
import { MatchRoom, MatchStore } from '../../../core/match-store';
import { Match, MatchHistoryStore, MatchParticipant, nemesisOf } from '../../../core/matches';
import { LeaguesStore } from '../../../core/leagues';
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

interface SlotView {
  filled: boolean;
  initials: string;
  name?: string;
  riotId?: string;
}

interface MvpHighlight {
  name: string;
  initials: string;
  champion: string;
  kda: string;
  quote: string;
  riotId: string;
}

interface NemesisHighlight {
  name: string;
  initials: string;
  record: string;
  callout: string;
  riotId: string;
  myWins: number;
  myLosses: number;
  myWinrate: number;
}

export interface GroupHighlightItem {
  id: 'damage' | 'streak' | 'duel';
  label: string;
  value: string;
  sublabel: string;
  matchId?: string;
  riotId?: string;
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

function matchParticipants(m: Match): MatchParticipant[] {
  return [...m.blueTeam.participants, ...m.redTeam.participants];
}

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
  private readonly matchStore = inject(MatchStore);
  private readonly matchHistoryStore = inject(MatchHistoryStore);
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

  /** Primera sala activa del grupo protagonista (con mock realista para LAN Challenger). */
  readonly activeRoom = computed<MatchRoom | null>(() => {
    const g = this.activeGroup();
    if (!g) return null;
    const rooms = this.matchStore.activeOf(g.id);
    if (rooms.length > 0) return rooms[0];

    // Mock realista de sala activa para LAN y Escuadrón Prueba
    const nameLower = (g.name || '').toLowerCase().trim();
    const isMockTarget =
      g.id === 'grp-1' ||
      nameLower === 'lan' ||
      nameLower.includes('lan') ||
      nameLower.includes('escuadron') ||
      nameLower.includes('escuadrón') ||
      nameLower.includes('prueba');

    if (isMockTarget) {
      return {
        id: `room-${g.id}-5v5`,
        groupId: g.id,
        name: `Custom 5v5 Equilibrada · ${g.name}`,
        capacity: 10,
        createdAt: '2026-09-01T18:00:00Z',
        seats: [
          { userId: 'u-1', name: 'daxlup#EUW', role: 'CAPTAIN' },
          { userId: 'u-2', name: 'EduUC#EUW', role: 'MEMBER' },
          { userId: 'u-3', name: 'Nightstalker#EUW', role: 'MEMBER' },
          { userId: 'u-4', name: 'FakerClone#EUW', role: 'MEMBER' },
          { userId: 'u-5', name: 'Chronoshift#EUW', role: 'MEMBER' },
          { userId: 'u-6', name: 'ViperX#EUW', role: 'MEMBER' },
        ],
        draftStatus: 'WAITING_PLAYERS',
      } as unknown as MatchRoom;
    }

    return null;
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

  /** MVP de la última custom del grupo o global. */
  readonly lastMvp = computed<MvpHighlight | null>(() => {
    const g = this.activeGroup();
    const groupMatches = g ? this.matchHistoryStore.matchesByGroup(g.id) : [];
    const allMatches = groupMatches.length ? groupMatches : this.matchHistoryStore.allPersonalMatches();
    if (!allMatches.length) return null;

    const m = allMatches[0];
    const participants = matchParticipants(m);
    const mvp = participants.find((p) => p.id === m.mvpParticipantId) ?? participants[0];
    if (!mvp) return null;

    const rawName = cleanRiotName(mvp.riotId, 'MVP');
    const kills = mvp.stats.kills;
    const deaths = mvp.stats.deaths;
    const assists = mvp.stats.assists;

    const quotes = [
      'Remontada heroica en el minuto 28 con robo de dragón anciano.',
      'Control total del mapa y dominio indiscutible en fase de líneas.',
      'Impacto decisivo en peleas grupales asegurando la victoria.',
      'Actuación impecable liderando el daño total de la partida.',
    ];
    const quote = quotes[Math.abs(m.id.charCodeAt(0) ?? 0) % quotes.length];

    return {
      name: rawName,
      initials: rawName.substring(0, 2).toUpperCase(),
      champion: mvp.championName || 'Akali',
      kda: `${kills}/${deaths}/${assists} KDA (${mvp.role})`,
      quote,
      riotId: mvp.riotId || rawName,
    };
  });

  /** Highlights y récords semanales del grupo con acción interactiva. */
  readonly highlights = computed<GroupHighlightItem[]>(() => {
    const g = this.activeGroup();
    const groupMatches = g ? this.matchHistoryStore.matchesByGroup(g.id) : [];
    const allMatches = groupMatches.length ? groupMatches : this.matchHistoryStore.allPersonalMatches();
    const firstMatch = allMatches[0];

    // Buscar la mayor racha activa en la clasificación del grupo
    const rows = this.leaguesStore.rows();
    const topStreakRow = rows.length
      ? [...rows].filter((r) => r.streakType === 'WIN').sort((a, b) => b.streakCount - a.streakCount)[0]
      : null;

    const streakPlayer = topStreakRow ? cleanRiotName(topStreakRow.riotId, 'daxlup') : 'daxlup';
    const streakWins = topStreakRow ? topStreakRow.streakCount : 6;

    return [
      {
        id: 'damage',
        label: 'Mayor daño registrado',
        value: allMatches.length > 0 ? '54.2k dmg (daxlup)' : '52.1k dmg (daxlup)',
        sublabel: 'Partida récord de la semana',
        matchId: firstMatch?.id || 'match-1',
      },
      {
        id: 'streak',
        label: 'Racha récord del grupo',
        value: `${streakPlayer} · W${streakWins} victorias`,
        sublabel: 'Mejor racha activa',
      },
      {
        id: 'duel',
        label: 'Duelo más disputado',
        value: 'daxlup vs EduUC (8-7)',
        sublabel: '15 enfrentamientos directos',
        riotId: 'EduUC',
      },
    ];
  });

  /** Mayor Némesis del usuario para aumentar el pique competitivo. */
  readonly nemesisHighlight = computed<NemesisHighlight | null>(() => {
    const partners = this.matchHistoryStore.crossPartners();
    const nemesis = nemesisOf(partners);

    if (nemesis && nemesis.enemies.length > 0) {
      const name = cleanRiotName(nemesis.riotId, 'Rival');
      const total = nemesis.enemies.length;
      const wins = nemesis.enemies.filter((m) => m.match.userOutcome === 'win').length;
      const losses = total - wins;
      const wr = Math.round((wins / total) * 100);

      return {
        name,
        initials: name.substring(0, 2).toUpperCase(),
        record: `${wins}V - ${losses}D (${wr}% WR)`,
        callout: `Tu mayor rival en customs. Te ha ganado ${losses} de ${total} enfrentamientos.`,
        riotId: nemesis.riotId,
        myWins: wins,
        myLosses: losses,
        myWinrate: wr,
      };
    }

    // Fallback de demostración si aún no hay historial cruzado
    return {
      name: 'daxlup',
      initials: 'DA',
      record: '4V - 2D (67% WR)',
      callout: 'Tu mayor rival en customs. Tienes 4 victorias y 2 derrotas frente a él.',
      riotId: 'daxlup#EUW',
      myWins: 4,
      myLosses: 2,
      myWinrate: 67,
    };
  });

  /** Navega a crear/convocar partida en el grupo activo. */
  crearPartida(): void {
    const g = this.activeGroup() ?? this.groupsStore.groups()[0] ?? null;
    this.router.navigate(g ? ['/app', 'grupos', g.id, 'crear-partida'] : ['/app', 'grupos']);
  }

  /** Navega a una sala de espera en curso. */
  entrarSala(roomId: string): void {
    const g = this.activeGroup();
    if (!g) return;
    this.router.navigate(['/app', 'grupos', g.id, 'partidas', roomId]);
  }

  /** Navega al perfil de un jugador (MVP, etc.). */
  verPerfil(riotId: string): void {
    if (!riotId) return;
    this.router.navigate(['/app', 'perfil', encodeURIComponent(riotId)]);
  }

  /** Navega al cara a cara / versus contra el Némesis. */
  retarNemesis(riotId: string): void {
    this.router.navigate(['/app', 'versus', encodeURIComponent(riotId)]);
  }

  /** Navega según el highlight pulsado. */
  onHighlightClick(item: GroupHighlightItem): void {
    const g = this.activeGroup();
    if (item.id === 'damage') {
      if (item.matchId) {
        this.router.navigate(['/app', 'historial', item.matchId]);
      } else {
        this.router.navigate(['/app', 'historial']);
      }
    } else if (item.id === 'streak') {
      if (g) {
        this.router.navigate(['/app', 'grupos', g.id, 'ranking']);
      } else {
        this.router.navigate(['/app', 'grupos']);
      }
    } else if (item.id === 'duel') {
      const target = item.riotId || 'EduUC';
      this.router.navigate(['/app', 'versus', encodeURIComponent(target)]);
    }
  }
}
