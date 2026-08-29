import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  NfButton,
  NfAvatar,
  NfSegmented,
  NfSegmentOption,
  NfSelect,
} from '../../../ui';
import { Session } from '../../../core/auth';
import { CURRENT_USER } from '../../../core/lobby';
import { GroupStore } from '../../../core/group-store';
import { GameDataStore } from '../../../core/game-data';
import { buildMemberProfile } from '../../../core/player-profile';
import { itemBg } from '../../../core/matches/match-view';

@Component({
  selector: 'app-perfil-miembro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    NfButton,
    NfAvatar,
    NfSegmented,
    NfSelect,
  ],
  template: `
    <div class="view pf-view">
      <a class="view-back nf-mono" [routerLink]="['/app', 'historial']">
        <span class="view-back__arrow" aria-hidden="true">←</span> Volver al historial
      </a>

      @if (profile(); as p) {
        <!-- ════════ HERO UNIFICADO COMPACTO (~100px) ════════ -->
        <header class="pf-hero-compact">
          <div class="pf-hero-compact__left">
            <span class="pf-hero-compact__avatar" [style.background]="grad(p.hue)">
              {{ p.initials }}
            </span>

            <div class="pf-hero-compact__info">
              <div class="pf-hero-compact__name-row">
                <h1 class="pf-hero-compact__name">{{ p.name }}</h1>
                <div class="pf-badge-archetype nf-mono" [title]="p.archetype.subtitle">
                  <span class="pf-badge-archetype__icon">{{ p.archetype.icon }}</span>
                  <span class="pf-badge-archetype__title">{{ p.archetype.title }}</span>
                </div>
              </div>

              <div class="pf-hero-compact__meta-row nf-mono">
                <span class="pf-meta-chip">{{ p.tag }}</span>
                <span class="pf-meta-chip">◷ Desde {{ p.memberSince }}</span>
                <span class="pf-meta-chip">Rol: {{ p.mainRole }}</span>
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
            ariaLabel="Secciones del perfil del miembro"
          />
        </nav>

        <!-- ════════ PESTAÑA 1: RESUMEN & CARA A CARA ════════ -->
        @if (activeTab() === 'resumen') {
          <div class="pf-bento">
            <!-- ── Columna Principal (60%): Módulo Tú vs Él + KPIs ── -->
            <div class="pf-bento__col pf-bento__col--main">
              <!-- Tarjeta de Enfrentamiento (VS Battle Card) -->
              @if (p.mutualH2h; as h2h) {
                <section class="pf-card pf-vs-card">
                  <div class="pf-card__header">
                    <span class="pf-card__title nf-mono">▸ Cara a Cara Directo · Tú vs {{ p.name }}</span>
                    <span class="pf-meta-chip nf-mono">Historial cruzado</span>
                  </div>

                  <!-- 2 Fichas de Sinergia y Rivalidad -->
                  <div class="pf-vs-grid">
                    <div class="pf-vs-tile pf-vs-tile--synergy">
                      <div class="pf-vs-tile__head nf-mono">
                        <span>🤝 Como Compañeros</span>
                        <span class="pf-pos">{{ h2h.gamesTogether }} partidas</span>
                      </div>
                      <div class="pf-vs-tile__val nf-mono" [class.pf-pos]="h2h.wrTogether >= 50">
                        {{ h2h.wrTogether }}% WR
                      </div>
                      <div class="pf-vs-tile__sub nf-mono">
                        {{ h2h.winsTogether }}V · {{ h2h.lossesTogether }}D juntos en el equipo
                      </div>
                    </div>

                    <div class="pf-vs-tile pf-vs-tile--rivalry">
                      <div class="pf-vs-tile__head nf-mono">
                        <span>⚔️ Duelos Directos</span>
                        <span>{{ h2h.gamesVersus }} partidas</span>
                      </div>
                      <div class="pf-vs-tile__val nf-mono">
                        {{ h2h.winsVersus }} - {{ h2h.lossesVersus }}
                      </div>
                      <div class="pf-vs-tile__sub nf-mono">
                        @if (h2h.h2hDiff > 0) {
                          <span class="pf-pos">Vas ganando tú (+{{ h2h.h2hDiff }})</span>
                        } @else if (h2h.h2hDiff < 0) {
                          <span class="pf-neg">Va ganando {{ p.name }} ({{ h2h.h2hDiff }})</span>
                        } @else {
                          <span>Marcador empatado</span>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Comparativa Directa de Métricas (Barras Balanceadas) -->
                  <div class="pf-compare-compact">
                    <div class="pf-compare-compact__head nf-mono">
                      <span class="pf-compare-compact__col pf-compare-compact__col--me">Tú</span>
                      <span class="pf-compare-compact__col pf-compare-compact__col--metric">Métricas de Rendimiento</span>
                      <span class="pf-compare-compact__col pf-compare-compact__col--foe">{{ p.name }}</span>
                    </div>

                    <div class="pf-compare-compact__row nf-mono">
                      <span class="pf-compare-compact__val pf-compare-compact__val--me" [class.pf-pos]="h2h.statsComparison.kdaUser >= h2h.statsComparison.kdaTarget">
                        {{ h2h.statsComparison.kdaUser }}
                      </span>
                      <span class="pf-compare-compact__label">KDA Medio</span>
                      <span class="pf-compare-compact__val pf-compare-compact__val--foe" [class.pf-pos]="h2h.statsComparison.kdaTarget >= h2h.statsComparison.kdaUser">
                        {{ h2h.statsComparison.kdaTarget }}
                      </span>
                    </div>

                    <div class="pf-compare-compact__row nf-mono">
                      <span class="pf-compare-compact__val pf-compare-compact__val--me" [class.pf-pos]="h2h.statsComparison.wonLaneUser >= h2h.statsComparison.wonLaneTarget">
                        {{ h2h.statsComparison.wonLaneUser }}%
                      </span>
                      <span class="pf-compare-compact__label">% Línea Ganada (@14)</span>
                      <span class="pf-compare-compact__val pf-compare-compact__val--foe" [class.pf-pos]="h2h.statsComparison.wonLaneTarget >= h2h.statsComparison.wonLaneUser">
                        {{ h2h.statsComparison.wonLaneTarget }}%
                      </span>
                    </div>

                    <div class="pf-compare-compact__row nf-mono">
                      <span class="pf-compare-compact__val pf-compare-compact__val--me" [class.pf-pos]="h2h.statsComparison.csPerMinUser >= h2h.statsComparison.csPerMinTarget">
                        {{ h2h.statsComparison.csPerMinUser }}
                      </span>
                      <span class="pf-compare-compact__label">CS por Minuto</span>
                      <span class="pf-compare-compact__val pf-compare-compact__val--foe" [class.pf-pos]="h2h.statsComparison.csPerMinTarget >= h2h.statsComparison.csPerMinUser">
                        {{ h2h.statsComparison.csPerMinTarget }}
                      </span>
                    </div>

                    <div class="pf-compare-compact__row nf-mono">
                      <span class="pf-compare-compact__val pf-compare-compact__val--me" [class.pf-pos]="h2h.statsComparison.damageShareUser >= h2h.statsComparison.damageShareTarget">
                        {{ h2h.statsComparison.damageShareUser }}%
                      </span>
                      <span class="pf-compare-compact__label">Cuota de Daño</span>
                      <span class="pf-compare-compact__val pf-compare-compact__val--foe" [class.pf-pos]="h2h.statsComparison.damageShareTarget >= h2h.statsComparison.damageShareUser">
                        {{ h2h.statsComparison.damageShareTarget }}%
                      </span>
                    </div>

                    <div class="pf-compare-compact__row nf-mono">
                      <span class="pf-compare-compact__val pf-compare-compact__val--me" [class.pf-pos]="h2h.statsComparison.visionAvgUser >= h2h.statsComparison.visionAvgTarget">
                        {{ h2h.statsComparison.visionAvgUser }}
                      </span>
                      <span class="pf-compare-compact__label">Puntos de Visión</span>
                      <span class="pf-compare-compact__val pf-compare-compact__val--foe" [class.pf-pos]="h2h.statsComparison.visionAvgTarget >= h2h.statsComparison.visionAvgUser">
                        {{ h2h.statsComparison.visionAvgTarget }}
                      </span>
                    </div>
                  </div>
                </section>
              }

              <!-- Franja de KPIs clave de su carrera -->
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
            </div>

            <!-- ── Columna Lateral (40%): Campeones Insignia y Grupos ── -->
            <div class="pf-bento__col pf-bento__col--side">
              <!-- Top Campeones -->
              <section class="pf-card">
                <div class="pf-card__header">
                  <span class="pf-card__title nf-mono">▸ Campeones Más Jugados</span>
                  <button
                    type="button"
                    class="pf-link-btn nf-mono"
                    (click)="activeTab.set('campeones')"
                  >
                    Ver todos →
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

              <!-- Grupos del Miembro -->
              <section class="pf-card">
                <div class="pf-card__header">
                  <span class="pf-card__title nf-mono">▸ Grupos en los que Participa</span>
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
      } @else {
        <div class="empty-state">
          <div class="empty-state__icon">🔍</div>
          <p class="empty-state__text nf-mono">No se encontró el jugador</p>
          <p class="empty-state__hint">El jugador solicitado no pertenece a ninguno de tus grupos activos.</p>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'historial']">
            Volver al historial
          </button>
        </div>
      }
    </div>
  `,
})
export class PerfilMiembro {
  private readonly route = inject(ActivatedRoute);
  private readonly groups = inject(GroupStore);
  protected readonly session = inject(Session);
  private readonly user = CURRENT_USER;

  readonly userId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? 'Jugador')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? 'Jugador' },
  );

  readonly profile = computed(() => {
    const targetTag = this.userId();
    if (!targetTag) return null;
    return buildMemberProfile(targetTag, this.user, this.groups.groups(), (id) => this.groups.rosterOf(id));
  });

  // ── Pestañas de Navegación ────────────────────────────────────────
  readonly activeTab = signal<'resumen' | 'dna' | 'campeones'>('resumen');
  readonly tabOptions: readonly NfSegmentOption[] = [
    { value: 'resumen', label: 'Resumen & Cara a Cara' },
    { value: 'dna', label: 'ADN & Stats' },
    { value: 'campeones', label: 'Campeones' },
  ];

  setTab(val: string): void {
    if (['resumen', 'dna', 'campeones'].includes(val)) {
      this.activeTab.set(val as any);
    }
  }

  // ── Top 3 Signature Champions ─────────────────────────────────────
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

  grad(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }
}

