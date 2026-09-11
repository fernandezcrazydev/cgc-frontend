import { Component, computed, inject, signal } from '@angular/core';
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
import { opggUrl } from '../../../../core/member-detail';
import { RoleSample, buildPlayerProfile } from '../../../../core/player-profile';
import { LaneRole, PreferencesStore } from '../../../../core/preferences';
import { RiotAccountStore } from '../../../../core/riot';
import { GameDataStore } from '../../../../core/game-data';
import {
  CROSS_MIN_SAMPLE,
  CrossPartner,
  MatchHistoryStore,
  aggregateCross,
  bestAllyOf,
  itemBg,
  nemesisOf,
} from '../../../../core/matches';
import { nameOf } from '../cross/cross-player';
import { hash } from '../../../../core/group-ranking';
import { ProfileGroupsCard } from './profile-groups-card.component';
import { ProfileStreakCard } from './profile-streak-card.component';
import { ProfileLpChartComponent } from './profile-lp-chart.component';
import { ProfileTrophiesCardComponent } from './profile-trophies-card.component';

const MEMBER_SINCE_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' });

/**
 * Las pestañas del perfil, en un solo sitio: la lista es a la vez el tipo y el validador de lo
 * que llega del segmentado.
 */
const PERFIL_TABS = ['resumen', 'dna', 'campeones'] as const;
type PerfilTab = (typeof PERFIL_TABS)[number];

interface RoleTile {
  role: LaneRole;
  short: string;
  name: string;
  glyph: string;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    RouterLink,
    NfButton,
    NfCombobox,
    NfIconButton,
    NfSelect,
    NfSkeleton,
    NfAvatar,
    NfLaneIcon,
    NfSegmented,
    ProfileStreakCard,
    ProfileGroupsCard,
    ProfileLpChartComponent,
    ProfileTrophiesCardComponent,
  ],
  styleUrl: './perfil.scss',
  templateUrl: './perfil.html',
})
export class Perfil {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly groups = inject(GroupStore);
  protected readonly session = inject(Session);
  protected readonly riot = inject(RiotAccountStore);
  protected readonly prefs = inject(PreferencesStore);
  protected readonly gameData = inject(GameDataStore);
  private readonly matchHistory = inject(MatchHistoryStore);

  /**
   * Quién mira, tomado de la sesión real y no del mock legacy `CURRENT_USER`.
   */
  private readonly user = computed(() => {
    const account = this.riot.account();
    const tag = account?.riotId ?? this.session.displayName();
    return {
      name: account?.gameName ?? this.session.displayName(),
      tag,
      initials: this.session.initials(),
      region: account?.region ?? '',
    };
  });

  /**
   * El desglose por posición sale de las partidas que el usuario ha jugado de verdad.
   */
  private readonly roleSamples = computed<RoleSample[]>(() =>
    this.matchHistory.allPersonalMatches().map((m) => ({
      role: m.userParticipant!.role,
      won: m.userOutcome === 'win',
      wonLane: m.userParticipant!.stats.wonLane,
    })),
  );

  readonly profile = computed(() =>
    buildPlayerProfile(
      this.user(),
      this.groups.groups(),
      (id) => this.groups.rosterOf(id),
      this.roleSamples(),
    ),
  );

  // ── Roles del Hero (Punto 2) ──────────────────────────────────────
  readonly heroRoles = computed<{ primary: LaneRole | null; secondaries: LaneRole[] } | null>(() => {
    const saved = this.prefs.prefs();
    if (!saved.roles.length) return null;
    const primary =
      saved.primary && saved.roles.includes(saved.primary) ? saved.primary : (saved.roles[0] ?? null);
    const secondaries = saved.roles.filter((r) => r !== primary);
    return { primary, secondaries };
  });

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

  // ── Rivalidades y sinergias ───────────────────────────────────────
  protected readonly minSample = CROSS_MIN_SAMPLE;

  private readonly partners = this.matchHistory.crossPartners;

  readonly bestAlly = computed(() => cardFor(bestAllyOf(this.partners()), 'ally'));
  readonly nemesis = computed(() => cardFor(nemesisOf(this.partners()), 'enemy'));

  // ── Navegación Modular por Pestañas (Punto 7 & 13) ─────────────────
  readonly activeTab = signal<PerfilTab>(
    (() => {
      const tab = this.route.snapshot?.queryParamMap?.get('tab');
      return (tab && (PERFIL_TABS as readonly string[]).includes(tab) ? tab : 'resumen') as PerfilTab;
    })(),
  );

  readonly tabOptions: readonly NfSegmentOption[] = [
    { value: 'resumen', label: 'Resumen' },
    { value: 'dna', label: 'ADN y stats' },
    { value: 'campeones', label: 'Campeones' },
  ];

  setTab(val: string): void {
    if ((PERFIL_TABS as readonly string[]).includes(val)) {
      const tab = val as PerfilTab;
      this.activeTab.set(tab);
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { tab },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  // ── Top Signature Champions (Top 3 para el resumen) ───────────────
  readonly topSignatureChampions = computed(() => {
    const p = this.profile();
    return p ? p.topChampions.slice(0, 3) : [];
  });

  // ── Catálogo de campeones ─────────────────────────────────────────
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

  readonly champQuery = signal<string>('');

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

  // ── Tabla de roles (Pestaña ADN) ──────────────────────────────────
  protected readonly roleTiles: readonly RoleTile[] = [
    { role: 'TOP', short: 'TOP', name: 'Top', glyph: '◤' },
    { role: 'JUNGLA', short: 'JG', name: 'Jungla', glyph: '♣' },
    { role: 'MID', short: 'MID', name: 'Mid', glyph: '◈' },
    { role: 'ADC', short: 'ADC', name: 'ADC', glyph: '➤' },
    { role: 'SUPPORT', short: 'SUP', name: 'Support', glyph: '✚' },
  ];

  roleStatus(role: LaneRole): string {
    const saved = this.prefs.prefs();
    if (saved.primary === role) return '★ Principal';
    if (saved.roles.includes(role)) return 'Activo';
    return 'Inactivo';
  }

  constructor() {
    this.prefs.ensureLoaded();
    this.riot.ensureLoaded();
    this.gameData.ensureLoaded();
    this.route.queryParamMap?.subscribe((q) => {
      const tab = q.get('tab');
      if (tab && (PERFIL_TABS as readonly string[]).includes(tab)) {
        this.activeTab.set(tab as PerfilTab);
      }
    });
  }

  readonly heroName = computed(() => this.session.displayName() || this.profile()?.name || '');

  readonly profileLoading = computed(
    () =>
      this.session.status() === 'idle' ||
      this.session.status() === 'loading' ||
      this.matchHistory.status() === 'loading',
  );

  readonly memberSince = computed(() => {
    const iso = this.session.createdAt();
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return MEMBER_SINCE_FMT.format(date).replace('.', '');
  });

  readonly avatarBroken = signal(false);
  readonly showAvatarImage = computed(() => !!this.session.avatarUrl() && !this.avatarBroken());

  grad(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }

  opgg(tag: string): string {
    return opggUrl(tag);
  }
}

/** Lo que necesita pintar una tarjeta de rivalidad o de sinergia. */
interface CrossCard {
  tag: string;
  name: string;
  hue: number;
  avatarUrl: string | null;
  wr: number;
  wins: number;
  losses: number;
}

/**
 * Resume un compañero o rival para su tarjeta.
 */
function cardFor(partner: CrossPartner | null, side: 'ally' | 'enemy'): CrossCard | null {
  if (!partner) return null;
  const list = side === 'ally' ? partner.allies : partner.enemies;
  if (!list.length) return null;
  const agg = aggregateCross(list);
  const them = list[0].them;

  return {
    tag: them.riotId,
    name: nameOf(them.riotId),
    hue: hash(them.riotId) % 360,
    avatarUrl: them.avatarUrl ?? null,
    wr: agg.winrate,
    wins: agg.wins,
    losses: agg.losses,
  };
}
