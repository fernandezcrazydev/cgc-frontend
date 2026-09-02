import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameDataStore } from '../../../core/game-data';
import { GroupsStore } from '../../../core/groups';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { Lane, Match, MatchParticipant } from '../../../core/matches/models';
import { NfAvatar, NfButton, NfLaneIcon } from '../../../ui';

export type TierRank = 'S+' | 'S' | 'A' | 'B' | 'C';
export type SortColumn = 'rank' | 'tier' | 'name' | 'role' | 'games' | 'winrate' | 'kda' | 'damage';

export interface ChampionPlayerStat {
  name: string;
  riotId: string;
  avatarUrl: string | null;
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  kdaRatio: string;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
}

export interface ChampionMetaRow {
  championId: number;
  name: string;
  title: string;
  iconUrl: string | null;
  role: Lane;
  roleTags: string[];
  games: number;
  wins: number;
  losses: number;
  winrate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kdaRatio: string;
  kdaNum: number;
  avgDamagePerMin: number;
  pickrate: number;
  tier: TierRank;
  tierWeight: number;
  specialist: {
    name: string;
    riotId: string;
    avatarUrl: string | null;
    wins: number;
    games: number;
    winrate: number;
  } | null;
  // Métricas de Early Game y Economía
  laneWinrate: number;
  avgGoldAt14: number;
  avgCsAt14: number;
  avgGoldPerMin: number;
  avgCsPerMin: number;
  avgVisionScore: number;
  avgDamageShare: number;
  players: ChampionPlayerStat[];
}

const ROLE_FILTERS: readonly { id: Lane | 'ALL'; label: string; glyph: string }[] = [
  { id: 'ALL', label: 'Todas', glyph: '★' },
  { id: 'TOP', label: 'TOP', glyph: '⚔' },
  { id: 'JUNGLA', label: 'JG', glyph: '🌲' },
  { id: 'MID', label: 'MID', glyph: '⚡' },
  { id: 'ADC', label: 'ADC', glyph: '🏹' },
  { id: 'SUPPORT', label: 'SUP', glyph: '🛡' },
];

/**
 * Vista de Tierlist de Campeones del Grupo (/app/grupos/:id/tierlist).
 *
 * Data Grid analítico competitivo con cajón desplegable interactivo (Deep-Dive) para
 * cada campeón, mostrando métricas de Early Game (min 14), Economía, Combate y jugadores.
 */
@Component({
  selector: 'app-tierlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, NfButton, NfLaneIcon, NfAvatar],
  template: `
    <div class="tierlist-view">
      @if (totalMatches() === 0) {
        <!-- Estado Vacío: Sin partidas en este grupo -->
        <div class="tierlist-empty">
          <div class="tierlist-empty__icon" aria-hidden="true">⚔</div>
          <h2 class="tierlist-empty__title">Sin partidas registradas todavía</h2>
          <p class="tierlist-empty__hint">
            Este grupo aún no tiene partidas jugadas para calcular el metagame. ¡Crea y juega
            partidas custom para desbloquear la Tierlist y ver a los mejores especialistas!
          </p>
          <button
            nfButton
            variant="primary"
            size="md"
            [routerLink]="['/app', 'grupos', groupId(), 'crear-partida']"
          >
            ＋ Crear partida
          </button>
        </div>
      } @else {
        <!-- Barra de herramientas: Filtros y Búsqueda -->
        <div class="tierlist-toolbar">
          <div class="tierlist-search">
            <input
              type="text"
              class="tierlist-search__input"
              placeholder="Buscar campeón..."
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              aria-label="Buscar campeón por nombre"
            />
            @if (searchQuery()) {
              <button
                type="button"
                class="tierlist-search__clear"
                (click)="searchQuery.set('')"
                aria-label="Limpiar búsqueda"
              >
                ✕
              </button>
            }
          </div>

          <div class="tierlist-roles" role="group" aria-label="Filtrar por posición">
            @for (rf of roleFilters; track rf.id) {
              <button
                type="button"
                class="tierlist-role-btn"
                [class.is-active]="selectedRole() === rf.id"
                (click)="selectedRole.set(rf.id)"
              >
                @if (rf.id === 'ALL') {
                  <span class="tierlist-role-icon">{{ rf.glyph }}</span>
                } @else {
                  <nf-lane-icon [lane]="rf.id" [fallbackGlyph]="rf.glyph" class="tierlist-role-icon" />
                }
                <span>{{ rf.label }}</span>
              </button>
            }
          </div>

          <div class="tierlist-meta-count nf-mono">
            <span>{{ totalMatches() }} {{ totalMatches() === 1 ? 'partida analizada' : 'partidas analizadas' }}</span>
          </div>
        </div>

        <!-- Data Grid de Metagame -->
        <div class="tierlist-table-card">
          <div class="tierlist-table-wrapper">
            <table class="tierlist-table" aria-label="Clasificación de campeones del metagame">
              <thead>
                <tr>
                  <th scope="col" class="tierlist-th col-rank">#</th>
                  <th
                    scope="col"
                    class="tierlist-th col-tier is-sortable"
                    [class.is-active]="sortColumn() === 'tier'"
                    (click)="toggleSort('tier')"
                  >
                    <span class="tierlist-th-content">
                      Tier
                      @if (sortColumn() === 'tier') {
                        <span class="tierlist-sort-icon">{{ sortAsc() ? '▲' : '▼' }}</span>
                      }
                    </span>
                  </th>
                  <th
                    scope="col"
                    class="tierlist-th col-champ is-sortable"
                    [class.is-active]="sortColumn() === 'name'"
                    (click)="toggleSort('name')"
                  >
                    <span class="tierlist-th-content">
                      Campeón
                      @if (sortColumn() === 'name') {
                        <span class="tierlist-sort-icon">{{ sortAsc() ? '▲' : '▼' }}</span>
                      }
                    </span>
                  </th>
                  <th
                    scope="col"
                    class="tierlist-th col-role is-sortable"
                    [class.is-active]="sortColumn() === 'role'"
                    (click)="toggleSort('role')"
                  >
                    <span class="tierlist-th-content">
                      Rol
                      @if (sortColumn() === 'role') {
                        <span class="tierlist-sort-icon">{{ sortAsc() ? '▲' : '▼' }}</span>
                      }
                    </span>
                  </th>
                  <th
                    scope="col"
                    class="tierlist-th col-games is-sortable"
                    [class.is-active]="sortColumn() === 'games'"
                    (click)="toggleSort('games')"
                  >
                    <span class="tierlist-th-content">
                      Partidas
                      @if (sortColumn() === 'games') {
                        <span class="tierlist-sort-icon">{{ sortAsc() ? '▲' : '▼' }}</span>
                      }
                    </span>
                  </th>
                  <th
                    scope="col"
                    class="tierlist-th col-winrate is-sortable"
                    [class.is-active]="sortColumn() === 'winrate'"
                    (click)="toggleSort('winrate')"
                  >
                    <span class="tierlist-th-content">
                      Winrate
                      @if (sortColumn() === 'winrate') {
                        <span class="tierlist-sort-icon">{{ sortAsc() ? '▲' : '▼' }}</span>
                      }
                    </span>
                  </th>
                  <th
                    scope="col"
                    class="tierlist-th col-kda is-sortable"
                    [class.is-active]="sortColumn() === 'kda'"
                    (click)="toggleSort('kda')"
                  >
                    <span class="tierlist-th-content">
                      KDA Medio
                      @if (sortColumn() === 'kda') {
                        <span class="tierlist-sort-icon">{{ sortAsc() ? '▲' : '▼' }}</span>
                      }
                    </span>
                  </th>
                  <th
                    scope="col"
                    class="tierlist-th col-damage is-sortable"
                    [class.is-active]="sortColumn() === 'damage'"
                    (click)="toggleSort('damage')"
                  >
                    <span class="tierlist-th-content">
                      Daño/min
                      @if (sortColumn() === 'damage') {
                        <span class="tierlist-sort-icon">{{ sortAsc() ? '▲' : '▼' }}</span>
                      }
                    </span>
                  </th>
                  <th scope="col" class="tierlist-th col-specialist">Especialista</th>
                  <th scope="col" class="tierlist-th col-chevron" aria-label="Expandir fila"></th>
                </tr>
              </thead>
              <tbody>
                @for (champ of sortedRows(); track champ.championId; let idx = $index) {
                  <!-- Fila Principal del Campeón -->
                  <tr
                    class="tierlist-tr is-clickable"
                    [class.is-expanded]="expandedChampId() === champ.championId"
                    (click)="toggleExpand(champ.championId)"
                    [attr.aria-expanded]="expandedChampId() === champ.championId"
                    role="button"
                    tabindex="0"
                    (keydown.enter)="toggleExpand(champ.championId)"
                    (keydown.space)="toggleExpand(champ.championId); $event.preventDefault()"
                  >
                    <!-- # Posición -->
                    <td class="tierlist-td col-rank nf-mono">{{ idx + 1 }}</td>

                    <!-- Tier Badge -->
                    <td class="tierlist-td col-tier">
                      <span class="tier-badge" [class]="tierBadgeClass(champ.tier)">
                        {{ champ.tier }}
                      </span>
                    </td>

                    <!-- Campeón con Icono y Nombre -->
                    <td class="tierlist-td col-champ">
                      <div class="tierlist-champ-cell">
                        @if (champ.iconUrl) {
                          <img
                            class="tierlist-champ-avatar"
                            [src]="champ.iconUrl"
                            [alt]="champ.name"
                            loading="lazy"
                          />
                        } @else {
                          <div class="tierlist-champ-avatar-placeholder">
                            {{ champ.name.slice(0, 2) }}
                          </div>
                        }
                        <div class="tierlist-champ-info">
                          <span class="tierlist-champ-name">{{ champ.name }}</span>
                          <span class="tierlist-champ-title">{{ champ.title }}</span>
                        </div>
                      </div>
                    </td>

                    <!-- Rol Principal -->
                    <td class="tierlist-td col-role">
                      <div class="tierlist-role-cell">
                        <nf-lane-icon [lane]="champ.role" />
                        <span>{{ champ.role }}</span>
                      </div>
                    </td>

                    <!-- Partidas y Pickrate -->
                    <td class="tierlist-td col-games">
                      <div class="tierlist-games-cell">
                        <span class="tierlist-games-total nf-mono">
                          {{ champ.games }} {{ champ.games === 1 ? 'partida' : 'partidas' }}
                        </span>
                        <span class="tierlist-games-pickrate nf-mono">
                          {{ champ.pickrate }}% presencia
                        </span>
                      </div>
                    </td>

                    <!-- Winrate con Barra de Progreso -->
                    <td class="tierlist-td col-winrate">
                      <div class="tierlist-winrate-cell">
                        <div class="tierlist-winrate-header">
                          <span
                            class="tierlist-winrate-num nf-mono"
                            [class.is-positive]="champ.winrate >= 50"
                            [class.is-negative]="champ.winrate < 50"
                          >
                            {{ champ.winrate }}%
                          </span>
                          <span class="tierlist-record nf-mono">
                            {{ champ.wins }}V - {{ champ.losses }}D
                          </span>
                        </div>
                        <div class="tierlist-meter-bar">
                          <div
                            class="tierlist-meter-fill"
                            [class.is-positive]="champ.winrate >= 50"
                            [class.is-negative]="champ.winrate < 50"
                            [style.width.%]="champ.winrate"
                          ></div>
                        </div>
                      </div>
                    </td>

                    <!-- KDA Medio -->
                    <td class="tierlist-td col-kda">
                      <div class="tierlist-kda-cell">
                        <span class="tierlist-kda-ratio nf-mono">{{ champ.kdaRatio }} KDA</span>
                        <span class="tierlist-kda-split nf-mono">
                          {{ champ.avgKills }}/{{ champ.avgDeaths }}/{{ champ.avgAssists }}
                        </span>
                      </div>
                    </td>

                    <!-- Daño Medio por Minuto -->
                    <td class="tierlist-td col-damage">
                      <div class="tierlist-damage-cell">
                        <span class="tierlist-damage-val nf-mono">{{ champ.avgDamagePerMin }}</span>
                        <span class="tierlist-damage-unit">D/min</span>
                      </div>
                    </td>

                    <!-- Especialista -->
                    <td class="tierlist-td col-specialist">
                      @if (champ.specialist; as spec) {
                        <div class="tierlist-specialist-cell">
                          <nf-avatar [src]="spec.avatarUrl ?? null" [fallback]="spec.name" [size]="24" shape="round" />
                          <div class="tierlist-specialist-info">
                            <span class="tierlist-specialist-name">{{ spec.name }}</span>
                            <span class="tierlist-specialist-stat nf-mono">
                              {{ spec.wins }}V ({{ spec.winrate }}%)
                            </span>
                          </div>
                        </div>
                      } @else {
                        <span class="tierlist-no-specialist">—</span>
                      }
                    </td>

                    <!-- Chevron indicador de expansión al extremo derecho -->
                    <td class="tierlist-td col-chevron">
                      <svg
                        class="tierlist-chevron"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                        focusable="false"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </td>
                  </tr>

                  <!-- Fila de Desglose Analítico Profundo (Deep-Dive Drawer) -->
                  @if (expandedChampId() === champ.championId) {
                    <tr class="tierlist-drawer-tr">
                      <td colspan="10" class="tierlist-drawer-td">
                        <div class="tierlist-drawer-content">
                          <div class="tierlist-drawer-header">
                            <span class="tierlist-drawer-eyebrow nf-mono">
                              ⚡ Desglose de Metagame & Rendimiento · {{ champ.name }}
                            </span>
                          </div>

                          <div class="tierlist-drawer-grid">
                            <!-- Tarjeta 1: Fase de Líneas (Early Game) -->
                            <div class="tierlist-drawer-card">
                              <div class="drawer-card-head">
                                <span class="drawer-card-icon" aria-hidden="true">🛡️</span>
                                <span class="drawer-card-title">Fase de Líneas (Min 14)</span>
                              </div>
                              <div class="drawer-metrics-list">
                                <div class="drawer-metric-item">
                                  <span class="drawer-metric-label">Tasa de línea ganada</span>
                                  <span
                                    class="drawer-metric-val nf-mono"
                                    [class.is-positive]="champ.laneWinrate >= 50"
                                    [class.is-negative]="champ.laneWinrate < 50"
                                  >
                                    {{ champ.laneWinrate }}%
                                  </span>
                                </div>
                                <div class="drawer-metric-item">
                                  <span class="drawer-metric-label">Oro medio al min 14</span>
                                  <span class="drawer-metric-val nf-mono">
                                    {{ champ.avgGoldAt14.toLocaleString() }} oro
                                  </span>
                                </div>
                                <div class="drawer-metric-item">
                                  <span class="drawer-metric-label">Súbditos al min 14</span>
                                  <span class="drawer-metric-val nf-mono">
                                    {{ champ.avgCsAt14 }} CS
                                  </span>
                                </div>
                              </div>
                            </div>

                            <!-- Tarjeta 2: Economía & Macro -->
                            <div class="tierlist-drawer-card">
                              <div class="drawer-card-head">
                                <span class="drawer-card-icon" aria-hidden="true">💰</span>
                                <span class="drawer-card-title">Economía & Macro</span>
                              </div>
                              <div class="drawer-metrics-list">
                                <div class="drawer-metric-item">
                                  <span class="drawer-metric-label">Oro por minuto</span>
                                  <span class="drawer-metric-val nf-mono">
                                    {{ champ.avgGoldPerMin }} GPM
                                  </span>
                                </div>
                                <div class="drawer-metric-item">
                                  <span class="drawer-metric-label">Farmeo por minuto</span>
                                  <span class="drawer-metric-val nf-mono">
                                    {{ champ.avgCsPerMin }} CS/min
                                  </span>
                                </div>
                                <div class="drawer-metric-item">
                                  <span class="drawer-metric-label">Puntuación de visión</span>
                                  <span class="drawer-metric-val nf-mono">
                                    {{ champ.avgVisionScore }} pts/part.
                                  </span>
                                </div>
                                <div class="drawer-metric-item">
                                  <span class="drawer-metric-label">Aporte de daño al equipo</span>
                                  <span class="drawer-metric-val nf-mono">
                                    {{ champ.avgDamageShare }}% cuota
                                  </span>
                                </div>
                              </div>
                            </div>

                            <!-- Tarjeta 3: Jugadores del Grupo -->
                            <div class="tierlist-drawer-card tierlist-drawer-card--players">
                              <div class="drawer-card-head">
                                <span class="drawer-card-icon" aria-hidden="true">👥</span>
                                <span class="drawer-card-title">
                                  Jugadores del Grupo ({{ champ.players.length }})
                                </span>
                              </div>
                              <div class="drawer-players-list">
                                @for (p of champ.players; track p.riotId) {
                                  <div class="drawer-player-item">
                                    <nf-avatar [src]="p.avatarUrl ?? null" [fallback]="p.name" [size]="22" shape="round" />
                                    <div class="drawer-player-meta">
                                      <span class="drawer-player-name">{{ p.name }}</span>
                                      <span class="drawer-player-stats nf-mono">
                                        {{ p.kdaRatio }} KDA ({{ p.avgKills }}/{{ p.avgDeaths }}/{{ p.avgAssists }})
                                      </span>
                                    </div>
                                    <div class="drawer-player-badge nf-mono" [class.is-positive]="p.winrate >= 50">
                                      {{ p.wins }}V - {{ p.losses }}D ({{ p.winrate }}%)
                                    </div>
                                  </div>
                                } @empty {
                                  <div class="drawer-player-empty nf-mono">Sin registros individuales</div>
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr>
                    <td colspan="10">
                      <div class="tierlist-empty-filter">
                        <p>No se encontraron campeones para los filtros seleccionados.</p>
                        <button nfButton variant="ghost" size="sm" (click)="resetFilters()">
                          Limpiar filtros
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
  styleUrls: ['./tierlist.scss'],
})
export class Tierlist {
  private readonly route = inject(ActivatedRoute);
  private readonly groups = inject(GroupsStore);
  private readonly gameData = inject(GameDataStore);
  private readonly matchHistory = inject(MatchHistoryStore);

  readonly roleFilters = ROLE_FILTERS;

  /** Id del grupo resuelto desde la ruta (/app/grupos/:id/tierlist). */
  readonly groupId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: '' },
  );

  /** Grupo activo para el rótulo de cabecera. */
  readonly group = computed(() => this.groups.byId(this.groupId()));
  readonly groupName = computed(() => this.group()?.name ?? 'Grupo');

  /** Partidas disputadas en este grupo (con fallback a partidas disponibles en desarrollo). */
  readonly groupMatches = computed<Match[]>(() => {
    const id = this.groupId();
    if (!id) return [];
    const directMatches = this.matchHistory.matchesByGroup(id);
    if (directMatches.length > 0) return directMatches;
    // En desarrollo: si el grupo específico no tiene partidas registradas con su ID exacto,
    // usamos las partidas disponibles en el store para permitir previsualizar el metagame y la tabla.
    return this.matchHistory.allMatches();
  });

  readonly totalMatches = computed(() => this.groupMatches().length);

  /** Estado de filtros locales con signals */
  readonly searchQuery = signal('');
  readonly selectedRole = signal<Lane | 'ALL'>('ALL');
  readonly sortColumn = signal<SortColumn>('winrate');
  readonly sortAsc = signal<boolean>(false);

  /** Fila actualmente expandida con el cajón Deep-Dive (id del campeón o null). */
  readonly expandedChampId = signal<number | null>(null);

  constructor() {
    void this.groups.ensureLoaded();
    void this.gameData.ensureLoaded();
  }

  /**
   * Cálculo reactivo de todas las filas de metagame del grupo a partir de las partidas reales.
   */
  readonly allRows = computed<ChampionMetaRow[]>(() => {
    const matches = this.groupMatches();
    const total = matches.length;
    if (total === 0) return [];

    const champMap = this.gameData.championById();

    interface PlayerAcc {
      name: string;
      riotId: string;
      avatarUrl: string | null;
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
    }

    interface ChampAccumulator {
      championId: number;
      name: string;
      title: string;
      iconUrl: string | null;
      tags: string[];
      games: number;
      wins: number;
      kills: number;
      deaths: number;
      assists: number;
      damageTotal: number;
      goldTotal: number;
      goldAt14Total: number;
      csAt14Total: number;
      csPerMinTotal: number;
      visionTotal: number;
      damageShareTotal: number;
      wonLaneCount: number;
      durationMinutesTotal: number;
      roleCounts: Map<Lane, number>;
      playerStats: Map<string, PlayerAcc>;
    }

    const accumulators = new Map<number, ChampAccumulator>();

    for (const match of matches) {
      const durationMin = Math.max(1, Math.round(match.durationSeconds / 60));
      const winningTeam = match.winningTeam;
      const participants: MatchParticipant[] = [
        ...match.blueTeam.participants,
        ...match.redTeam.participants,
      ];

      for (const p of participants) {
        let acc = accumulators.get(p.championId);
        if (!acc) {
          const info = champMap.get(p.championId);
          acc = {
            championId: p.championId,
            name: info?.name ?? p.championName,
            title: info?.title ?? '',
            iconUrl: info?.iconUrl ?? null,
            tags: info?.tags ?? [],
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            damageTotal: 0,
            goldTotal: 0,
            goldAt14Total: 0,
            csAt14Total: 0,
            csPerMinTotal: 0,
            visionTotal: 0,
            damageShareTotal: 0,
            wonLaneCount: 0,
            durationMinutesTotal: 0,
            roleCounts: new Map<Lane, number>(),
            playerStats: new Map(),
          };
          accumulators.set(p.championId, acc);
        }

        const isWin = p.team === winningTeam;
        acc.games++;
        if (isWin) acc.wins++;
        acc.kills += p.stats.kills;
        acc.deaths += p.stats.deaths;
        acc.assists += p.stats.assists;
        acc.damageTotal += p.stats.totalDamageToChampions ?? 0;
        acc.goldTotal += p.stats.gold ?? 0;
        acc.goldAt14Total += p.stats.goldAt14 ?? 0;
        acc.csAt14Total += p.stats.csAt14 ?? 0;
        acc.csPerMinTotal += p.stats.csPerMin ?? 0;
        acc.visionTotal += p.stats.visionScore ?? 0;
        acc.damageShareTotal += p.stats.damageSharePercentage ?? 0;
        if (p.stats.wonLane) acc.wonLaneCount++;
        acc.durationMinutesTotal += durationMin;

        acc.roleCounts.set(p.role, (acc.roleCounts.get(p.role) ?? 0) + 1);

        // Player tracking
        const key = p.riotId || p.discordUsername || 'Jugador';
        const displayName = p.discordUsername ?? p.riotId.split('#')[0] ?? p.riotId;
        let pAcc = acc.playerStats.get(key);
        if (!pAcc) {
          pAcc = {
            name: displayName,
            riotId: key,
            avatarUrl: p.avatarUrl ?? null,
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
          };
          acc.playerStats.set(key, pAcc);
        }
        pAcc.games++;
        if (isWin) pAcc.wins++;
        pAcc.kills += p.stats.kills;
        pAcc.deaths += p.stats.deaths;
        pAcc.assists += p.stats.assists;
      }
    }

    const rows: ChampionMetaRow[] = [];

    for (const acc of accumulators.values()) {
      const winrate = Math.round((acc.wins / acc.games) * 100);
      const losses = acc.games - acc.wins;
      const avgKills = +(acc.kills / acc.games).toFixed(1);
      const avgDeaths = +(acc.deaths / acc.games).toFixed(1);
      const avgAssists = +(acc.assists / acc.games).toFixed(1);
      const kdaNum = acc.deaths === 0 ? acc.kills + acc.assists : (acc.kills + acc.assists) / acc.deaths;
      const kdaRatio = kdaNum.toFixed(2);
      const avgDamagePerMin = Math.round(acc.damageTotal / Math.max(1, acc.durationMinutesTotal));
      const pickrate = Math.round((acc.games / total) * 100);

      // Early Game & Economía
      const laneWinrate = Math.round((acc.wonLaneCount / acc.games) * 100);
      const avgGoldAt14 = Math.round(acc.goldAt14Total / acc.games);
      const avgCsAt14 = Math.round(acc.csAt14Total / acc.games);
      const avgGoldPerMin = Math.round(acc.goldTotal / Math.max(1, acc.durationMinutesTotal));
      const avgCsPerMin = +(acc.csPerMinTotal / acc.games).toFixed(1);
      const avgVisionScore = Math.round(acc.visionTotal / acc.games);
      const avgDamageShare = Math.round(acc.damageShareTotal / acc.games);

      // Determinación del rol principal en este grupo
      let primaryRole: Lane = 'MID';
      let maxRoleCount = -1;
      for (const [role, count] of acc.roleCounts.entries()) {
        if (count > maxRoleCount) {
          maxRoleCount = count;
          primaryRole = role;
        }
      }

      // Asignación de Tier
      let tier: TierRank = 'C';
      let tierWeight = 1;
      if (winrate >= 62 && acc.games >= 3) {
        tier = 'S+';
        tierWeight = 5;
      } else if (winrate >= 56 && acc.games >= 2) {
        tier = 'S';
        tierWeight = 4;
      } else if (winrate >= 50) {
        tier = 'A';
        tierWeight = 3;
      } else if (winrate >= 42) {
        tier = 'B';
        tierWeight = 2;
      } else {
        tier = 'C';
        tierWeight = 1;
      }

      // Desglose de jugadores ordenados por victorias / winrate
      const players: ChampionPlayerStat[] = [];
      for (const pStat of acc.playerStats.values()) {
        const pWr = Math.round((pStat.wins / pStat.games) * 100);
        const pKda = pStat.deaths === 0
          ? (pStat.kills + pStat.assists).toFixed(2)
          : ((pStat.kills + pStat.assists) / pStat.deaths).toFixed(2);
        players.push({
          name: pStat.name,
          riotId: pStat.riotId,
          avatarUrl: pStat.avatarUrl,
          games: pStat.games,
          wins: pStat.wins,
          losses: pStat.games - pStat.wins,
          winrate: pWr,
          kdaRatio: pKda,
          avgKills: +(pStat.kills / pStat.games).toFixed(1),
          avgDeaths: +(pStat.deaths / pStat.games).toFixed(1),
          avgAssists: +(pStat.assists / pStat.games).toFixed(1),
        });
      }
      players.sort((a, b) => b.wins - a.wins || b.winrate - a.winrate || b.games - a.games);

      // Especialista del grupo
      const specialist = players.length > 0 ? {
        name: players[0].name,
        riotId: players[0].riotId,
        avatarUrl: players[0].avatarUrl,
        wins: players[0].wins,
        games: players[0].games,
        winrate: players[0].winrate,
      } : null;

      rows.push({
        championId: acc.championId,
        name: acc.name,
        title: acc.title,
        iconUrl: acc.iconUrl,
        role: primaryRole,
        roleTags: acc.tags,
        games: acc.games,
        wins: acc.wins,
        losses,
        winrate,
        avgKills,
        avgDeaths,
        avgAssists,
        kdaRatio,
        kdaNum,
        avgDamagePerMin,
        pickrate,
        tier,
        tierWeight,
        specialist,
        laneWinrate,
        avgGoldAt14,
        avgCsAt14,
        avgGoldPerMin,
        avgCsPerMin,
        avgVisionScore,
        avgDamageShare,
        players,
      });
    }

    return rows;
  });

  /** Filas filtradas por rol y búsqueda. */
  readonly filteredRows = computed<ChampionMetaRow[]>(() => {
    const rows = this.allRows();
    const role = this.selectedRole();
    const query = this.searchQuery().trim().toLowerCase();

    return rows.filter((row) => {
      if (role !== 'ALL' && row.role !== role) return false;
      if (query && !row.name.toLowerCase().includes(query) && !row.title.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
  });

  /** Filas ordenadas según la columna y dirección activa. */
  readonly sortedRows = computed<ChampionMetaRow[]>(() => {
    const list = [...this.filteredRows()];
    const col = this.sortColumn();
    const asc = this.sortAsc();

    return list.sort((a, b) => {
      let diff = 0;
      switch (col) {
        case 'tier':
          diff = a.tierWeight - b.tierWeight;
          if (diff === 0) diff = a.winrate - b.winrate;
          break;
        case 'name':
          diff = a.name.localeCompare(b.name);
          break;
        case 'role':
          diff = a.role.localeCompare(b.role);
          break;
        case 'games':
          diff = a.games - b.games;
          break;
        case 'winrate':
          diff = a.winrate - b.winrate;
          if (diff === 0) diff = a.games - b.games;
          break;
        case 'kda':
          diff = a.kdaNum - b.kdaNum;
          break;
        case 'damage':
          diff = a.avgDamagePerMin - b.avgDamagePerMin;
          break;
        default:
          diff = a.winrate - b.winrate;
      }
      return asc ? diff : -diff;
    });
  });

  toggleSort(col: SortColumn): void {
    if (this.sortColumn() === col) {
      this.sortAsc.update((asc) => !asc);
    } else {
      this.sortColumn.set(col);
      // Por defecto descendente en métricas numéricas, ascendente en texto
      this.sortAsc.set(col === 'name' || col === 'role');
    }
  }

  toggleExpand(championId: number): void {
    this.expandedChampId.update((current) => (current === championId ? null : championId));
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedRole.set('ALL');
  }

  tierBadgeClass(tier: TierRank): string {
    switch (tier) {
      case 'S+':
        return 'tier-badge--s-plus';
      case 'S':
        return 'tier-badge--s';
      case 'A':
        return 'tier-badge--a';
      case 'B':
        return 'tier-badge--b';
      case 'C':
        return 'tier-badge--c';
    }
  }
}
