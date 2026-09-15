import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  NfAvatar,
  NfButton,
  NfCombobox,
  NfComboboxOption,
  NfIconButton,
  NfSegmented,
  NfSegmentOption,
  NfSelect,
  NfSkeleton,
} from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupStore } from '../../../../core/group-store';
import { GameDataStore } from '../../../../core/game-data';
import { RoleSample, buildMemberProfile } from '../../../../core/player-profile';
import {
  EMPTY_FILTERS,
  MAX_PAGE_SIZE,
  MatchHistoryStore,
  itemBg,
  personalMatchQuery,
  personalSummaryQuery,
  toCrossMatches,
} from '../../../../core/matches';
import { ProfileGroupsCard } from './profile-groups-card.component';
import { ProfileStreakCard } from './profile-streak-card.component';

/** Las pestañas del perfil ajeno: la lista es a la vez el tipo y el validador del segmentado. */
const MIEMBRO_TABS = ['resumen', 'dna', 'campeones'] as const;
type MiembroTab = (typeof MIEMBRO_TABS)[number];

@Component({
  selector: 'app-perfil-miembro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NfButton,
    NfCombobox,
    NfIconButton,
    NfAvatar,
    NfSegmented,
    NfSelect,
    NfSkeleton,
    ProfileStreakCard,
    ProfileGroupsCard,
  ],
  styleUrl: './perfil-miembro.scss',
  templateUrl: './perfil-miembro.html',
})
export class PerfilMiembro {
  private readonly route = inject(ActivatedRoute);
  private readonly groups = inject(GroupStore);
  private readonly matchHistory = inject(MatchHistoryStore);
  protected readonly session = inject(Session);

  constructor() {
    // Vuestro cruce: `GET /me/matches?with={userId}` con una muestra amplia para el desglose
    // por posición, más los dos recuentos que sí cubren todas las partidas. Las tres consultas
    // están deduplicadas en el store, así que volver a entrar en la ficha no repite ninguna.
    effect(() => {
      const id = this.userId();
      if (!id) return;
      // `untracked` no es decorativo: los métodos del store LEEN sus propias signals de
      // estado, así que llamarlos dentro del efecto lo suscribiría a lo que él mismo escribe.
      // Las únicas dependencias del efecto deben ser la consulta y el id.
      untracked(() => {
        void this.matchHistory.ensurePersonal(
          personalMatchQuery(EMPTY_FILTERS, 0, MAX_PAGE_SIZE, { with: id, relation: 'all' }),
        );
        for (const relation of ['ally', 'enemy'] as const) {
          void this.matchHistory.ensurePersonalSummary(
            personalSummaryQuery(EMPTY_FILTERS, { with: id, relation }),
          );
        }
      });
    });
  }

  // Sin valor de relleno: un parámetro vacío es un jugador que no existe, y eso lo resuelve el
  // 404 de abajo. Caer a 'Jugador' hacía que la ruta sin id pintase el perfil de alguien.
  readonly userId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  /**
   * El desglose por posición del jugador ajeno, contado sobre lo que de verdad le has visto
   * jugar: vuestras partidas en común. Es poca muestra a propósito —no tenemos su historial
   * entero, solo la parte que compartís— y por eso las posiciones que no aparecen se pintan
   * como «sin datos» en vez de con un porcentaje inventado.
   */
  private readonly roleSamples = computed<RoleSample[]>(() =>
    this.cross().map((c) => ({
      role: c.them.role,
      won: c.them.slot === c.match.winningSlot,
      // `wonLane` ya no viaja: el backend no sirve ese juicio y derivarlo necesita el oro del
      // minuto 14, que solo llega al abrir cada partida.
      wonLane: undefined,
    })),
  );

  /** Mientras el cruce viaja no se puede afirmar todavía si este jugador existe. */
  readonly loading = computed(() => {
    const status = this.matchHistory.personalStatus();
    return status === 'idle' || status === 'loading';
  });

  readonly profile = computed(() => {
    const targetTag = this.userId();
    if (!targetTag) return null;
    return buildMemberProfile(
      targetTag,
      this.groups.groups(),
      (id) => this.groups.rosterOf(id),
      this.roleSamples(),
      // Alguien que ya no comparte grupo contigo pero con quien sí has jugado existe: sus
      // partidas lo prueban. Solo es 404 cuando no aparece por ninguna de las dos vías.
      this.cross().length > 0,
    );
  });

  // ── Cara a cara ───────────────────────────────────────────────────
  // El cruce es un filtro del historial personal: `GET /me/matches?with={userId}`. Los récords
  // salen de `GET /me/matches/summary` con los mismos parámetros, no de contar la lista: la
  // lista es una muestra y el resumen sí cuenta todas.

  /** Vuestras partidas en común que hay cargadas; decide si la ficha tiene algo que decir. */
  readonly cross = computed(() =>
    toCrossMatches(this.matchHistory.personalMatches(), this.userId()),
  );

  readonly together = computed(() =>
    this.matchHistory.personalSummaryFor(
      personalSummaryQuery(EMPTY_FILTERS, { with: this.userId(), relation: 'ally' }),
    ),
  );

  readonly against = computed(() =>
    this.matchHistory.personalSummaryFor(
      personalSummaryQuery(EMPTY_FILTERS, { with: this.userId(), relation: 'enemy' }),
    ),
  );

  /** Sobre partidas decididas: una anulada no cuenta ni como victoria ni como derrota. */
  readonly togetherWinrate = computed(() => {
    const s = this.together();
    if (!s) return 0;
    const decided = s.wins + s.losses;
    return decided > 0 ? Math.round((s.wins / decided) * 100) : 0;
  });

  /** Positivo = vas ganando tú el marcador de los duelos directos. */
  readonly lead = computed(() => {
    const a = this.against();
    return a ? a.wins - a.losses : 0;
  });

  // ── Pestañas de Navegación ────────────────────────────────────────
  readonly activeTab = signal<MiembroTab>('resumen');
  readonly tabOptions: readonly NfSegmentOption[] = [
    { value: 'resumen', label: 'Resumen y cara a cara' },
    { value: 'dna', label: 'ADN y stats' },
    { value: 'campeones', label: 'Campeones' },
  ];

  setTab(val: string): void {
    if (MIEMBRO_TABS.includes(val as MiembroTab)) this.activeTab.set(val as MiembroTab);
  }

  // ── Top 3 Signature Champions ─────────────────────────────────────
  readonly topSignatureChampions = computed(() => {
    const p = this.profile();
    return p ? p.topChampions.slice(0, 3) : [];
  });

  // ── Catálogo de campeones ─────────────────────────────────────────
  protected readonly gameData = inject(GameDataStore);
  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  readonly champRoleFilter = signal<string>('TODOS');
  readonly champRoleFilterOptions: readonly NfSegmentOption[] = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'TOP', label: 'TOP' },
    { value: 'JUNGLA', label: 'JG' },
    { value: 'MID', label: 'MID' },
    { value: 'ADC', label: 'ADC' },
    { value: 'SUPPORT', label: 'SUP' },
  ];

  /** Campeón elegido en el buscador. Cadena vacía = sin filtrar. */
  readonly champQuery = signal<string>('');

  /**
   * Solo los campeones que este jugador ha jugado: sugerir uno que no está en la
   * rejilla sería ofrecer un filtro que la deja vacía.
   */
  readonly championOptions = computed<NfComboboxOption[]>(() => {
    const p = this.profile();
    if (!p) return [];
    const byId = this.gameData.championById();
    return p.topChampions
      .map((c) => ({
        value: String(c.championId),
        label: byId.get(c.championId)?.name ?? 'Campeón',
        iconUrl: byId.get(c.championId)?.iconUrl ?? null,
        tint: c.championId,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });

  readonly champSortBy = signal<string>('games');
  readonly champSortOptions = [
    { value: 'games', label: 'Más jugados' },
    { value: 'wr', label: 'Mayor winrate' },
    { value: 'kda', label: 'Mejor KDA' },
  ];

  readonly filteredChampions = computed(() => {
    const p = this.profile();
    if (!p) return [];
    let list = [...p.topChampions];
    const role = this.champRoleFilter();
    if (role !== 'TODOS') {
      list = list.filter((c) => c.role === role);
    }
    const query = this.champQuery();
    if (query) {
      list = list.filter((c) => String(c.championId) === query);
    }
    const sort = this.champSortBy();
    if (sort === 'wr') {
      list.sort((a, b) => b.wr - a.wr || b.games - a.games);
    } else if (sort === 'kda') {
      list.sort((a, b) => b.kda - a.kda || b.games - a.games);
    } else {
      list.sort((a, b) => b.games - a.games);
    }
    return list;
  });

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  itemSlotBg(id: number): string {
    return itemBg(`Item ${id}`);
  }

  grad(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }
}

