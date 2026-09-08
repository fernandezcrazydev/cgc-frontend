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
  template: `
    <div class="m-scoreboard">
      <!-- Tabs de visualización (ocultables si la vista contenedora gestiona pestañas) -->
      @if (showTabs()) {
        <div class="m-scoreboard__tabs">
          <div class="m-scoreboard__tabs-group">
            <button
              type="button"
              class="m-scoreboard__tab nf-mono"
              [class.is-active]="activeTab() === 'overview'"
              (click)="setTab('overview')"
            >
              {{ tabLabels().overview }}
            </button>
            <button
              type="button"
              class="m-scoreboard__tab nf-mono"
              [class.is-active]="activeTab() === 'charts'"
              (click)="setTab('charts')"
            >
              {{ tabLabels().charts }}
            </button>
            <button
              type="button"
              class="m-scoreboard__tab nf-mono"
              [class.is-active]="activeTab() === 'lanes'"
              (click)="setTab('lanes')"
            >
              {{ tabLabels().lanes }}
            </button>
          </div>

          <button
            type="button"
            class="m-scoreboard__share-btn"
            (click)="copyMatchLink()"
            title="Copiar enlace de la partida"
            aria-label="Copiar enlace de la partida"
          >
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>
      }

      <!-- TAB 1: MARCADOR COMPLETO 5v5 -->
      @if (activeTab() === 'overview') {
        <div class="m-scoreboard__tab-content">
          <!-- EQUIPO AZUL -->
          <div class="m-team-table m-team-table--blue">
            <div class="m-team-table__header">
              <div class="m-team-table__title">
                <span class="m-team-table__side-dot m-team-table__side-dot--blue"></span>
                <strong class="m-team-table__name">Equipo Azul</strong>
                <span class="m-team-table__badge nf-mono" [class.is-win]="match().blueTeam.won" [class.is-loss]="!match().blueTeam.won">
                  {{ match().blueTeam.won ? 'Victoria' : 'Derrota' }}
                </span>
              </div>
              <div class="m-team-table__objectives nf-mono">
                <span class="m-team-stat-item" title="Kills totales">
                  <svg viewBox="0 0 24 24" class="m-team-obj-svg" aria-hidden="true"><path fill="currentColor" d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  <strong>{{ match().blueTeam.totalKills }}</strong> kills
                </span>
                <span class="m-team-stat-item" title="Oro total">
                  <img src="/assets/objectives/gold.png" alt="Oro" class="m-team-obj-icon" />
                  <strong>{{ formatGold(match().blueTeam.totalGold) }}</strong>
                </span>

                @if (match().blueTeam.dragonTypes && match().blueTeam.dragonTypes!.length > 0) {
                  <span class="m-team-stat-item m-team-stat-item--drakes" title="Dragones elementales">
                    @for (d of match().blueTeam.dragonTypes; track $index) {
                      <img [src]="drakeIcon(d)" [alt]="d" [title]="drakeTitle(d)" class="m-team-obj-icon m-team-obj-icon--drake" />
                    }
                  </span>
                } @else if (match().blueTeam.dragons > 0) {
                  <span class="m-team-stat-item" [title]="'Dragones: ' + match().blueTeam.dragons">
                    <img src="/assets/objectives/dragon.png" alt="Dragones" class="m-team-obj-icon" />
                    <strong>{{ match().blueTeam.dragons }}</strong>
                  </span>
                }

                @if ((match().blueTeam.barons ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Barón Nashor: ' + match().blueTeam.barons">
                    <img src="/assets/objectives/baron.png" alt="Barón" class="m-team-obj-icon" />
                    <strong>{{ match().blueTeam.barons }}</strong>
                  </span>
                }
                @if ((match().blueTeam.elderDragons ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Dragón Anciano: ' + match().blueTeam.elderDragons">
                    <img src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-100.png" alt="Dragón Anciano" class="m-team-obj-icon" />
                    <strong>{{ match().blueTeam.elderDragons }}</strong>
                  </span>
                }
                @if ((match().blueTeam.heralds ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Heraldo de la Grieta: ' + match().blueTeam.heralds">
                    <img src="/assets/objectives/herald.png" alt="Heraldo" class="m-team-obj-icon" />
                    <strong>{{ match().blueTeam.heralds }}</strong>
                  </span>
                }
                @if ((match().blueTeam.voidgrubs ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Larvas del Vacío: ' + match().blueTeam.voidgrubs">
                    <img src="/assets/objectives/grubs.png" alt="Larvas" class="m-team-obj-icon" />
                    <strong>{{ match().blueTeam.voidgrubs }}</strong>
                  </span>
                }
                <span class="m-team-stat-item" [title]="'Torres destruidas: ' + match().blueTeam.towers">
                  <img src="/assets/objectives/tower.png" alt="Torres" class="m-team-obj-icon" />
                  <strong>{{ match().blueTeam.towers }}</strong>
                </span>
              </div>
            </div>

            <div class="m-player-grid">
              <div class="m-player-grid__head nf-mono">
                <span class="m-col-champ">Invocador / Campeón</span>
                <span class="m-col-score">Nota</span>
                <span class="m-col-kda">KDA</span>
                <span class="m-col-damage">Daño</span>
                <span class="m-col-cs">CS / Oro</span>
                <span class="m-col-items">Objetos</span>
                <span class="m-col-lp">Puntos</span>
                <span class="m-col-reactions">Reacciones</span>
              </div>

              @for (p of match().blueTeam.participants; track p.id) {
                <div
                  class="m-player-row"
                  [class.is-current-user]="isCurrentUser(p.id)"
                  [class.is-mvp]="p.stats.isMvp"
                >
                  <!-- 1. Identidad: Rol → Champ (con nivel) → Hechizos + Runas → Nombre -->
                  <div class="m-player-row__identity">
                    <nf-lane-icon class="m-player-row__role-ico" [lane]="p.role" mode="original" />

                    <div class="m-player-row__champ-wrap">
                      <a
                        [routerLink]="['/app', 'tierlist']"
                        [title]="'Ver estadísticas de ' + championName(p.championId)"
                      >
                        <nf-avatar
                          [src]="champion(p.championId)?.iconUrl ?? null"
                          [fallback]="p.championName"
                          [tint]="p.championId"
                          [size]="34"
                          shape="square"
                        />
                      </a>
                      <span class="m-player-row__lvl nf-mono">{{ p.championLevel }}</span>
                    </div>

                    <div class="m-player-row__spells-runes">
                      <div class="m-player-row__spells">
                        @for (sId of participantSpells(p); track $index) {
                          <nf-avatar
                            class="m-player-row__spell-slot"
                            [src]="spellIcon(sId)"
                            [fallback]="spellName(sId)"
                            [size]="14"
                            shape="square"
                            [title]="spellName(sId)"
                          />
                        }
                      </div>
                      <div class="m-player-row__runes">
                        <nf-avatar
                          class="m-player-row__rune-slot"
                          [src]="runeIcon(participantPrimaryRune(p))"
                          [fallback]="runeName(participantPrimaryRune(p))"
                          [size]="14"
                          shape="round"
                          [title]="runeName(participantPrimaryRune(p))"
                        />
                        <nf-avatar
                          class="m-player-row__rune-slot"
                          [src]="runeIcon(participantSecondaryRune(p))"
                          [fallback]="runeName(participantSecondaryRune(p))"
                          [size]="13"
                          shape="round"
                          [title]="runeName(participantSecondaryRune(p))"
                        />
                      </div>
                    </div>

                    <div class="m-player-row__meta">
                      <div class="m-player-row__name-wrap">
                        <a
                          class="m-player-row__name"
                          [routerLink]="isCurrentUser(p.id) ? ['/app', 'perfil'] : ['/app', 'perfil', p.userId]"
                          [title]="p.riotId"
                        >
                          {{ p.riotId }}
                        </a>
                        @if (p.stats.isMvp) {
                          <span class="m-mvp-badge nf-mono">MVP</span>
                        }
                        @if (p.stats.isAce) {
                          <span class="m-ace-badge nf-mono">ACE</span>
                        }
                        @if (isCurrentUser(p.id)) {
                          <span class="m-you-badge nf-mono">Tú</span>
                        }
                      </div>
                      <a
                        class="m-player-row__champ-name nf-mono"
                        [routerLink]="['/app', 'tierlist']"
                        [title]="'Ver estadísticas de ' + championName(p.championId)"
                      >
                        {{ championName(p.championId) }}
                      </a>
                    </div>
                  </div>

                  <!-- 2. Nota -->
                  <div class="m-player-row__score">
                    <span
                      class="m-score-badge nf-mono"
                      [class.is-mvp]="p.stats.isMvp"
                      [class.is-ace]="p.stats.isAce"
                      [class.is-podium]="playerRank(p) <= 3"
                      [title]="'Nota de partida: ' + playerRankScore(p)"
                    >
                      {{ playerRankScore(p) }}
                    </span>
                  </div>

                  <!-- 3. KDA -->
                  <div class="m-player-row__kda">
                    <div class="m-player-row__kda-nums nf-mono">
                      <strong>{{ p.stats.kills }}</strong> /
                      <strong class="m-deaths">{{ p.stats.deaths }}</strong> /
                      <strong>{{ p.stats.assists }}</strong>
                    </div>
                    <span class="m-player-row__kda-ratio nf-mono">{{ kdaRatio(p.stats) }} KDA</span>
                  </div>

                  <!-- 4. Daño -->
                  <div class="m-player-row__damage">
                    <div class="m-damage-val nf-mono">
                      <span>{{ formatNumber(p.stats.totalDamageToChampions) }}</span>
                      <span class="m-damage-pct">({{ damagePct(p, match().blueTeam) }}%)</span>
                    </div>
                    <div class="m-damage-bar-track">
                      <div
                        class="m-damage-bar-fill m-damage-bar-fill--blue"
                        [style.width.%]="(p.stats.totalDamageToChampions / maxDamage()) * 100"
                      ></div>
                    </div>
                  </div>

                  <!-- 5. CS y Oro -->
                  <div class="m-player-row__cs">
                    <span class="m-cs-text nf-mono">{{ p.stats.cs }} CS ({{ p.stats.csPerMin }}/m)</span>
                    <div class="m-gold-val nf-mono">
                      <img src="/assets/objectives/gold.png" alt="Oro" class="m-gold-coin-sm" />
                      <span>{{ formatGold(p.stats.gold) }}</span>
                    </div>
                  </div>

                  <!-- 6. Objetos -->
                  <div class="m-player-row__items">
                    <div class="m-items-grid">
                      @for (it of p.stats.items; track $index) {
                        @if (it) {
                          <nf-avatar
                            class="m-item-slot"
                            [src]="it.iconUrl ?? null"
                            [fallback]="it.name"
                            [tint]="0"
                            [size]="20"
                            shape="square"
                            [style.background]="itemBg(it.name)"
                            [title]="it.name"
                          />
                        } @else {
                          <span class="m-item-slot m-item-slot--empty"></span>
                        }
                      }
                    </div>
                  </div>

                  <!-- 7. LP Delta -->
                  <div class="m-player-row__lp">
                    <span class="m-lp-pill nf-mono" [class.is-gain]="p.lpDelta > 0" [class.is-loss]="p.lpDelta < 0">
                      {{ p.lpDelta > 0 ? '+' : '' }}{{ p.lpDelta }} LP
                    </span>
                  </div>

                  <!-- 8. Reacciones -->
                  <div class="m-player-row__reactions" (mouseleave)="clearPeek()">
                    @for (r of topReactions(p); track r.emoji) {
                      <button
                        type="button"
                        class="m-reaction-btn"
                        [class.is-mine]="r.mine"
                        [attr.aria-label]="(r.mine ? 'Quitar tu reacción ' : 'Reaccionar con ') + r.emoji + ' a ' + p.riotId"
                        (click)="toggleReaction(p, r.emoji, $event)"
                      >
                        <span aria-hidden="true">{{ r.emoji }}</span>
                        <span class="nf-mono">{{ r.count }}</span>
                      </button>
                    }
                    <div style="position: relative; display: inline-flex;">
                      <button
                        type="button"
                        class="m-add-reaction-btn"
                        (click)="toggleReactionPicker(p.id, $event)"
                        [attr.aria-label]="'Añadir reacción a ' + p.riotId"
                        title="Añadir reacción"
                      >
                        ＋
                      </button>

                      @if (pickerFor() === p.id) {
                        <div class="m-scoreboard-quick-picker" role="menu">
                          @for (em of quickEmojis(); track em) {
                            <button
                              type="button"
                              class="m-scoreboard-emoji-btn"
                              (click)="toggleReaction(p, em, $event)"
                            >
                              {{ em }}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- EQUIPO ROJO -->
          <div class="m-team-table m-team-table--red">
            <div class="m-team-table__header">
              <div class="m-team-table__title">
                <span class="m-team-table__side-dot m-team-table__side-dot--red"></span>
                <strong class="m-team-table__name">Equipo Rojo</strong>
                <span class="m-team-table__badge nf-mono" [class.is-win]="match().redTeam.won" [class.is-loss]="!match().redTeam.won">
                  {{ match().redTeam.won ? 'Victoria' : 'Derrota' }}
                </span>
              </div>
              <div class="m-team-table__objectives nf-mono">
                <span class="m-team-stat-item" title="Kills totales">
                  <svg viewBox="0 0 24 24" class="m-team-obj-svg" aria-hidden="true"><path fill="currentColor" d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
                  <strong>{{ match().redTeam.totalKills }}</strong> kills
                </span>
                <span class="m-team-stat-item" title="Oro total">
                  <img src="/assets/objectives/gold.png" alt="Oro" class="m-team-obj-icon" />
                  <strong>{{ formatGold(match().redTeam.totalGold) }}</strong>
                </span>

                @if (match().redTeam.dragonTypes && match().redTeam.dragonTypes!.length > 0) {
                  <span class="m-team-stat-item m-team-stat-item--drakes" title="Dragones elementales">
                    @for (d of match().redTeam.dragonTypes; track $index) {
                      <img [src]="drakeIcon(d)" [alt]="d" [title]="drakeTitle(d)" class="m-team-obj-icon m-team-obj-icon--drake" />
                    }
                  </span>
                } @else if (match().redTeam.dragons > 0) {
                  <span class="m-team-stat-item" [title]="'Dragones: ' + match().redTeam.dragons">
                    <img src="/assets/objectives/dragon.png" alt="Dragones" class="m-team-obj-icon" />
                    <strong>{{ match().redTeam.dragons }}</strong>
                  </span>
                }

                @if ((match().redTeam.barons ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Barón Nashor: ' + match().redTeam.barons">
                    <img src="/assets/objectives/baron.png" alt="Barón" class="m-team-obj-icon" />
                    <strong>{{ match().redTeam.barons }}</strong>
                  </span>
                }
                @if ((match().redTeam.elderDragons ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Dragón Anciano: ' + match().redTeam.elderDragons">
                    <img src="https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/elder-100.png" alt="Dragón Anciano" class="m-team-obj-icon" />
                    <strong>{{ match().redTeam.elderDragons }}</strong>
                  </span>
                }
                @if ((match().redTeam.heralds ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Heraldo de la Grieta: ' + match().redTeam.heralds">
                    <img src="/assets/objectives/herald.png" alt="Heraldo" class="m-team-obj-icon" />
                    <strong>{{ match().redTeam.heralds }}</strong>
                  </span>
                }
                @if ((match().redTeam.voidgrubs ?? 0) > 0) {
                  <span class="m-team-stat-item" [title]="'Larvas del Vacío: ' + match().redTeam.voidgrubs">
                    <img src="/assets/objectives/grubs.png" alt="Larvas" class="m-team-obj-icon" />
                    <strong>{{ match().redTeam.voidgrubs }}</strong>
                  </span>
                }
                <span class="m-team-stat-item" [title]="'Torres destruidas: ' + match().redTeam.towers">
                  <img src="/assets/objectives/tower.png" alt="Torres" class="m-team-obj-icon" />
                  <strong>{{ match().redTeam.towers }}</strong>
                </span>
              </div>
            </div>

            <div class="m-player-grid">
              <div class="m-player-grid__head nf-mono">
                <span class="m-col-champ">Invocador / Campeón</span>
                <span class="m-col-score">Nota</span>
                <span class="m-col-kda">KDA</span>
                <span class="m-col-damage">Daño</span>
                <span class="m-col-cs">CS / Oro</span>
                <span class="m-col-items">Objetos</span>
                <span class="m-col-lp">Puntos</span>
                <span class="m-col-reactions">Reacciones</span>
              </div>

              @for (p of match().redTeam.participants; track p.id) {
                <div
                  class="m-player-row"
                  [class.is-current-user]="isCurrentUser(p.id)"
                  [class.is-mvp]="p.stats.isMvp"
                >
                  <!-- 1. Identidad: Rol → Champ (con nivel) → Hechizos + Runas → Nombre -->
                  <div class="m-player-row__identity">
                    <nf-lane-icon class="m-player-row__role-ico" [lane]="p.role" mode="original" />

                    <div class="m-player-row__champ-wrap">
                      <a
                        [routerLink]="['/app', 'tierlist']"
                        [title]="'Ver estadísticas de ' + championName(p.championId)"
                      >
                        <nf-avatar
                          [src]="champion(p.championId)?.iconUrl ?? null"
                          [fallback]="p.championName"
                          [tint]="p.championId"
                          [size]="34"
                          shape="square"
                        />
                      </a>
                      <span class="m-player-row__lvl nf-mono">{{ p.championLevel }}</span>
                    </div>

                    <div class="m-player-row__spells-runes">
                      <div class="m-player-row__spells">
                        @for (sId of participantSpells(p); track $index) {
                          <nf-avatar
                            class="m-player-row__spell-slot"
                            [src]="spellIcon(sId)"
                            [fallback]="spellName(sId)"
                            [size]="14"
                            shape="square"
                            [title]="spellName(sId)"
                          />
                        }
                      </div>
                      <div class="m-player-row__runes">
                        <nf-avatar
                          class="m-player-row__rune-slot"
                          [src]="runeIcon(participantPrimaryRune(p))"
                          [fallback]="runeName(participantPrimaryRune(p))"
                          [size]="14"
                          shape="round"
                          [title]="runeName(participantPrimaryRune(p))"
                        />
                        <nf-avatar
                          class="m-player-row__rune-slot"
                          [src]="runeIcon(participantSecondaryRune(p))"
                          [fallback]="runeName(participantSecondaryRune(p))"
                          [size]="13"
                          shape="round"
                          [title]="runeName(participantSecondaryRune(p))"
                        />
                      </div>
                    </div>

                    <div class="m-player-row__meta">
                      <div class="m-player-row__name-wrap">
                        <a
                          class="m-player-row__name"
                          [routerLink]="isCurrentUser(p.id) ? ['/app', 'perfil'] : ['/app', 'perfil', p.userId]"
                          [title]="p.riotId"
                        >
                          {{ p.riotId }}
                        </a>
                        @if (p.stats.isMvp) {
                          <span class="m-mvp-badge nf-mono">MVP</span>
                        }
                        @if (p.stats.isAce) {
                          <span class="m-ace-badge nf-mono">ACE</span>
                        }
                        @if (isCurrentUser(p.id)) {
                          <span class="m-you-badge nf-mono">Tú</span>
                        }
                      </div>
                      <a
                        class="m-player-row__champ-name nf-mono"
                        [routerLink]="['/app', 'tierlist']"
                        [title]="'Ver estadísticas de ' + championName(p.championId)"
                      >
                        {{ championName(p.championId) }}
                      </a>
                    </div>
                  </div>

                  <!-- 2. Nota -->
                  <div class="m-player-row__score">
                    <span
                      class="m-score-badge nf-mono"
                      [class.is-mvp]="p.stats.isMvp"
                      [class.is-ace]="p.stats.isAce"
                      [class.is-podium]="playerRank(p) <= 3"
                      [title]="'Nota de partida: ' + playerRankScore(p)"
                    >
                      {{ playerRankScore(p) }}
                    </span>
                  </div>

                  <!-- 3. KDA -->
                  <div class="m-player-row__kda">
                    <div class="m-player-row__kda-nums nf-mono">
                      <strong>{{ p.stats.kills }}</strong> /
                      <strong class="m-deaths">{{ p.stats.deaths }}</strong> /
                      <strong>{{ p.stats.assists }}</strong>
                    </div>
                    <span class="m-player-row__kda-ratio nf-mono">{{ kdaRatio(p.stats) }} KDA</span>
                  </div>

                  <!-- 4. Daño -->
                  <div class="m-player-row__damage">
                    <div class="m-damage-val nf-mono">
                      <span>{{ formatNumber(p.stats.totalDamageToChampions) }}</span>
                      <span class="m-damage-pct">({{ damagePct(p, match().redTeam) }}%)</span>
                    </div>
                    <div class="m-damage-bar-track">
                      <div
                        class="m-damage-bar-fill m-damage-bar-fill--red"
                        [style.width.%]="(p.stats.totalDamageToChampions / maxDamage()) * 100"
                      ></div>
                    </div>
                  </div>

                  <!-- 5. CS y Oro -->
                  <div class="m-player-row__cs">
                    <span class="m-cs-text nf-mono">{{ p.stats.cs }} CS ({{ p.stats.csPerMin }}/m)</span>
                    <div class="m-gold-val nf-mono">
                      <img src="/assets/objectives/gold.png" alt="Oro" class="m-gold-coin-sm" />
                      <span>{{ formatGold(p.stats.gold) }}</span>
                    </div>
                  </div>

                  <!-- 6. Objetos -->
                  <div class="m-player-row__items">
                    <div class="m-items-grid">
                      @for (it of p.stats.items; track $index) {
                        @if (it) {
                          <nf-avatar
                            class="m-item-slot"
                            [src]="it.iconUrl ?? null"
                            [fallback]="it.name"
                            [tint]="0"
                            [size]="20"
                            shape="square"
                            [style.background]="itemBg(it.name)"
                            [title]="it.name"
                          />
                        } @else {
                          <span class="m-item-slot m-item-slot--empty"></span>
                        }
                      }
                    </div>
                  </div>

                  <!-- 7. LP Delta -->
                  <div class="m-player-row__lp">
                    <span class="m-lp-pill nf-mono" [class.is-gain]="p.lpDelta > 0" [class.is-loss]="p.lpDelta < 0">
                      {{ p.lpDelta > 0 ? '+' : '' }}{{ p.lpDelta }} LP
                    </span>
                  </div>

                  <!-- 8. Reacciones -->
                  <div class="m-player-row__reactions" (mouseleave)="clearPeek()">
                    @for (r of topReactions(p); track r.emoji) {
                      <button
                        type="button"
                        class="m-reaction-btn"
                        [class.is-mine]="r.mine"
                        [attr.aria-label]="(r.mine ? 'Quitar tu reacción ' : 'Reaccionar con ') + r.emoji + ' a ' + p.riotId"
                        (click)="toggleReaction(p, r.emoji, $event)"
                      >
                        <span aria-hidden="true">{{ r.emoji }}</span>
                        <span class="nf-mono">{{ r.count }}</span>
                      </button>
                    }
                    <div style="position: relative; display: inline-flex;">
                      <button
                        type="button"
                        class="m-add-reaction-btn"
                        (click)="toggleReactionPicker(p.id, $event)"
                        [attr.aria-label]="'Añadir reacción a ' + p.riotId"
                        title="Añadir reacción"
                      >
                        ＋
                      </button>

                      @if (pickerFor() === p.id) {
                        <div class="m-scoreboard-quick-picker" role="menu">
                          @for (em of quickEmojis(); track em) {
                            <button
                              type="button"
                              class="m-scoreboard-emoji-btn"
                              (click)="toggleReaction(p, em, $event)"
                            >
                              {{ em }}
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- TAB 2: RANKING DE LA PARTIDA -->
      @if (activeTab() === 'charts') {
        <div class="m-scoreboard__tab-content m-rank-tab">
          <div class="m-rank-head">
            <p class="m-rank-lead">
              Los diez, ordenados de mayor a menor. En orden de equipo estas barras no respondían
              a ninguna pregunta: para saber qué bando pegó más están los totales de la cabecera,
              y para saber quién pegó más hay que poder leerlo de un vistazo.
            </p>
            <nf-segmented
              [options]="metricOptions"
              [value]="metric()"
              (valueChange)="setMetric($event)"
              ariaLabel="Ordenar el ranking por"
            />
          </div>

          <ol class="m-rank-list">
            @for (row of ranking(); track row.player.id; let i = $index) {
              <li class="m-rank-row" [class.is-first]="i === 0" [class.is-you]="isCurrentUser(row.player.id)">
                <span class="m-rank-pos nf-mono">{{ i + 1 }}</span>

                <div class="m-rank-who">
                  <nf-lane-icon class="m-rank-lane" [lane]="row.player.role" mode="original" />
                  <a
                    class="m-rank-name"
                    [routerLink]="isCurrentUser(row.player.id) ? ['/app', 'perfil'] : ['/app', 'perfil', row.player.userId]"
                    [title]="row.player.riotId"
                  >
                    {{ row.player.riotId }}
                  </a>
                  <a
                    class="m-rank-champ nf-mono"
                    [routerLink]="['/app', 'tierlist']"
                    [title]="'Ver estadísticas de ' + championName(row.player.championId)"
                  >
                    {{ championName(row.player.championId) }}
                  </a>
                </div>

                <!--
                  Barra doble: daño arriba, oro abajo, cada una en su propia escala. Ver mucho
                  oro con poco daño identifica a quien farmeó sin aparecer, que es la
                  conversación interesante en un grupo de amigos.
                -->
                <div class="m-rank-bars">
                  <div class="m-rank-bar">
                    <div
                      class="m-rank-bar__fill m-rank-bar__fill--damage"
                      [class.is-blue]="row.player.team === 'blue'"
                      [class.is-red]="row.player.team === 'red'"
                      [style.width.%]="row.damagePct"
                    ></div>
                  </div>
                  <div class="m-rank-bar m-rank-bar--thin">
                    <div class="m-rank-bar__fill m-rank-bar__fill--gold" [style.width.%]="row.goldPct"></div>
                  </div>
                </div>

                <div class="m-rank-values nf-mono">
                  <span class="m-rank-value">{{ row.primary }}</span>
                  <span class="m-rank-value m-rank-value--sub">{{ row.secondary }}</span>
                </div>
              </li>
            }
          </ol>

          <p class="m-rank-legend nf-mono">
            Barra ancha: daño a campeones, con el color del bando. Barra fina: oro.
          </p>
        </div>
      }

      <!-- TAB 3: ENFRENTAMIENTOS DE LÍNEA (14 min) -->
      @if (activeTab() === 'lanes') {
        <div class="m-scoreboard__tab-content m-lanes-tab">
          <div class="m-lanes-list">
            @for (lane of laneMatchups(); track lane.role) {
              <div class="m-lane-card">
                <div class="m-lane-card__role">
                  <nf-lane-icon [lane]="lane.role" mode="original" />
                  <span class="nf-mono">{{ laneLabel(lane.role) }}</span>
                </div>

                <!-- Jugador Azul -->
                <div class="m-lane-card__side m-lane-card__side--blue" [class.is-winner]="lane.blue.stats.wonLane">
                  <a
                    [routerLink]="['/app', 'tierlist']"
                    [title]="'Ver estadísticas de ' + championName(lane.blue.championId)"
                  >
                    <nf-avatar
                      [src]="champion(lane.blue.championId)?.iconUrl ?? null"
                      [fallback]="lane.blue.championName"
                      [tint]="lane.blue.championId"
                      [size]="36"
                      shape="square"
                    />
                  </a>
                  <div class="m-lane-card__meta">
                    <a
                      class="m-lane-card__player"
                      [routerLink]="isCurrentUser(lane.blue.id) ? ['/app', 'perfil'] : ['/app', 'perfil', lane.blue.userId]"
                      [title]="lane.blue.riotId"
                    >
                      {{ lane.blue.riotId }}
                    </a>
                    <a
                      class="m-lane-card__champ nf-mono"
                      [routerLink]="['/app', 'tierlist']"
                      [title]="'Ver estadísticas de ' + championName(lane.blue.championId)"
                    >
                      {{ championName(lane.blue.championId) }}
                    </a>
                    <span class="m-lane-card__stats nf-mono">
                      {{ lane.blue.stats.csAt14 ?? 0 }} CS @14m · {{ formatGold(lane.blue.stats.goldAt14 ?? 0) }} Oro
                    </span>
                  </div>
                  @if (lane.blue.stats.wonLane) {
                    <span class="m-lane-win-badge nf-mono">Ganó línea</span>
                  }
                </div>

                <div class="m-lane-card__vs nf-mono">VS</div>

                <!-- Jugador Rojo -->
                <div class="m-lane-card__side m-lane-card__side--red" [class.is-winner]="lane.red.stats.wonLane">
                  <a
                    [routerLink]="['/app', 'tierlist']"
                    [title]="'Ver estadísticas de ' + championName(lane.red.championId)"
                  >
                    <nf-avatar
                      [src]="champion(lane.red.championId)?.iconUrl ?? null"
                      [fallback]="lane.red.championName"
                      [tint]="lane.red.championId"
                      [size]="36"
                      shape="square"
                    />
                  </a>
                  <div class="m-lane-card__meta">
                    <a
                      class="m-lane-card__player"
                      [routerLink]="isCurrentUser(lane.red.id) ? ['/app', 'perfil'] : ['/app', 'perfil', lane.red.userId]"
                      [title]="lane.red.riotId"
                    >
                      {{ lane.red.riotId }}
                    </a>
                    <a
                      class="m-lane-card__champ nf-mono"
                      [routerLink]="['/app', 'tierlist']"
                      [title]="'Ver estadísticas de ' + championName(lane.red.championId)"
                    >
                      {{ championName(lane.red.championId) }}
                    </a>
                    <span class="m-lane-card__stats nf-mono">
                      {{ lane.red.stats.csAt14 ?? 0 }} CS @14m · {{ formatGold(lane.red.stats.goldAt14 ?? 0) }} Oro
                    </span>
                  </div>
                  @if (lane.red.stats.wonLane) {
                    <span class="m-lane-win-badge nf-mono">Ganó línea</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
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
