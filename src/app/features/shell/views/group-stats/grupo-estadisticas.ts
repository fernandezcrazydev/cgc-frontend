import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  NfButton,
  NfCombobox,
  NfComboboxOption,
  NfModal,
  NfSegmentOption,
  NfSegmented,
  NfSkeleton,
} from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge, GroupsStore } from '../../../../core/groups';
import { GameDataStore } from '../../../../core/game-data';
import { medalBoardsFor, medalById } from '../../../../core/group-medals';
import {
  StatModality,
  StatScope,
  epicRecordsFor,
  goldenDuoFor,
  woodenDuoFor,
  groupModalitiesConfig,
  groupVisionFor,
  laneImpactFor,
  mapTelemetryFor,
  metagameFor,
  multikillsFor,
  statsFor,
} from '../../../../core/group-stats';
import { HallOfFameComponent } from './hall-of-fame.component';
import { MedalDetailComponent } from './medal-detail.component';
import { StatsGoldenDuoComponent } from './stats-golden-duo.component';
import { StatsLaneImpactComponent } from './stats-lane-impact.component';
import { StatsLeadersComponent } from './stats-leaders.component';
import { StatsMapTelemetryComponent } from './stats-map-telemetry.component';
import { StatsMetagameComponent } from './stats-metagame.component';
import { StatsMultikillsComponent } from './stats-multikills.component';
import { StatsRadarComponent } from './stats-radar.component';
import { StatsRecordsComponent } from './stats-records.component';
import { StatsVisionComponent } from './stats-vision.component';

/** Las dos pestañas de §5.5.5. La lista es a la vez el tipo y el validador. */
const STAT_TABS = ['rendimiento', 'medallas'] as const;
type StatTab = (typeof STAT_TABS)[number];

/**
 * Estadísticas del grupo (`Roadmap.md` §5.5.5): panel analítico con dos pestañas,
 * rendimiento competitivo y Hall of Fame.
 *
 * La vista orquesta y navega; cada bloque de la pantalla es un componente propio de
 * esta carpeta con su hoja de estilos. Dos cosas viven en la URL a propósito:
 *   - `?medalla=<id>` abre el detalle de una medalla.
 *   - `?jugador=<tag>` despliega la fila de alguien en la tabla de líderes.
 */
@Component({
  selector: 'app-grupo-estadisticas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    NfButton,
    NfCombobox,
    NfModal,
    NfSegmented,
    NfSkeleton,
    HallOfFameComponent,
    MedalDetailComponent,
    StatsGoldenDuoComponent,
    StatsLaneImpactComponent,
    StatsLeadersComponent,
    StatsMapTelemetryComponent,
    StatsMetagameComponent,
    StatsMultikillsComponent,
    StatsRadarComponent,
    StatsRecordsComponent,
    StatsVisionComponent,
  ],
  templateUrl: './grupo-estadisticas.html',
  styleUrl: './grupo-estadisticas.scss',
})
export class GrupoEstadisticas {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  readonly bridge = inject(GroupBridge);

  readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  /** Tag del jugador cuya fila está desplegada, sincronizado con `?jugador=`. */
  private readonly focusedTag = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('jugador'))),
    { initialValue: this.route.snapshot.queryParamMap.get('jugador') },
  );

  /** Medalla abierta, sincronizada con `?medalla=`. */
  private readonly focusedMedal = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('medalla'))),
    { initialValue: this.route.snapshot.queryParamMap.get('medalla') },
  );

  readonly group = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.groupStore.byId(id) ?? this.groupsStore.byId(id) ?? null;
  });

  /* ---- Control temporal y modalidad ---- */

  readonly modality = signal<StatModality>('COMPETITIVE');
  readonly seasonId = signal<string>('all');

  readonly modalities = computed(() => {
    const g = this.group();
    return g ? groupModalitiesConfig(g.id) : [];
  });

  readonly modalityOptions = computed<readonly NfSegmentOption[]>(() =>
    this.modalities().map((m) => ({
      value: m.modality,
      label: m.label,
      disabled: !m.played,
    })),
  );

  readonly activeModality = computed(() =>
    this.modalities().find((m) => m.modality === this.modality()) ?? this.modalities()[0] ?? null,
  );

  readonly seasonOptions = computed<readonly NfComboboxOption[]>(() => {
    const active = this.activeModality();
    if (!active || !active.played) {
      return [{ value: 'all', label: 'Todas' }];
    }

    const playedSeasons = active.seasons.filter((s) => s.played);
    return [
      { value: 'all', label: 'Todas' },
      ...playedSeasons.map((s) => ({ value: s.id, label: s.label })),
    ];
  });

  readonly scope = computed<StatScope>(() =>
    this.seasonId() === 'all' ? 'historico' : 'temporada',
  );

  /* ---- Pestañas ---- */

  readonly tabOptions = [
    { value: 'rendimiento', label: 'Rendimiento competitivo' },
    { value: 'medallas', label: 'Hall of Fame' },
  ];

  /** Llegar con `?medalla=` significa venir a por una medalla: se abre esa pestaña. */
  readonly tab = linkedSignal<string | null, StatTab>({
    source: this.focusedMedal,
    computation: (medal, prev) => (medal ? 'medallas' : (prev?.value ?? 'rendimiento')),
  });

  readonly expandedTag = signal<string | null>(this.route.snapshot.queryParamMap.get('jugador'));
  readonly hoveredObjectiveId = signal<string | null>(null);

  /* ---- Datos ---- */

  /**
   * Nada aparece antes de tiempo: mientras el roster o el catálogo de campeones
   * siguen en vuelo, cada bloque pinta su hueco en lugar de cifras a medio hacer.
   */
  readonly statsLoading = computed(
    () => this.bridge.status() !== 'ready' || this.gameData.status() === 'loading',
  );

  /**
   * Clave de siembra de las estadísticas por grupo, modalidad y temporada.
   */
  private readonly statsKey = computed(() => {
    const g = this.group();
    if (!g) return '';
    const active = this.activeModality();
    if (active && !active.played) return '';
    const mod = this.modality();
    const season = this.seasonId();
    return `${g.id}@${mod}@${season}`;
  });

  private readonly roster = computed(() => {
    const g = this.group();
    return g ? this.groupStore.rosterOf(g.id) : [];
  });

  private readonly stats = computed(() => {
    const key = this.statsKey();
    return key ? statsFor(key, this.roster(), this.scope()) : [];
  });

  readonly players = computed(() => this.stats());
  readonly telemetry = computed(() => {
    const key = this.statsKey();
    const st = this.stats();
    return key && st.length ? mapTelemetryFor(key, st, this.scope()) : null;
  });
  readonly metagame = computed(() => {
    const key = this.statsKey();
    const st = this.stats();
    return key && st.length ? metagameFor(key, st) : [];
  });
  readonly goldenDuo = computed(() => {
    const key = this.statsKey();
    const r = this.roster();
    const st = this.stats();
    return key && r.length >= 2 ? goldenDuoFor(key, r, st) : null;
  });
  readonly woodenDuo = computed(() => {
    const key = this.statsKey();
    const r = this.roster();
    const st = this.stats();
    return key && r.length >= 2 ? woodenDuoFor(key, r, st) : null;
  });
  readonly multikills = computed(() => {
    const st = this.stats();
    return st.length ? multikillsFor(st) : null;
  });
  readonly vision = computed(() => {
    const key = this.statsKey();
    const st = this.stats();
    return key && st.length ? groupVisionFor(key, st) : null;
  });
  readonly laneImpact = computed(() => {
    const key = this.statsKey();
    return key ? laneImpactFor(key, this.scope()) : [];
  });
  readonly records = computed(() => {
    const key = this.statsKey();
    const st = this.stats();
    return key && st.length ? epicRecordsFor(key, st) : [];
  });

  /**
   * El tag del usuario activo DENTRO de este roster, o nulo si no pertenece al grupo.
   */
  private readonly meTag = computed(() => {
    const myId = this.session.user()?.userId;
    if (!myId) return null;
    return this.roster().find((m) => m.userId === myId)?.tag ?? null;
  });

  readonly medals = computed(() => {
    const key = this.statsKey();
    return key ? medalBoardsFor(key, this.roster(), this.scope(), this.meTag()) : [];
  });

  /** La medalla que pide la URL, ya resuelta con su clasificación. */
  readonly openBoard = computed(() => {
    const medal = medalById(this.focusedMedal());
    if (!medal) return null;
    return this.medals().find((b) => b.medal.id === medal.id) ?? null;
  });

  constructor() {
    this.gameData.ensureLoaded();
    this.groupsStore.ensureLoaded();
    effect(() => {
      const id = this.id();
      if (id) void this.bridge.ensure(id);
    });
    effect(() => {
      const tag = this.focusedTag();
      this.expandedTag.set(tag);
    });
  }

  /* ---- Acciones ---- */

  retry(): void {
    const id = this.id();
    if (id) void this.bridge.ensure(id);
  }

  setModality(value: string): void {
    const mod = value as StatModality;
    this.modality.set(mod);
    const active = this.modalities().find((m) => m.modality === mod);
    if (active) {
      const isSeasonPlayed =
        this.seasonId() === 'all' || active.seasons.some((s) => s.id === this.seasonId() && s.played);
      if (!isSeasonPlayed) {
        this.seasonId.set('all');
      }
    }
  }

  setSeason(value: string): void {
    this.seasonId.set(value || 'all');
  }

  setTab(value: string): void {
    const tab = STAT_TABS.find((t) => t === value) ?? 'rendimiento';
    this.tab.set(tab);
    if (tab !== 'medallas' && this.focusedMedal()) this.writeParams({ medalla: null });
  }

  togglePlayer(tag: string): void {
    const next = this.expandedTag() === tag ? null : tag;
    this.expandedTag.set(next);
    this.writeParams({ jugador: next });
  }

  openMedal(id: string): void {
    this.writeParams({ medalla: id });
  }

  closeMedal(): void {
    this.writeParams({ medalla: null });
  }

  /**
   * Escribe los parámetros de interfaz sin apilar entradas en el historial: abrir y
   * cerrar un modal cuatro veces no debe costar cuatro pulsaciones de «atrás».
   */
  private writeParams(params: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
