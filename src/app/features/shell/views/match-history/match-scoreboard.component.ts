import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match, MatchParticipant, TeamSummary } from '../../../../core/matches/models';
import {
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

@Component({
  selector: 'app-match-scoreboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfLaneIcon, NfSegmented],
  styleUrl: './match-scoreboard.component.scss',
  template: `
    <div class="m-scoreboard">
      <!-- Tabs de visualización -->
      <div class="m-scoreboard__tabs">
        <div class="m-scoreboard__tabs-group">
          <button
            type="button"
            class="m-scoreboard__tab nf-mono"
            [class.is-active]="activeTab() === 'overview'"
            (click)="activeTab.set('overview')"
          >
            {{ tabLabels().overview }}
          </button>
          <button
            type="button"
            class="m-scoreboard__tab nf-mono"
            [class.is-active]="activeTab() === 'charts'"
            (click)="activeTab.set('charts')"
          >
            {{ tabLabels().charts }}
          </button>
          <button
            type="button"
            class="m-scoreboard__tab nf-mono"
            [class.is-active]="activeTab() === 'lanes'"
            (click)="activeTab.set('lanes')"
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
                <span>{{ match().blueTeam.totalKills }} bajas</span>
                <span>{{ formatGold(match().blueTeam.totalGold) }} de oro</span>
                <span>{{ plural(match().blueTeam.dragons, 'dragón', 'dragones') }}</span>
                <span>{{ plural(match().blueTeam.barons, 'barón', 'barones') }}</span>
                <span>{{ plural(match().blueTeam.towers, 'torre', 'torres') }}</span>
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
                  [class.is-current-user]="isCurrentUser(p.id)"
                  [class.is-mvp]="p.stats.isMvp"
                >
                  <!-- Campeón & Nombre -->
                  <div class="m-player-row__identity">
                    <div class="m-player-row__champ-wrap">
                      <a
                        [routerLink]="['/app', 'tierlist']"
                        [title]="'Ver estadísticas de ' + championName(p.championId)"
                      >
                        <nf-avatar
                          [src]="champion(p.championId)?.iconUrl ?? null"
                          [fallback]="p.championName"
                          [tint]="p.championId"
                          [size]="38"
                          shape="square"
                        />
                      </a>
                      <span class="m-player-row__lvl nf-mono">{{ p.championLevel }}</span>
                    </div>
                    <div class="m-player-row__meta">
                      <div class="m-player-row__name-wrap">
                        <nf-lane-icon class="m-player-row__role-ico" [lane]="p.role" mode="original" />
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

                  <!-- KDA -->
                  <div class="m-player-row__kda">
                    <span class="m-player-row__label nf-mono">KDA</span>
                    <div class="m-player-row__kda-nums">
                      <strong>{{ p.stats.kills }}</strong> /
                      <strong class="m-deaths">{{ p.stats.deaths }}</strong> /
                      <strong>{{ p.stats.assists }}</strong>
                    </div>
                    <span class="m-player-row__kda-ratio nf-mono">{{ kdaRatio(p.stats) }} KDA</span>
                  </div>

                  <!-- Daño con barra -->
                  <div class="m-player-row__damage">
                    <span class="m-player-row__label nf-mono">Daño</span>
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

                  <!-- CS & Oro -->
                  <div class="m-player-row__cs">
                    <span class="m-player-row__label nf-mono">CS y oro</span>
                    <span class="m-cs-text nf-mono">{{ p.stats.cs }} CS ({{ p.stats.csPerMin }}/m)</span>
                    <span class="m-gold-text nf-mono">{{ formatGold(p.stats.gold) }} de oro</span>
                  </div>

                  <!-- Items & Spells -->
                  <div class="m-player-row__items">
                    <span class="m-player-row__label nf-mono">Objetos</span>
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
                <span>{{ match().redTeam.totalKills }} bajas</span>
                <span>{{ formatGold(match().redTeam.totalGold) }} de oro</span>
                <span>{{ plural(match().redTeam.dragons, 'dragón', 'dragones') }}</span>
                <span>{{ plural(match().redTeam.barons, 'barón', 'barones') }}</span>
                <span>{{ plural(match().redTeam.towers, 'torre', 'torres') }}</span>
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
                  [class.is-current-user]="isCurrentUser(p.id)"
                  [class.is-mvp]="p.stats.isMvp"
                >
                  <!-- Campeón & Nombre -->
                  <div class="m-player-row__identity">
                    <div class="m-player-row__champ-wrap">
                      <a
                        [routerLink]="['/app', 'tierlist']"
                        [title]="'Ver estadísticas de ' + championName(p.championId)"
                      >
                        <nf-avatar
                          [src]="champion(p.championId)?.iconUrl ?? null"
                          [fallback]="p.championName"
                          [tint]="p.championId"
                          [size]="38"
                          shape="square"
                        />
                      </a>
                      <span class="m-player-row__lvl nf-mono">{{ p.championLevel }}</span>
                    </div>
                    <div class="m-player-row__meta">
                      <div class="m-player-row__name-wrap">
                        <nf-lane-icon class="m-player-row__role-ico" [lane]="p.role" mode="original" />
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

                  <!-- KDA -->
                  <div class="m-player-row__kda">
                    <span class="m-player-row__label nf-mono">KDA</span>
                    <div class="m-player-row__kda-nums">
                      <strong>{{ p.stats.kills }}</strong> /
                      <strong class="m-deaths">{{ p.stats.deaths }}</strong> /
                      <strong>{{ p.stats.assists }}</strong>
                    </div>
                    <span class="m-player-row__kda-ratio nf-mono">{{ kdaRatio(p.stats) }} KDA</span>
                  </div>

                  <!-- Daño con barra -->
                  <div class="m-player-row__damage">
                    <span class="m-player-row__label nf-mono">Daño</span>
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

                  <!-- CS & Oro -->
                  <div class="m-player-row__cs">
                    <span class="m-player-row__label nf-mono">CS y oro</span>
                    <span class="m-cs-text nf-mono">{{ p.stats.cs }} CS ({{ p.stats.csPerMin }}/m)</span>
                    <span class="m-gold-text nf-mono">{{ formatGold(p.stats.gold) }} de oro</span>
                  </div>

                  <!-- Items & Spells -->
                  <div class="m-player-row__items">
                    <span class="m-player-row__label nf-mono">Objetos</span>
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

  private readonly gameData = inject(GameDataStore);
  private readonly toasts = inject(ToastService);
  private readonly viewport = inject(Viewport);

  readonly activeTab = signal<'overview' | 'charts' | 'lanes'>('overview');

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
