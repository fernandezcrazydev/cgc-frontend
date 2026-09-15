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
import { Lane, Match, MatchParticipant } from '../../../../core/matches/models';
import {
  LANE_ORDER,
  computeMatchScores,
  formatKda,
  participantName,
  teamLabel,
} from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { NfAvatar, NfEmojiPicker, NfLaneIcon } from '../../../../ui';
import { ReactionsStore, ReactionTally } from '../../../../core/reactions';
import { playerReactionsFor } from '../../../../core/group-hub';
import { MatchHistoryUiState } from './match-history-ui';

/**
 * Alineación de la partida: lo que se abre al desplegar una fila del historial.
 *
 * Deliberadamente MÍNIMA y distinta de `<app-match-scoreboard>` (la página de análisis):
 * responde a una sola pregunta —«¿quién jugaba y cómo le fue?»— con los diez jugadores, su
 * campeón, su línea y su KDA, y nada más. Oro, daño, duelos de línea y objetivos viven en
 * `/app/historial/:id`, porque una fila desplegada que repite la página entera convierte la
 * lista en una pared de datos y deja la página sin motivo para existir: el desplegable se
 * ojea, la página se estudia.
 *
 * ## Lo que ya no pinta, y por qué no volverá aquí
 *
 * Objetos, runas, hechizos, nivel de campeón y objetivos del equipo. Los tres primeros el
 * backend **no los sirve**: están guardados, pero con nombres de campo sacados de la
 * documentación del cliente de LoL que nadie ha visto en un payload medido. Los objetivos sí
 * existen, pero **solo en el detalle** y solo si la sala decidió lados. Mientras tanto esto se
 * pintaba con una tabla de reserva por línea —el jungla siempre con Smite azul, el soporte
 * siempre con Protector— que no describía ninguna partida real.
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
  template: `
    <div class="m-lineup">
      <div class="m-lineup__teams">
        @for (team of teams(); track team.slot) {
          <div
            class="m-lineup__team"
            [class.m-lineup__team--blue]="team.side === 'blue'"
            [class.m-lineup__team--red]="team.side === 'red'"
          >
            <div class="m-lineup__team-head">
              <span class="m-lineup__team-outcome nf-mono" [class.is-win]="team.won" [class.is-loss]="!team.won">
                {{ team.won ? 'Victoria' : 'Derrota' }}
              </span>
              <!--
                El equipo se nombra siempre, y con color solo cuando lo tiene. «Equipo A» no es
                un texto de reserva: es el nombre correcto de un equipo cuya sala nunca eligió
                bando, y ponerle uno aquí sería inventárselo.
              -->
              <span class="ml-team__name nf-mono">{{ team.label }}</span>
            </div>

            @for (p of team.participants; track p.userId) {
              <div
                class="m-lineup__row"
                [class.is-you]="isCurrentUser(p)"
                [class.m-lineup__row--no-react]="!reactionScope()"
              >
                <nf-lane-icon class="m-lineup__lane" [lane]="p.role" mode="original" />

                <div class="m-lineup__champ-col">
                  <div class="m-lineup__champ-wrap">
                    @if (p.championId; as champId) {
                      <a
                        class="m-lineup__champ-link"
                        [routerLink]="['/app', 'tierlist']"
                        [title]="'Ver estadísticas de ' + championName(p)"
                        (click)="$event.stopPropagation()"
                      >
                        <nf-avatar
                          class="m-lineup__champ"
                          [loading]="champsLoading()"
                          [src]="championIcon(champId)"
                          [fallback]="championName(p)"
                          [tint]="champId"
                          [size]="28"
                          shape="square"
                        />
                      </a>
                    } @else {
                      <span class="ml-row__no-champ" aria-hidden="true"></span>
                    }
                  </div>
                </div>

                <div class="m-lineup__who">
                  <div class="m-lineup__who-top">
                    <a
                      class="m-lineup__player"
                      [routerLink]="isCurrentUser(p) ? ['/app', 'perfil'] : ['/app', 'perfil', p.userId]"
                      [title]="playerName(p)"
                      (click)="$event.stopPropagation()"
                    >
                      {{ playerName(p) }}
                    </a>
                    @if (isCurrentUser(p)) {
                      <span class="m-lineup__tag nf-mono">Tú</span>
                    }
                  </div>
                  @if (p.championId) {
                    <a
                      class="m-lineup__champ-name nf-mono"
                      [routerLink]="['/app', 'tierlist']"
                      [title]="'Ver estadísticas de ' + championName(p)"
                      (click)="$event.stopPropagation()"
                    >
                      {{ championName(p) }}
                    </a>
                  }
                </div>

                @if (playerRankScore(p); as score) {
                  <div class="m-lineup__score-col">
                    <span
                      class="m-lineup__tag m-lineup__tag--score nf-mono"
                      [class.is-mvp]="p.userId === match().mvpUserId"
                      [class.is-ace]="p.userId === match().aceUserId"
                      [class.is-podium]="playerRank(p) <= 3"
                      [title]="'Nota de partida: ' + score"
                    >
                      {{ score }}
                    </span>
                  </div>
                }

                @if (reactionScope(); as scope) {
                  <!-- Reacciones sobre el jugador. En la fila se enseña SOLO la más votada: diez
                       filas con emojis de más se leen como ruido y tapan el marcador. El resto se
                       cuenta en un «+N» que las asoma al pasar el cursor, y el «＋» sigue estando
                       para añadir la tuya. -->
                  <div class="m-lineup__reactions" (mouseleave)="clearPeek()">
                    @for (r of topReactions(p); track r.emoji) {
                      <button
                        type="button"
                        class="m-lineup__reaction"
                        [class.is-mine]="r.mine"
                        [attr.aria-pressed]="r.mine"
                        [attr.aria-label]="(r.mine ? 'Quitar tu reacción ' : 'Reaccionar con ') + r.emoji + ' a ' + playerName(p)"
                        (click)="toggleReaction(p, r.emoji, $event)"
                      >
                        <span aria-hidden="true">{{ r.emoji }}</span>
                        <span class="nf-mono">{{ r.count }}</span>
                      </button>
                    }
                    @if (hiddenReactions(p); as extra) {
                      <button
                        type="button"
                        class="m-lineup__reaction m-lineup__reaction--more nf-mono"
                        [attr.aria-label]="'Ver las ' + extra + ' reacciones restantes de ' + playerName(p)"
                        (mouseenter)="peek(p.userId)"
                        (focus)="peek(p.userId)"
                        (click)="openPanel(p.userId, $event)"
                      >+{{ extra }}</button>
                    }
                    <button
                      type="button"
                      class="m-lineup__react-add"
                      aria-haspopup="menu"
                      [attr.aria-expanded]="panelFor() === p.userId"
                      [attr.aria-label]="'Reaccionar a ' + playerName(p)"
                      (click)="openPanel(p.userId, $event)"
                    >＋</button>

                    @if (panelFor() === p.userId || peekFor() === p.userId) {
                      <div
                        class="m-lineup__react-panel"
                        role="menu"
                        (mouseenter)="peek(p.userId)"
                        (click)="$event.stopPropagation()"
                      >
                        @if (allReactions(p).length) {
                          <div class="m-lineup__react-panel-title nf-mono">Reacciones</div>
                          <div class="m-lineup__react-panel-list" [class.is-peek]="panelFor() !== p.userId">
                            @for (r of allReactions(p); track r.emoji) {
                              <button
                                type="button"
                                class="m-lineup__reaction"
                                [class.is-mine]="r.mine"
                                (click)="toggleReaction(p, r.emoji, $event)"
                              >
                                <span aria-hidden="true">{{ r.emoji }}</span>
                                <span class="nf-mono">{{ r.count }}</span>
                              </button>
                            }
                          </div>
                        }
                        <!-- El selector solo aparece cuando se ha PEDIDO reaccionar; asomarse a lo
                             que votaron los demás no tiene por qué abrir un teclado de emojis. -->
                        @if (panelFor() === p.userId) {
                          <nf-emoji-picker
                            [quick]="quickEmojis()"
                            [selected]="myReaction(p)"
                            (picked)="toggleReaction(p, $event)"
                          />
                        }
                      </div>
                    }
                  </div>
                }

                <div class="m-lineup__kda-col">
                  @if (p.stats.kills != null) {
                    <span class="m-lineup__kda nf-mono">
                      {{ p.stats.kills }}<span class="m-lineup__slash">/</span
                      ><span class="m-lineup__deaths">{{ p.stats.deaths }}</span
                      ><span class="m-lineup__slash">/</span>{{ p.stats.assists }}
                    </span>
                    @if (kdaRatio(p); as ratio) {
                      <span class="m-lineup__ratio nf-mono">{{ ratio }}</span>
                    }
                  } @else if (p.lpDelta != null) {
                    <!--
                      Sin subida no hay marcador, pero sí hay lo que la partida movió en la
                      clasificación: es lo único medido que queda, y es lo que se pinta.
                    -->
                    <span
                      class="m-lineup__kda nf-mono"
                      [class.is-gain]="p.lpDelta > 0"
                      [class.is-loss]="p.lpDelta < 0"
                    >
                      {{ p.lpDelta > 0 ? '+' : '' }}{{ p.lpDelta }} LP
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      @if (!match().hasStats) {
        <p class="ml-no-stats">
          Nadie subió esta partida desde el cliente de LoL, así que no hay campeones ni marcador
          que enseñar. Contó para la clasificación igual.
        </p>
      }

      <div class="m-lineup__actions">
        @if (crossContext(); as ctx) {
          @if (ctx.relation === 'enemy') {
            <a
              class="m-lineup__more nf-mono"
              [routerLink]="['/app', 'jugador', ctx.playerId, 'contra', match().id]"
            >
              Cara a Cara
            </a>
          } @else if (ctx.relation === 'ally') {
            <a
              class="m-lineup__more nf-mono"
              [routerLink]="['/app', 'jugador', ctx.playerId, 'juntos', match().id]"
            >
              Sinergia
            </a>
          }
        }

        <a
          class="m-lineup__more nf-mono"
          [routerLink]="['/app', 'historial', match().id]"
          [queryParams]="queryParams()"
          (click)="onOpenDetail()"
        >
          Análisis completo
        </a>
      </div>
    </div>
  `,
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
   * de diez filas, y cada emoji de más resta sitio al nombre.
   */
  private static readonly VISIBLE_REACTIONS = 1;

  /** Panel de reacciones abierto, por `userId`. Estado de interfaz. */
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
      for (const team of match.teams) {
        for (const p of team.participants) {
          this.reactions.seed(scope, match.id + ':' + p.userId, playerReactionsFor(match.id, p.userId));
        }
      }
    });
  }

  /** Clave del objetivo: la reacción es a ESTE jugador en ESTA partida, no al jugador en general. */
  private targetOf(p: MatchParticipant): string {
    return this.match().id + ':' + p.userId;
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

  openPanel(userId: string, event: Event): void {
    event.stopPropagation();
    this.peekFor.set(null);
    this.panelFor.update((open) => (open === userId ? null : userId));
  }

  /** Asomar las reacciones al pasar el cursor por el «+N», sin abrir el selector. */
  peek(userId: string): void {
    if (this.panelFor()) return;
    this.peekFor.set(userId);
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

  /** Los dos equipos en orden de hueco, cada uno con su alineación ordenada por línea. */
  protected readonly teams = computed(() =>
    this.match().teams.map((t) => ({
      slot: t.slot,
      side: t.side,
      won: t.won,
      label: teamLabel(t),
      participants: [...t.participants].sort(
        (a, b) => laneIndex(a.role) - laneIndex(b.role),
      ),
    })),
  );

  protected championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  /**
   * El nombre del campeón sale del catálogo, que es la única fuente: el asiento solo trae el id.
   * Sin campeón registrado no hay nombre que dar, y el hueco se pinta como hueco.
   */
  protected championName(p: MatchParticipant): string {
    if (p.championId == null) return 'Campeón sin registrar';
    return this.gameData.championById().get(p.championId)?.name ?? `Campeón ${p.championId}`;
  }

  protected playerName(p: MatchParticipant): string {
    return participantName(p);
  }

  /**
   * Por `userId`, no por nombre: la partida ya trae resuelto quién es el usuario de la sesión
   * (`userParticipant`), así que la vista no tiene que conocer ninguna identidad.
   */
  protected isCurrentUser(p: MatchParticipant): boolean {
    return p.userId === this.match().userParticipant?.userId;
  }

  protected kdaRatio(p: MatchParticipant): string | null {
    const ratio = formatKda(p.stats, 1);
    return ratio === null ? null : `${ratio} KDA`;
  }

  /** Vacío si la partida no está subida: una nota sobre un KDA que nadie exportó es un invento. */
  private readonly playerScores = computed(() => computeMatchScores(this.match()));

  protected playerRankScore(p: MatchParticipant): string | null {
    return this.playerScores().get(p.userId)?.display ?? null;
  }

  protected playerRank(p: MatchParticipant): number {
    return this.playerScores().get(p.userId)?.rank ?? 10;
  }
}

/** Orden de lectura de una alineación de LoL, de calle superior a soporte. */
function laneIndex(lane: Lane): number {
  const i = LANE_ORDER.indexOf(lane);
  return i === -1 ? LANE_ORDER.length : i;
}
