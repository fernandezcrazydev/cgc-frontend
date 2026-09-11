import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  NfAvatar,
  NfButton,
  NfCombobox,
  NfComboboxOption,
  NfIconButton,
  NfLaneIcon,
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
  CrossAggregate,
  CrossChampionMatchup,
  CrossStreak,
  MatchHistoryStore,
  aggregateCross,
  itemBg,
} from '../../../../core/matches';
import { ProfileGroupsCard } from './profile-groups-card.component';
import { ProfileLpChartComponent } from './profile-lp-chart.component';
import { ProfileStreakCard } from './profile-streak-card.component';
import { ProfileTrophiesCardComponent } from './profile-trophies-card.component';
import { SharedGroups } from './shared-groups';

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
    NfLaneIcon,
    NfSegmented,
    NfSelect,
    NfSkeleton,
    ProfileStreakCard,
    ProfileGroupsCard,
    ProfileLpChartComponent,
    ProfileTrophiesCardComponent,
  ],
  styleUrl: './perfil-miembro.scss',
  templateUrl: './perfil-miembro.html',
})
export class PerfilMiembro {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groups = inject(GroupStore);
  private readonly matchHistory = inject(MatchHistoryStore);
  private readonly shared = inject(SharedGroups);
  protected readonly session = inject(Session);

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
    this.crossWith().all.map((c) => ({
      role: c.them.role,
      won: c.them.team === c.match.winningTeam,
      wonLane: c.them.stats.wonLane,
    })),
  );

  /** Mientras el historial se reproyecta no se puede afirmar todavía si este jugador existe. */
  readonly loading = computed(() => this.matchHistory.status() === 'loading');

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
      this.crossWith().all.length > 0,
    );
  });

  // ── Cara a cara ───────────────────────────────────────────────────
  // Sale del historial real, no de una semilla propia: es el mismo `crossWith()` que alimenta
  // el historial cruzado y las dos páginas de medias, así que las cifras de esta ficha y las
  // de la pantalla que abre no pueden discrepar.
  private readonly crossWith = computed(() => this.matchHistory.crossWith(this.userId()));

  /** Todas vuestras partidas en común; su longitud decide si la ficha tiene algo que decir. */
  readonly cross = computed(() => this.crossWith().all);

  readonly together = computed(() => aggregateCross(this.crossWith().allies));
  readonly against = computed(() => aggregateCross(this.crossWith().enemies));

  /** Positivo = vas ganando tú el marcador de los duelos directos. */
  readonly lead = computed(() => this.against().wins - this.against().losses);

  /**
   * Cómo se reparten vuestras partidas en común entre las dos relaciones, en porcentaje del
   * total. Es lo que dice de un vistazo qué clase de relación tenéis: compañeros habituales,
   * rivales, o de todo.
   */
  readonly togetherShare = computed(() => {
    const total = this.cross().length;
    return total ? Math.round((this.together().games / total) * 100) : 0;
  });

  /**
   * La racha viva de una relación, en corto: «2V», «3D». `null` cuando no hay racha que contar,
   * y entonces la línea no se pinta en vez de decir «racha 0».
   */
  streakLabel(streak: CrossStreak | null): string | null {
    if (!streak || streak.count === 0) return null;
    return streak.count + (streak.type === 'win' ? 'V' : 'D');
  }

  /**
   * El emparejamiento de campeones más repetido de una relación, o `null` si no hay ninguno.
   *
   * Devuelve el dato y no una frase a propósito: escrito salía «Tu Campeón 33 vs su Campeón 64»,
   * porque `myChampionName` es el nombre que trae la partida y en el mock los campeones no tienen
   * nombre propio. Un campeón se reconoce por su icono, no por su número, así que lo pinta la
   * plantilla con `nf-avatar` igual que el resto de la aplicación.
   */
  topMatchup(agg: CrossAggregate): CrossChampionMatchup | null {
    return agg.topMatchups[0] ?? null;
  }

  /**
   * Los grupos de este jugador **que además son tuyos**, que son los únicos de los que se puede
   * enseñar su clasificación.
   *
   * No es una restricción técnica: la tarjeta de grupos que va justo al lado ya oculta el LP de
   * los grupos ajenos —pinta la etiqueta «Grupo ajeno» en lugar de `#7 · 239 LP`—, así que una
   * gráfica que sí lo enseñara contradiría a su vecina en la misma pantalla.
   *
   * BACKEND NOTE: la regla que se quiere de verdad es la **visibilidad del grupo**, y no existe
   * todavía; está explicada entera en `SharedGroups`.
   */
  readonly sharedGroups = computed(() =>
    (this.profile()?.groups ?? []).filter((g) => this.shared.has(g.id)),
  );

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      TOP: 'Top',
      JUNGLA: 'Jungla',
      MID: 'Mid',
      ADC: 'ADC',
      SUPPORT: 'Support',
    };
    return map[role] ?? role;
  }

  matchupWr(m: CrossChampionMatchup): number {
    return m.games ? Math.round((m.wins / m.games) * 100) : 0;
  }

  // ── Pestañas de Navegación ────────────────────────────────────────
  readonly activeTab = signal<MiembroTab>(
    (() => {
      const tab = this.route.snapshot?.queryParamMap?.get('tab');
      return (tab && (MIEMBRO_TABS as readonly string[]).includes(tab) ? tab : 'resumen') as MiembroTab;
    })(),
  );

  readonly tabOptions: readonly NfSegmentOption[] = [
    { value: 'resumen', label: 'Resumen' },
    { value: 'dna', label: 'ADN y stats' },
    { value: 'campeones', label: 'Campeones' },
  ];

  setTab(val: string): void {
    if ((MIEMBRO_TABS as readonly string[]).includes(val)) {
      const tab = val as MiembroTab;
      this.activeTab.set(tab);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
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

  constructor() {
    this.route.queryParamMap?.subscribe((q) => {
      const tab = q.get('tab');
      if (tab && (MIEMBRO_TABS as readonly string[]).includes(tab)) {
        this.activeTab.set(tab as MiembroTab);
      }
    });
  }
}

