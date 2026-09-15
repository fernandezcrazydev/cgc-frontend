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
import {
  MATCHMAKING_PRESET_INFO,
  MatchmakingPreset,
} from '../../../../core/groups/models';
import { PRESET_SLUGS, presetFromSlug } from '../../../../core/matches/match-filtering';
import { MatchPreset } from '../../../../core/matches/models';
import {
  GroupStatsStore,
  StatsQuery,
  defaultScopeOf,
  duosOf,
  laneImpactOf,
  mapTelemetryOf,
  medalBoardsOf,
  medalById,
  metagameOf,
  multikillsOf,
  playersOf,
  recordsOf,
  visionOf,
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
 * esta carpeta con su hoja de estilos, y todas las derivaciones (medias, porcentajes,
 * etiquetas) viven en `core/group-stats/stats-view.ts`. Aquí no se calcula nada.
 *
 * **Tres cosas viven en la URL a propósito**, para que un enlace lleve a lo que se está mirando:
 *   - `?liga=<slug>` la modalidad, con el mismo vocabulario que el historial (`competitivo`…).
 *   - `?temporada=<leagueId>` la temporada, o ausente para el histórico.
 *   - `?medalla=<id>` abre el detalle de una medalla, y `?jugador=<userId>` despliega una fila.
 *
 * El alcance está en la URL y no en una signal suelta porque es lo que decide TODAS las cifras de
 * la pantalla: mandar el enlace de «mira el caos de esta temporada» y que el otro abra el histórico
 * de equilibrado es la clase de cosa que nadie nota hasta que discute con capturas distintas.
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
  readonly store = inject(GroupStatsStore);

  readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  /** Id del jugador cuya fila está desplegada, sincronizado con `?jugador=`. */
  private readonly focusedUserId = computed(() => this.params().get('jugador'));

  /** Medalla abierta, sincronizada con `?medalla=`. */
  private readonly focusedMedal = computed(() => this.params().get('medalla'));

  readonly group = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.groupStore.byId(id) ?? this.groupsStore.byId(id) ?? null;
  });

  /* ---- Alcance: modalidad y temporada ---- */

  readonly scopes = this.store.scopes;

  /**
   * El alcance activo. Sale de la URL si la trae, y si no del que más ha jugado el grupo.
   *
   * Nulo mientras los alcances siguen en vuelo: pedir estadísticas antes de saber qué modalidades
   * existen sería adivinar una, y adivinar mal enseña un panel vacío de una modalidad que el grupo
   * nunca ha tocado.
   */
  readonly scope = computed<StatsQuery | null>(() => {
    const scopes = this.scopes();
    if (!scopes.length) return null;

    const fromUrl = presetFromSlug(this.params().get('liga'));
    const preset = fromUrl ?? defaultScopeOf(scopes)?.preset ?? scopes[0].preset;

    // Una temporada de otra modalidad no se arrastra al cambiar de pestaña: no tiene ni una
    // partida de esta, así que el panel saldría vacío sin que nada dijera por qué.
    const seasons = scopes.find((s) => s.preset === preset)?.seasons ?? [];
    const requested = this.params().get('temporada');
    const leagueId = seasons.some((s) => s.id === requested) ? requested : null;

    return { preset, leagueId };
  });

  readonly activeScope = computed(() => {
    const preset = this.scope()?.preset;
    return this.scopes().find((s) => s.preset === preset) ?? null;
  });

  /**
   * Las tres modalidades, siempre. La que el grupo no ha jugado se ofrece deshabilitada en vez de
   * desaparecer: un control que cambia de forma bajo el cursor es peor que uno con una opción
   * apagada, y además dice algo — «esto no lo habéis jugado nunca».
   */
  readonly presetOptions = computed<readonly NfSegmentOption[]>(() =>
    this.scopes().map((s) => ({
      value: s.preset,
      label: MATCHMAKING_PRESET_INFO[s.preset as MatchmakingPreset].label,
      disabled: s.matches === 0,
    })),
  );

  /** Solo las temporadas con partidas: ofrecer una vacía es ofrecer un panel de ceros. */
  readonly seasonOptions = computed<readonly NfComboboxOption[]>(() => {
    const seasons = (this.activeScope()?.seasons ?? []).filter((s) => s.matches > 0);
    return [
      { value: 'all', label: 'Todas' },
      ...seasons.map((s) => ({ value: s.id, label: s.name })),
    ];
  });

  readonly seasonValue = computed(() => this.scope()?.leagueId ?? 'all');

  readonly historyLink = computed(() => {
    const g = this.group();
    return g ? ['/app', 'grupos', g.id, 'historial'] : ['/app', 'historial'];
  });

  readonly historyQueryParams = computed(() => {
    const scope = this.scope();
    return scope
      ? { liga: PRESET_SLUGS[scope.preset], ...(scope.leagueId ? { temporada: scope.leagueId } : {}) }
      : {};
  });

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

  readonly expandedUserId = signal<string | null>(null);
  readonly hoveredObjectiveId = signal<string | null>(null);

  /* ---- Datos ---- */

  /**
   * Nada aparece antes de tiempo: mientras el alcance, las cifras o el catálogo de campeones siguen
   * en vuelo, cada bloque pinta su hueco en lugar de cifras a medio hacer.
   */
  readonly statsLoading = computed(
    () =>
      this.store.scopesStatus() === 'loading' ||
      this.store.status() === 'loading' ||
      this.store.status() === 'idle' ||
      this.gameData.status() === 'loading',
  );

  /** `true` cuando el grupo existe y no ha jugado nada: un vacío con explicación, no un error. */
  readonly nothingPlayed = computed(
    () => this.store.scopesStatus() === 'ready' && this.scopes().every((s) => s.matches === 0),
  );

  private readonly stats = this.store.stats;

  readonly players = computed(() => {
    const s = this.stats();
    return s ? playersOf(s) : [];
  });

  readonly telemetry = computed(() => {
    const s = this.stats();
    return s ? mapTelemetryOf(s) : null;
  });

  readonly metagame = computed(() => {
    const s = this.stats();
    return s ? metagameOf(s) : [];
  });

  private readonly duos = computed(() => {
    const s = this.stats();
    return s ? duosOf(s) : { golden: null, wooden: null };
  });

  readonly goldenDuo = computed(() => this.duos().golden);
  readonly woodenDuo = computed(() => this.duos().wooden);

  readonly multikills = computed(() => {
    const s = this.stats();
    return s ? multikillsOf(s) : null;
  });

  readonly vision = computed(() => {
    const s = this.stats();
    return s ? visionOf(s) : null;
  });

  readonly laneImpact = computed(() => {
    const s = this.stats();
    return s ? laneImpactOf(s) : [];
  });

  readonly records = computed(() => {
    const s = this.stats();
    return s ? recordsOf(s) : [];
  });

  /**
   * El id del usuario activo, o nulo. **No se cruza contra el censo del grupo**: las filas ya vienen
   * identificadas, y quien se fue del grupo sigue teniendo su récord en la temporada.
   */
  private readonly meUserId = computed(() => this.session.user()?.userId ?? null);

  readonly medals = computed(() => medalBoardsOf(this.players(), this.meUserId()));

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
      if (!id) return;
      void this.bridge.ensure(id);
      void this.store.ensureScopes(id);
    });

    // El alcance activo manda la petición. Cambiar de modalidad o de temporada es cambiar la URL, y
    // este efecto es lo único que traduce eso en una llamada — así no hay dos caminos por los que
    // se pueda pedir un alcance y quedar desincronizados.
    effect(() => {
      const id = this.id();
      const scope = this.scope();
      if (id && scope) void this.store.ensure(id, scope);
    });

    effect(() => this.expandedUserId.set(this.focusedUserId()));
  }

  /* ---- Acciones ---- */

  retry(): void {
    const id = this.id();
    if (!id) return;
    void this.store.reloadScopes(id);
    const scope = this.scope();
    if (scope) void this.store.reload(id, scope);
  }

  setPreset(value: string): void {
    // La temporada se suelta al cambiar de modalidad: son temporadas distintas (V48), y arrastrar
    // un id que no existe en la nueva dejaría el combo enseñando "Todas" con otro alcance detrás.
    this.writeParams({ liga: PRESET_SLUGS[value as MatchPreset], temporada: null });
  }

  setSeason(value: string): void {
    this.writeParams({ temporada: value && value !== 'all' ? value : null });
  }

  setTab(value: string): void {
    const tab = STAT_TABS.find((t) => t === value) ?? 'rendimiento';
    this.tab.set(tab);
    if (tab !== 'medallas' && this.focusedMedal()) this.writeParams({ medalla: null });
  }

  togglePlayer(userId: string): void {
    const next = this.expandedUserId() === userId ? null : userId;
    this.expandedUserId.set(next);
    this.writeParams({ jugador: next });
  }

  openMedal(id: string): void {
    this.writeParams({ medalla: id });
  }

  closeMedal(): void {
    this.writeParams({ medalla: null });
  }

  /**
   * Escribe los parámetros de interfaz sin apilar entradas en el historial: abrir y cerrar un modal
   * cuatro veces no debe costar cuatro pulsaciones de «atrás».
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
