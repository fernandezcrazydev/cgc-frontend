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
import { DragonType, Lane, Match, MatchParticipant, TeamSummary } from '../../../../core/matches/models';
import {
  computeMatchScores,
  damagePerGold,
  damageShare,
  formatKda,
  itemBg,
  laneLabel,
} from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { formatCompact, formatNumber } from '../../../../shared/date-format';
import { ToastService } from '../../../../core/toast';
import { NfAvatar, NfLaneIcon, NfSegmentOption, NfSegmented } from '../../../../ui';
import { Viewport } from '../../../../shared/viewport';
import { ReactionsStore, ReactionTally } from '../../../../core/reactions';
import { playerReactionsFor } from '../../../../core/group-hub';

@Component({
  selector: 'app-match-scoreboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'pickerFor.set(null); peekFor.set(null)',
  },
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
  readonly quickEmojis = computed(() => this.reactions.mostUsed(this.match().groupId || 'group'));

  private readonly playerScores = computed(() => computeMatchScores(this.match()));

  constructor() {
    this.gameData.ensureLoaded();

    effect(() => {
      const match = this.match();
      const scope = match.groupId || 'group';
      for (const team of [match.blueTeam, match.redTeam]) {
        for (const p of team.participants) {
          this.reactions.seed(scope, match.id + ':' + p.id, playerReactionsFor(match.id, p.id));
        }
      }
    });
  }

  setTab(tab: 'overview' | 'charts' | 'lanes'): void {
    this.internalTab.set(tab);
  }

  private targetOf(p: MatchParticipant): string {
    return this.match().id + ':' + p.id;
  }

  protected allReactions(p: MatchParticipant): ReactionTally[] {
    return this.reactions.tally(this.match().groupId || 'group', this.targetOf(p));
  }

  protected topReactions(p: MatchParticipant): ReactionTally[] {
    return this.allReactions(p).slice(0, 1);
  }

  protected toggleReaction(p: MatchParticipant, emoji: string, event?: Event): void {
    event?.stopPropagation();
    this.pickerFor.set(null);
    this.peekFor.set(null);
    this.reactions.toggle(this.match().groupId || 'group', this.targetOf(p), emoji);
  }

  protected toggleReactionPicker(participantId: string, event: Event): void {
    event.stopPropagation();
    this.pickerFor.update((curr) => (curr === participantId ? null : participantId));
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

  protected playerRankScore(p: MatchParticipant): string {
    return this.playerScores().get(p.id)?.score ?? '';
  }

  protected playerRank(p: MatchParticipant): number {
    return this.playerScores().get(p.id)?.rank ?? 10;
  }

  protected drakeIcon(type: DragonType): string {
    const map: Record<DragonType, string> = {
      infernal: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_fire.png',
      mountain: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_earth.png',
      ocean: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_ocean.png',
      cloud: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_cloud.png',
      hextech: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_hextech.png',
      chemtech: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_chemtech.png',
    };
    return map[type] ?? map.infernal;
  }

  protected drakeTitle(type: DragonType): string {
    const map: Record<DragonType, string> = {
      infernal: 'Dragón de fuego',
      mountain: 'Dragón de montaña',
      ocean: 'Dragón de océano',
      cloud: 'Dragón de nube',
      hextech: 'Dragón hextech',
      chemtech: 'Dragón tecnoquímico',
    };
    return map[type] ?? 'Dragón elemental';
  }

  protected participantSpells(p: MatchParticipant): number[] {
    if (p.role === 'JUNGLA') {
      if (p.stats?.smiteVariant === 'blue') return [p.stats.spells?.[0] ?? 4, 1102];
      if (p.stats?.smiteVariant === 'red') return [p.stats.spells?.[0] ?? 4, 1101];
      if (p.stats?.smiteVariant === 'green') return [p.stats.spells?.[0] ?? 4, 1103];
      if (p.stats?.smiteVariant === 'unevolved') return [p.stats.spells?.[0] ?? 4, 11];
      if (p.stats?.spells && [11, 1101, 1102, 1103].includes(p.stats.spells[1])) {
        return p.stats.spells;
      }
      return [p.stats?.spells?.[0] ?? 4, 1102];
    }
    if (p.stats?.spells && p.stats.spells.length >= 2) return p.stats.spells;
    const second: Record<Lane, number> = {
      TOP: 12,
      JUNGLA: 1102,
      MID: 14,
      ADC: 7,
      SUPPORT: 3,
    };
    return [4, second[p.role] ?? 14];
  }

  protected participantPrimaryRune(p: MatchParticipant): number {
    const fallback: Record<Lane, number> = { TOP: 8437, JUNGLA: 8010, MID: 8112, ADC: 8008, SUPPORT: 8465 };
    return p.stats?.primaryRuneId ?? fallback[p.role] ?? 8010;
  }

  protected participantSecondaryRune(p: MatchParticipant): number {
    const fallback: Record<Lane, number> = { TOP: 8000, JUNGLA: 8300, MID: 8200, ADC: 8300, SUPPORT: 8400 };
    return p.stats?.secondaryRuneTreeId ?? fallback[p.role] ?? 8300;
  }

  protected spellIcon(id: number): string | null {
    if (id === 1102) return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1102_smite.png';
    if (id === 1101) return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1101_smite.png';
    if (id === 1103) return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1103_smite.png';
    if (id === 11) return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_smite.png';
    const names: Record<number, string> = { 4: 'SummonerFlash', 12: 'SummonerTeleport', 11: 'SummonerSmite', 14: 'SummonerDot', 7: 'SummonerHeal', 21: 'SummonerBarrier', 3: 'SummonerExhaust', 6: 'SummonerHaste' };
    return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/${names[id] ?? 'SummonerFlash'}.png`;
  }

  protected spellName(id: number): string {
    const names: Record<number, string> = { 4: 'Destello', 12: 'Teleportar', 11: 'Smite', 14: 'Ignición', 7: 'Curar', 21: 'Barrera', 3: 'Extenuación', 6: 'Fantasmal' };
    return names[id] ?? `Hechizo ${id}`;
  }

  protected runeIcon(id: number | undefined): string | null {
    if (!id) return null;
    const icons: Record<number, string> = {
      8010: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/Conqueror/Conqueror.png',
      8008: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png',
      8021: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png',
      8005: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png',
      8112: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/Electrocute/Electrocute.png',
      8128: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png',
      8214: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/SummonAery/SummonAery.png',
      8229: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png',
      8437: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png',
      8465: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Resolve/Guardian/Guardian.png',
      8351: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png',
      8000: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7201_Precision.png',
      8100: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
      8200: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7202_Sorcery.png',
      8300: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7203_Whimsy.png',
      8400: 'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7204_Resolve.png',
    };
    return icons[id] ?? null;
  }

  protected runeName(id: number | undefined): string {
    if (!id) return 'Runa';
    const names: Record<number, string> = {
      8010: 'Conquistador', 8008: 'Compás Letal', 8021: 'Pies Veloces', 8005: 'Ataque Intensificado',
      8112: 'Electrocutar', 8128: 'Cosecha Oscura', 8214: 'Invocar a Aery', 8229: 'Cometa Arcano',
      8437: 'Garras del Inmortal', 8465: 'Protector', 8351: 'Mejora Glacial',
      8000: 'Precisión', 8100: 'Dominación', 8200: 'Brujería', 8300: 'Inspiración', 8400: 'Valor',
    };
    return names[id] ?? `Runa ${id}`;
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

  readonly allPlayers = computed(() => {
    return [...this.match().blueTeam.participants, ...this.match().redTeam.participants];
  });

  readonly maxDamage = computed(() =>
    Math.max(...this.allPlayers().map((p) => p.stats.totalDamageToChampions), 1),
  );

  readonly maxGold = computed(() => Math.max(...this.allPlayers().map((p) => p.stats.gold), 1));

  /** Por qué se ordena el ranking. */
  readonly metric = signal<RankMetric>('damage');

  readonly metricOptions: readonly NfSegmentOption[] = [
    { value: 'damage', label: 'Daño' },
    { value: 'gold', label: 'Oro' },
    { value: 'efficiency', label: 'Daño por oro' },
  ];

  /**
   * Los diez ordenados por la métrica activa.
   *
   * «Daño por oro» está aquí porque es la única de las tres que no premia automáticamente al
   * tirador: el daño en bruto lo gana casi siempre quien más oro recibe, y esta separa «hizo
   * mucho daño» de «hizo mucho daño con lo que tenía».
   */
  readonly ranking = computed<RankRow[]>(() => {
    const metric = this.metric();
    const maxDamage = this.maxDamage();
    const maxGold = this.maxGold();

    return this.allPlayers()
      .map((player) => {
        const efficiency = damagePerGold(player.stats);
        return {
          player,
          damagePct: (player.stats.totalDamageToChampions / maxDamage) * 100,
          goldPct: (player.stats.gold / maxGold) * 100,
          primary: primaryLabel(metric, player, efficiency),
          secondary: secondaryLabel(metric, player, efficiency),
          score: scoreOf(metric, player, efficiency),
        };
      })
      .sort((a, b) => b.score - a.score);
  });

  readonly laneMatchups = computed(() => {
    const m = this.match();
    const roles: MatchParticipant['role'][] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];
    return roles.map((role) => ({
      role,
      blue: m.blueTeam.participants.find((p) => p.role === role) ?? m.blueTeam.participants[0],
      red: m.redTeam.participants.find((p) => p.role === role) ?? m.redTeam.participants[0],
    }));
  });

  setMetric(metric: string): void {
    this.metric.set(metric as RankMetric);
  }

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  /**
   * El reparto de daño se DERIVA de los cinco del equipo, no se lee de
   * `stats.damageSharePercentage`. Ver `damageShare()`: el campo almacenado y el cálculo
   * eran el mismo concepto con dos valores distintos.
   */
  damagePct(p: MatchParticipant, team: TeamSummary): number {
    return damageShare(p, team);
  }

  laneLabel(lane: MatchParticipant['role']): string {
    return laneLabel(lane);
  }

  /** Por id de participante: la vista no conoce ni compara identidades. */
  isCurrentUser(participantId: string): boolean {
    return participantId === this.match().userParticipant?.id;
  }

  kdaRatio(stats: MatchParticipant['stats']): string {
    return formatKda(stats);
  }

  formatGold(gold: number): string {
    return formatCompact(gold);
  }

  formatNumber(value: number): string {
    return formatNumber(value);
  }

  itemBg(name: string): string {
    return itemBg(name);
  }

  plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
  }

  copyMatchLink(): void {
    const url = `${window.location.origin}/app/historial/${this.match().id}`;
    navigator.clipboard?.writeText(url);
    this.toasts.info('Enlace de la partida copiado al portapapeles');
  }
}

type RankMetric = 'damage' | 'gold' | 'efficiency';

interface RankRow {
  player: MatchParticipant;
  damagePct: number;
  goldPct: number;
  primary: string;
  secondary: string;
  score: number;
}

function scoreOf(metric: RankMetric, p: MatchParticipant, efficiency: number): number {
  if (metric === 'gold') return p.stats.gold;
  if (metric === 'efficiency') return efficiency;
  return p.stats.totalDamageToChampions;
}

/** La cifra grande es siempre la que ordena: si no, el orden parece arbitrario. */
function primaryLabel(metric: RankMetric, p: MatchParticipant, efficiency: number): string {
  if (metric === 'gold') return `${formatCompact(p.stats.gold)} de oro`;
  if (metric === 'efficiency') return `${Math.round(efficiency)} por 1.000`;
  return `${formatCompact(p.stats.totalDamageToChampions)} de daño`;
}

function secondaryLabel(metric: RankMetric, p: MatchParticipant, efficiency: number): string {
  if (metric === 'gold') return `${formatCompact(p.stats.totalDamageToChampions)} de daño`;
  if (metric === 'efficiency') {
    return `${formatCompact(p.stats.totalDamageToChampions)} con ${formatCompact(p.stats.gold)}`;
  }
  return `${formatCompact(p.stats.gold)} de oro`;
}
