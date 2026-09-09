import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  NfButton,
  NfCombobox,
  NfComboboxOption,
  NfIconButton,
  NfSelect,
  NfModal,
  NfToggle,
  NfSkeleton,
  NfAvatar,
  NfLaneIcon,
  NfSegmented,
  NfSegmentOption,
} from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupStore } from '../../../../core/group-store';
import { opggUrl } from '../../../../core/member-detail';
import { NotificationsStore } from '../../../../core/notifications';
import { RoleSample, buildPlayerProfile } from '../../../../core/player-profile';
import { LANE_ROLES, LaneRole, PreferencesStore, RolePreferences } from '../../../../core/preferences';
import { PairingCode, RIOT_REGIONS, RiotAccount, RiotAccountStore, RiotRegion } from '../../../../core/riot';
import { errorMessage } from '../../../../core/http';
import { ToastService } from '../../../../core/toast';
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
import { wireConnectModalOnRiotEvent } from './perfil-connect-modal';
import { ProfileGroupsCard } from './profile-groups-card.component';
import { ProfileStreakCard } from './profile-streak-card.component';
import { ProfileLpChartComponent } from './profile-lp-chart.component';
import { ProfileTrophiesCardComponent } from './profile-trophies-card.component';

const MEMBER_SINCE_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' });

/**
 * Las pestañas del perfil, en un solo sitio: la lista es a la vez el tipo y el validador de lo
 * que llega del segmentado. Antes el tipo estaba escrito en la signal y la lista repetida en un
 * `if`, y el hueco entre los dos se tapaba con un `as any`.
 */
const PERFIL_TABS = ['resumen', 'dna', 'campeones', 'ajustes'] as const;
type PerfilTab = (typeof PERFIL_TABS)[number];

interface RoleTile {
  role: LaneRole;
  short: string;
  name: string;
  glyph: string;
}

const RELINK_FMT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [
    RouterLink,
    NfButton,
    NfCombobox,
    NfIconButton,
    NfSelect,
    NfModal,
    NfToggle,
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
  private readonly groups = inject(GroupStore);
  protected readonly session = inject(Session);

  /**
   * Quién mira, tomado de la sesión real y no del mock legacy `CURRENT_USER`, que la regla de
   * oro 1 prohíbe en código nuevo. No era cosmético: la semilla del perfil se construye con el
   * tag, y `CURRENT_USER.tag` es siempre `N1ghtfang#LAN`, así que TODOS los usuarios veían las
   * mismas cifras —mismo winrate, mismos campeones, misma racha— bajo su propio nombre y su
   * propia foto.
   *
   * Es la misma resolución que ya hace `MatchHistoryStore.viewer()`: el Riot ID vinculado si lo
   * hay, y si no el nombre de Discord antes que un hueco.
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

  private readonly matchHistory = inject(MatchHistoryStore);

  /**
   * El desglose por posición sale de las partidas que el usuario ha jugado de verdad, no de una
   * semilla aparte: es la misma fuente que ya alimentan la sinergia y la némesis de más abajo,
   * así que la tabla de roles y el historial no pueden contar cosas distintas.
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

  // ── Rivalidades y sinergias ───────────────────────────────────────
  // Salen de las partidas del historial, no de una semilla por pareja. Antes eran dos fuentes
  // distintas para el mismo hecho: la tarjeta anunciaba un winrate y la página que abría —que
  // ya lee las partidas reales— enseñaba otro.
  protected readonly minSample = CROSS_MIN_SAMPLE;

  private readonly partners = this.matchHistory.crossPartners;

  readonly bestAlly = computed(() => cardFor(bestAllyOf(this.partners()), 'ally'));
  readonly nemesis = computed(() => cardFor(nemesisOf(this.partners()), 'enemy'));

  // ── Navegación Modular por Pestañas ───────────────────────────────
  readonly activeTab = signal<PerfilTab>('resumen');
  readonly tabOptions: readonly NfSegmentOption[] = [
    { value: 'resumen', label: 'Resumen' },
    { value: 'dna', label: 'ADN y stats' },
    { value: 'campeones', label: 'Campeones' },
    { value: 'ajustes', label: 'Roles y cuenta' },
  ];

  setTab(val: string): void {
    if (PERFIL_TABS.includes(val as PerfilTab)) this.activeTab.set(val as PerfilTab);
  }

  // ── Top Signature Champions (Top 3 para el resumen) ───────────────
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

  /**
   * Campeón elegido en el buscador. Cadena vacía = sin filtrar, la convención del
   * resto de filtros de la app. Es estado de UI, así que vive en el componente.
   */
  readonly champQuery = signal<string>('');

  /**
   * Lo que ofrece el buscador son los campeones que el jugador ha jugado de
   * verdad, no el catálogo entero: sugerir uno que no aparece en la rejilla sería
   * ofrecer un filtro que deja la pantalla vacía. Los nombres e iconos salen del
   * catálogo real (`GameDataStore`); los ids, del perfil.
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

  // ── Roles preferidos ──────────────────────────────────────────────
  protected readonly prefs = inject(PreferencesStore);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifs = inject(NotificationsStore);

  protected readonly rolesHelp = signal(false);

  protected readonly roleTiles: RoleTile[] = [
    { role: 'TOP', short: 'TOP', name: 'Top', glyph: '◤' },
    { role: 'JUNGLA', short: 'JG', name: 'Jungla', glyph: '♣' },
    { role: 'MID', short: 'MID', name: 'Mid', glyph: '◈' },
    { role: 'ADC', short: 'ADC', name: 'ADC', glyph: '➤' },
    { role: 'SUPPORT', short: 'SUP', name: 'Support', glyph: '✚' },
  ];

  constructor() {
    this.prefs.ensureLoaded();
    this.riot.ensureLoaded();
    this.gameData.ensureLoaded();
    this.destroyRef.onDestroy(() => this.stopTick());

    wireConnectModalOnRiotEvent(this.notifs, this.connecting, (riotId, type) => {
      const message =
        type === 'RIOT_ACCOUNT_PAIRED'
          ? `Vinculamos ${riotId} desde la app de escritorio.`
          : `Comprobamos con Riot que ${riotId} es tuya.`;
      this.closeConnect();
      this.toast.success(message);
    });
  }

  readonly roleDraft = linkedSignal<RolePreferences, RolePreferences>({
    source: this.prefs.prefs,
    computation: (saved) => ({ roles: [...saved.roles], primary: saved.primary }),
  });

  readonly hasRoles = computed(() => this.roleDraft().roles.length > 0);
  readonly isFlex = computed(() => this.roleDraft().roles.length === LANE_ROLES.length);

  readonly rolesDirty = computed(() => {
    const draft = this.roleDraft();
    const saved = this.prefs.prefs();
    return (
      draft.primary !== saved.primary ||
      draft.roles.length !== saved.roles.length ||
      !draft.roles.every((r) => saved.roles.includes(r))
    );
  });

  readonly canSaveRoles = computed(() => this.rolesDirty() && this.hasRoles() && !this.prefs.saving());

  isSelected(role: LaneRole): boolean {
    return this.roleDraft().roles.includes(role);
  }

  isPrimary(role: LaneRole): boolean {
    return this.roleDraft().primary === role;
  }

  toggleRole(role: LaneRole): void {
    this.roleDraft.update((d) => {
      const on = d.roles.includes(role);
      const roles = LANE_ROLES.filter((r) => (r === role ? !on : d.roles.includes(r)));
      return { roles, primary: this.keepPrimary(roles, d.primary) };
    });
  }

  setPrimaryRole(role: LaneRole): void {
    if (!this.isSelected(role)) return;
    this.roleDraft.update((d) => ({ ...d, primary: role }));
  }

  toggleFlex(flex: boolean): void {
    this.roleDraft.update((d) => {
      const roles = flex ? [...LANE_ROLES] : d.primary ? [d.primary] : [];
      return { roles, primary: this.keepPrimary(roles, d.primary) };
    });
  }

  discardRoles(): void {
    const saved = this.prefs.prefs();
    this.roleDraft.set({ roles: [...saved.roles], primary: saved.primary });
  }

  async saveRoles(): Promise<void> {
    if (!this.canSaveRoles()) return;
    const ok = await this.prefs.save(this.roleDraft());
    if (ok) this.toast.success('Roles preferidos guardados.');
    else this.toast.error('No se han podido guardar tus roles. Inténtalo de nuevo.');
  }

  private keepPrimary(roles: readonly LaneRole[], primary: LaneRole | null): LaneRole | null {
    if (primary && roles.includes(primary)) return primary;
    return roles[0] ?? null;
  }

  readonly heroName = computed(() => this.session.displayName() || this.profile()?.name || '');

  /**
   * Si todavía no hay perfil firme que enseñar.
   *
   * Son las dos fuentes de las que sale: quién eres (la sesión, que además es la semilla de
   * todas las cifras) y tu historial (que se reproyecta al llegar tus ligas). Mientras
   * cualquiera de las dos viaje, lo que se pintaría sería el perfil de un usuario vacío.
   */
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
    // Sin `toUpperCase()`: la regla del proyecto es que lo que se escribe es lo que se pinta,
    // y ningún componente transforma el texto que recibe. Pintaba «AGO 2025».
    return MEMBER_SINCE_FMT.format(date).replace('.', '');
  });

  readonly avatarBroken = linkedSignal({
    source: this.session.avatarUrl,
    computation: () => false,
  });
  readonly showAvatarImage = computed(() => !!this.session.avatarUrl() && !this.avatarBroken());

  // ── Cuenta de Riot ────────────────────────────────────────────────
  protected readonly riot = inject(RiotAccountStore);

  readonly linking = signal(false);
  readonly unlinking = signal<RiotAccount | null>(null);
  readonly riotIdDraft = signal('');
  readonly regionDraft = signal<RiotRegion>('EUW');
  readonly regions = [...RIOT_REGIONS];

  readonly linkValid = computed(() => /^.+#.+$/.test(this.riotIdDraft().trim()));
  readonly canLink = computed(() => this.linkValid() && !this.riot.saving());

  readonly relinkAvailableAt = computed(() => {
    const iso = this.riot.relinkAvailableAt();
    return iso ? RELINK_FMT.format(new Date(iso)) : null;
  });

  retryRiot(): void {
    this.riot.reload();
  }

  setRegion(value: string): void {
    if ((RIOT_REGIONS as readonly string[]).includes(value)) this.regionDraft.set(value as RiotRegion);
  }

  startLinking(): void {
    this.riotIdDraft.set('');
    this.regionDraft.set(this.riot.account()?.region ?? 'EUW');
    this.linking.set(true);
  }

  cancelLinking(): void {
    if (this.riot.saving()) return;
    this.linking.set(false);
  }

  async confirmLink(): Promise<void> {
    if (!this.canLink()) return;
    try {
      const ok = await this.riot.link({
        riotId: this.riotIdDraft().trim(),
        region: this.regionDraft(),
      });
      if (!ok) return;
      this.linking.set(false);
      this.toast.success('Cuenta de Riot vinculada.');
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  askUnlink(): void {
    this.unlinking.set(this.riot.account());
  }

  cancelUnlink(): void {
    if (this.riot.saving()) return;
    this.unlinking.set(null);
  }

  async confirmUnlink(): Promise<void> {
    try {
      const ok = await this.riot.unlink();
      if (!ok) return;
      this.unlinking.set(null);
      this.linking.set(false);
      this.toast.success('Cuenta de Riot desvinculada.');
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  // ── Conectar app ──────────────────────────────────────────────────
  readonly connecting = signal(false);
  readonly pairingCode = signal<PairingCode | null>(null);
  readonly copied = signal(false);

  private readonly now = signal(Date.now());
  private tick: ReturnType<typeof setInterval> | null = null;

  private readonly codeRemainingMs = computed(() => {
    const pc = this.pairingCode();
    if (!pc) return 0;
    return Math.max(0, new Date(pc.expiresAt).getTime() - this.now());
  });
  readonly codeExpired = computed(() => this.pairingCode() !== null && this.codeRemainingMs() === 0);
  readonly codeCountdown = computed(() => {
    const total = Math.floor(this.codeRemainingMs() / 1000);
    const seconds = total % 60;
    return `${Math.floor(total / 60)}:${seconds.toString().padStart(2, '0')}`;
  });

  openConnect(): void {
    this.pairingCode.set(null);
    this.copied.set(false);
    this.connecting.set(true);
    this.startTick();
  }

  closeConnect(): void {
    this.connecting.set(false);
    this.pairingCode.set(null);
    this.stopTick();
  }

  async generateCode(): Promise<void> {
    if (this.riot.generatingCode()) return;
    try {
      const code = await this.riot.requestPairingCode();
      if (!code) return;
      this.copied.set(false);
      this.now.set(Date.now());
      this.pairingCode.set(code);
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(code);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      // Ignorar fallo de portapapeles
    }
  }

  private startTick(): void {
    this.stopTick();
    this.now.set(Date.now());
    this.tick = setInterval(() => this.now.set(Date.now()), 1000);
  }

  private stopTick(): void {
    if (this.tick !== null) {
      clearInterval(this.tick);
      this.tick = null;
    }
  }

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
 * Resume un compañero o rival para su tarjeta. El `tag` es el mismo que viaja en la ruta del
 * cruce, así que la tarjeta y la página que abre hablan del mismo jugador y de las mismas
 * partidas.
 */
function cardFor(partner: CrossPartner | null, side: 'ally' | 'enemy'): CrossCard | null {
  if (!partner) return null;
  const list = side === 'ally' ? partner.allies : partner.enemies;
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
