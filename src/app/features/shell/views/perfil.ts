import { Component, DestroyRef, computed, inject, linkedSignal, signal } from '@angular/core';
import {
  NfButton,
  NfSelect,
  NfModal,
  NfToggle,
  NfSkeleton,
  NfAvatar,
  NfLaneIcon,
  NfSegmented,
  NfSegmentOption,
} from '../../../ui';
import { Session } from '../../../core/auth';
import { CURRENT_USER } from '../../../core/lobby';
import { GroupStore } from '../../../core/group-store';
import { opggUrl } from '../../../core/member-detail';
import { NotificationsStore } from '../../../core/notifications';
import { PlayerRecentMatch, buildPlayerProfile } from '../../../core/player-profile';
import { LANE_ROLES, LaneRole, PreferencesStore, RolePreferences } from '../../../core/preferences';
import { PairingCode, RIOT_REGIONS, RiotAccount, RiotAccountStore, RiotRegion } from '../../../core/riot';
import { errorMessage } from '../../../core/http';
import { ToastService } from '../../../core/toast';
import { GameDataStore } from '../../../core/game-data';
import { itemBg } from '../../../core/matches/match-view';
import { wireConnectModalOnRiotEvent } from './perfil-connect-modal';

const MEMBER_SINCE_FMT = new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' });

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
    NfButton,
    NfSelect,
    NfModal,
    NfToggle,
    NfSkeleton,
    NfAvatar,
    NfLaneIcon,
    NfSegmented,
  ],
  template: `
    <div class="view pf-view">
      @if (profile(); as p) {
        <!-- ════════ HERO UNIFICADO COMPACTO (~100px) ════════ -->
        <header class="pf-hero-compact" [attr.aria-busy]="identityLoading() ? 'true' : null">
          <div class="pf-hero-compact__left">
            <span class="pf-hero-compact__avatar" [style.background]="grad(p.hue)">
              @if (identityLoading()) {
                <nf-skeleton width="100%" height="100%" radius="0" />
              } @else if (showAvatarImage()) {
                <img
                  class="pf-hero-compact__avatar-img"
                  [src]="session.avatarUrl()"
                  alt=""
                  referrerpolicy="no-referrer"
                  (error)="avatarBroken.set(true)"
                />
              } @else {
                {{ session.initials() }}
              }
            </span>

            <div class="pf-hero-compact__info">
              <div class="pf-hero-compact__name-row">
                @if (identityLoading()) {
                  <nf-skeleton width="180px" height="24px" />
                } @else {
                  <h1 class="pf-hero-compact__name">{{ heroName() }}</h1>
                  <!-- Badge Arquetipo -->
                  <div class="pf-badge-archetype nf-mono" [title]="p.archetype.subtitle">
                    <span class="pf-badge-archetype__icon">{{ p.archetype.icon }}</span>
                    <span class="pf-badge-archetype__title">{{ p.archetype.title }}</span>
                  </div>
                }
              </div>

              <div class="pf-hero-compact__meta-row nf-mono">
                @if (memberSince(); as since) {
                  <span class="pf-meta-chip">◷ Desde {{ since }}</span>
                }
                <!-- Estado Riot -->
                @if (riot.account(); as account) {
                  @switch (account.strength) {
                    @case ('VERIFIED') {
                      <span class="pf-meta-chip pf-meta-chip--verified" title="Cuenta verificada">
                        ✓ {{ account.riotId }} ({{ account.region }})
                      </span>
                    }
                    @case ('PAIRED') {
                      <span class="pf-meta-chip" title="Vinculada desde la app">
                        ↔ {{ account.riotId }} ({{ account.region }})
                      </span>
                    }
                    @default {
                      <span class="pf-meta-chip" title="Sin verificar">
                        {{ account.riotId }}
                      </span>
                    }
                  }
                } @else {
                  <button
                    type="button"
                    class="pf-meta-chip pf-meta-chip--action"
                    (click)="activeTab.set('ajustes')"
                  >
                    ＋ Vincular Riot ID
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Resumen de Desempeño Rápido (Winrate Ring + LP) -->
          <div class="pf-hero-compact__right">
            <div class="pf-hero-compact__kpi-group">
              <div class="pf-hero-compact__ring" [style.--wr]="p.wr" [class.pf-hero-compact__ring--lo]="p.wr < 50">
                <div class="pf-hero-compact__ring-inner">
                  <span class="pf-hero-compact__ring-val nf-mono">{{ p.wr }}%</span>
                  <span class="pf-hero-compact__ring-lbl nf-mono">WR</span>
                </div>
              </div>
              <div class="pf-hero-compact__kpi-text">
                <div class="pf-hero-compact__record nf-mono">
                  <span class="pf-pos">{{ p.wins }}V</span>
                  <span class="pf-sep">-</span>
                  <span class="pf-neg">{{ p.losses }}D</span>
                </div>
                <div
                  class="pf-hero-compact__lp nf-mono"
                  [class.pf-pos]="p.recentLpTrend >= 0"
                  [class.pf-neg]="p.recentLpTrend < 0"
                >
                  {{ p.recentLpTrend >= 0 ? '▲ +' + p.recentLpTrend : '▼ ' + p.recentLpTrend }} LP
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- ════════ NAVEGACIÓN MODULAR DE PESTAÑAS ════════ -->
        <nav class="pf-tabs-bar">
          <nf-segmented
            variant="tabs"
            [options]="tabOptions"
            [value]="activeTab()"
            (valueChange)="setTab($event)"
            ariaLabel="Secciones del perfil"
          />
        </nav>

        <!-- ════════ PESTAÑA 1: RESUMEN (BENTO GRID) ════════ -->
        @if (activeTab() === 'resumen') {
          <div class="pf-bento">
            <!-- ── Columna Principal (60%) ── -->
            <div class="pf-bento__col pf-bento__col--main">
              <!-- Franja de KPIs clave -->
              <section class="pf-kpi-strip">
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">KDA Medio</div>
                  <div class="pf-kpi-tile__val nf-mono">{{ p.kda }}</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.dna.survival.avgDeaths }} d/p</div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">CS / min</div>
                  <div class="pf-kpi-tile__val nf-mono">{{ p.dna.economy.csPerMinAvg }}</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.dna.economy.goldPerMinAvg }} o/m</div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">% Daño Eq.</div>
                  <div class="pf-kpi-tile__val nf-mono">{{ p.dna.combat.damageSharePercentage }}%</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.dna.combat.killParticipation }}% KP</div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">% Línea @14</div>
                  <div class="pf-kpi-tile__val nf-mono" [class.pf-pos]="p.dna.lane.wonLanePercentage >= 50">
                    {{ p.dna.lane.wonLanePercentage }}%
                  </div>
                  <div class="pf-kpi-tile__sub nf-mono">
                    {{ p.dna.lane.avgGoldDiffAt14 >= 0 ? '+' : '' }}{{ p.dna.lane.avgGoldDiffAt14 }} oro
                  </div>
                </div>
                <div class="pf-kpi-tile">
                  <div class="pf-kpi-tile__lbl nf-mono">Tasa MVP</div>
                  <div class="pf-kpi-tile__val nf-mono pf-pos">{{ p.dna.clutch.mvpRate }}%</div>
                  <div class="pf-kpi-tile__sub nf-mono">{{ p.pentas }} pentas</div>
                </div>
              </section>

              <!-- Forma Reciente (12 partidas compactas + Tooltips) -->
              <section class="pf-card pf-form-card">
                <div class="pf-card__header">
                  <span class="pf-card__title nf-mono">▸ Forma Reciente & Racha</span>
                  <div class="pf-streak-badge nf-mono" [class.pf-streak-badge--lose]="p.streakType === 'L'">
                    {{ p.currentStreak }}{{ p.streakType }}
                    <span class="pf-streak-badge__label">{{ p.streakType === 'W' ? 'Victorias seguidas' : 'Derrotas' }}</span>
                  </div>
                </div>

                <div class="pf-form-chain">
                  @for (m of p.recentMatches; track m.id) {
                    <div
                      class="pf-match-node"
                      (mouseenter)="hoveredMatch.set(m)"
                      (mouseleave)="hoveredMatch.set(null)"
                      [class.pf-match-node--win]="m.won"
                      [class.pf-match-node--loss]="!m.won"
                      [class.pf-match-node--mvp]="m.isMvp"
                    >
                      <span class="pf-match-node__text nf-mono">{{ m.won ? 'V' : 'D' }}</span>
                      @if (m.isMvp) {
                        <span class="pf-match-node__crown" title="MVP">★</span>
                      }
                    </div>
                  }
                </div>

                <!-- Tooltip flotante interactivo -->
                @if (hoveredMatch(); as hm) {
                  <div class="pf-form-tooltip nf-mono" role="tooltip">
                    <div class="pf-form-tooltip__row">
                      <span [class.pf-pos]="hm.won" [class.pf-neg]="!hm.won">
                        {{ hm.won ? 'Victoria' : 'Derrota' }}
                        @if (hm.isMvp) { · 👑 MVP }
                      </span>
                      <span class="pf-form-tooltip__time">{{ hm.dateFormatted }} · {{ hm.durationFormatted }}</span>
                    </div>
                    <div class="pf-form-tooltip__row pf-form-tooltip__row--sub">
                      <span>{{ championName(hm.championId) }} ({{ hm.role }})</span>
                      <span>KDA {{ hm.kda }}</span>
                      <span [class.pf-pos]="hm.lpDelta >= 0" [class.pf-neg]="hm.lpDelta < 0">
                        {{ hm.lpDelta >= 0 ? '+' : '' }}{{ hm.lpDelta }} LP
                      </span>
                    </div>
                  </div>
                }
              </section>

              <!-- Top Campeones Insignia -->
              <section class="pf-card">
                <div class="pf-card__header">
                  <span class="pf-card__title nf-mono">▸ Campeones Insignia</span>
                  <button
                    type="button"
                    class="pf-link-btn nf-mono"
                    (click)="activeTab.set('campeones')"
                  >
                    Ver catálogo completo →
                  </button>
                </div>

                <div class="pf-mini-champs" [attr.aria-busy]="champsLoading() ? 'true' : null">
                  @for (c of topSignatureChampions(); track c.championId) {
                    <div class="pf-mini-champ">
                      <nf-avatar
                        class="pf-mini-champ__avatar"
                        [loading]="champsLoading()"
                        [src]="champion(c.championId)?.iconUrl ?? null"
                        [fallback]="championName(c.championId)"
                        [tint]="c.championId"
                        [size]="38"
                        shape="square"
                      />
                      <div class="pf-mini-champ__meta">
                        <div class="pf-mini-champ__name-row">
                          <span class="pf-mini-champ__name">{{ championName(c.championId) }}</span>
                          <span class="pf-mini-champ__role nf-mono">{{ c.role }}</span>
                        </div>
                        <div class="pf-mini-champ__bar">
                          <div
                            class="pf-mini-champ__bar-fill"
                            [class.pf-mini-champ__bar-fill--lo]="c.wr < 50"
                            [style.width.%]="c.wr"
                          ></div>
                        </div>
                      </div>
                      <div class="pf-mini-champ__stats nf-mono">
                        <span class="pf-mini-champ__wr" [class.pf-neg]="c.wr < 50">{{ c.wr }}%</span>
                        <span class="pf-mini-champ__games">{{ c.games }}p · {{ c.kda }} KDA</span>
                      </div>
                    </div>
                  }
                </div>
              </section>
            </div>

            <!-- ── Columna Lateral (40%) ── -->
            <div class="pf-bento__col pf-bento__col--side">
              <!-- Cara a cara (Aliado & Némesis) -->
              <section class="pf-card">
                <div class="pf-card__header">
                  <span class="pf-card__title nf-mono">▸ Rivalidades & Sinergias</span>
                </div>

                <div class="pf-h2h-stack">
                  @if (p.bestAlly; as a) {
                    <div class="pf-h2h-compact pf-h2h-compact--ally">
                      <div class="pf-h2h-compact__head nf-mono">
                        <span>🤝 Mejor Aliado</span>
                        <span class="pf-pos">{{ a.wr }}% WR juntos</span>
                      </div>
                      <div class="pf-h2h-compact__body">
                        <span class="pf-h2h-compact__avatar" [style.background]="grad(a.hue)">{{ a.initials }}</span>
                        <div class="pf-h2h-compact__info">
                          <div class="pf-h2h-compact__name">{{ a.name }}</div>
                          <div class="pf-h2h-compact__sub nf-mono">{{ a.wins }}V - {{ a.losses }}D juntos</div>
                        </div>
                      </div>
                    </div>
                  }

                  @if (p.nemesis; as n) {
                    <div class="pf-h2h-compact pf-h2h-compact--nemesis">
                      <div class="pf-h2h-compact__head nf-mono">
                        <span>💀 Némesis</span>
                        <span class="pf-neg">{{ n.wr }}% WR contra él</span>
                      </div>
                      <div class="pf-h2h-compact__body">
                        <span class="pf-h2h-compact__avatar" [style.background]="grad(n.hue)">{{ n.initials }}</span>
                        <div class="pf-h2h-compact__info">
                          <div class="pf-h2h-compact__name">{{ n.name }}</div>
                          <div class="pf-h2h-compact__sub nf-mono">{{ n.wins }}V - {{ n.losses }}D rivales</div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </section>

              <!-- Tus Grupos Activos -->
              <section class="pf-card">
                <div class="pf-card__header">
                  <span class="pf-card__title nf-mono">▸ Tus Grupos</span>
                </div>

                <div class="pf-group-list">
                  @for (g of p.groups; track g.id) {
                    <div class="pf-group-item">
                      <span class="pf-group-item__avatar" [style.background]="'linear-gradient(135deg,' + g.c1 + ',' + g.c2 + ')'">
                        {{ g.initials }}
                      </span>
                      <div class="pf-group-item__info">
                        <div class="pf-group-item__name-row">
                          <span class="pf-group-item__name">{{ g.name }}</span>
                          <span class="pf-group-item__rank nf-mono">#{{ g.rankPosition }} · {{ g.lp }} LP</span>
                        </div>
                        <div class="pf-group-item__sub nf-mono">
                          {{ g.wins }}V {{ g.losses }}D ({{ g.wr }}%) · {{ g.role }}
                        </div>
                      </div>
                    </div>
                  } @empty {
                    <div class="empty-state empty-state--compact">
                      <span class="empty-state__icon">◎</span>
                      <span class="empty-state__text nf-mono">Sin grupos todavía</span>
                    </div>
                  }
                </div>
              </section>
            </div>
          </div>
        }

        <!-- ════════ PESTAÑA 2: ADN & TELEMETRÍA 5V5 ════════ -->
        @if (activeTab() === 'dna') {
          <div class="pf-tab-content">
            <div class="pf-dna-grid">
              <!-- Tarjeta 1: Fase de Líneas -->
              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  <span class="pf-dna-card__icon">⚔️</span> Fase de líneas (@14)
                </div>
                <div class="pf-dna-card__big nf-mono" [class.pf-pos]="p.dna.lane.wonLanePercentage >= 50">
                  {{ p.dna.lane.wonLanePercentage }}%
                </div>
                <div class="pf-dna-card__sub nf-mono">Líneas 1v1 ganadas</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span [class.pf-pos]="p.dna.lane.avgGoldDiffAt14 >= 0" [class.pf-neg]="p.dna.lane.avgGoldDiffAt14 < 0">
                    {{ p.dna.lane.avgGoldDiffAt14 >= 0 ? '+' : '' }}{{ p.dna.lane.avgGoldDiffAt14 }} oro @14
                  </span>
                  <span [class.pf-pos]="p.dna.lane.avgCsDiffAt14 >= 0" [class.pf-neg]="p.dna.lane.avgCsDiffAt14 < 0">
                    {{ p.dna.lane.avgCsDiffAt14 >= 0 ? '+' : '' }}{{ p.dna.lane.avgCsDiffAt14 }} CS @14
                  </span>
                </div>
              </div>

              <!-- Tarjeta 2: Combate & Daño -->
              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  <span class="pf-dna-card__icon">💥</span> Combate & Daño
                </div>
                <div class="pf-dna-card__big nf-mono">{{ p.dna.combat.damageSharePercentage }}%</div>
                <div class="pf-dna-card__sub nf-mono">Cuota de daño del equipo</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.combat.damagePerMin }} daño/min</span>
                  <span>{{ p.dna.combat.killParticipation }}% participación</span>
                </div>
              </div>

              <!-- Tarjeta 3: Visión & Mapa -->
              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  <span class="pf-dna-card__icon">👁️</span> Visión & Mapa
                </div>
                <div class="pf-dna-card__big nf-mono">{{ p.dna.vision.visionScoreAvg }}</div>
                <div class="pf-dna-card__sub nf-mono">Puntos de visión / partida</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.vision.wardsPlacedAvg }} wards/min</span>
                  <span>{{ p.dna.vision.wardsKilledAvg }} destruidos</span>
                </div>
              </div>

              <!-- Tarjeta 4: Economía & Farm -->
              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  <span class="pf-dna-card__icon">🌾</span> Economía & Farm
                </div>
                <div class="pf-dna-card__big nf-mono">{{ p.dna.economy.csPerMinAvg }}</div>
                <div class="pf-dna-card__sub nf-mono">CS por minuto medio</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.economy.goldPerMinAvg }} oro/min</span>
                  <span>{{ p.hoursPlayed }}h jugadas</span>
                </div>
              </div>

              <!-- Tarjeta 5: Factor Decisivo -->
              <div class="pf-dna-card">
                <div class="pf-dna-card__head nf-mono">
                  <span class="pf-dna-card__icon">👑</span> Factor Decisivo
                </div>
                <div class="pf-dna-card__big nf-mono pf-pos">{{ p.dna.clutch.mvpRate }}%</div>
                <div class="pf-dna-card__sub nf-mono">Tasa de MVP</div>
                <div class="pf-dna-card__metrics nf-mono">
                  <span>{{ p.dna.clutch.firstBloodRate }}% 1ª sangre</span>
                  <span>{{ p.pentas }} pentas</span>
                </div>
              </div>
            </div>

            <!-- Tabla Detallada por Rol -->
            <section class="pf-card" style="margin-top: 16px;">
              <div class="pf-card__header">
                <span class="pf-card__title nf-mono">▸ Rendimiento Detallado por Posición</span>
              </div>
              <div class="pf-role-table">
                <div class="pf-role-table__row pf-role-table__row--head nf-mono">
                  <span>Posición</span>
                  <span>Partidas</span>
                  <span>Win Rate</span>
                  <span>% Línea Ganada</span>
                  <span>Estado</span>
                </div>
                @for (t of roleTiles; track t.role) {
                  @if (p.roleStats[t.role]; as rs) {
                    <div class="pf-role-table__row nf-mono">
                      <div class="pf-role-table__lane">
                        <nf-lane-icon [lane]="t.role" [fallbackGlyph]="t.glyph" />
                        <span class="pf-role-table__lane-name">{{ t.name }}</span>
                      </div>
                      <span>{{ rs.games }} partidas</span>
                      <span [class.pf-pos]="rs.wr >= 50" [class.pf-neg]="rs.wr < 50">{{ rs.wr }}%</span>
                      <span>{{ rs.wonLaneRate }}%</span>
                      <span class="pf-role-table__tag">
                        {{ isPrimary(t.role) ? '★ Principal' : isSelected(t.role) ? 'Activo' : 'Inactivo' }}
                      </span>
                    </div>
                  }
                }
              </div>
            </section>
          </div>
        }

        <!-- ════════ PESTAÑA 3: CAMPEONES ════════ -->
        @if (activeTab() === 'campeones') {
          <div class="pf-tab-content">
            <div class="pf-champ-toolbar-compact">
              <nf-segmented
                [options]="champRoleFilterOptions"
                [value]="champRoleFilter()"
                (valueChange)="champRoleFilter.set($event)"
                ariaLabel="Filtrar campeones por línea"
              />
              <nf-select
                [options]="champSortOptions"
                [value]="champSortBy()"
                (valueChange)="champSortBy.set($event)"
              />
            </div>

            <div class="pf-champ-grid">
              @for (c of filteredChampions(); track c.championId) {
                <div class="pf-champ-tile">
                  <div class="pf-champ-tile__head">
                    <nf-avatar
                      class="pf-champ-tile__avatar"
                      [loading]="champsLoading()"
                      [src]="champion(c.championId)?.iconUrl ?? null"
                      [fallback]="championName(c.championId)"
                      [tint]="c.championId"
                      [size]="44"
                      shape="square"
                    />
                    <div class="pf-champ-tile__info">
                      <div class="pf-champ-tile__name-row">
                        <span class="pf-champ-tile__name">{{ championName(c.championId) }}</span>
                        <span class="pf-champ-tile__role nf-mono">{{ c.role }}</span>
                      </div>
                      <div class="pf-champ-tile__kda nf-mono">
                        KDA {{ c.kda }} · {{ c.csPerMin }} CS/m
                      </div>
                    </div>
                    <div class="pf-champ-tile__wr-side nf-mono">
                      <span class="pf-champ-tile__wr" [class.pf-neg]="c.wr < 50">{{ c.wr }}%</span>
                      <span class="pf-champ-tile__games">{{ c.games }} part.</span>
                    </div>
                  </div>

                  <div class="pf-champ-tile__foot">
                    <div class="pf-champ-tile__bar">
                      <div
                        class="pf-champ-tile__bar-fill"
                        [class.pf-champ-tile__bar-fill--lo]="c.wr < 50"
                        [style.width.%]="c.wr"
                      ></div>
                    </div>
                    <div class="pf-champ-tile__items" title="Objetos más frecuentes">
                      @for (itemId of c.coreItemIds; track $index) {
                        <span
                          class="pf-champ-tile__item-slot nf-mono"
                          [style.background]="itemSlotBg(itemId)"
                          [title]="'Objeto #' + itemId"
                        >
                          ●
                        </span>
                      }
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="empty-state">
                  <div class="empty-state__icon">◎</div>
                  <div class="empty-state__text nf-mono">No hay campeones para este filtro</div>
                </div>
              }
            </div>
          </div>
        }

        <!-- ════════ PESTAÑA 4: ROLES & AJUSTES ════════ -->
        @if (activeTab() === 'ajustes') {
          <div class="pf-tab-content">
            <!-- Selector de Roles Horizontal Compacto -->
            <section class="pf-card pf-roles-section">
              <div class="pf-card__header">
                <div class="pf-card__title-row">
                  <span class="pf-card__title nf-mono">▸ Roles Preferidos (Preferencia Global)</span>
                  <button
                    type="button"
                    class="pf-help-toggle"
                    [class.pf-help-toggle--on]="rolesHelp()"
                    (click)="rolesHelp.set(!rolesHelp())"
                    title="Qué son los roles preferidos"
                  >
                    ?
                  </button>
                </div>

                @if (rolesDirty()) {
                  <div class="pf-roles-actions">
                    <button nfButton variant="ghost" size="sm" [disabled]="prefs.saving()" (click)="discardRoles()">
                      Descartar
                    </button>
                    <button nfButton variant="primary" size="sm" [disabled]="!canSaveRoles()" (click)="saveRoles()">
                      {{ prefs.saving() ? 'Guardando…' : 'Guardar roles' }}
                    </button>
                  </div>
                }
              </div>

              @if (rolesHelp()) {
                <div class="scope-note" role="note">
                  <span class="scope-note__icon" aria-hidden="true">ⓘ</span>
                  <p class="scope-note__text">
                    Sirven para <strong>inicializar tu perfil al unirte a nuevos grupos</strong>.
                    Dentro de cada grupo manda la copia interna del grupo.
                  </p>
                </div>
              }

              <!-- Barra de Roles Horizontal -->
              <div class="pf-roles-strip" role="group" aria-label="Roles que quieres jugar">
                @for (t of roleTiles; track t.role) {
                  <div
                    class="pf-role-pill"
                    [class.pf-role-pill--on]="isSelected(t.role)"
                    [class.pf-role-pill--primary]="isPrimary(t.role)"
                  >
                    <button
                      type="button"
                      class="pf-role-pill__btn"
                      [attr.aria-checked]="isSelected(t.role)"
                      (click)="toggleRole(t.role)"
                    >
                      <nf-lane-icon class="pf-role-pill__glyph" [lane]="t.role" [fallbackGlyph]="t.glyph" />
                      <span class="pf-role-pill__code nf-mono">{{ t.short }}</span>
                      <span class="pf-role-pill__name">{{ t.name }}</span>
                    </button>

                    @if (isSelected(t.role)) {
                      <button
                        type="button"
                        class="pf-role-pill__star"
                        [attr.aria-pressed]="isPrimary(t.role)"
                        [title]="isPrimary(t.role) ? 'Rol principal' : 'Marcar como principal'"
                        (click)="setPrimaryRole(t.role)"
                      >
                        ★
                      </button>
                    }
                  </div>
                }
              </div>

              <div class="pf-roles-foot">
                <div class="pf-roles-flex">
                  <nf-toggle
                    [checked]="isFlex()"
                    ariaLabel="Soy FLEX: me vale cualquier rol"
                    (checkedChange)="toggleFlex($event)"
                  />
                  <span class="pf-roles-flex__text nf-mono">Soy FLEX (juego cualquier rol)</span>
                </div>

                @if (!hasRoles()) {
                  <span class="pf-warn nf-mono">⚠ Selecciona al menos un rol</span>
                } @else if (!roleDraft().primary) {
                  <span class="pf-hint nf-mono">Marca con ★ tu rol principal si tienes uno preferido.</span>
                }
              </div>
            </section>

            <!-- Gestión de Cuenta Riot -->
            <section class="pf-card pf-riot-section">
              <div class="pf-card__header">
                <span class="pf-card__title nf-mono">▸ Vinculación de Cuenta Riot</span>
              </div>

              @switch (riot.status()) {
                @case ('loading') {
                  <div aria-busy="true"><nf-skeleton width="100%" height="70px" radius="8px" /></div>
                }
                @case ('error') {
                  <div class="pf-riot-box pf-riot-box--empty">
                    <div>
                      <div class="pf-riot-box__title">Error al cargar la cuenta Riot</div>
                      <p class="pf-riot-box__text">Comprueba tu conexión e inténtalo de nuevo.</p>
                    </div>
                    <button nfButton variant="ghost" size="sm" (click)="retryRiot()">Reintentar</button>
                  </div>
                }
                @default {
                  @if (riot.account(); as account) {
                    <div class="pf-riot-box pf-riot-box--linked">
                      <nf-avatar
                        class="pf-riot-box__logo"
                        [src]="account.profileIconUrl"
                        [fallback]="account.riotId"
                        [size]="46"
                        shape="square"
                      />
                      <div class="pf-riot-box__meta">
                        <div class="pf-riot-box__id">{{ account.riotId }}</div>
                        <div class="pf-riot-box__sub nf-mono">
                          <span class="pf-meta-chip">{{ account.region }}</span>
                          @switch (account.strength) {
                            @case ('VERIFIED') {
                              <span class="pf-meta-chip pf-meta-chip--verified">✓ Verificada</span>
                            }
                            @case ('PAIRED') {
                              <span class="pf-meta-chip">↔ Vinculada app</span>
                            }
                            @default {
                              <span class="pf-meta-chip">Sin verificar</span>
                            }
                          }
                        </div>
                      </div>
                      <div class="pf-riot-box__actions">
                        <a class="pf-link-btn nf-mono" [href]="opgg(account.riotId)" target="_blank" rel="noopener">
                          OP.GG ↗
                        </a>
                        <button nfButton variant="ghost" size="sm" [disabled]="riot.saving()" (click)="askUnlink()">
                          Desvincular
                        </button>
                      </div>
                    </div>

                    @if (account.strength !== 'VERIFIED') {
                      <div class="pf-riot-verify-banner">
                        <div class="pf-riot-verify-banner__text">
                          <strong>¿Quieres verificar la titularidad?</strong> Abre la app de escritorio para comprobar tu cuenta mediante cambio de icono.
                        </div>
                        <button nfButton variant="accent" size="sm" (click)="openConnect()">
                          Verificar con la app
                        </button>
                      </div>
                    }
                  } @else {
                    <div class="pf-riot-box pf-riot-box--empty">
                      <div>
                        <div class="pf-riot-box__title">Sin cuenta de Riot vinculada</div>
                        <p class="pf-riot-box__text">
                          Vincula tu cuenta para importar automáticamente tus estadísticas de invocador.
                          @if (relinkAvailableAt(); as until) {
                            <br /><span class="pf-hint">Re-vinculación disponible el {{ until }}.</span>
                          }
                        </p>
                      </div>
                      <div class="pf-riot-box__cta-btns">
                        <button nfButton variant="accent" size="sm" (click)="openConnect()">
                          Conectar app
                        </button>
                        <button nfButton variant="ghost" size="sm" [disabled]="riot.saving()" (click)="startLinking()">
                          ＋ Riot ID manual
                        </button>
                      </div>
                    </div>
                  }
                }
              }
            </section>
          </div>
        }
      }

      <!-- Modales de Riot y Conexión -->
      @if (linking()) {
        <nf-modal title="Vincular cuenta de Riot" (closed)="cancelLinking()">
          <div class="settings-eyebrow nf-mono">Vincular cuenta de Riot</div>
          <div class="riot-link">
            <p class="riot-link__text">
              Introduce tu Riot ID tal y como aparece en el cliente (ej. <code>Nombre#TAG</code>).
            </p>
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field__label nf-mono" for="riot-id">Riot ID</label>
              <input
                id="riot-id"
                class="field__input"
                type="text"
                placeholder="Nombre#TAG"
                autocomplete="off"
                [value]="riotIdDraft()"
                (input)="riotIdDraft.set($any($event.target).value)"
                (keydown.enter)="confirmLink()"
              />
            </div>
            <div class="field">
              <label class="field__label nf-mono">Región</label>
              <nf-select
                [options]="regions"
                [value]="regionDraft()"
                (valueChange)="setRegion($event)"
              />
            </div>
          </div>
          <div class="form-foot">
            <button nfButton variant="primary" size="md" [disabled]="!canLink()" (click)="confirmLink()">
              {{ riot.saving() ? 'Vinculando…' : 'Vincular' }}
            </button>
            <button nfButton variant="ghost" size="md" [disabled]="riot.saving()" (click)="cancelLinking()">
              Cancelar
            </button>
          </div>
        </nf-modal>
      }

      @if (unlinking(); as account) {
        <nf-modal title="Desvincular cuenta de Riot" width="440px" (closed)="cancelUnlink()">
          <div class="settings-eyebrow nf-mono">Desvincular cuenta de Riot</div>
          <p class="confirm__text">
            Vas a desvincular <strong>{{ account.riotId }}</strong>. Tus partidas y grupos no se tocan.
          </p>
          <div class="form-foot">
            <button nfButton variant="danger" size="md" [disabled]="riot.saving()" (click)="confirmUnlink()">
              {{ riot.saving() ? 'Desvinculando…' : 'Sí, desvincular' }}
            </button>
            <button nfButton variant="ghost" size="md" [disabled]="riot.saving()" (click)="cancelUnlink()">
              Cancelar
            </button>
          </div>
        </nf-modal>
      }

      @if (connecting()) {
        <nf-modal title="Conectar la aplicación" width="460px" (closed)="closeConnect()">
          <div class="settings-eyebrow nf-mono">Conectar app de escritorio</div>
          <p class="riot-link__text">Abre la app de escritorio y pulsa «Conectar» o pega este código:</p>
          <div class="connect-fallback">
            @if (pairingCode(); as pc) {
              <div class="connect-code" [class.is-expired]="codeExpired()">
                <span class="connect-code__value nf-mono">{{ pc.code }}</span>
                <button nfButton variant="ghost" size="sm" (click)="copyCode(pc.code)">
                  {{ copied() ? 'Copiado' : 'Copiar' }}
                </button>
              </div>
              <p class="connect-code__hint nf-mono">
                {{ codeExpired() ? 'Caducado. Genera otro.' : 'Caduca en ' + codeCountdown() }}
              </p>
              <button nfButton variant="ghost" size="sm" [disabled]="riot.generatingCode()" (click)="generateCode()">
                Generar otro
              </button>
            } @else {
              <button nfButton variant="primary" size="md" [disabled]="riot.generatingCode()" (click)="generateCode()">
                {{ riot.generatingCode() ? 'Generando…' : 'Generar código' }}
              </button>
            }
          </div>
          <div class="form-foot">
            <button nfButton variant="ghost" size="md" (click)="closeConnect()">Cerrar</button>
          </div>
        </nf-modal>
      }
    </div>
  `,
})
export class Perfil {
  private readonly groups = inject(GroupStore);
  protected readonly session = inject(Session);
  private readonly user = CURRENT_USER;

  readonly profile = computed(() =>
    buildPlayerProfile(this.user, this.groups.groups(), (id) => this.groups.rosterOf(id)),
  );

  // ── Navegación Modular por Pestañas ───────────────────────────────
  readonly activeTab = signal<'resumen' | 'dna' | 'campeones' | 'ajustes'>('resumen');
  readonly tabOptions: readonly NfSegmentOption[] = [
    { value: 'resumen', label: 'Resumen' },
    { value: 'dna', label: 'ADN & Stats' },
    { value: 'campeones', label: 'Campeones' },
    { value: 'ajustes', label: 'Roles & Cuenta' },
  ];

  setTab(val: string): void {
    if (['resumen', 'dna', 'campeones', 'ajustes'].includes(val)) {
      this.activeTab.set(val as any);
    }
  }

  // ── Tooltip interactivo de partidas recientes ─────────────────────
  readonly hoveredMatch = signal<PlayerRecentMatch | null>(null);

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

  readonly champSortBy = signal<string>('games');
  readonly champSortOptions = [
    { value: 'games', label: 'Más jugados' },
    { value: 'wr', label: 'Mayor Win rate' },
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

  readonly identityLoading = computed(
    () => this.session.status() === 'idle' || this.session.status() === 'loading',
  );

  readonly memberSince = computed(() => {
    const iso = this.session.createdAt();
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return MEMBER_SINCE_FMT.format(date).replace('.', '').toUpperCase();
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

