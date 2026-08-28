import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfAvatar, NfLaneIcon } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { GameDataStore } from '../../../core/game-data';
import { rankingFor, sparkPoints, RankEntry } from '../../../core/group-ranking';
import { MemberBadge, badgesFor } from '../../../core/group-badges';

@Component({
  selector: 'app-grupo-ranking',
  standalone: true,
  imports: [RouterLink, NfButton, NfAvatar, NfLaneIcon],
  template: `
    <div class="view rk-view">
      @if (group(); as g) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Ranking del grupo</div>
          <p class="view__lead">Clasificación de los miembros del grupo ordenada por rating y nivel de juego.</p>
        </div>

        <!-- 3 PANELES HORIZONTALES SUPERIORES (TOP 3) -->
        @if (top3().length) {
          <div class="rk-top3-grid">
            @for (e of top3(); track e.name) {
              <div
                class="rk-top-card"
                [class.is-first]="e.rank === 1"
                [class.is-second]="e.rank === 2"
                [class.is-third]="e.rank === 3"
              >
                <!-- Fila 1: Arriba a la izquierda corona/rango + Centro/derecha avatar y nombre Discord con enlace OP.GG -->
                <div class="rk-top-card__head">
                  <div class="rk-top-card__crown-badge nf-mono">
                    @if (e.rank === 1) { <span>👑 #1</span> }
                    @else if (e.rank === 2) { <span>🥈 #2</span> }
                    @else if (e.rank === 3) { <span>🥉 #3</span> }
                  </div>

                  <div class="rk-top-card__user">
                    <nf-avatar [src]="e.avatar ?? null" [fallback]="e.name" [tint]="e.hue" [size]="48" />
                    <div class="rk-top-card__user-meta">
                      <a
                        class="rk-top-card__name"
                        [href]="e.opggUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        [title]="'Abrir ' + e.name + ' en OP.GG'"
                      >{{ e.name }}</a>
                      <span class="rk-top-card__tag nf-mono">#{{ e.tag }}</span>
                    </div>
                  </div>
                </div>

                <!-- Fila 2: Debajo del avatar insignia LoL más alta + Derecha puntuación destacada LP -->
                <div class="rk-top-card__mid">
                  <div class="rk-top-card__tier" [style.--tier-color]="e.lolRank.color">
                    <span class="rk-top-card__tier-emblem">🛡️</span>
                    <span class="rk-top-card__tier-lbl nf-mono">{{ e.lolRank.label }}</span>
                  </div>
                  <div class="rk-top-card__lp nf-mono">{{ e.formattedLp }}</div>
                </div>

                <!-- Fila 3: Mitad inferior izquierda stats (XWins XLoses y Winrate) + Esquina inferior derecha Trofeo -->
                <div class="rk-top-card__foot">
                  <div class="rk-top-card__stats">
                    <div class="rk-top-card__stat-line">
                      <span class="rk-top-card__wl nf-mono">
                        <span class="rk-top-card__w">{{ e.wins }}Wins</span>
                        <span class="rk-top-card__l"> {{ e.losses }}Loses</span>
                      </span>
                      <span class="rk-top-card__total nf-mono">({{ e.totalGames }} partidas)</span>
                    </div>
                    <div class="rk-top-card__wr-group">
                      <span class="rk-top-card__wr-val nf-mono">{{ e.wr }}%</span>
                      <span class="rk-top-card__wr-lbl nf-mono">Winrate</span>
                    </div>
                  </div>

                  @if (e.trophyImg) {
                    <img class="rk-top-card__trophy" [src]="e.trophyImg" [alt]="'Trofeo ' + e.rank" />
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- TABLA COMPLETA CON TODOS LOS JUGADORES -->
        <div class="view__label nf-mono">▸ Clasificación general</div>
        <div class="rk-table-wrap">
          <table class="rk-table">
            <thead class="rk-thead">
              <tr>
                <th class="nf-mono">POS</th>
                <th class="nf-mono">JUGADOR</th>
                <th class="nf-mono">ROL</th>
                <th class="nf-mono">RANGO & LP</th>
                <th class="nf-mono">WINRATE & BALANCE</th>
                <th class="nf-mono">TENDENCIA</th>
                <th class="nf-mono">LP PROM.</th>
                <th class="nf-mono" style="text-align: center;">MAIN</th>
              </tr>
            </thead>
            <tbody>
              @for (e of ranking(); track e.name) {
                <tr class="rk-trow" [class.is-top]="e.rank <= 3">
                  <!-- 1) Posición (número o medalla/corona para top 3) y guion -->
                  <td class="rk-td rk-td--pos nf-mono">
                    <span class="rk-pos-wrap">
                      @if (e.rank === 1) { <span class="rk-medal rk-medal--1">👑</span> }
                      @else if (e.rank === 2) { <span class="rk-medal rk-medal--2">🥈</span> }
                      @else if (e.rank === 3) { <span class="rk-medal rk-medal--3">🥉</span> }
                      <span>{{ e.rank }} -</span>
                    </span>
                  </td>

                  <!-- 2 & 3) Avatar de Discord + Bloque usuario con estrella, nombre (link OP.GG) y Riot ID -->
                  <td class="rk-td">
                    <div class="rk-user-cell">
                      <nf-avatar [src]="e.avatar ?? null" [fallback]="e.name" [tint]="e.hue" [size]="40" />
                      <div class="rk-user-meta">
                        <div class="rk-user-meta__top">
                          @if (e.rank <= 3) {
                            <span class="rk-star" title="Destacado">⭐</span>
                          }
                          <a
                            class="rk-user-name"
                            [href]="e.opggUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            [title]="'Abrir ' + e.name + ' en OP.GG'"
                          >{{ e.name }}</a>
                        </div>
                        <div class="rk-user-riot nf-mono">{{ e.name }}#{{ e.tag }}</div>
                      </div>
                    </div>
                  </td>

                  <!-- 4) Icono de rol de LoL -->
                  <td class="rk-td rk-td--lane">
                    <div class="rk-lane-badge">
                      <nf-lane-icon [lane]="e.lane" mode="original" [title]="'Rol: ' + e.lane" />
                      <span class="nf-mono">{{ e.lane }}</span>
                    </div>
                  </td>

                  <!-- 5) Emblema de rango y puntuación (ej. 2591 LP) -->
                  <td class="rk-td rk-td--rank-lp">
                    <div class="rk-rank-lp-wrap">
                      <span class="rk-tier-pill nf-mono" [style.--tier-color]="e.lolRank.color">
                        🛡️ {{ e.lolRank.tier }}
                      </span>
                      <span class="rk-lp-value nf-mono">{{ e.formattedLp }}</span>
                    </div>
                  </td>

                  <!-- 6) Winrate y balance (ej. 58% 205V - 144D) con barra de progreso verde/roja debajo -->
                  <td class="rk-td rk-td--wr">
                    <div class="rk-wr-box">
                      <div class="rk-wr-text nf-mono">
                        <span class="rk-wr-pct">{{ e.wr }}%</span>
                        <span class="rk-wr-counts">{{ e.wins }}V - {{ e.losses }}D</span>
                      </div>
                      <div class="rk-wr-bar" [title]="e.wins + ' Victorias / ' + e.losses + ' Derrotas (' + e.totalGames + ' partidas)'">
                        <div class="rk-wr-bar__w" [style.width.%]="e.wr"></div>
                        <div class="rk-wr-bar__l" [style.width.%]="100 - e.wr"></div>
                      </div>
                    </div>
                  </td>

                  <!-- 7) Gráfica de línea de tendencia de racha (verde o roja) -->
                  <td class="rk-td rk-td--trend">
                    <svg class="rk-spark" [class.is-down]="e.trend === 'down'" viewBox="0 0 100 28" preserveAspectRatio="none">
                      <polyline [attr.points]="spark(e, 100, 28)" />
                    </svg>
                  </td>

                  <!-- 8) Promedio de LP ganados y perdidos -->
                  <td class="rk-td rk-td--avg-lp">
                    <div class="rk-avg-lp-box nf-mono">
                      <span class="rk-lp-gain">+{{ e.avgLpGain }}</span>
                      <span class="rk-lp-loss">-{{ e.avgLpLoss }}</span>
                    </div>
                  </td>

                  <!-- 9) Icono secundario (Campeón principal) -->
                  <td class="rk-td rk-td--main">
                    <div class="rk-main-champ" [title]="'Campeón principal: ' + championName(e.mainChampionId)">
                      <nf-avatar
                        [src]="champion(e.mainChampionId)?.iconUrl ?? null"
                        [fallback]="championName(e.mainChampionId)"
                        [size]="32"
                        shape="square"
                      />
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
          <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← Volver a grupos</button>
      }
    </div>
  `,
})
export class GrupoRanking {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  protected readonly gameData = inject(GameDataStore);

  constructor() {
    this.gameData.ensureLoaded();
  }

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  readonly ranking = computed(() => {
    const g = this.group();
    return g ? rankingFor(g.id, g.members) : [];
  });

  readonly top3 = computed(() => {
    return this.ranking().slice(0, 3);
  });

  /** Name → accolade badges for the group, shared with the member list. */
  readonly badges = computed(() => {
    const g = this.group();
    return g ? badgesFor(g.id, this.groups.rosterOf(g.id)) : new Map<string, MemberBadge[]>();
  });

  badgesOf(name: string): MemberBadge[] {
    return this.badges().get(name) ?? [];
  }

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  spark(e: RankEntry, w = 100, h = 28): string {
    return sparkPoints(e.spark, w, h);
  }
}

