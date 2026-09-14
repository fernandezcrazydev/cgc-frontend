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
import { DragonType, Lane, Match, MatchItemSlot, MatchParticipant, TeamSide } from '../../../../core/matches/models';
import { computeMatchScores, formatKda } from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { NfAvatar, NfEmojiPicker, NfLaneIcon } from '../../../../ui';
import { ReactionsStore, ReactionTally } from '../../../../core/reactions';
import { playerReactionsFor } from '../../../../core/group-hub';
import { MatchHistoryUiState } from './match-history-ui';

/**
 * Alineación de la partida: lo que se abre al desplegar una fila del historial.
 *
 * Deliberadamente MÍNIMA y distinta de `<app-match-scoreboard>` (la página de análisis):
 * responde a una sola pregunta —"¿quién jugaba y cómo le fue?"— con los diez jugadores,
 * su campeón, su línea y su KDA, y nada más. Objetos, oro, daño, runas, duelos de línea
 * y pestañas viven en `/app/historial/:id`, porque una fila desplegada que repite la
 * página entera convierte la lista en una pared de datos y deja la página sin motivo
 * para existir: el desplegable se ojea, la página se estudia.
 */
@Component({
  selector: 'app-match-lineup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'panelFor.set(null); peekFor.set(null)',
  },
  imports: [RouterLink, NfAvatar, NfEmojiPicker, NfLaneIcon],
  styleUrls: ['./match-lineup.component.scss'],
  templateUrl: './match-lineup.component.html',
})
export class MatchLineupComponent {
  readonly match = input.required<Match>();
  readonly returnTo = input<string | null>(null);
  readonly crossContext = input<{ playerId: string; relation: 'ally' | 'enemy' } | null>(null);
  /**
   * Grupo bajo el que se reacciona a los jugadores, o `null` para no ofrecer reacciones. Es el
   * historial DEL GRUPO el que las abre: en el historial personal la fila no las pinta.
   */
  readonly reactionScope = input<string | null>(null);

  private readonly gameData = inject(GameDataStore);
  private readonly ui = inject(MatchHistoryUiState, { optional: true });
  private readonly reactions = inject(ReactionsStore);

  /**
   * Cuántas reacciones se pintan en la fila. Solo la más votada: el marcador es una tabla densa
   * de diez filas, y cada emoji de más resta sitio al nombre y a los objetos.
   */
  private static readonly VISIBLE_REACTIONS = 1;

  /** Panel de reacciones abierto, por id de participante. Estado de interfaz. */
  readonly panelFor = signal<string | null>(null);
  /** Fila cuyo «+N» tiene el cursor encima: asoma las reacciones sin abrir nada. */
  readonly peekFor = signal<string | null>(null);

  /** Los emojis que más usa el grupo encabezan el selector. */
  readonly quickEmojis = computed(() => this.reactions.mostUsed(this.reactionScope() ?? ''));

  constructor() {
    this.gameData.ensureLoaded();

    // Las reacciones que ya traía cada jugador se siembran una vez; a partir de ahí manda el
    // store. `seed` es idempotente, así que volver a desplegar la fila no las duplica.
    effect(() => {
      const scope = this.reactionScope();
      if (!scope) return;
      const match = this.match();
      for (const team of [match.blueTeam, match.redTeam]) {
        for (const p of team.participants) {
          this.reactions.seed(scope, match.id + ':' + p.id, playerReactionsFor(match.id, p.id));
        }
      }
    });
  }

  /** Clave del objetivo: la reacción es a ESTE jugador en ESTA partida, no al jugador en general. */
  private targetOf(p: MatchParticipant): string {
    return this.match().id + ':' + p.id;
  }

  /** Todas las reacciones del jugador, de la más repetida a la menos y, a empate, por antigüedad. */
  allReactions(p: MatchParticipant): ReactionTally[] {
    return this.reactions.tally(this.reactionScope() ?? '', this.targetOf(p));
  }

  /** La que se pinta en la fila: la más votada. */
  topReactions(p: MatchParticipant): ReactionTally[] {
    return this.allReactions(p).slice(0, MatchLineupComponent.VISIBLE_REACTIONS);
  }

  /** Cuántas quedan fuera de la fila; `0` cuando caben todas (el «+N» no se pinta). */
  hiddenReactions(p: MatchParticipant): number {
    return Math.max(0, this.allReactions(p).length - MatchLineupComponent.VISIBLE_REACTIONS);
  }

  myReaction(p: MatchParticipant): string | null {
    return this.reactions.mine(this.reactionScope() ?? '', this.targetOf(p));
  }

  toggleReaction(p: MatchParticipant, emoji: string, event?: Event): void {
    event?.stopPropagation();
    this.panelFor.set(null);
    this.peekFor.set(null);
    this.reactions.toggle(this.reactionScope() ?? '', this.targetOf(p), emoji);
  }

  openPanel(participantId: string, event: Event): void {
    event.stopPropagation();
    this.peekFor.set(null);
    this.panelFor.update((open) => (open === participantId ? null : participantId));
  }

  /** Asomar las reacciones al pasar el cursor por el «+N», sin abrir el selector. */
  peek(participantId: string): void {
    if (this.panelFor()) return;
    this.peekFor.set(participantId);
  }

  clearPeek(): void {
    this.peekFor.set(null);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.panelFor()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.m-lineup__reactions')) return;
    this.panelFor.set(null);
  }

  protected onOpenDetail(): void {
    this.ui?.recordNavigation(this.match().id);
  }

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly queryParams = computed(() => {
    const to = this.returnTo();
    return to ? { volver: to } : {};
  });

  protected readonly teams = computed(() => {
    const m = this.match();
    return [m.blueTeam, m.redTeam].map((t) => ({
      side: t.side as TeamSide,
      won: t.won,
      kills: t.totalKills,
      barons: t.barons ?? 0,
      elderDragons: t.elderDragons ?? 0,
      voidgrubs: t.voidgrubs ?? 0,
      dragonTypes: t.dragonTypes ?? [],
      participants: [...t.participants].sort(
        (a, b) => LANE_ORDER.indexOf(a.role) - LANE_ORDER.indexOf(b.role),
      ),
    }));
  });

  protected champion(id: number) {
    return this.gameData.championById().get(id);
  }

  /**
   * Mientras el catálogo carga no hay nombre real que enseñar, y el del participante es
   * el que grabó la partida: se pinta ese en vez de un hueco, y se sustituye por el del
   * catálogo cuando llega (mismo texto en la práctica, cero salto de layout).
   */
  protected championName(p: MatchParticipant): string {
    return this.champion(p.championId)?.name ?? p.championName;
  }

  /**
   * Por id de participante, no por `riotId`: la partida ya trae resuelto quién es el
   * usuario de la sesión (`userParticipant`), así que la vista no tiene que conocer
   * ninguna identidad.
   */
  protected isCurrentUser(p: MatchParticipant): boolean {
    return p.id === this.match().userParticipant?.id;
  }

  protected kdaRatio(p: MatchParticipant): string {
    return `${formatKda(p.stats, 1)} KDA`;
  }

  protected participantItems(p: MatchParticipant): (MatchItemSlot | null)[] {
    return (p.stats.items ?? []).slice(0, 8);
  }

  protected drakeIcon(type: DragonType): string {
    const map: Record<DragonType, string> = {
      infernal: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_infernal.png',
      mountain: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon_mountain.png',
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

  private readonly playerScores = computed(() => computeMatchScores(this.match()));

  protected playerRankScore(p: MatchParticipant): string {
    return this.playerScores().get(p.id)?.display ?? '';
  }

  protected playerRank(p: MatchParticipant): number {
    return this.playerScores().get(p.id)?.rank ?? 10;
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
    return p.stats?.primaryRuneId ?? RUNES_FALLBACK[p.role]?.primary ?? 8010;
  }

  protected participantSecondaryRune(p: MatchParticipant): number {
    return p.stats?.secondaryRuneTreeId ?? RUNES_FALLBACK[p.role]?.secondary ?? 8300;
  }

  protected spellIcon(id: number): string | null {
    if (id === 1102) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1102_smite.png';
    }
    if (id === 1101) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1101_smite.png';
    }
    if (id === 1103) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/1103_smite.png';
    }
    if (id === 11) {
      return 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/data/spells/icons2d/summoner_smite.png';
    }

    const fromStore = typeof this.gameData.summonerSpellById === 'function'
      ? this.gameData.summonerSpellById().get(id)?.iconUrl
      : null;
    if (fromStore) return fromStore;
    const names: Record<number, string> = {
      4: 'SummonerFlash',
      12: 'SummonerTeleport',
      11: 'SummonerSmite',
      14: 'SummonerDot',
      7: 'SummonerHeal',
      21: 'SummonerBarrier',
      3: 'SummonerExhaust',
      6: 'SummonerHaste',
    };
    const key = names[id] ?? 'SummonerFlash';
    return `https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/${key}.png`;
  }

  protected spellName(id: number): string {
    if (id === 1102) return 'Smite Desatado (Azul - Caminavientos)';
    if (id === 1101) return 'Smite de Furia (Rojo - Garramélica)';
    if (id === 1103) return 'Smite de Vitalidad (Verde - Brincamusgo)';
    if (id === 11) return 'Smite (Sin evolucionar)';

    const fromStore = typeof this.gameData.summonerSpellById === 'function'
      ? this.gameData.summonerSpellById().get(id)?.name
      : null;
    if (fromStore) return fromStore;
    const names: Record<number, string> = {
      4: 'Destello',
      12: 'Teleportar',
      11: 'Smite',
      14: 'Ignición',
      7: 'Curar',
      21: 'Barrera',
      3: 'Extenuación',
      6: 'Fantasmal',
    };
    return names[id] ?? `Hechizo ${id}`;
  }

  protected runeIcon(id: number | undefined): string | null {
    if (!id) return null;
    const fromStore = typeof this.gameData.perkById === 'function'
      ? this.gameData.perkById().get(id)?.iconUrl
      : null;
    if (fromStore) return fromStore;
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
    const fromStore = typeof this.gameData.perkById === 'function'
      ? this.gameData.perkById().get(id)?.name
      : null;
    if (fromStore) return fromStore;
    const names: Record<number, string> = {
      8010: 'Conquistador',
      8008: 'Compás Letal',
      8021: 'Pies Veloces',
      8005: 'Ataque Intensificado',
      8112: 'Electrocutar',
      8128: 'Cosecha Oscura',
      8214: 'Invocar a Aery',
      8229: 'Cometa Arcano',
      8437: 'Garras del Inmortal',
      8465: 'Protector',
      8351: 'Mejora Glacial',
      8000: 'Precisión',
      8100: 'Dominación',
      8200: 'Brujería',
      8300: 'Inspiración',
      8400: 'Valor',
    };
    return names[id] ?? `Runa ${id}`;
  }
}

/** Orden de lectura de una alineación de LoL, de calle superior a soporte. */
const LANE_ORDER: Lane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];

const RUNES_FALLBACK: Record<Lane, { primary: number; secondary: number }> = {
  TOP: { primary: 8437, secondary: 8000 },
  JUNGLA: { primary: 8010, secondary: 8300 },
  MID: { primary: 8112, secondary: 8200 },
  ADC: { primary: 8008, secondary: 8300 },
  SUPPORT: { primary: 8465, secondary: 8400 },
};
