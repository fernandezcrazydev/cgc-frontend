import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match, MatchParticipant, TeamSide } from '../../../../core/matches/models';
import { GameDataStore } from '../../../../core/game-data';
import { ToastService } from '../../../../core/toast';
import { hash } from '../../../../core/group-ranking';
import { NfAvatar, NfLaneIcon } from '../../../../ui';

@Component({
  selector: 'app-match-scoreboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfLaneIcon],
  template: `
    <div class="m-scoreboard">
      <!-- Tabs de visualización -->
      <div class="m-scoreboard__tabs">
        <button
          type="button"
          class="m-scoreboard__tab nf-mono"
          [class.is-active]="activeTab() === 'overview'"
          (click)="activeTab.set('overview')"
        >
          Marcador 5v5
        </button>
        <button
          type="button"
          class="m-scoreboard__tab nf-mono"
          [class.is-active]="activeTab() === 'charts'"
          (click)="activeTab.set('charts')"
        >
          Gráficos de Daño & Oro
        </button>
        <button
          type="button"
          class="m-scoreboard__tab nf-mono"
          [class.is-active]="activeTab() === 'lanes'"
          (click)="activeTab.set('lanes')"
        >
          Duelos en Línea (14m)
        </button>
      </div>

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
                <span>⚔️ {{ match().blueTeam.totalKills }} Kills</span>
                <span>⬣ {{ formatGold(match().blueTeam.totalGold) }} Oro</span>
                <span>🐉 {{ match().blueTeam.dragons }}</span>
                <span>👾 {{ match().blueTeam.barons }}</span>
                <span>🏰 {{ match().blueTeam.towers }}</span>
              </div>
            </div>

            <div class="m-player-grid">
              <div class="m-player-grid__head nf-mono">
                <span class="m-col-champ">Campeón / Jugador</span>
                <span class="m-col-kda">KDA</span>
                <span class="m-col-damage">Daño infligido</span>
                <span class="m-col-cs">CS / Oro</span>
                <span class="m-col-items">Objetos</span>
                <span class="m-col-lp">Puntos de Liga</span>
              </div>

              @for (p of match().blueTeam.participants; track p.id) {
                <div
                  class="m-player-row"
                  [class.is-current-user]="isCurrentUser(p.riotId)"
                  [class.is-mvp]="p.stats.isMvp"
                >
                  <!-- Campeón & Nombre -->
                  <div class="m-player-row__identity">
                    <div class="m-player-row__champ-wrap">
                      <nf-avatar
                        [src]="champion(p.championId)?.iconUrl ?? null"
                        [fallback]="p.championName"
                        [tint]="p.championId"
                        [size]="38"
                        shape="square"
                      />
                      <span class="m-player-row__lvl nf-mono">{{ p.championLevel }}</span>
                    </div>
                    <div class="m-player-row__meta">
                      <div class="m-player-row__name-wrap">
                        <nf-lane-icon class="m-player-row__role-ico" [lane]="p.role" mode="original" />
                        <span class="m-player-row__name" [title]="p.riotId">{{ p.riotId }}</span>
                        @if (p.stats.isMvp) {
                          <span class="m-mvp-badge nf-mono">MVP</span>
                        }
                        @if (isCurrentUser(p.riotId)) {
                          <span class="m-you-badge nf-mono">TÚ</span>
                        }
                      </div>
                      <span class="m-player-row__champ-name nf-mono">{{ championName(p.championId) }}</span>
                    </div>
                  </div>

                  <!-- KDA -->
                  <div class="m-player-row__kda">
                    <div class="m-player-row__kda-nums">
                      <strong>{{ p.stats.kills }}</strong> /
                      <strong class="m-deaths">{{ p.stats.deaths }}</strong> /
                      <strong>{{ p.stats.assists }}</strong>
                    </div>
                    <span class="m-player-row__kda-ratio nf-mono">{{ kdaRatio(p.stats) }} KDA</span>
                  </div>

                  <!-- Daño con barra -->
                  <div class="m-player-row__damage">
                    <div class="m-damage-val nf-mono">
                      <span>{{ p.stats.totalDamageToChampions.toLocaleString('es-ES') }}</span>
                      <span class="m-damage-pct">({{ p.stats.damageSharePercentage }}%)</span>
                    </div>
                    <div class="m-damage-bar-track">
                      <div
                        class="m-damage-bar-fill m-damage-bar-fill--blue"
                        [style.width.%]="(p.stats.totalDamageToChampions / maxDamage()) * 100"
                      ></div>
                    </div>
                  </div>

                  <!-- CS & Oro -->
                  <div class="m-player-row__cs">
                    <span class="m-cs-text nf-mono">{{ p.stats.cs }} CS ({{ p.stats.csPerMin }}/m)</span>
                    <span class="m-gold-text nf-mono">⬣ {{ formatGold(p.stats.gold) }}</span>
                  </div>

                  <!-- Items & Spells -->
                  <div class="m-player-row__items">
                    <div class="m-items-grid">
                      @for (it of p.stats.items; track $index) {
                        @if (it) {
                          <span
                            class="m-item-slot"
                            [style.background]="itemBg(it.name)"
                            [title]="it.name"
                          ></span>
                        } @else {
                          <span class="m-item-slot m-item-slot--empty"></span>
                        }
                      }
                    </div>
                  </div>

                  <!-- LP Delta -->
                  <div class="m-player-row__lp">
                    <span class="m-lp-pill nf-mono" [class.is-gain]="p.lpDelta > 0" [class.is-loss]="p.lpDelta < 0">
                      {{ p.lpDelta > 0 ? '+' : '' }}{{ p.lpDelta }} LP
                    </span>
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
                <span>⚔️ {{ match().redTeam.totalKills }} Kills</span>
                <span>⬣ {{ formatGold(match().redTeam.totalGold) }} Oro</span>
                <span>🐉 {{ match().redTeam.dragons }}</span>
                <span>👾 {{ match().redTeam.barons }}</span>
                <span>🏰 {{ match().redTeam.towers }}</span>
              </div>
            </div>

            <div class="m-player-grid">
              <div class="m-player-grid__head nf-mono">
                <span class="m-col-champ">Campeón / Jugador</span>
                <span class="m-col-kda">KDA</span>
                <span class="m-col-damage">Daño infligido</span>
                <span class="m-col-cs">CS / Oro</span>
                <span class="m-col-items">Objetos</span>
                <span class="m-col-lp">Puntos de Liga</span>
              </div>

              @for (p of match().redTeam.participants; track p.id) {
                <div
                  class="m-player-row"
                  [class.is-current-user]="isCurrentUser(p.riotId)"
                  [class.is-mvp]="p.stats.isMvp"
                >
                  <!-- Campeón & Nombre -->
                  <div class="m-player-row__identity">
                    <div class="m-player-row__champ-wrap">
                      <nf-avatar
                        [src]="champion(p.championId)?.iconUrl ?? null"
                        [fallback]="p.championName"
                        [tint]="p.championId"
                        [size]="38"
                        shape="square"
                      />
                      <span class="m-player-row__lvl nf-mono">{{ p.championLevel }}</span>
                    </div>
                    <div class="m-player-row__meta">
                      <div class="m-player-row__name-wrap">
                        <nf-lane-icon class="m-player-row__role-ico" [lane]="p.role" mode="original" />
                        <span class="m-player-row__name" [title]="p.riotId">{{ p.riotId }}</span>
                        @if (p.stats.isMvp) {
                          <span class="m-mvp-badge nf-mono">MVP</span>
                        }
                        @if (isCurrentUser(p.riotId)) {
                          <span class="m-you-badge nf-mono">TÚ</span>
                        }
                      </div>
                      <span class="m-player-row__champ-name nf-mono">{{ championName(p.championId) }}</span>
                    </div>
                  </div>

                  <!-- KDA -->
                  <div class="m-player-row__kda">
                    <div class="m-player-row__kda-nums">
                      <strong>{{ p.stats.kills }}</strong> /
                      <strong class="m-deaths">{{ p.stats.deaths }}</strong> /
                      <strong>{{ p.stats.assists }}</strong>
                    </div>
                    <span class="m-player-row__kda-ratio nf-mono">{{ kdaRatio(p.stats) }} KDA</span>
                  </div>

                  <!-- Daño con barra -->
                  <div class="m-player-row__damage">
                    <div class="m-damage-val nf-mono">
                      <span>{{ p.stats.totalDamageToChampions.toLocaleString('es-ES') }}</span>
                      <span class="m-damage-pct">({{ p.stats.damageSharePercentage }}%)</span>
                    </div>
                    <div class="m-damage-bar-track">
                      <div
                        class="m-damage-bar-fill m-damage-bar-fill--red"
                        [style.width.%]="(p.stats.totalDamageToChampions / maxDamage()) * 100"
                      ></div>
                    </div>
                  </div>

                  <!-- CS & Oro -->
                  <div class="m-player-row__cs">
                    <span class="m-cs-text nf-mono">{{ p.stats.cs }} CS ({{ p.stats.csPerMin }}/m)</span>
                    <span class="m-gold-text nf-mono">⬣ {{ formatGold(p.stats.gold) }}</span>
                  </div>

                  <!-- Items & Spells -->
                  <div class="m-player-row__items">
                    <div class="m-items-grid">
                      @for (it of p.stats.items; track $index) {
                        @if (it) {
                          <span
                            class="m-item-slot"
                            [style.background]="itemBg(it.name)"
                            [title]="it.name"
                          ></span>
                        } @else {
                          <span class="m-item-slot m-item-slot--empty"></span>
                        }
                      }
                    </div>
                  </div>

                  <!-- LP Delta -->
                  <div class="m-player-row__lp">
                    <span class="m-lp-pill nf-mono" [class.is-gain]="p.lpDelta > 0" [class.is-loss]="p.lpDelta < 0">
                      {{ p.lpDelta > 0 ? '+' : '' }}{{ p.lpDelta }} LP
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- TAB 2: GRÁFICOS DE DAÑO & ORO -->
      @if (activeTab() === 'charts') {
        <div class="m-scoreboard__tab-content m-charts-tab">
          <div class="m-charts-grid">
            <!-- Gráfico de daño 10 jugadores -->
            <div class="m-chart-card">
              <h3 class="m-chart-card__title nf-mono">Comparativa de daño a campeones</h3>
              <div class="m-chart-bars">
                @for (p of allPlayers(); track p.id) {
                  <div class="m-chart-bar-row">
                    <div class="m-chart-bar-label">
                      <nf-lane-icon class="m-chart-bar-role" [lane]="p.role" mode="original" />
                      <span class="m-chart-bar-name" [title]="p.riotId">{{ p.riotId }}</span>
                    </div>
                    <div class="m-chart-bar-track">
                      <div
                        class="m-chart-bar-value"
                        [class.is-blue]="p.team === 'blue'"
                        [class.is-red]="p.team === 'red'"
                        [style.width.%]="(p.stats.totalDamageToChampions / maxDamage()) * 100"
                      ></div>
                    </div>
                    <span class="m-chart-bar-num nf-mono">{{ (p.stats.totalDamageToChampions / 1000).toFixed(1) }}k</span>
                  </div>
                }
              </div>
            </div>

            <!-- Gráfico de oro acumulado -->
            <div class="m-chart-card">
              <h3 class="m-chart-card__title nf-mono">Distribución de oro total</h3>
              <div class="m-chart-bars">
                @for (p of allPlayers(); track p.id) {
                  <div class="m-chart-bar-row">
                    <div class="m-chart-bar-label">
                      <nf-lane-icon class="m-chart-bar-role" [lane]="p.role" mode="original" />
                      <span class="m-chart-bar-name" [title]="p.riotId">{{ p.riotId }}</span>
                    </div>
                    <div class="m-chart-bar-track">
                      <div
                        class="m-chart-bar-value m-chart-bar-value--gold"
                        [style.width.%]="(p.stats.gold / maxGold()) * 100"
                      ></div>
                    </div>
                    <span class="m-chart-bar-num nf-mono">{{ (p.stats.gold / 1000).toFixed(1) }}k</span>
                  </div>
                }
              </div>
            </div>
          </div>
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
                  <span class="nf-mono">{{ lane.role }}</span>
                </div>

                <!-- Jugador Azul -->
                <div class="m-lane-card__side m-lane-card__side--blue" [class.is-winner]="lane.blue.stats.wonLane">
                  <nf-avatar
                    [src]="champion(lane.blue.championId)?.iconUrl ?? null"
                    [fallback]="lane.blue.championName"
                    [tint]="lane.blue.championId"
                    [size]="36"
                    shape="square"
                  />
                  <div class="m-lane-card__meta">
                    <span class="m-lane-card__player">{{ lane.blue.riotId }}</span>
                    <span class="m-lane-card__champ nf-mono">{{ championName(lane.blue.championId) }}</span>
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
                  <nf-avatar
                    [src]="champion(lane.red.championId)?.iconUrl ?? null"
                    [fallback]="lane.red.championName"
                    [tint]="lane.red.championId"
                    [size]="36"
                    shape="square"
                  />
                  <div class="m-lane-card__meta">
                    <span class="m-lane-card__player">{{ lane.red.riotId }}</span>
                    <span class="m-lane-card__champ nf-mono">{{ championName(lane.red.championId) }}</span>
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

      <!-- Footer de acciones del acordeón -->
      <div class="m-scoreboard__footer">
        <button
          type="button"
          class="m-foot-btn nf-mono"
          (click)="copyMatchLink()"
        >
          🔗 Copiar enlace
        </button>

        @if (showDetailedPageLink()) {
          <a
            class="m-foot-btn m-foot-btn--primary nf-mono"
            [routerLink]="['/app', 'historial', match().id]"
          >
            Ver análisis completo →
          </a>
        }
      </div>
    </div>
  `,
})
export class MatchScoreboardComponent {
  readonly match = input.required<Match>();
  readonly showDetailedPageLink = input(true);

  private readonly gameData = inject(GameDataStore);
  private readonly toasts = inject(ToastService);

  readonly activeTab = signal<'overview' | 'charts' | 'lanes'>('overview');

  readonly allPlayers = computed(() => {
    return [...this.match().blueTeam.participants, ...this.match().redTeam.participants];
  });

  readonly maxDamage = computed(() => {
    const damages = this.allPlayers().map((p) => p.stats.totalDamageToChampions);
    return Math.max(...damages, 1);
  });

  readonly maxGold = computed(() => {
    const golds = this.allPlayers().map((p) => p.stats.gold);
    return Math.max(...golds, 1);
  });

  readonly laneMatchups = computed(() => {
    const m = this.match();
    const roles: MatchParticipant['role'][] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];
    return roles.map((role) => {
      const blueP = m.blueTeam.participants.find((p) => p.role === role) ?? m.blueTeam.participants[0];
      const redP = m.redTeam.participants.find((p) => p.role === role) ?? m.redTeam.participants[0];
      return {
        role,
        blue: blueP,
        red: redP,
      };
    });
  });

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  isCurrentUser(riotId: string): boolean {
    return riotId.toLowerCase() === 'n1ghtfang#lan';
  }

  kdaRatio(stats: MatchParticipant['stats']): string {
    const ratio = stats.deaths === 0 ? stats.kills + stats.assists : (stats.kills + stats.assists) / stats.deaths;
    return ratio.toFixed(2);
  }

  formatGold(gold: number): string {
    return (gold / 1000).toFixed(1) + 'k';
  }

  itemBg(name: string): string {
    const h = hash(name) % 360;
    return `linear-gradient(135deg, hsl(${h},70%,46%), hsl(${h},60%,24%))`;
  }

  copyMatchLink(): void {
    const url = `${window.location.origin}/app/historial/${this.match().id}`;
    navigator.clipboard?.writeText(url);
    this.toasts.info('Enlace de la partida copiado al portapapeles');
  }
}
