import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { Match, MatchParticipant, TeamSummary } from '../../../../core/matches/models';
import { GameDataStore } from '../../../../core/game-data';
import { NfAvatar, NfLaneIcon, NfSegmented } from '../../../../ui';
import { MatchScoreboardComponent } from '../match-history/match-scoreboard.component';
import { computeMatchScores, formatKda, itemBg, laneLabel } from '../../../../core/matches/match-view';
import { formatNumber } from '../../../../shared/date-format';

export interface ObjectiveRow {
  id: string;
  name: string;
  icon: string;
  blueScore: number;
  redScore: number;
  isDragons?: boolean;
}

export interface VisionSlide {
  id: string;
  title: string;
  subtitle: string;
  blueScore: number;
  redScore: number;
  bluePct: number;
}

export interface HeatPoint {
  id: string;
  x: number;
  y: number;
  size: number;
  color: 'crimson' | 'gold' | 'blue';
  phase: 'early' | 'late';
  radius?: number;
  intensity?: number;
}

export interface MapEventPin {
  id: string;
  x: number;
  y: number;
  type: 'kill' | 'death' | 'objective' | 'ward';
  icon: string;
  time: string;
  title: string;
  desc: string;
  phase: 'early' | 'late';
}

export interface VisionWard {
  id: string;
  team: 'blue' | 'red';
  type: 'yellow' | 'pink';
  x: number;
  y: number;
  placedBy: string;
  champ: string;
  placedAt: string;
  durationStr: string;
  locationName: string;
  deniedEnemyWards?: number;
}

export interface PlayerZoneBreakdown {
  mainLane: { name: string; minutes: number; pct: number };
  objectives: { name: string; minutes: number; pct: number };
  base: { name: string; minutes: number; pct: number };
  roam: { name: string; minutes: number; pct: number };
  diagnosisBadge: string;
  diagnosisText: string;
}

export interface HeatmapDataset {
  points: HeatPoint[];
  pins: MapEventPin[];
  pathD: string;
}

/**
 * BACKEND NOTE:
 * Para alimentar el mapa de calor táctico real, el scraper local (capturador LCU/live-client)
 * debe enviar en el payload de la partida la serie temporal de coordenadas:
 * timeline.frames[n].participantFrames[p].position { x: number, y: number } (normalizadas 0-100%).
 * Actualmente las coordenadas mostradas se generan de forma determinista como maqueta funcional.
 */
function generateHeatmapData(player: MatchParticipant | null): HeatmapDataset {
  const role = player?.role ?? 'MID';
  const isRed = player?.team === 'red';
  const tx = (x: number) => (isRed ? 100 - x : x);
  const ty = (y: number) => (isRed ? 100 - y : y);

  let rawPoints: Array<{ x: number; y: number; size: number; color: 'crimson' | 'gold' | 'blue'; phase: 'early' | 'late' }> = [];
  let rawPins: Array<{ type: 'kill' | 'death' | 'objective' | 'ward'; icon: string; x: number; y: number; time: string; title: string; desc: string; phase: 'early' | 'late' }> = [];
  let pathD = '';

  if (role === 'TOP') {
    rawPoints = [
      { x: 16, y: 72, size: 28, color: 'blue', phase: 'early' },
      { x: 18, y: 45, size: 34, color: 'blue', phase: 'early' },
      { x: 22, y: 24, size: 44, color: 'crimson', phase: 'early' },
      { x: 28, y: 22, size: 38, color: 'gold', phase: 'early' },
      { x: 34, y: 28, size: 48, color: 'gold', phase: 'late' },
      { x: 38, y: 18, size: 36, color: 'crimson', phase: 'late' },
      { x: 50, y: 50, size: 40, color: 'blue', phase: 'late' },
      { x: 66, y: 68, size: 38, color: 'crimson', phase: 'late' },
    ];
    rawPins = [
      { type: 'kill', icon: '⚔️', x: 23, y: 23, time: '05:42', title: 'Primera Sangre en Top', desc: 'Duelo 1v1 resuelto con ventaja de nivel', phase: 'early' },
      { type: 'death', icon: '💀', x: 29, y: 26, time: '11:15', title: 'Emboscada del jungla', desc: 'Gank coordinado con control de masas', phase: 'early' },
      { type: 'objective', icon: '👾', x: 33, y: 29, time: '16:30', title: 'Heraldo asegurado', desc: 'Prioridad de carril convertida en objetivo', phase: 'late' },
      { type: 'kill', icon: '⚔️', x: 66, y: 68, time: '23:50', title: 'Flanqueo con Teleport', desc: 'Aparición decisiva en la fosa del dragón', phase: 'late' },
    ];
    pathD = `M ${tx(14)} ${ty(86)} Q ${tx(16)} ${ty(50)} ${tx(22)} ${ty(24)} T ${tx(33)} ${ty(29)} T ${tx(50)} ${ty(50)} T ${tx(66)} ${ty(68)}`;
  } else if (role === 'JUNGLA') {
    rawPoints = [
      { x: 48, y: 74, size: 36, color: 'blue', phase: 'early' },
      { x: 44, y: 62, size: 34, color: 'blue', phase: 'early' },
      { x: 36, y: 64, size: 38, color: 'blue', phase: 'early' },
      { x: 38, y: 44, size: 42, color: 'gold', phase: 'early' },
      { x: 74, y: 78, size: 46, color: 'crimson', phase: 'early' },
      { x: 68, y: 70, size: 52, color: 'crimson', phase: 'late' },
      { x: 33, y: 29, size: 50, color: 'gold', phase: 'late' },
      { x: 50, y: 50, size: 38, color: 'blue', phase: 'late' },
    ];
    rawPins = [
      { type: 'kill', icon: '⚔️', x: 76, y: 79, time: '04:15', title: 'Gank exitoso en Bot', desc: 'Emboscada por el río con baja sobre el tirador rival', phase: 'early' },
      { type: 'objective', icon: '🐉', x: 68, y: 70, time: '12:30', title: 'Dragón Asegurado', desc: 'Smite certero ante disputa del jungla enemigo', phase: 'early' },
      { type: 'death', icon: '💀', x: 34, y: 31, time: '21:05', title: 'Disputa de Barón', desc: 'Caído en la fosa durante la lucha por la visión', phase: 'late' },
      { type: 'kill', icon: '⚔️', x: 50, y: 50, time: '27:40', title: 'Iniciación en Mid', desc: 'Caza clave en el carril central', phase: 'late' },
    ];
    pathD = `M ${tx(14)} ${ty(86)} L ${tx(48)} ${ty(74)} L ${tx(44)} ${ty(62)} L ${tx(36)} ${ty(64)} L ${tx(76)} ${ty(79)} L ${tx(68)} ${ty(70)} L ${tx(33)} ${ty(29)}`;
  } else if (role === 'MID') {
    rawPoints = [
      { x: 35, y: 65, size: 32, color: 'blue', phase: 'early' },
      { x: 48, y: 52, size: 52, color: 'crimson', phase: 'early' },
      { x: 55, y: 45, size: 46, color: 'gold', phase: 'early' },
      { x: 70, y: 72, size: 42, color: 'crimson', phase: 'late' },
      { x: 66, y: 68, size: 48, color: 'gold', phase: 'late' },
      { x: 34, y: 32, size: 44, color: 'gold', phase: 'late' },
      { x: 72, y: 30, size: 36, color: 'crimson', phase: 'late' },
    ];
    rawPins = [
      { type: 'kill', icon: '⚔️', x: 50, y: 50, time: '06:10', title: 'Solo Kill en Mid', desc: 'Daño explosivo tras esquivar habilidad rival', phase: 'early' },
      { type: 'kill', icon: '⚔️', x: 70, y: 72, time: '14:20', title: 'Roam letal a Bot', desc: 'Rotación con superioridad numérica', phase: 'early' },
      { type: 'death', icon: '💀', x: 44, y: 58, time: '18:40', title: 'Cazado en río', desc: 'Sorprendido sin destello en la rampa', phase: 'late' },
      { type: 'objective', icon: '🐉', x: 66, y: 68, time: '24:15', title: 'Control de Dragón', desc: 'Zoneo con habilidades de área', phase: 'late' },
    ];
    pathD = `M ${tx(14)} ${ty(86)} L ${tx(35)} ${ty(65)} L ${tx(50)} ${ty(50)} L ${tx(70)} ${ty(72)} L ${tx(66)} ${ty(68)} L ${tx(34)} ${ty(32)}`;
  } else if (role === 'ADC') {
    rawPoints = [
      { x: 80, y: 82, size: 48, color: 'blue', phase: 'early' },
      { x: 74, y: 76, size: 42, color: 'gold', phase: 'early' },
      { x: 68, y: 71, size: 50, color: 'crimson', phase: 'early' },
      { x: 52, y: 50, size: 46, color: 'gold', phase: 'late' },
      { x: 35, y: 32, size: 40, color: 'crimson', phase: 'late' },
      { x: 68, y: 34, size: 34, color: 'crimson', phase: 'late' },
    ];
    rawPins = [
      { type: 'kill', icon: '⚔️', x: 76, y: 78, time: '07:35', title: 'Doble baja en Bot', desc: 'Cálculo perfecto de rango y daño por segundo', phase: 'early' },
      { type: 'death', icon: '💀', x: 72, y: 75, time: '14:50', title: 'Dive bajo torre', desc: 'Emboscada de 4 rivales tras empujar oleada', phase: 'early' },
      { type: 'kill', icon: '⚔️', x: 68, y: 71, time: '21:10', title: 'Batalla en Dragón', desc: 'Posicionamiento seguro con daño continuado', phase: 'late' },
      { type: 'kill', icon: '⚔️', x: 52, y: 50, time: '28:30', title: 'Exterminio en Mid', desc: 'Triple kill decisiva para abrir la base rival', phase: 'late' },
    ];
    pathD = `M ${tx(14)} ${ty(86)} L ${tx(50)} ${ty(86)} L ${tx(80)} ${ty(82)} L ${tx(68)} ${ty(71)} L ${tx(52)} ${ty(50)} L ${tx(35)} ${ty(32)}`;
  } else {
    // SUPPORT
    rawPoints = [
      { x: 82, y: 84, size: 44, color: 'blue', phase: 'early' },
      { x: 76, y: 78, size: 40, color: 'blue', phase: 'early' },
      { x: 65, y: 65, size: 46, color: 'gold', phase: 'early' },
      { x: 68, y: 70, size: 52, color: 'crimson', phase: 'early' },
      { x: 50, y: 54, size: 40, color: 'blue', phase: 'late' },
      { x: 33, y: 34, size: 42, color: 'gold', phase: 'late' },
      { x: 44, y: 60, size: 36, color: 'gold', phase: 'late' },
    ];
    rawPins = [
      { type: 'ward', icon: '👁️', x: 65, y: 65, time: '03:40', title: 'Ward profundo en río', desc: 'Visión estratégica que detectó la ruta del jungla', phase: 'early' },
      { type: 'objective', icon: '🐉', x: 68, y: 70, time: '12:15', title: 'Bloqueo en Dragón', desc: 'Desenganche y CC que impidió la entrada rival', phase: 'early' },
      { type: 'death', icon: '💀', x: 60, y: 68, time: '17:30', title: 'Sacrificio defensivo', desc: 'Interceptación de gancho salvando al tirador', phase: 'late' },
      { type: 'kill', icon: '⚔️', x: 50, y: 50, time: '26:50', title: 'Engage maestro', desc: 'Control de masas en cadena a 3 enemigos', phase: 'late' },
    ];
    pathD = `M ${tx(14)} ${ty(86)} L ${tx(60)} ${ty(86)} L ${tx(82)} ${ty(84)} L ${tx(65)} ${ty(65)} L ${tx(68)} ${ty(70)} L ${tx(50)} ${ty(54)} L ${tx(33)} ${ty(34)}`;
  }

  const points: HeatPoint[] = rawPoints.map((p, idx) => ({
    id: `hp-${idx}`,
    x: tx(p.x),
    y: ty(p.y),
    size: p.size,
    color: p.color,
    phase: p.phase,
    radius: p.size * 1.35,
    intensity: p.color === 'crimson' ? 1.0 : p.color === 'gold' ? 0.75 : 0.45,
  }));

  const pins: MapEventPin[] = rawPins.map((p, idx) => ({
    id: `pin-${idx}`,
    x: tx(p.x),
    y: ty(p.y),
    type: p.type,
    icon: p.icon,
    time: p.time,
    title: p.title,
    desc: p.desc,
    phase: p.phase,
  }));

  return { points, pins, pathD };
}

@Component({
  selector: 'app-match-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfLaneIcon, NfSegmented, MatchScoreboardComponent],
  templateUrl: './match-detail.html',
  styleUrls: ['./match-detail.scss'],
})
export class MatchDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly routeId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
  );


  /** Partida cargada o fallback de demostración determinista */
  readonly match = computed<Match | undefined>(() => {
    const id = this.routeId();
    if (id) {
      const found = this.store.matchById(id);
      if (found) return found;
    }
    const all = this.store.allMatches();
    return all.length > 0 ? all[0] : undefined;
  });

  /** ¿Dispone de telemetría completa de scraper (B.7)? */
  readonly hasDetailedStats = computed(() => {
    const m = this.match();
    if (!m) return true;
    return m.source !== 'manual';
  });

  /** Participante del usuario si jugó esta partida (B.4) */
  readonly userParticipant = computed(() => this.match()?.userParticipant);
  readonly userParticipated = computed(() => Boolean(this.userParticipant()));

  // Pestaña activa del cuerpo analítico
  readonly activeMainTab = signal<string>('scoreboard');

  readonly mainTabOptions = computed(() => {
    const opts = [
      { label: 'Marcador 5v5', value: 'scoreboard' },
      { label: 'Ranking', value: 'ranking' },
      { label: 'Duelos de línea', value: 'duels' },
      { label: 'Mapa de calor y visión', value: 'heatmap' },
    ];
    if (this.userParticipated()) {
      opts.push({ label: 'Mi rendimiento', value: 'performance' });
    }
    return opts;
  });

  // Interacción bidireccional entre Grieta y Radar
  readonly hoveredObjectiveId = signal<string | null>(null);

  // Fase activa de Economía (Final vs 14min)
  readonly activeEconomyPhase = signal<'final' | '14min'>('final');

  // Slider de Visión (funcionamiento idéntico a trivia de hub)
  readonly activeVisionIndex = signal<number>(0);
  readonly visionPercent = signal<number>(0);
  readonly isVisionPaused = signal<boolean>(false);

  readonly visionSlides: VisionSlide[] = [
    { id: 'placed', title: 'Wards Colocados', subtitle: 'Visión ofensiva y defensiva desplegada', blueScore: 34, redScore: 21, bluePct: 62 },
    { id: 'killed', title: 'Wards Destruidos', subtitle: 'Denegación de visión al enemigo', blueScore: 12, redScore: 6, bluePct: 67 },
    { id: 'pinks', title: 'Wards de Control', subtitle: 'Pinks comprados y activos en puntos clave', blueScore: 8, redScore: 3, bluePct: 73 },
  ];

  readonly currentVisionSlide = computed(() => this.visionSlides[this.activeVisionIndex()]);

  // Objetivos de la Grieta
  readonly objectives: ObjectiveRow[] = [
    { id: 'dragons', name: 'Dragones', icon: '/assets/objectives/dragon.png', blueScore: 4, redScore: 1, isDragons: true },
    { id: 'grubs', name: 'Larvas', icon: '/assets/objectives/grubs.png', blueScore: 6, redScore: 0 },
    { id: 'herald', name: 'Heraldo', icon: '/assets/objectives/herald.png', blueScore: 1, redScore: 0 },
    { id: 'baron', name: 'Barón', icon: '/assets/objectives/baron.png', blueScore: 1, redScore: 0 },
    { id: 'towers', name: 'Torres', icon: '/assets/objectives/tower.png', blueScore: 8, redScore: 2 },
  ];

  // Iconos de los dragones elementales obtenidos en la partida
  readonly blueDragons = [
    { name: 'Fuego', icon: '/assets/objectives/dragon_fire.png' },
    { name: 'Agua', icon: '/assets/objectives/dragon_water.png' },
    { name: 'Hextech', icon: '/assets/objectives/dragon_hextech.png' },
    { name: 'Tierra', icon: '/assets/objectives/dragon_earth.png' },
  ];

  readonly redDragons = [
    { name: 'Aire', icon: '/assets/objectives/dragon_air.png' },
  ];

  // Datos MVP (Sylas / Mid / Ganador Azul) - Alternativa 2 con foto de perfil y nota destacada
  readonly mvp = {
    playerName: 'Adri_LoL',
    playerAvatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
    role: 'MID',
    sideLabel: 'Equipo azul',
    championId: 517,
    championName: 'Sylas',
    championLevel: 18,
    championIconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Sylas.png',
    kills: 14,
    deaths: 2,
    assists: 11,
    kdaRatio: '12.5',
    damage: '34.2k',
    damageShare: 32,
    score: 9.8,
  };

  // Datos ACE (Jinx / ADC / Derrotado Rojo) - Alternativa 2 con foto de perfil y nota destacada
  readonly ace = {
    playerName: 'VictorGod',
    playerAvatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
    role: 'ADC',
    sideLabel: 'Equipo rojo',
    championId: 222,
    championName: 'Jinx',
    championLevel: 16,
    championIconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Jinx.png',
    kills: 7,
    deaths: 3,
    assists: 6,
    kdaRatio: '4.3',
    damage: '28.1k',
    damageShare: 29,
    score: 8.6,
  };

  // Menciones de honor (Variante 4: Pilares de laboratorio con burbujas)
  readonly honors = [
    { id: 'damage', title: 'Cañón de daño', player: 'Adri_LoL', val: '34.2k', metric: 'daño', color: 'crimson', pct: 32 },
    { id: 'tank', title: 'Muro de hierro', player: 'EdgarP', val: '41.5k', metric: 'mitigado', color: 'cyan', pct: 40 },
    { id: 'vision', title: 'Ojo de águila', player: 'Sam_Sup', val: '68', metric: 'visión', color: 'emerald', pct: 48 },
    { id: 'farm', title: 'Rey del farm', player: 'DaniG', val: '9.4', metric: 'CS/min', color: 'indigo', pct: 85 },
  ];

  // Podio de daño a campeones (Tercera card de Piso 2: 25% ancho)
  readonly topDamagePodium = [
    { rank: 1, player: 'Adri_LoL', champ: 'Sylas', champIcon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Sylas.png', level: 18, damage: '34.2k', team: 'blue' as const, pct: 100 },
    { rank: 2, player: 'VictorGod', champ: 'Jinx', champIcon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Jinx.png', level: 16, damage: '28.1k', team: 'red' as const, pct: 82 },
    { rank: 3, player: 'DaniG', champ: 'Jhin', champIcon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Jhin.png', level: 16, damage: '26.1k', team: 'blue' as const, pct: 76 },
  ];

  // Radar pentagonal
  readonly radarMetrics = [
    { id: 'dragons', label: 'Dragones', blue: 80, red: 20 },
    { id: 'grubs', label: 'Larvas', blue: 100, red: 0 },
    { id: 'herald', label: 'Heraldo', blue: 100, red: 0 },
    { id: 'baron', label: 'Barón', blue: 100, red: 0 },
    { id: 'towers', label: 'Torres', blue: 80, red: 20 },
  ];

  // Ritmo de partida (Alineación horizontal continua)
  readonly pace = {
    duration: '31:24',
    killsPerMin: '2.0',
    totalKills: 62,
    fbPlayer: 'EduUC',
    fbChamp: 'Darius',
    fbChampIcon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Darius.png',
    fbTime: '02:41',
  };

  // Economía con donut circular
  readonly hoveredEconomySide = signal<'blue' | 'red' | null>(null);
  readonly economy = {
    blueTotal: '18.4k',
    redTotal: '14.1k',
    leadTotal: '+4.3k',
    blue14: '8.1k',
    red14: '7.2k',
    lead14: '+900g',
    bluePct: 57,
  };

  // Comentarios inmutables de la partida y reacciones
  readonly newCommentText = signal('');
  readonly activePickerCommentId = signal<string | null>(null);
  readonly quickEmojis = ['🔥', '👑', '💀', '🤡', '❤️', '👀', '👏', '🎯'];
  readonly comments = signal([
    {
      id: 'c-1',
      authorName: 'Adri_LoL',
      authorAvatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
      authorRole: 'MID',
      authorChampion: 'Sylas',
      authorSide: 'blue' as const,
      text: 'El robo de barón nos salvó la partida, pero nadie habla de los tres flashes que gastaron en la primera jugada.',
      createdAt: 'hace 2 días',
      reactions: [
        { emoji: '🔥', count: 6, mine: true },
        { emoji: '👑', count: 2, mine: false },
        { emoji: '💀', count: 1, mine: false },
      ],
    },
    {
      id: 'c-2',
      authorName: 'VictorGod',
      authorAvatarUrl: 'https://cdn.discordapp.com/embed/avatars/1.png',
      authorRole: 'ADC',
      authorChampion: 'Jinx',
      authorSide: 'red' as const,
      text: 'Buen try en la teamfight de dragón anciano. Nos faltó daño en el engage inicial pero fue partidaza.',
      createdAt: 'hace 2 días',
      reactions: [
        { emoji: '👏', count: 4, mine: false },
        { emoji: '🔥', count: 3, mine: false },
      ],
    },
  ]);

  // ==============================================================
  // MAPA TÁCTICO: CALOR TÉRMICO Y CONTROL DE VISIÓN
  // ==============================================================
  readonly mapAnalysisMode = signal<'presence' | 'vision'>('presence');
  readonly selectedHeatmapPlayerId = signal<string | null>(null);
  readonly heatmapPhase = signal<'all' | 'early' | 'late' | 'fights'>('all');
  readonly hoveredEventPin = signal<MapEventPin | null>(null);

  // Control y calor de visión
  readonly visionTeam = signal<'blue' | 'red' | 'both'>('blue');
  readonly showPinkWards = signal<boolean>(true);
  readonly showYellowWards = signal<boolean>(true);
  readonly hoveredWard = signal<VisionWard | null>(null);

  readonly heatCanvas = viewChild<ElementRef<HTMLCanvasElement>>('heatCanvas');

  readonly allParticipants = computed(() => {
    const m = this.match();
    if (!m) return [];
    return [...m.blueTeam.participants, ...m.redTeam.participants];
  });

  /** Jugador activo en el visor de mapa (tú si jugaste; si no, MVP) */
  readonly activeHeatmapPlayer = computed(() => {
    const all = this.allParticipants();
    if (all.length === 0) return null;
    const selId = this.selectedHeatmapPlayerId();
    if (selId) {
      const found = all.find((p) => p.id === selId);
      if (found) return found;
    }
    const user = this.match()?.userParticipant;
    if (user) return user;
    const mvpId = this.match()?.mvpParticipantId;
    if (mvpId) {
      const mvp = all.find((p) => p.id === mvpId);
      if (mvp) return mvp;
    }
    return all[0];
  });

  readonly heatmapData = computed(() => {
    return generateHeatmapData(this.activeHeatmapPlayer());
  });

  readonly filteredHeatPoints = computed(() => {
    const data = this.heatmapData();
    const phase = this.heatmapPhase();
    if (phase === 'all') return data.points;
    if (phase === 'early') return data.points.filter((p) => p.phase === 'early');
    if (phase === 'late') return data.points.filter((p) => p.phase === 'late');
    return [];
  });

  readonly filteredEventPins = computed(() => {
    const data = this.heatmapData();
    const phase = this.heatmapPhase();
    if (phase === 'all') return data.pins;
    if (phase === 'early') return data.pins.filter((p) => p.phase === 'early');
    if (phase === 'late') return data.pins.filter((p) => p.phase === 'late');
    if (phase === 'fights') return data.pins.filter((p) => p.type === 'kill' || p.type === 'death');
    return data.pins;
  });

  readonly playerZoneBreakdown = computed<PlayerZoneBreakdown>(() => {
    const p = this.activeHeatmapPlayer();
    const durationMin = Math.round((this.match()?.durationSeconds ?? 1884) / 60);
    const role = p?.role ?? 'MID';

    if (role === 'TOP') {
      const mainMin = Math.round(durationMin * 0.72);
      const objMin = Math.round(durationMin * 0.14);
      const baseMin = Math.round(durationMin * 0.10);
      const roamMin = Math.max(1, durationMin - mainMin - objMin - baseMin);
      return {
        mainLane: { name: 'Carril Superior (Isla Top)', minutes: mainMin, pct: 72 },
        objectives: { name: 'Fosa Heraldo y Río Norte', minutes: objMin, pct: 14 },
        base: { name: 'Base y Recarga de Compras', minutes: baseMin, pct: 10 },
        roam: { name: 'Rotación con Teleport a Bot', minutes: roamMin, pct: 4 },
        diagnosisBadge: 'Top Laner de Presión Continua',
        diagnosisText: 'Concentró el 72% de su presencia fijando al rival bajo su torre superior. Bajó al río en minuto 16 para asegurar el Heraldo decisivo.',
      };
    } else if (role === 'JUNGLA') {
      const mainMin = Math.round(durationMin * 0.40);
      const objMin = Math.round(durationMin * 0.25);
      const roamMin = Math.round(durationMin * 0.20);
      const baseMin = Math.max(1, durationMin - mainMin - objMin - roamMin);
      return {
        mainLane: { name: 'Jungla Aliada (Rutas de Camps)', minutes: mainMin, pct: 40 },
        objectives: { name: 'Fosas de Dragón y Barón', minutes: objMin, pct: 25 },
        base: { name: 'Invasiones a Jungla Enemiga', minutes: roamMin, pct: 20 },
        roam: { name: 'Presencia en Líneas / Ganks', minutes: baseMin, pct: 15 },
        diagnosisBadge: 'Jungla Proactivo de Objetivos',
        diagnosisText: 'Priorizó el control del río inferior y la fosa de dragones. Aseguró 4 dragones y ejecutó 3 ganks clave en el carril inferior.',
      };
    } else if (role === 'MID') {
      const mainMin = Math.round(durationMin * 0.58);
      const objMin = Math.round(durationMin * 0.20);
      const roamMin = Math.round(durationMin * 0.14);
      const baseMin = Math.max(1, durationMin - mainMin - objMin - roamMin);
      return {
        mainLane: { name: 'Carril Central (Zona Dominada)', minutes: mainMin, pct: 58 },
        objectives: { name: 'Rotaciones y Roams a Bot', minutes: objMin, pct: 20 },
        base: { name: 'Fosa de Dragón y Escaramuzas', minutes: roamMin, pct: 14 },
        roam: { name: 'Base y Compras', minutes: baseMin, pct: 8 },
        diagnosisBadge: 'Mid Laner de Alto Impacto / Roam',
        diagnosisText: 'No se limitó a farmear en el carril central: empleó el 20% de su tiempo en rotaciones letales hacia el río y carril inferior.',
      };
    } else if (role === 'ADC') {
      const mainMin = Math.round(durationMin * 0.65);
      const objMin = Math.round(durationMin * 0.22);
      const roamMin = Math.round(durationMin * 0.08);
      const baseMin = Math.max(1, durationMin - mainMin - objMin - roamMin);
      return {
        mainLane: { name: 'Carril Inferior (Fase de Líneas)', minutes: mainMin, pct: 65 },
        objectives: { name: 'Rotación a Mid (Mid/Late Game)', minutes: objMin, pct: 22 },
        base: { name: 'Disputa de Fosa de Dragón', minutes: roamMin, pct: 8 },
        roam: { name: 'Base y Reagrupación', minutes: baseMin, pct: 5 },
        diagnosisBadge: 'Tirador de Posicionamiento Seguro',
        diagnosisText: 'Fase de líneas disciplinada en bot hasta min 14. Rotó limpiamente a mid para tomar la primera torre y asediar con el equipo.',
      };
    } else {
      const mainMin = Math.round(durationMin * 0.48);
      const objMin = Math.round(durationMin * 0.28);
      const roamMin = Math.round(durationMin * 0.14);
      const baseMin = Math.max(1, durationMin - mainMin - objMin - roamMin);
      return {
        mainLane: { name: 'Carril Inferior (Protección ADC)', minutes: mainMin, pct: 48 },
        objectives: { name: 'Río y Fosas (Control de Visión)', minutes: objMin, pct: 28 },
        base: { name: 'Rotaciones a Mid y Escaramuzas', minutes: roamMin, pct: 14 },
        roam: { name: 'Base y Recarga de Wards', minutes: baseMin, pct: 10 },
        diagnosisBadge: 'Soporte Playmaker y Control de Mapa',
        diagnosisText: 'Excelente cobertura del mapa; invirtió el 28% de su partida en el río y fosas estableciendo zonas de visión seguras.',
      };
    }
  });

  readonly allVisionWards: VisionWard[] = [
    {
      id: 'vw-b1',
      team: 'blue',
      type: 'pink',
      x: 67,
      y: 68,
      placedBy: 'Sam_Sup',
      champ: 'Thresh',
      placedAt: '09:20',
      durationStr: '8 min 40 s (Destruido)',
      locationName: 'Entrada a la Fosa de Dragón',
      deniedEnemyWards: 2,
    },
    {
      id: 'vw-b2',
      team: 'blue',
      type: 'pink',
      x: 34,
      y: 31,
      placedBy: 'EdgarP',
      champ: 'Jarvan IV',
      placedAt: '18:15',
      durationStr: '5 min 12 s (Destruido)',
      locationName: 'Pixel Bush Río de Barón',
      deniedEnemyWards: 1,
    },
    {
      id: 'vw-b3',
      team: 'blue',
      type: 'pink',
      x: 48,
      y: 58,
      placedBy: 'Adri_LoL',
      champ: 'Sylas',
      placedAt: '12:40',
      durationStr: '6 min 30 s (Activo)',
      locationName: 'Arbusto rampa central inferior',
    },
    {
      id: 'vw-b4',
      team: 'blue',
      type: 'yellow',
      x: 74,
      y: 63,
      placedBy: 'Sam_Sup',
      champ: 'Thresh',
      placedAt: '07:15',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Tri-bush jungla roja en bot',
    },
    {
      id: 'vw-b5',
      team: 'blue',
      type: 'yellow',
      x: 69,
      y: 72,
      placedBy: 'EdgarP',
      champ: 'Jarvan IV',
      placedAt: '14:05',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Interior de la Fosa de Dragón',
    },
    {
      id: 'vw-b6',
      team: 'blue',
      type: 'yellow',
      x: 62,
      y: 62,
      placedBy: 'DaniG',
      champ: 'Jhin',
      placedAt: '05:40',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Arbusto de río carril inferior',
    },
    {
      id: 'vw-b7',
      team: 'blue',
      type: 'yellow',
      x: 58,
      y: 44,
      placedBy: 'Adri_LoL',
      champ: 'Sylas',
      placedAt: '10:20',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Campamento de Picuchillos rivales',
    },
    {
      id: 'vw-b8',
      team: 'blue',
      type: 'yellow',
      x: 28,
      y: 34,
      placedBy: 'EduUC',
      champ: 'Darius',
      placedAt: '04:30',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Arbusto de río carril superior',
    },
    {
      id: 'vw-b9',
      team: 'blue',
      type: 'yellow',
      x: 33,
      y: 28,
      placedBy: 'EduUC',
      champ: 'Darius',
      placedAt: '13:50',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Interior de la Fosa de Heraldo',
    },
    {
      id: 'vw-r1',
      team: 'red',
      type: 'pink',
      x: 71,
      y: 74,
      placedBy: 'Lulu_King',
      champ: 'Lulu',
      placedAt: '10:10',
      durationStr: '4 min 20 s (Destruido)',
      locationName: 'Muro posterior de la Fosa de Dragón',
      deniedEnemyWards: 1,
    },
    {
      id: 'vw-r2',
      team: 'red',
      type: 'pink',
      x: 32,
      y: 27,
      placedBy: 'Viego_Pro',
      champ: 'Viego',
      placedAt: '19:30',
      durationStr: '7 min 10 s (Destruido)',
      locationName: 'Fosa de Barón Nashor',
      deniedEnemyWards: 1,
    },
    {
      id: 'vw-r3',
      team: 'red',
      type: 'pink',
      x: 42,
      y: 66,
      placedBy: 'Zed_Main',
      champ: 'Zed',
      placedAt: '15:40',
      durationStr: '3 min 45 s (Destruido)',
      locationName: 'Cruce de Buff Azul rival',
    },
    {
      id: 'vw-r4',
      team: 'red',
      type: 'yellow',
      x: 78,
      y: 82,
      placedBy: 'VictorGod',
      champ: 'Jinx',
      placedAt: '06:10',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Arbusto de línea carril inferior',
    },
    {
      id: 'vw-r5',
      team: 'red',
      type: 'yellow',
      x: 64,
      y: 66,
      placedBy: 'Lulu_King',
      champ: 'Lulu',
      placedAt: '13:20',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Entrada de río a Dragón',
    },
    {
      id: 'vw-r6',
      team: 'red',
      type: 'yellow',
      x: 46,
      y: 45,
      placedBy: 'Zed_Main',
      champ: 'Zed',
      placedAt: '08:45',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Arbusto de río central superior',
    },
    {
      id: 'vw-r7',
      team: 'red',
      type: 'yellow',
      x: 36,
      y: 60,
      placedBy: 'Viego_Pro',
      champ: 'Viego',
      placedAt: '11:30',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Entrada al Blue de equipo azul',
    },
    {
      id: 'vw-r8',
      team: 'red',
      type: 'yellow',
      x: 22,
      y: 30,
      placedBy: 'Garen_God',
      champ: 'Garen',
      placedAt: '05:10',
      durationStr: '2 min 30 s (Expirado)',
      locationName: 'Arbusto carril superior',
    },
  ];

  readonly filteredVisionWards = computed(() => {
    const team = this.visionTeam();
    const showPinks = this.showPinkWards();
    const showYellows = this.showYellowWards();

    return this.allVisionWards.filter((w) => {
      if (team !== 'both' && w.team !== team) return false;
      if (w.type === 'pink' && !showPinks) return false;
      if (w.type === 'yellow' && !showYellows) return false;
      return true;
    });
  });

  readonly visionMetrics = computed(() => {
    const team = this.visionTeam();
    if (team === 'red') {
      return {
        teamName: 'Equipo Rojo',
        riverControl: 44,
        dragonControl: 20,
        invadeControl: 22,
        pinksPlaced: 6,
        yellowsPlaced: 21,
        wardsDenied: 9,
        mvpName: 'Lulu_King',
        mvpRole: 'SUPPORT',
        mvpScore: 54,
      };
    }
    return {
      teamName: team === 'both' ? 'Comparativa General' : 'Equipo Azul',
      riverControl: 68,
      dragonControl: 80,
      invadeControl: 35,
      pinksPlaced: 8,
      yellowsPlaced: 26,
      wardsDenied: 15,
      mvpName: 'Sam_Sup',
      mvpRole: 'SUPPORT',
      mvpScore: 68,
    };
  });


  // ==============================================================
  // MI RENDIMIENTO (B.4)
  // ==============================================================
  readonly userScoreItem = computed(() => {
    const m = this.match();
    const p = m?.userParticipant;
    if (!m || !p) return null;
    return computeMatchScores(m).get(p.id) ?? null;
  });

  readonly userOpponent = computed(() => {
    const m = this.match();
    const p = m?.userParticipant;
    if (!m || !p) return null;
    const oppTeam = p.team === 'blue' ? m.redTeam : m.blueTeam;
    return oppTeam.participants.find((op) => op.role === p.role) ?? null;
  });

  readonly userPerformanceMetrics = computed(() => {
    const m = this.match();
    const p = m?.userParticipant;
    if (!m || !p) return null;
    const stats = p.stats;
    const durationMin = Math.max(1, m.durationSeconds / 60);
    const team = p.team === 'blue' ? m.blueTeam : m.redTeam;

    const kdaNum = (stats.kills + stats.assists) / Math.max(1, stats.deaths);
    const avgKda = 3.4;
    const kdaDiff = +(kdaNum - avgKda).toFixed(1);

    const csPerMin = stats.csPerMin;
    const avgCsPerMin = 6.9;
    const csPerMinDiff = +(csPerMin - avgCsPerMin).toFixed(1);

    const dpm = Math.round(stats.totalDamageToChampions / durationMin);
    const avgDpm = 560;
    const dpmDiff = dpm - avgDpm;

    const damageShare = stats.damageSharePercentage || Math.round((stats.totalDamageToChampions / Math.max(1, team.totalDamage)) * 100);
    const goldShare = Math.round((stats.gold / Math.max(1, team.totalGold)) * 100);
    const kp = Math.round(((stats.kills + stats.assists) / Math.max(1, team.totalKills)) * 100);

    const opp = this.userOpponent();
    const goldDiff14 = opp ? (stats.goldAt14 ?? 0) - (opp.stats.goldAt14 ?? 0) : 0;
    const csDiff14 = opp ? (stats.csAt14 ?? 0) - (opp.stats.csAt14 ?? 0) : 0;

    return {
      kdaRatio: formatKda(stats),
      kdaNum: +kdaNum.toFixed(2),
      avgKda,
      kdaDiff,
      csPerMin,
      avgCsPerMin,
      csPerMinDiff,
      dpm,
      avgDpm,
      dpmDiff,
      damageShare,
      goldShare,
      kp,
      goldDiff14,
      csDiff14,
      wonLane: stats.wonLane ?? (goldDiff14 >= 0),
    };
  });

  constructor() {
    // Redibujo reactivo del canvas de calor y visión al conmutar pestañas, jugador o filtros
    effect(() => {
      this.activeMainTab();
      this.mapAnalysisMode();
      this.activeHeatmapPlayer();
      this.heatmapPhase();
      this.visionTeam();
      this.showPinkWards();
      this.showYellowWards();

      this.scheduleCanvasDraw();
    });

    // Si la pestaña actual era 'performance' pero el usuario no jugó, resetear a 'scoreboard'
    effect(() => {
      if (!this.userParticipated() && this.activeMainTab() === 'performance') {
        this.activeMainTab.set('scoreboard');
      }
    });

    // Temporizador suave del slider de visión (5000ms por diapositiva)
    const intervalMs = 100;
    const step = (intervalMs / 5000) * 100;
    const timer = setInterval(() => {
      if (this.isVisionPaused()) return;
      const nextP = this.visionPercent() + step;
      if (nextP >= 100) {
        this.visionPercent.set(0);
        this.activeVisionIndex.set((this.activeVisionIndex() + 1) % this.visionSlides.length);
      } else {
        this.visionPercent.set(nextP);
      }
    }, intervalMs);

    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  setHoveredObjective(id: string | null): void {
    this.hoveredObjectiveId.set(id);
  }

  setEconomyPhase(phase: 'final' | '14min'): void {
    this.activeEconomyPhase.set(phase);
  }

  pauseVision(): void {
    this.isVisionPaused.set(true);
  }

  resumeVision(): void {
    this.isVisionPaused.set(false);
  }

  prevVision(): void {
    const len = this.visionSlides.length;
    this.activeVisionIndex.set((this.activeVisionIndex() - 1 + len) % len);
    this.visionPercent.set(0);
  }

  nextVision(): void {
    const len = this.visionSlides.length;
    this.activeVisionIndex.set((this.activeVisionIndex() + 1) % len);
    this.visionPercent.set(0);
  }

  goVision(index: number): void {
    this.activeVisionIndex.set(index);
    this.visionPercent.set(0);
  }

  setMainTab(tab: string): void {
    this.activeMainTab.set(tab);
  }

  setHeatmapPlayer(id: string): void {
    this.selectedHeatmapPlayerId.set(id);
    this.scheduleCanvasDraw();
  }

  setHeatmapPhase(phase: 'all' | 'early' | 'late' | 'fights'): void {
    this.heatmapPhase.set(phase);
    this.scheduleCanvasDraw();
  }

  setHoveredPin(pin: MapEventPin | null): void {
    this.hoveredEventPin.set(pin);
  }

  setAnalysisMode(mode: 'presence' | 'vision'): void {
    this.mapAnalysisMode.set(mode);
    this.scheduleCanvasDraw();
  }

  setVisionTeam(team: 'blue' | 'red' | 'both'): void {
    this.visionTeam.set(team);
    this.scheduleCanvasDraw();
  }

  togglePinkWards(): void {
    this.showPinkWards.update((v) => !v);
    this.scheduleCanvasDraw();
  }

  toggleYellowWards(): void {
    this.showYellowWards.update((v) => !v);
    this.scheduleCanvasDraw();
  }

  setHoveredWard(ward: VisionWard | null): void {
    this.hoveredWard.set(ward);
  }

  scheduleCanvasDraw(): void {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const canvas = this.heatCanvas()?.nativeElement;
        if (canvas) {
          this.renderHeatmapCanvas(canvas);
        }
      });
    }
  }

  renderHeatmapCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.mapAnalysisMode() === 'presence') {
      this.drawPresenceHeatmap(ctx, w, h);
    } else {
      this.drawVisionHeatmap(ctx, w, h);
    }
  }

  private drawPresenceHeatmap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const pts = this.filteredHeatPoints();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const pt of pts) {
      const px = (pt.x / 100) * w;
      const py = (pt.y / 100) * h;
      const radius = (pt.size || 40) * 1.35;

      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, 'rgba(255, 30, 0, 0.90)');
      grad.addColorStop(0.22, 'rgba(255, 130, 0, 0.78)');
      grad.addColorStop(0.48, 'rgba(240, 230, 0, 0.58)');
      grad.addColorStop(0.70, 'rgba(0, 230, 110, 0.35)');
      grad.addColorStop(0.88, 'rgba(0, 130, 255, 0.16)');
      grad.addColorStop(1, 'rgba(0, 50, 200, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawVisionHeatmap(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const wards = this.filteredVisionWards();
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const wItem of wards) {
      const px = (wItem.x / 100) * w;
      const py = (wItem.y / 100) * h;

      if (wItem.type === 'pink') {
        const radius = 62;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, 'rgba(232, 121, 249, 0.92)');
        grad.addColorStop(0.35, 'rgba(192, 38, 211, 0.65)');
        grad.addColorStop(0.70, 'rgba(126, 34, 206, 0.28)');
        grad.addColorStop(1, 'rgba(88, 28, 135, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const radius = 50;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        if (wItem.team === 'blue') {
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.88)');
          grad.addColorStop(0.38, 'rgba(59, 130, 246, 0.62)');
          grad.addColorStop(0.75, 'rgba(30, 64, 175, 0.24)');
          grad.addColorStop(1, 'rgba(30, 58, 138, 0)');
        } else {
          grad.addColorStop(0, 'rgba(251, 113, 133, 0.88)');
          grad.addColorStop(0.38, 'rgba(239, 68, 68, 0.62)');
          grad.addColorStop(0.75, 'rgba(159, 18, 57, 0.24)');
          grad.addColorStop(1, 'rgba(136, 19, 55, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  toggleReactionPicker(commentId: string): void {
    this.activePickerCommentId.update((curr) => (curr === commentId ? null : commentId));
  }

  toggleCommentReaction(commentId: string, emoji: string): void {
    this.comments.update((list) =>
      list.map((c) => {
        if (c.id !== commentId) return c;
        const exists = c.reactions.find((r) => r.emoji === emoji);
        if (exists) {
          const nextMine = !exists.mine;
          const nextCount = nextMine ? exists.count + 1 : exists.count - 1;
          const updatedReactions = c.reactions
            .map((r) => (r.emoji === emoji ? { ...r, count: nextCount, mine: nextMine } : r))
            .filter((r) => r.count > 0);
          return { ...c, reactions: updatedReactions };
        } else {
          return { ...c, reactions: [...c.reactions, { emoji, count: 1, mine: true }] };
        }
      }),
    );
    this.activePickerCommentId.set(null);
  }

  postComment(): void {
    const text = this.newCommentText().trim();
    if (!text || text.length > 300) return;
    const newComment = {
      id: `c-${Date.now()}`,
      authorName: 'EduUC',
      authorAvatarUrl: 'https://cdn.discordapp.com/embed/avatars/2.png',
      authorRole: 'TOP',
      authorChampion: 'Ornn',
      authorSide: 'blue' as const,
      text,
      createdAt: 'Ahora mismo',
      reactions: [],
    };
    this.comments.update((list) => [newComment, ...list]);
    this.newCommentText.set('');
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  formatGold(gold: number): string {
    return gold >= 1000 ? `${(gold / 1000).toFixed(1)}k` : `${gold}`;
  }

  formatNumber(val: number): string {
    return formatNumber(val);
  }

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? 'Campeón';
  }

  championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  spellIcon(id: number): string | null {
    return this.gameData.summonerSpellById().get(id)?.iconUrl ?? null;
  }

  runeIcon(id?: number): string | null {
    if (!id) return null;
    return this.gameData.perkById().get(id)?.iconUrl ?? null;
  }

  isCurrentUser(participantId: string): boolean {
    return this.match()?.userParticipant?.id === participantId;
  }
}
