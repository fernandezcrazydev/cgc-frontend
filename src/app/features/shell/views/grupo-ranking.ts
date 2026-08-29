import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  NfAvatar,
  NfButton,
  NfLaneIcon,
  NfPagination,
  NfRankEmblem,
} from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { GameDataStore } from '../../../core/game-data';
import { hash, rankingFor, RankEntry } from '../../../core/group-ranking';
import { kdaRatio } from '../../../core/match-history';
import { timeAgo } from '../../../core/notifications';
import { RankMatch, rankMatchesFor } from '../../../core/ranking-matches';

/**
 * Columnas por las que se puede ordenar la clasificación.
 *
 * No hay `'lp'`: la clasificación se construye por LP descendente, así que
 * "Pos" y "LP" ordenaban exactamente igual y tener los dos controles dejaba al
 * usuario sin saber cuál mandaba.
 */
type SortKey = 'rank' | 'lane' | 'wr';
type SortDir = 'asc' | 'desc';

/** A partir de aquí la lista se pagina (requisito: 15 registros por página). */
const PAGE_SIZE = 15;

@Component({
  selector: 'app-grupo-ranking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    NfButton,
    NfAvatar,
    NfLaneIcon,
    NfRankEmblem,
    NfPagination,
  ],
  template: `
    <div class="view rk-view">
      @if (group(); as g) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>

        <!-- PODIO: las tres primeras posiciones activas -->
        @if (top3().length) {
          <div class="rk-top3-grid">
            @for (e of top3(); track e.playerId) {
              <div
                class="rk-top-card"
                [class.rk-top-card--1st]="e.rank === 1"
                [class.rk-top-card--2nd]="e.rank === 2"
                [class.rk-top-card--3rd]="e.rank === 3"
              >
                <div class="rk-top-card__head">
                  <div class="rk-top-card__pos nf-mono">#{{ e.rank }}</div>

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

                  <!-- Escudo de liga, esquina superior derecha -->
                  <nf-rank-emblem
                    class="rk-top-card__emblem"
                    [tier]="e.lolRank.tier"
                    [label]="e.lolRank.label"
                    [size]="34"
                  />
                </div>

                <!-- LP centrados, con el rol a su izquierda y sin caja alrededor -->
                <div class="rk-top-card__mid">
                  <nf-lane-icon
                    class="rk-top-card__lane"
                    [lane]="e.lane"
                    mode="original"
                    [title]="'Rol: ' + e.lane"
                  />
                  <span class="rk-top-card__lp nf-mono">{{ e.formattedLp }}</span>
                </div>

                <div class="rk-top-card__foot">
                  <div class="rk-top-card__stats">
                    <div class="rk-top-card__stat-line">
                      <span class="rk-top-card__wl nf-mono">
                        <span class="rk-top-card__w">{{ e.wins }}V</span>
                        <span class="rk-top-card__l"> {{ e.losses }}D</span>
                      </span>
                      <span class="rk-top-card__total nf-mono">({{ e.totalGames }} partidas)</span>
                    </div>
                    <div class="rk-top-card__wr-group">
                      <span class="rk-top-card__wr-val nf-mono">{{ e.wr }}%</span>
                      <span class="rk-top-card__wr-lbl nf-mono">Winrate</span>
                    </div>
                  </div>

                  @if (e.trophyImg) {
                    <img class="rk-top-card__trophy" [src]="e.trophyImg" [alt]="'Trofeo del puesto ' + e.rank" />
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- Ordenación móvil (chips): visible solo en pantallas táctiles/estrechas donde se oculta la cabecera -->
        <div class="rk-mobile-sort nf-mono" role="toolbar" aria-label="Ordenar clasificación">
          <span class="rk-mobile-sort__label">Ordenar:</span>
          <div class="rk-mobile-sort__chips">
            <button
              type="button"
              class="rk-sort-chip"
              [class.is-active]="sortKey() === 'rank'"
              (click)="sortBy('rank')"
            >
              Posición <span class="rk-sort-chip__arrow">{{ sortKey() === 'rank' ? arrow('rank') : '↕' }}</span>
            </button>
            <button
              type="button"
              class="rk-sort-chip"
              [class.is-active]="sortKey() === 'lane'"
              (click)="sortBy('lane')"
            >
              Rol <span class="rk-sort-chip__arrow">{{ sortKey() === 'lane' ? arrow('lane') : '↕' }}</span>
            </button>
            <button
              type="button"
              class="rk-sort-chip"
              [class.is-active]="sortKey() === 'wr'"
              (click)="sortBy('wr')"
            >
              Winrate <span class="rk-sort-chip__arrow">{{ sortKey() === 'wr' ? arrow('wr') : '↕' }}</span>
            </button>
          </div>
        </div>

        <!-- CLASIFICACIÓN: lista en grid (no <table>: el cajón desplegable
             heredaría el scroll horizontal del contenedor y se saldría de
             pantalla al desplazar las columnas). -->
        <div class="rk-list">
          <!-- Cabeceras centradas salvo "Jugador": todas las demás celdas pintan
               un dato centrado en su columna, así que un título alineado a la
               izquierda quedaba desplazado respecto a su propio contenido.
               No hay orden por LP: la columna Pos YA es el orden por LP
               descendente, y dos controles para el mismo criterio solo
               confunden sobre cuál manda. -->
          <div class="rk-list__head nf-mono">
            <button
              type="button"
              class="rk-th rk-th--btn"
              [attr.aria-sort]="ariaSort('rank')"
              (click)="sortBy('rank')"
            >Pos <span class="rk-th__arrow" aria-hidden="true">{{ arrow('rank') }}</span></button>

            <span class="rk-th rk-th--start">Jugador</span>

            <button
              type="button"
              class="rk-th rk-th--btn"
              [attr.aria-sort]="ariaSort('lane')"
              (click)="sortBy('lane')"
            >Rol <span class="rk-th__arrow" aria-hidden="true">{{ arrow('lane') }}</span></button>

            <span class="rk-th">LP</span>

            <button
              type="button"
              class="rk-th rk-th--btn"
              [attr.aria-sort]="ariaSort('wr')"
              (click)="sortBy('wr')"
            >Winrate <span class="rk-th__arrow" aria-hidden="true">{{ arrow('wr') }}</span></button>

            <span class="rk-th">Tendencia</span>
            <span class="rk-th">LP prom.</span>
            <span class="rk-th">Main</span>
            <span class="rk-th" aria-hidden="true"></span>
          </div>

          @for (e of pageRows(); track e.playerId) {
            <div class="rk-row" [class.is-open]="openId() === e.playerId" [class.is-banned]="e.banned">
              <!-- La fila NO es un <button>: el nombre del jugador es un enlace a
                   OP.GG y un enlace dentro de un botón es markup inválido. El
                   objetivo de clic del acordeón lo estira el propio botón del
                   chevrón con un ::after a toda la fila (mismo patrón que
                   .cp-rigid__toggle), y el enlace se pinta por encima. -->
              <div class="rk-row__summary">
                <span class="rk-cell rk-cell--pos nf-mono">{{ e.rank }}</span>

                <span class="rk-cell rk-cell--user">
                  <nf-avatar [src]="e.avatar ?? null" [fallback]="e.name" [tint]="e.hue" [size]="40" />
                  <span class="rk-user-meta">
                    <span class="rk-user-meta__top">
                      <a
                        class="rk-user-name"
                        [href]="e.opggUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        [title]="'Abrir ' + e.name + '#' + e.tag + ' en OP.GG'"
                      >{{ e.name }}</a>
                      @if (e.banned) {
                        <span class="rk-ban" [title]="e.banReason">
                          <span class="rk-ban__ico" aria-hidden="true">🔒</span>
                          <span class="rk-ban__lbl nf-mono">Baneado</span>
                        </span>
                      }
                    </span>
                    <span class="rk-user-riot nf-mono">{{ e.name }}#{{ e.tag }}</span>
                  </span>
                </span>

                <span class="rk-cell rk-cell--lane">
                  <nf-lane-icon [lane]="e.lane" mode="original" [title]="'Rol: ' + e.lane" />
                </span>

                <span class="rk-cell rk-cell--lp nf-mono">{{ e.formattedLp }}</span>

                <span class="rk-cell rk-cell--wr">
                  <span class="rk-wr-text nf-mono">
                    <span class="rk-wr-pct">{{ e.wr }}%</span>
                    <span class="rk-wr-counts">{{ e.wins }}V - {{ e.losses }}D</span>
                  </span>
                  <span
                    class="rk-wr-bar"
                    [title]="e.wins + ' victorias / ' + e.losses + ' derrotas (' + e.totalGames + ' partidas)'"
                  >
                    <span class="rk-wr-bar__w" [style.width.%]="e.wr"></span>
                    <span class="rk-wr-bar__l" [style.width.%]="100 - e.wr"></span>
                  </span>
                </span>

                <span class="rk-cell rk-cell--trend">
                  <svg class="rk-spark" [class.is-down]="e.trend === 'down'" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
                    <polyline [attr.points]="e.sparkPath" />
                  </svg>
                </span>

                <span class="rk-cell rk-cell--avg-lp nf-mono">
                  <span class="rk-lp-gain">+{{ e.avgLpGain }}</span>
                  <span class="rk-lp-loss">-{{ e.avgLpLoss }}</span>
                </span>

                <span class="rk-cell rk-cell--main">
                  <nf-avatar
                    [loading]="champsLoading()"
                    [src]="champion(e.mainChampionId)?.iconUrl ?? null"
                    [fallback]="championName(e.mainChampionId)"
                    [tint]="e.mainChampionId"
                    [size]="32"
                    shape="square"
                    [alt]="'Campeón principal: ' + championName(e.mainChampionId)"
                  />
                </span>

                <button
                  #summary
                  type="button"
                  class="rk-row__toggle"
                  [attr.aria-expanded]="openId() === e.playerId"
                  [attr.aria-controls]="'rkd-' + e.playerId"
                  [attr.aria-label]="'Puesto ' + e.rank + ', ' + e.name + ': ver historial'"
                  (click)="toggle(e.playerId)"
                >
                  <span class="rk-row__chev" aria-hidden="true">▾</span>
                </button>
              </div>

              @if (openId() === e.playerId) {
                <div
                  class="rk-drawer"
                  [id]="'rkd-' + e.playerId"
                  role="region"
                  [attr.aria-label]="'Historial de ' + e.name"
                  (keydown.escape)="close(summary)"
                >
                  <div class="rk-drawer__head">
                    <span class="rk-drawer__tab is-active nf-mono">Historial</span>
                    <!-- Sin enlace explícito a OP.GG: lo lleva el nombre del
                         jugador de la fila. -->
                    <span class="rk-drawer__actions">
                      <a
                        class="rk-drawer__btn nf-mono"
                        [routerLink]="['/app', 'grupos', g.id, 'estadisticas']"
                        [queryParams]="{ jugador: e.name }"
                      >Ver perfil</a>
                    </span>
                  </div>

                  @if (openMatches(); as ms) {
                    @if (ms.length) {
                      <div class="rk-matches">
                        @for (m of ms; track m.id) {
                          <a
                            class="rk-match"
                            [class.is-win]="m.win"
                            [class.is-loss]="!m.win"
                            [routerLink]="['/app', 'historial', m.id]"
                          >
                            <span class="rk-match__result">
                              <span class="rk-match__verdict nf-mono">{{ m.win ? 'Victoria' : 'Derrota' }}</span>
                              <span class="rk-match__meta nf-mono">{{ m.durationMin }} min · {{ ago(m.playedAt) }}</span>
                            </span>

                            <nf-lane-icon class="rk-match__lane" [lane]="m.lane" mode="original" [title]="'Rol: ' + m.lane" />

                            <!-- Espejo respecto al VS: el mismo template se pinta
                                 al revés a la izquierda (row-reverse), de modo
                                 que el orden leído desde el centro hacia fuera es
                                 el mismo en los dos lados. -->
                            <span class="rk-match__side rk-match__side--mine">
                              <ng-container *ngTemplateOutlet="loadout; context: { $implicit: m.player }" />
                            </span>

                            <span class="rk-match__vs nf-mono" aria-hidden="true">VS</span>

                            <span class="rk-match__side rk-match__side--foe">
                              <ng-container *ngTemplateOutlet="loadout; context: { $implicit: m.opponent }" />
                              <span class="rk-match__foe-name">
                                <span class="rk-match__foe-nick">{{ m.opponent.name }}</span>
                                <span class="rk-match__foe-tag nf-mono">#{{ m.opponent.tag }}</span>
                              </span>
                            </span>

                            <span class="rk-match__kda">
                              <span class="rk-match__kda-line nf-mono">
                                <strong>{{ m.kills }}</strong> /
                                <strong class="rk-match__deaths">{{ m.deaths }}</strong> /
                                <strong>{{ m.assists }}</strong>
                              </span>
                              <span class="rk-match__kda-sub nf-mono">{{ ratio(m) }} KDA · {{ m.kp }}% KP · {{ m.cs }} CS</span>
                            </span>

                            <span class="rk-match__build">
                              @for (it of m.items; track $index) {
                                @if (it) {
                                  <span class="rk-item" [style.background]="itemTint(it.name)" [title]="it.name"></span>
                                } @else {
                                  <span class="rk-item rk-item--empty"></span>
                                }
                              }
                              @if (m.trinket; as t) {
                                <span class="rk-item rk-item--trinket" [style.background]="itemTint(t.name)" [title]="t.name"></span>
                              }
                            </span>

                            <span class="rk-match__lp nf-mono" [class.is-gain]="m.lpDelta >= 0">
                              {{ m.lpDelta >= 0 ? '+' : '' }}{{ m.lpDelta }} LP
                            </span>

                            <span class="rk-match__chev" aria-hidden="true">›</span>
                          </a>
                        }
                      </div>
                    } @else {
                      <div class="empty-state">
                        <span class="empty-state__icon">🎮</span>
                        <p class="empty-state__text nf-mono">Sin partidas todavía</p>
                        <p class="empty-state__hint">{{ e.name }} aún no ha disputado ninguna partida en este grupo.</p>
                      </div>
                    }
                  }
                </div>
              }
            </div>
          }
        </div>

        @if (ranking().length > PAGE_SIZE) {
          <nf-pagination
            [total]="ranking().length"
            [pageSize]="PAGE_SIZE"
            [page]="page()"
            (pageChange)="goToPage($event)"
          />
        }
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
          <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← Volver a grupos</button>
      }
    </div>

    <!-- Campeón + hechizos + runas de un lado del enfrentamiento.
         Se emite SIEMPRE en el orden [campeón][hechizos][runas]; el lado del
         jugador lo invierte con row-reverse (.rk-match__side--mine) para que el
         bloque quede en espejo. Invertirlo por CSS y no con un segundo template
         evita duplicar el markup de los dos lados. -->
    <ng-template #loadout let-side>
      <nf-avatar
        class="rk-match__champ"
        [loading]="champsLoading()"
        [src]="champion(side.championId)?.iconUrl ?? null"
        [fallback]="championName(side.championId)"
        [tint]="side.championId"
        [size]="36"
        shape="square"
        [alt]="championName(side.championId)"
      />
      <span class="rk-match__spells">
        @for (sp of side.spellIds; track sp) {
          <nf-avatar
            [loading]="champsLoading()"
            [src]="spell(sp)?.iconUrl ?? null"
            [fallback]="spellName(sp)"
            [tint]="sp"
            [size]="17"
            shape="square"
            [alt]="spellName(sp)"
          />
        }
      </span>
      <span class="rk-match__perks">
        <nf-avatar
          [loading]="champsLoading()"
          [src]="perk(side.perkIds[0])?.iconUrl ?? null"
          [fallback]="perkName(side.perkIds[0])"
          [tint]="side.perkIds[0]"
          [size]="17"
          shape="square"
          [alt]="perkName(side.perkIds[0])"
        />
        <nf-avatar
          [loading]="champsLoading()"
          [src]="perk(side.perkIds[1])?.iconUrl ?? null"
          [fallback]="perkName(side.perkIds[1])"
          [tint]="side.perkIds[1]"
          [size]="15"
          shape="square"
          [alt]="perkName(side.perkIds[1])"
        />
      </span>
    </ng-template>
  `,
})
export class GrupoRanking {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  protected readonly gameData = inject(GameDataStore);

  protected readonly PAGE_SIZE = PAGE_SIZE;
  protected readonly ratio = kdaRatio;

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

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  /** Clasificación completa del grupo, ya con los sancionados al final. */
  readonly ranking = computed(() => {
    const g = this.group();
    return g ? rankingFor(g.id, g.members) : [];
  });

  /** Podio: las tres primeras posiciones (los sancionados nunca llegan aquí). */
  readonly top3 = computed(() => this.ranking().slice(0, 3).filter((e) => !e.banned));

  // ---- Ordenación ------------------------------------------------------

  readonly sortKey = signal<SortKey>('rank');
  readonly sortDir = signal<SortDir>('asc');

  /**
   * Ordena por la columna activa, pero los sancionados quedan SIEMPRE al final
   * sea cual sea el criterio: están fuera de competición, así que no deben
   * colarse en cabeza al ordenar por winrate o por rol.
   */
  readonly sorted = computed<RankEntry[]>(() => {
    const rows = [...this.ranking()];
    const key = this.sortKey();
    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return rows.sort((a, b) => {
      if (a.banned !== b.banned) return a.banned ? 1 : -1;
      switch (key) {
        case 'lane': return dir * (a.lane.localeCompare(b.lane) || a.rank - b.rank);
        case 'wr': return dir * (a.wr - b.wr || b.rank - a.rank);
        default: return dir * (a.rank - b.rank);
      }
    });
  });

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      // Pos y Rol se leen mejor ascendentes; el winrate, de mayor a menor.
      this.sortDir.set(key === 'wr' ? 'desc' : 'asc');
    }
    this.page.set(1);
    this.openId.set(null);
  }

  arrow(key: SortKey): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  ariaSort(key: SortKey): string {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  // ---- Paginación ------------------------------------------------------

  /** Vuelve a la página 1 al cambiar de grupo, sin `effect()`. */
  readonly page = linkedSignal<string | null, number>({
    source: this.id,
    computation: () => 1,
  });

  readonly pageRows = computed(() => {
    const rows = this.sorted();
    if (rows.length <= PAGE_SIZE) return rows;
    const start = (this.page() - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  });

  goToPage(n: number): void {
    this.page.set(n);
    this.openId.set(null);
  }

  // ---- Acordeón --------------------------------------------------------

  /** Solo una fila abierta a la vez; se cierra sola al cambiar de grupo. */
  readonly openId = linkedSignal<string | null, string | null>({
    source: this.id,
    computation: () => null,
  });

  toggle(playerId: string): void {
    this.openId.update((v) => (v === playerId ? null : playerId));
  }

  close(summary: HTMLElement): void {
    this.openId.set(null);
    summary.focus();
  }

  /**
   * Las partidas SOLO del jugador abierto. Generarlas para las 28 filas serían
   * 140 partidas para enseñar 5.
   */
  readonly openMatches = computed<RankMatch[]>(() => {
    const openId = this.openId();
    const g = this.group();
    if (!openId || !g) return [];
    const board = this.ranking();
    const entry = board.find((e) => e.playerId === openId);
    return entry ? rankMatchesFor(g.id, entry, board) : [];
  });

  // ---- Presentación ----------------------------------------------------

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  spell(id: number) {
    return this.gameData.spellById().get(id);
  }

  spellName(id: number): string {
    return this.spell(id)?.name ?? 'Hechizo';
  }

  perk(id: number) {
    return this.gameData.perkById().get(id);
  }

  /**
   * Un mismo método para la runa clave y para el árbol: el catálogo del backend los
   * devuelve en la misma lista y el `style` ya distingue cuál es, así que dos funciones
   * separadas solo repetirían la misma búsqueda con distinto texto de reserva.
   */
  perkName(id: number): string {
    return this.perk(id)?.name ?? 'Runa';
  }

  /**
   * "hace 2 d". `timeAgo` devuelve "Ahora" para lo recién jugado, y
   * "hace Ahora" no es español, así que ese caso se deja tal cual.
   */
  ago(iso: string): string {
    const t = timeAgo(iso);
    if (!t) return '';
    return t === 'Ahora' ? 'Ahora' : `hace ${t}`;
  }

  /**
   * Tinte del hueco de objeto. No hay catálogo de objetos por id en la app
   * (ver `ranking-matches.ts`), así que se colorea desde el nombre — la misma
   * convención que `grupo-historial.ts` y `partida-detalle.ts`.
   */
  itemTint(name: string): string {
    const h = hash(name) % 360;
    return `linear-gradient(135deg, hsl(${h},70%,46%), hsl(${h},60%,24%))`;
  }
}
