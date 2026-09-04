import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs';
import {
  NfAvatar,
  NfButton,
  NfLaneIcon,
  NfModal,
  NfPagination,
  NfRankEmblem,
  NfCombobox,
  NfComboboxOption,
  NfSkeleton,
  NfTypeahead,
} from '../../../ui';
import { GroupBridge, GroupDetailStore, GroupsStore } from '../../../core/groups';
import { GroupStore } from '../../../core/group-store';
import { hash, mapLeaderboardEntries, RankEntry } from '../../../core/group-ranking';
import { LeaderboardSearchSuggestion, LeaguesStore } from '../../../core/leagues';
import { ServerClock, errorMessage } from '../../../core/http';
import { ToastService } from '../../../core/toast';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { GameDataStore } from '../../../core/game-data';
import { Lane, Match, MatchItemSlot, MatchParticipant } from '../../../core/matches/models';
import { formatDurationMinutes, formatMatchDate } from '../../../shared/date-format';

/**
 * Columnas por las que se puede ordenar la clasificación.
 *
 * No hay `'lp'`: la clasificación se construye por LP descendente, así que "Pos" y "LP" ordenaban
 * exactamente igual y tener los dos controles dejaba al usuario sin saber cuál mandaba.
 *
 * Tampoco hay `'lane'`. La tenía, y era peor: el rol principal se sorteaba con un generador
 * determinista, así que ordenar por "Rol" ordenaba por ruido. La cabecera sigue ahí, deshabilitada,
 * y vuelve a activarse cuando el dato exista.
 */
type SortKey = 'rank' | 'wr';
type SortDir = 'asc' | 'desc';

export interface DrawerMatchItem {
  id: string;
  isWin: boolean;
  meta: string;
  lane: Lane;
  champId: number;
  champName: string;
  champIcon: string | null;
  spells: number[];
  smiteVariant?: 'blue' | 'red' | 'green' | 'unevolved';
  primaryRuneId?: number;
  secondaryRuneTreeId?: number;
  foeChampId: number;
  foeChampName: string;
  foeChampIcon: string | null;
  foeName: string;
  foeTag: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  items: (MatchItemSlot | null)[];
  lpDelta: number;
}

const SECOND_SPELL_FALLBACK: Record<Lane, number> = {
  TOP: 12,
  JUNGLA: 1102,
  MID: 14,
  ADC: 7,
  SUPPORT: 3,
};

const RUNES_FALLBACK: Record<Lane, { primary: number; secondary: number }> = {
  TOP: { primary: 8437, secondary: 8000 },
  JUNGLA: { primary: 8010, secondary: 8300 },
  MID: { primary: 8112, secondary: 8200 },
  ADC: { primary: 8008, secondary: 8300 },
  SUPPORT: { primary: 8465, secondary: 8400 },
};

/**
 * Duración de una temporada abierta desde aquí.
 *
 * BACKEND NOTE: es una COPIA de `DEFAULT_SEASON_DAYS`, que el backend ya usa para crear la primera
 * liga de un grupo. Dos constantes para el mismo valor por defecto, en dos repos, que nadie va a
 * acordarse de cambiar a la vez. Desaparece con `POST /groups/{groupId}/leagues/next`: la siguiente
 * temporada se pide sin cuerpo y el servidor —que ya conoce la duración y sabe qué número le
 * toca— decide fechas y nombre. Hasta entonces se queda aquí, porque el endpoint de creación
 * exige `endsAt` y alguien tiene que proponerlo.
 */
const SEASON_LENGTH_DAYS = 14;

@Component({
  selector: 'app-grupo-ranking',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeMenu()',
  },
  imports: [
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    NfButton,
    NfAvatar,
    NfLaneIcon,
    NfRankEmblem,
    NfPagination,
    NfSkeleton,
    NfModal,
    NfCombobox,
    NfTypeahead,
  ],
  styleUrl: './grupo-ranking.scss',
  template: `
    <div class="view rk-view">
      @if (isLoading()) {
        <div aria-busy="true">
          <div class="rk-league-header">
            <div class="view-back nf-mono"><nf-skeleton width="140px" height="14px" /></div>
            <div class="rk-league-hero">
              <div class="rk-league-title-group">
                <nf-skeleton width="140px" height="12px" />
                <nf-skeleton width="280px" height="34px" />
              </div>
              <div class="rk-countdown"><nf-skeleton width="220px" height="24px" radius="999px" /></div>
            </div>
          </div>

          <div class="rk-top3-grid">
            @for (s of [1, 2, 3]; track s) {
              <div class="rk-top-card">
                <div class="rk-top-card__head">
                  <div class="rk-top-card__user">
                    <nf-skeleton width="48px" height="48px" radius="50%" />
                    <div class="rk-top-card__user-meta">
                      <nf-skeleton width="100px" height="15px" />
                      <nf-skeleton width="60px" height="11px" />
                    </div>
                  </div>
                  <nf-skeleton width="34px" height="34px" radius="50%" />
                </div>
                <div class="rk-top-card__mid">
                  <nf-skeleton width="24px" height="24px" />
                  <nf-skeleton width="90px" height="28px" />
                </div>
                <div class="rk-top-card__foot">
                  <div class="rk-top-card__stats">
                    <nf-skeleton width="120px" height="13px" />
                    <nf-skeleton width="80px" height="17px" />
                  </div>
                </div>
              </div>
            }
          </div>

          <div class="rk-list">
            <!-- Las MISMAS columnas que la tabla real, no una copia: si divergieran, el esqueleto
                 reservaría un hueco distinto del que ocupa el contenido y la página saltaría al
                 llegar el dato, que es justo lo que un esqueleto existe para evitar. -->
            <ng-container *ngTemplateOutlet="tableHead" />
            @for (s of [1, 2, 3, 4, 5, 6, 7, 8]; track s) {
              <div class="rk-row">
                <div class="rk-row__summary">
                  <span class="rk-cell rk-cell--pos nf-mono"><nf-skeleton width="18px" height="14px" /></span>
                  <span class="rk-cell rk-cell--user">
                    <nf-skeleton width="40px" height="40px" radius="50%" />
                    <span class="rk-user-meta">
                      <nf-skeleton width="110px" height="14px" />
                      <nf-skeleton width="65px" height="11px" />
                    </span>
                  </span>
                  <span class="rk-cell rk-cell--lane"><nf-skeleton width="24px" height="24px" /></span>
                  <span class="rk-cell rk-cell--lp"><nf-skeleton width="70px" height="16px" /></span>
                  <span class="rk-cell rk-cell--wr"><nf-skeleton width="80px" height="14px" /></span>
                  <span class="rk-cell rk-cell--trend"><nf-skeleton width="60px" height="14px" /></span>
                  <span class="rk-cell rk-cell--avg-lp"><nf-skeleton width="50px" height="14px" /></span>
                  <span class="rk-cell rk-cell--main"><nf-skeleton width="32px" height="32px" radius="4px" /></span>
                  <span class="rk-cell"><nf-skeleton width="16px" height="16px" /></span>
                </div>
              </div>
            }
          </div>
        </div>
      } @else if (group(); as g) {
        <div class="rk-league-header">
          <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
            <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
          </a>

          <div class="rk-league-hero">
            <div class="rk-league-title-group">
              <span class="rk-league-eyebrow nf-mono">Clasificación oficial</span>
              <h1 class="rk-league-title">{{ leagueName() }}</h1>
              <!-- Solo con más de una temporada: un selector con una sola opción no es una
                   elección, es un adorno que sugiere que hay algo más donde no lo hay. -->
              @if (seasonOptions().length > 1) {
                <div class="rk-season">
                  <span class="rk-season__label nf-mono">Temporada</span>
                  <!-- Combobox y no el select nativo: aquel es legacy (Input/Output) y se
                       quedaba desincronizado del store — la tabla cambiaba de temporada y el
                       desplegable seguía rotulando la anterior. Este va con signals, así que
                       refleja siempre lo que hay cargado. -->
                  <nf-combobox
                    class="rk-season__control"
                    [options]="seasonOptions()"
                    [value]="leagues.viewingLeagueId() ?? ''"
                    (valueChange)="onSeasonChange($event)"
                    [clearable]="false"
                    ariaLabel="Temporada"
                  />
                  @if (leagues.viewingLeagueId()) {
                    <span class="rk-season__past nf-mono">Temporada cerrada · solo lectura</span>
                  }
                </div>
              }
            </div>

            @if (countdown(); as cd) {
              <div class="rk-countdown" [class.is-expired]="cd.isExpired">
                <div class="rk-countdown__status">
                  <span
                    class="rk-countdown__badge nf-mono"
                    [class.rk-countdown__badge--success]="cd.statusVariant === 'success'"
                    [class.rk-countdown__badge--warning]="cd.statusVariant === 'warning'"
                    [class.rk-countdown__badge--danger]="cd.statusVariant === 'danger'"
                  >
                    <span class="rk-countdown__dot" aria-hidden="true"></span>
                    {{ cd.statusLabel }}
                  </span>
                </div>

                @if (!cd.isExpired) {
                  <div class="rk-countdown__timer nf-mono" aria-label="Tiempo restante de la liga">
                    <span class="rk-countdown__unit">
                      <strong class="rk-countdown__val">{{ cd.days }}</strong>
                      <small class="rk-countdown__lbl">días</small>
                    </span>
                    <span class="rk-countdown__sep" aria-hidden="true">:</span>
                    <span class="rk-countdown__unit">
                      <strong class="rk-countdown__val">{{ pad(cd.hours) }}</strong>
                      <small class="rk-countdown__lbl">h</small>
                    </span>
                    <span class="rk-countdown__sep" aria-hidden="true">:</span>
                    <span class="rk-countdown__unit">
                      <strong class="rk-countdown__val">{{ pad(cd.minutes) }}</strong>
                      <small class="rk-countdown__lbl">m</small>
                    </span>
                    <span class="rk-countdown__sep" aria-hidden="true">:</span>
                    <span class="rk-countdown__unit">
                      <strong class="rk-countdown__val">{{ pad(cd.seconds) }}</strong>
                      <small class="rk-countdown__lbl">s</small>
                    </span>
                  </div>
                } @else {
                  <div class="rk-countdown__expired nf-mono">Temporada concluida</div>
                }
              </div>
            }
          </div>
        </div>

        @if (leagues.status() === 'error') {
          <!-- Error, no vacío: hubo un fallo y hay algo que reintentar. -->
          <div class="empty-state" role="alert">
            <span class="empty-state__icon">⚠️</span>
            <p class="empty-state__text nf-mono">No se pudo cargar la clasificación</p>
            <p class="empty-state__hint">{{ leagues.error() }}</p>
            <button nfButton variant="secondary" size="md" (click)="retry()">Reintentar</button>
          </div>
        } @else if (leagues.isEmpty()) {
          <!-- Vacío, no error: la liga existe, simplemente aún no se ha jugado nada. -->
          <div class="empty-state">
            <span class="empty-state__icon">🏆</span>
            <p class="empty-state__text nf-mono">La liga aún no tiene participantes</p>
            <p class="empty-state__hint">
              Cuando juguéis vuestra primera custom, el podio y la clasificación aparecerán aquí.
            </p>
            <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">
              Crear partida
            </button>
          </div>
        } @else {
          @if (leagues.isSeasonClosed()) {
            <!-- La temporada acabó. La clasificación sigue debajo, ya en solo lectura: es el
                 resultado final, no una tabla viva. La siguiente temporada no aparece sola —
                 reiniciar el LP de todo el grupo es una decisión de un admin. -->
            <div class="rk-season-over" role="status">
              <div class="rk-season-over__head">
                <span class="rk-season-over__trophy" aria-hidden="true">🏆</span>
                <div class="rk-season-over__text">
                  <p class="rk-season-over__title">Temporada finalizada</p>
                  @if (leagues.champion(); as champ) {
                    <p class="rk-season-over__champ">
                      Campeón: <strong>{{ champ.discordUsername }}</strong>
                      <span class="nf-mono">· {{ champ.lp }} LP · {{ champ.wins }}V-{{ champ.losses }}D</span>
                    </p>
                  } @else {
                    <p class="rk-season-over__champ">Nadie llegó a puntuar en esta temporada.</p>
                  }
                </div>
              </div>

              @if (leagues.canManageLeague()) {
                <button
                  nfButton
                  variant="primary"
                  size="md"
                  [disabled]="leagues.starting()"
                  (click)="startNextSeason(g.name)"
                >
                  {{ leagues.starting() ? 'Abriendo…' : 'Empezar nueva temporada' }}
                </button>
              } @else {
                <p class="rk-season-over__hint">
                  Un administrador del grupo puede abrir la siguiente temporada.
                </p>
              }
            </div>
          }

          @if (podium().length) {
            <div class="rk-top3-grid" role="region" aria-label="Podio de honor Top 3">
              @for (e of podium(); track e.playerId) {
                <div
                  class="rk-top-card"
                  [class.rk-top-card--1st]="e.rank === 1"
                  [class.rk-top-card--2nd]="e.rank === 2"
                  [class.rk-top-card--3rd]="e.rank === 3"
                  [attr.aria-label]="'Puesto ' + e.rank + ': ' + e.name"
                >
                  <div class="rk-top-card__head">
                    <div class="rk-top-card__user">
                      <nf-avatar [src]="e.avatar" [fallback]="e.name" [tint]="e.hue" [size]="e.rank === 1 ? 54 : 44" />
                      <div class="rk-top-card__user-meta">
                        <a
                          class="rk-top-card__name no-underline"
                          [routerLink]="['/app', 'perfil', e.playerId]"
                          [title]="'Ver perfil de ' + e.name"
                        >{{ e.name }}</a>
                        @if (e.tag) {
                          <span class="rk-top-card__tag nf-mono">#{{ e.tag }}</span>
                        }
                      </div>
                    </div>

                    @if (e.lolRank; as r) {
                      <nf-rank-emblem
                        class="rk-top-card__emblem"
                        [tier]="r.tier"
                        [label]="r.label"
                        [size]="e.rank === 1 ? 38 : 30"
                      />
                    }
                  </div>

                  <div class="rk-top-card__mid">
                    @if (e.lane; as lane) {
                      <nf-lane-icon class="rk-top-card__lane" [lane]="lane" mode="original" [title]="'Rol: ' + lane" />
                    }
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

                    @if (e.trophyImg; as trophy) {
                      <img class="rk-top-card__trophy" [src]="trophy" [alt]="'Trofeo del puesto ' + e.rank" aria-hidden="true" />
                    }
                  </div>
                </div>
              }
            </div>
          }

          <div class="rk-mobile-sort nf-mono" role="toolbar" aria-label="Ordenar clasificación">
            <span class="rk-mobile-sort__label">Ordenar:</span>
            <div class="rk-mobile-sort__chips">
              <button type="button" class="rk-sort-chip" [class.is-active]="sortKey() === 'rank'" (click)="sortBy('rank')">
                Posición <span class="rk-sort-chip__arrow">{{ arrow('rank') }}</span>
              </button>
              <button type="button" class="rk-sort-chip" disabled [title]="NO_DATA_HINT">
                Rol <span class="rk-sort-chip__arrow">–</span>
              </button>
              <button type="button" class="rk-sort-chip" [class.is-active]="sortKey() === 'wr'" (click)="sortBy('wr')">
                Winrate <span class="rk-sort-chip__arrow">{{ arrow('wr') }}</span>
              </button>
            </div>
          </div>

          <div class="rk-list">
            <ng-container *ngTemplateOutlet="tableHead; context: { interactive: true }" />

            @for (e of rows(); track e.playerId) {
              <div
                #rowRef
                class="rk-row"
                [id]="'rk-row-' + e.playerId"
                [attr.data-player]="e.playerId"
                [class.is-open]="openId() === e.playerId"
                [class.has-menu]="menuFor() === e.playerId"
                [class.is-banned]="e.banned"
                [class.is-highlighted]="highlightedPlayerId() === e.playerId"
              >
                <div class="rk-row__summary">
                  <span class="rk-cell rk-cell--pos nf-mono">{{ e.rank }}</span>

                  <span class="rk-cell rk-cell--user">
                    <nf-avatar [src]="e.avatar" [fallback]="e.name" [tint]="e.hue" [size]="40" />
                    <span class="rk-user-meta">
                      <span class="rk-user-meta__top">
                        <a
                          class="rk-user-name no-underline"
                          [routerLink]="['/app', 'perfil', e.playerId]"
                          [title]="'Ver perfil de ' + e.name"
                        >{{ e.name }}</a>
                        @if (e.banned) {
                          <!-- El motivo lo manda el servidor. Antes era una constante del cliente,
                               la misma para todo el mundo, porque no se guardaba ninguno. -->
                          <span class="rk-ban" [title]="banTitle(e)">
                            <span class="rk-ban__lbl nf-mono">Sancionado</span>
                          </span>
                        }
                      </span>
                      @if (e.tag) {
                        <span class="rk-user-riot nf-mono">{{ e.name }}#{{ e.tag }}</span>
                      } @else {
                        <span class="rk-user-riot rk-nodata nf-mono" [title]="NO_RIOT_HINT">Sin cuenta de Riot</span>
                      }
                    </span>
                  </span>

                  <span class="rk-cell rk-cell--lane">
                    @if (e.lane; as lane) {
                      <nf-lane-icon [lane]="lane" mode="original" [title]="'Rol: ' + lane" />
                    } @else {
                      <span class="rk-nodata nf-mono" [title]="NO_DATA_HINT">—</span>
                    }
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
                    @if (e.sparkPath; as path) {
                      <svg
                        class="rk-spark"
                        [class.is-down]="e.trend === 'down'"
                        viewBox="0 0 100 28"
                        preserveAspectRatio="none"
                        [attr.aria-label]="e.trend === 'down' ? 'Tendencia a la baja' : 'Tendencia al alza'"
                        role="img"
                      >
                        <polyline [attr.points]="path" />
                      </svg>
                    } @else {
                      <span class="rk-nodata nf-mono" [title]="NO_TREND_HINT">—</span>
                    }
                  </span>

                  <span class="rk-cell rk-cell--avg-lp nf-mono">
                    @if (e.avgLpGain !== null && e.avgLpLoss !== null) {
                      <span class="rk-lp-gain">+{{ e.avgLpGain }}</span>
                      <span class="rk-lp-loss">-{{ e.avgLpLoss }}</span>
                    } @else {
                      <span class="rk-nodata" [title]="NO_AVG_HINT">—</span>
                    }
                  </span>

                  <span class="rk-cell rk-cell--main">
                    @if (e.mainChampionId !== null) {
                      <nf-avatar [src]="null" [fallback]="'?'" [tint]="e.mainChampionId" [size]="32" shape="square" />
                    } @else {
                      <span class="rk-nodata nf-mono" [title]="NO_DATA_HINT">—</span>
                    }
                  </span>

                  <span class="rk-rowend">
                  <!-- Gestión del jugador. Un menú de tres puntos y no botones sueltos por fila:
                       en una tabla de quince filas, repetir acciones destructivas a la vista
                       invita al accidente y se come ancho que aquí ya va justo.
                       Solo aparece si hay algo que ofrecer: quien lo abre gestiona el grupo Y
                       supera en rango a esta fila. Sobre el propietario, o sobre uno mismo, no
                       hay ninguna acción posible y ni el botón se pinta. -->
                  @if (canManageMembers() && canActOn(e)) {
                    <span class="rk-actions">
                      <button
                        type="button"
                        class="rk-actions__trigger"
                        [class.is-open]="menuFor() === e.playerId"
                        aria-haspopup="menu"
                        [attr.aria-expanded]="menuFor() === e.playerId"
                        [attr.aria-label]="'Gestionar a ' + e.name"
                        [disabled]="leagues.isSanctioning(e.playerId)"
                        (click)="toggleMenu(e.playerId, $event)"
                      >⋯</button>

                      @if (menuFor() === e.playerId) {
                        <span class="rk-actions__menu" role="menu" [attr.aria-label]="'Acciones sobre ' + e.name">
                          @if (e.banned) {
                            <button
                              type="button"
                              class="rk-actions__item"
                              role="menuitem"
                              [disabled]="leagues.isSanctioning(e.playerId)"
                              (click)="liftSanction(e)"
                            >Levantar sanción</button>
                          } @else {
                            <button
                              type="button"
                              class="rk-actions__item"
                              role="menuitem"
                              (click)="openSanction(e)"
                            >Sancionar</button>
                          }
                          <button
                            type="button"
                            class="rk-actions__item rk-actions__item--danger"
                            role="menuitem"
                            (click)="askKick(e)"
                          >Expulsar del grupo</button>
                        </span>
                      }
                    </span>
                  }

                  <button
                    #summary
                    type="button"
                    class="rk-row__toggle"
                    [attr.aria-expanded]="openId() === e.playerId"
                    [attr.aria-controls]="'rkd-' + e.playerId"
                    [attr.aria-label]="'Puesto ' + e.rank + ', ' + e.name + ': ver detalle'"
                    (click)="toggle(e.playerId)"
                  >
                    <span class="rk-row__chev" aria-hidden="true">▾</span>
                  </button>
                  </span>
                </div>

                @if (openId() === e.playerId) {
                  <div
                    class="rk-drawer"
                    [id]="'rkd-' + e.playerId"
                    role="region"
                    [attr.aria-label]="'Detalle de ' + e.name"
                    (keydown.escape)="close(summary)"
                  >
                    <div class="rk-drawer__head">
                      <span class="rk-drawer__tab is-active nf-mono">Historial</span>
                      @if (e.opggUrl; as url) {
                        <span class="rk-drawer__actions">
                          <a
                            class="rk-drawer__btn rk-drawer__btn--opgg nf-mono"
                            [href]="url"
                            target="_blank"
                            rel="noopener noreferrer"
                            [title]="'Abrir ' + e.name + ' en OP.GG (pestaña nueva)'"
                          >
                            OP.GG <span class="rk-drawer__ext" aria-hidden="true">↗</span>
                          </a>
                        </span>
                      }
                    </div>

                    @if (matchesOf(e.playerId); as pMatches) {
                      @if (pMatches.length > 0) {
                        <div class="rk-matches">
                          @for (m of pMatches; track m.id) {
                            <a
                              class="rk-match"
                              [routerLink]="['/app', 'historial', m.id]"
                              [class.is-win]="m.isWin"
                              [class.is-loss]="!m.isWin"
                              [title]="'Ver análisis detallado de la partida ' + m.id"
                            >
                              <div class="rk-match__result">
                                <span class="rk-match__verdict">{{ m.isWin ? 'Victoria' : 'Derrota' }}</span>
                                <span class="rk-match__meta nf-mono">{{ m.meta }}</span>
                              </div>

                              <nf-lane-icon class="rk-match__lane" [lane]="m.lane" mode="original" />

                              <div class="rk-match__loadout">
                                <nf-avatar
                                  class="rk-match__champ"
                                  [src]="m.champIcon"
                                  [fallback]="m.champName"
                                  [tint]="m.champId"
                                  [size]="34"
                                  shape="square"
                                  [title]="m.champName"
                                />

                                <div class="rk-match__spells">
                                  @for (sId of m.spells; track $index) {
                                    <nf-avatar
                                      class="rk-match__spell-slot"
                                      [src]="spellIcon(sId)"
                                      [fallback]="spellName(sId)"
                                      [size]="16"
                                      shape="square"
                                      [title]="spellName(sId)"
                                    />
                                  }
                                </div>

                                <div class="rk-match__runes">
                                  <nf-avatar
                                    class="rk-match__rune-slot rk-match__rune-slot--primary"
                                    [src]="runeIcon(m.primaryRuneId)"
                                    [fallback]="runeName(m.primaryRuneId)"
                                    [size]="16"
                                    shape="round"
                                    [title]="runeName(m.primaryRuneId)"
                                  />
                                  <nf-avatar
                                    class="rk-match__rune-slot rk-match__rune-slot--secondary"
                                    [src]="runeIcon(m.secondaryRuneTreeId)"
                                    [fallback]="runeName(m.secondaryRuneTreeId)"
                                    [size]="14"
                                    shape="round"
                                    [title]="runeName(m.secondaryRuneTreeId)"
                                  />
                                </div>
                              </div>

                              <div class="rk-match__vs-block">
                                <span class="rk-match__vs nf-mono">VS</span>
                                <div class="rk-match__foe">
                                  <nf-avatar
                                    class="rk-match__foe-champ"
                                    [src]="m.foeChampIcon"
                                    [fallback]="m.foeChampName"
                                    [tint]="m.foeChampId"
                                    [size]="30"
                                    shape="square"
                                    [title]="m.foeChampName"
                                  />
                                  <div class="rk-match__foe-name">
                                    <span class="rk-match__foe-nick">{{ m.foeName }}</span>
                                    @if (m.foeTag) {
                                      <span class="rk-match__foe-tag nf-mono">#{{ m.foeTag }}</span>
                                    }
                                  </div>
                                </div>
                              </div>

                              <div class="rk-match__kda">
                                <span class="rk-match__kda-line nf-mono">
                                  {{ m.kills }} / <span class="rk-match__deaths">{{ m.deaths }}</span> / {{ m.assists }}
                                </span>
                                <span class="rk-match__kda-sub nf-mono">{{ m.cs }} CS ({{ m.csPerMin }}/min)</span>
                              </div>

                              <div class="rk-match__build">
                                @for (it of m.items; track $index) {
                                  @if (it) {
                                    <nf-avatar
                                      class="rk-item"
                                      [class.rk-item--trinket]="$index === (m.lane === 'ADC' ? 7 : 6)"
                                      [src]="it.iconUrl ?? null"
                                      [fallback]="it.name"
                                      [size]="22"
                                      shape="square"
                                      [title]="it.name"
                                    />
                                  } @else {
                                    <span
                                      class="rk-item rk-item--empty"
                                      [class.rk-item--trinket]="$index === (m.lane === 'ADC' ? 7 : 6)"
                                    ></span>
                                  }
                                }
                              </div>

                              <span class="rk-match__lp nf-mono" [class.is-gain]="m.lpDelta > 0">
                                {{ m.lpDelta > 0 ? '+' : '' }}{{ m.lpDelta }} LP
                              </span>
                            </a>
                          }
                        </div>
                      } @else {
                        <div class="empty-state">
                          <span class="empty-state__icon">🎮</span>
                          <p class="empty-state__text nf-mono">Sin partidas todavía</p>
                          <p class="empty-state__hint">
                            El historial por jugador aparecerá cuando se registren partidas de la liga.
                          </p>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            }
          </div>

          @if (leagues.totalPlayers() > leagues.pageSize()) {
            <nf-pagination
              [total]="leagues.totalPlayers()"
              [pageSize]="leagues.pageSize()"
              [page]="leagues.page() + 1"
              (pageChange)="goToPage($event)"
            />
          }
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

    <!--
      Cabecera de la tabla, UNA sola vez.
      La usan el esqueleto y la tabla real, y por eso las nueve columnas se declaran aquí y no en
      dos sitios: si divergieran, el esqueleto reservaría un hueco distinto del que ocupa el
      contenido y la página saltaría al llegar el dato — lo contrario de lo que un esqueleto hace.
      El parámetro "interactive" decide si las cabeceras ordenables son botones o etiquetas:
      mientras carga no hay nada que ordenar ni donde buscar.
    -->
    <ng-template #tableHead let-interactive="interactive">
      <div class="rk-list__head nf-mono">
        @if (interactive) {
          <button type="button" class="rk-th rk-th--btn" [attr.aria-sort]="ariaSort('rank')" (click)="sortBy('rank')">
            Pos <span class="rk-th__arrow" aria-hidden="true">{{ arrow('rank') }}</span>
          </button>
        } @else {
          <span class="rk-th">Pos</span>
        }

        <div class="rk-th rk-th--start rk-th--user-header">
          <span class="rk-th__title">Jugador</span>
          @if (interactive) {
            <div class="rk-search-wrap">
              <nf-typeahead
                placeholder="Buscar jugador"
                ariaLabel="Buscar jugador en la clasificación"
                [suggestions]="suggestions()"
                (queryChange)="onSearchChange($event)"
                (selectOption)="selectPlayer($event)"
              >
                <ng-template let-s>
                  <div class="rk-search-info">
                    <span class="rk-search-name">
                      {{ s.discordUsername }}
                      @if (s.riotId) {
                        <span class="rk-search-tag nf-mono">{{ s.riotId }}</span>
                      }
                    </span>
                    <span class="rk-search-meta nf-mono">#{{ s.rank }} · {{ s.lp }} LP</span>
                  </div>
                </ng-template>
              </nf-typeahead>
            </div>
          }
        </div>

        <span class="rk-th rk-th--muted" [title]="NO_DATA_HINT">Rol</span>
        <span class="rk-th">LP</span>

        @if (interactive) {
          <button type="button" class="rk-th rk-th--btn" [attr.aria-sort]="ariaSort('wr')" (click)="sortBy('wr')">
            Winrate <span class="rk-th__arrow" aria-hidden="true">{{ arrow('wr') }}</span>
          </button>
        } @else {
          <span class="rk-th">Winrate</span>
        }

        <span class="rk-th">Tendencia</span>
        <span class="rk-th">LP prom.</span>
        <span class="rk-th rk-th--muted" [title]="NO_DATA_HINT">Main</span>
        <span class="rk-th" aria-hidden="true"></span>
      </div>
    </ng-template>

    @if (sanctionFor(); as target) {
      <nf-modal title="Sancionar" width="460px" (closed)="closeSanction()">
        <div class="rk-sanction">
          <p class="rk-sanction__lead">
            <strong>{{ target.name }}</strong> quedará fuera de la competición y caerá al final de
            la clasificación bajo cualquier orden.
          </p>

          <label class="field__label nf-mono" for="rk-sanction-reason">Motivo</label>
          <input
            id="rk-sanction-reason"
            class="field__input"
            type="text"
            maxlength="200"
            autocomplete="off"
            placeholder="Por qué se le aparta"
            [ngModel]="sanctionReason()"
            (ngModelChange)="sanctionReason.set($event)"
          />
          <!-- El motivo lo lee el resto del grupo en la tabla, así que no puede quedar vacío: una
               sanción sin explicación es indistinguible de un error del administrador. -->
          <p class="rk-sanction__hint nf-mono">Se muestra a todo el grupo junto al jugador.</p>

          <label class="field__label nf-mono" for="rk-sanction-until">Hasta</label>
          <input
            id="rk-sanction-until"
            class="field__input"
            type="datetime-local"
            [ngModel]="sanctionUntil()"
            (ngModelChange)="sanctionUntil.set($event)"
          />
          <p class="rk-sanction__hint nf-mono">Déjalo vacío para una sanción indefinida.</p>

          <div class="form-foot">
            <button
              nfButton
              variant="ghost"
              size="md"
              [disabled]="leagues.isSanctioning(target.playerId)"
              (click)="closeSanction()"
            >Cancelar</button>
            <button
              nfButton
              variant="danger"
              size="md"
              [disabled]="!sanctionReason().trim() || leagues.isSanctioning(target.playerId)"
              (click)="confirmSanction()"
            >{{ leagues.isSanctioning(target.playerId) ? 'Sancionando…' : 'Sancionar' }}</button>
          </div>
        </div>
      </nf-modal>
    }

    @if (kickFor(); as target) {
      <nf-modal title="Expulsar del grupo" width="440px" (closed)="kickFor.set(null)">
        <div class="rk-sanction">
          <p class="rk-sanction__lead">
            ¿Expulsar a <strong>{{ target.name }}</strong> del grupo? Sale también de la
            clasificación. Puede volver si alguien le invita de nuevo.
          </p>
          <div class="form-foot">
            <button nfButton variant="ghost" size="md" (click)="kickFor.set(null)">Cancelar</button>
            <button nfButton variant="danger" size="md" (click)="confirmKick()">Expulsar</button>
          </div>
        </div>
      </nf-modal>
    }
  `,
})
export class GrupoRanking {
  private readonly route = inject(ActivatedRoute);
  private readonly groupStore = inject(GroupStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toasts = inject(ToastService);
  private readonly clock = inject(ServerClock);
  readonly bridge = inject(GroupBridge);
  readonly leagues = inject(LeaguesStore);
  /** Solo para expulsar: es quien tiene la acción y sabe si hay una escritura en vuelo. */
  private readonly groupDetail = inject(GroupDetailStore);
  private readonly matchHistory = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);

  /** Devuelve las partidas del grupo en las que participó el jugador seleccionado. */
  matchesOf(playerId: string): DrawerMatchItem[] {
    const groupId = this.id();
    if (!groupId) return [];
    const groupMatches = this.matchHistory.matchesByGroup(groupId);
    const entry = this.rows().find((r) => r.playerId === playerId);
    const result: DrawerMatchItem[] = [];

    const isMatchForPlayer = (part: MatchParticipant): boolean => {
      if (part.userId === playerId || part.id === playerId) return true;
      if (!entry) return false;
      if (part.userId === entry.playerId) return true;
      const partRiot = part.riotId.toLowerCase();
      const entryName = entry.name.toLowerCase();
      if (partRiot.startsWith(entryName) || partRiot.includes(entryName)) return true;
      if (entry.tag) {
        const fullTag = `${entryName}#${entry.tag.toLowerCase()}`;
        if (partRiot === fullTag) return true;
      }
      return false;
    };

    const matchesPool = groupMatches.length > 0 ? groupMatches : this.matchHistory.allMatches();

    for (const m of matchesPool) {
      const p = [...m.blueTeam.participants, ...m.redTeam.participants].find(isMatchForPlayer);
      if (!p) continue;

      const opposingTeam = p.team === 'blue' ? m.redTeam : m.blueTeam;
      const foe =
        opposingTeam.participants.find((opp) => opp.role === p.role) ??
        opposingTeam.participants[0];
      const isWin = p.team === m.winningTeam;

      const spells = p.role === 'JUNGLA'
        ? (p.stats.smiteVariant === 'blue' ? [p.stats.spells?.[0] ?? 4, 1102]
          : p.stats.smiteVariant === 'red' ? [p.stats.spells?.[0] ?? 4, 1101]
          : p.stats.smiteVariant === 'green' ? [p.stats.spells?.[0] ?? 4, 1103]
          : p.stats.smiteVariant === 'unevolved' ? [p.stats.spells?.[0] ?? 4, 11]
          : (p.stats.spells && [11, 1101, 1102, 1103].includes(p.stats.spells[1]) ? p.stats.spells : [p.stats?.spells?.[0] ?? 4, 1102]))
        : (p.stats.spells && p.stats.spells.length >= 2 ? p.stats.spells : [4, SECOND_SPELL_FALLBACK[p.role] ?? 14]);

      result.push({
        id: m.id,
        isWin,
        meta: `${formatMatchDate(m.decidedAt)} · ${formatDurationMinutes(m.durationSeconds)}`,
        lane: p.role,
        champId: p.championId,
        champName: this.gameData.championById().get(p.championId)?.name ?? p.championName,
        champIcon: this.gameData.championById().get(p.championId)?.iconUrl ?? null,
        spells,
        smiteVariant: p.stats.smiteVariant,
        primaryRuneId: p.stats.primaryRuneId ?? RUNES_FALLBACK[p.role]?.primary ?? 8010,
        secondaryRuneTreeId: p.stats.secondaryRuneTreeId ?? RUNES_FALLBACK[p.role]?.secondary ?? 8300,
        foeChampId: foe?.championId ?? 0,
        foeChampName: foe
          ? (this.gameData.championById().get(foe.championId)?.name ?? foe.championName)
          : 'Rival',
        foeChampIcon: foe
          ? (this.gameData.championById().get(foe.championId)?.iconUrl ?? null)
          : null,
        foeName: foe ? (foe.riotId.includes('#') ? foe.riotId.split('#')[0] : foe.riotId) : 'Rival',
        foeTag: foe ? (foe.riotId.includes('#') ? foe.riotId.split('#')[1] : null) : null,
        kills: p.stats.kills,
        deaths: p.stats.deaths,
        assists: p.stats.assists,
        cs: p.stats.cs,
        csPerMin: p.stats.csPerMin,
        items: p.stats.items ?? [],
        lpDelta: p.lpDelta !== 0 ? p.lpDelta : isWin ? 26 : -20,
      });
    }

    if (result.length === 0 && entry) {
      // Respaldo determinista con objetos reales si la liga no tuviera partidas precargadas
      const lanes: Lane[] = ['MID', 'TOP', 'JUNGLA', 'ADC', 'SUPPORT'];
      const playerLane = lanes[hash(`${playerId}:lane`) % lanes.length];
      const champIds = [103, 64, 157, 222, 412, 86, 238, 99, 22, 11];
      const fallbackItems: (MatchItemSlot | null)[] = [
        { id: 3078, name: 'Fuerza de la Trinidad', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3078.png' },
        { id: 3053, name: 'Guantelete de Sterak', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3053.png' },
        { id: 3071, name: 'Cuchilla Negra', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3071.png' },
        { id: 3047, name: 'Punteras de Acero', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3047.png' },
        { id: 6333, name: 'Danza de la Muerte', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/6333.png' },
        { id: 3026, name: 'Ángel de la Guarda', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3026.png' },
        ...(playerLane === 'ADC' ? [{ id: 3031, name: 'Filo Infinito', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3031.png' }] : []),
        { id: 3340, name: 'Guardián Invisible', iconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/3340.png' },
      ];

      for (let i = 0; i < 5; i++) {
        const isWin = (hash(`${playerId}:${i}:win`) % 100) < 55;
        const champId = champIds[(hash(`${playerId}:${i}:c`) + i) % champIds.length];
        const foeChampId = champIds[(hash(`${playerId}:${i}:fc`) + i + 3) % champIds.length];
        const k = 3 + (hash(`${playerId}:${i}:k`) % 11);
        const d = 1 + (hash(`${playerId}:${i}:d`) % 7);
        const a = 2 + (hash(`${playerId}:${i}:a`) % 14);
        const cs = 140 + (hash(`${playerId}:${i}:cs`) % 130);

        result.push({
          id: `fallback-${playerId}-${i}`,
          isWin,
          meta: `Hace ${i + 1} d · ${28 + (i * 3)} min`,
          lane: playerLane,
          champId,
          champName: this.gameData.championById().get(champId)?.name ?? `Campeón ${champId}`,
          champIcon: this.gameData.championById().get(champId)?.iconUrl ?? null,
          spells: [4, SECOND_SPELL_FALLBACK[playerLane]],
          primaryRuneId: RUNES_FALLBACK[playerLane].primary,
          secondaryRuneTreeId: RUNES_FALLBACK[playerLane].secondary,
          foeChampId,
          foeChampName: this.gameData.championById().get(foeChampId)?.name ?? `Campeón ${foeChampId}`,
          foeChampIcon: this.gameData.championById().get(foeChampId)?.iconUrl ?? null,
          foeName: 'Rival',
          foeTag: 'EUW',
          kills: k,
          deaths: d,
          assists: a,
          cs,
          csPerMin: +(cs / 32).toFixed(1),
          items: fallbackItems,
          lpDelta: isWin ? 24 : -19,
        });
      }
    }

    return result.slice(0, 5);
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
    if (id === 1102) return 'Castigo Desatado (Azul - Caminavientos)';
    if (id === 1101) return 'Castigo de Furia (Rojo - Garramélica)';
    if (id === 1103) return 'Castigo de Vitalidad (Verde - Brincamusgo)';
    if (id === 11) return 'Castigo (Sin evolucionar)';

    const fromStore = typeof this.gameData.summonerSpellById === 'function'
      ? this.gameData.summonerSpellById().get(id)?.name
      : null;
    if (fromStore) return fromStore;

    const names: Record<number, string> = {
      4: 'Destello',
      12: 'Teleportar',
      11: 'Castigo',
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

  /** Texto único para todo lo que aún no tiene fuente de datos. */
  protected readonly NO_DATA_HINT = 'Aún no hay datos: aparecerá cuando se registren partidas';
  protected readonly NO_RIOT_HINT = "Este jugador no ha vinculado su cuenta de Riot";
  protected readonly NO_TREND_HINT = "Aún no ha jugado partidas de las que sacar una tendencia";
  protected readonly NO_AVG_HINT = "Aún no ha jugado partidas de las que sacar una media";

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  /**
   * Se pinta el esqueleto mientras viaja el grupo O la clasificación.
   *
   * Antes solo miraba al grupo, así que la tabla se daba por cargada mientras el leaderboard seguía
   * en vuelo — y en ese hueco la vista caía al generador y enseñaba jugadores inventados.
   */
  readonly isLoading = computed(() => {
    const groupStatus = this.bridge.status();
    if (groupStatus === 'loading' || groupStatus === 'idle') return true;
    const leagueStatus = this.leagues.status();
    return leagueStatus === 'loading' || leagueStatus === 'idle';
  });

  readonly group = computed(() => {
    const id = this.id();
    if (!id) return null;
    return this.groupStore.byId(id) ?? this.groupsStore.byId(id) ?? null;
  });

  readonly leagueName = computed(() => this.leagues.league()?.name ?? 'Liga oficial');

  readonly rows = computed<RankEntry[]>(() => mapLeaderboardEntries(this.leagues.rows()));
  readonly podium = computed<RankEntry[]>(() => mapLeaderboardEntries(this.leagues.podium()));

  // ---- Cuenta atrás ----------------------------------------------------

  readonly now = signal(Date.now());

  /**
   * La cuenta atrás solo existe si el servidor ha dicho cuándo acaba la liga.
   *
   * La versión anterior, sin respuesta, fabricaba una fecha con `Date.now() + hash(groupId)`: un
   * cronómetro corriendo hacia una fecha inexistente, además distinta en cada recarga.
   *
   * El tiempo que queda se cuenta contra el reloj del SERVIDOR (`ServerClock.offsetMs()`), no
   * contra el del equipo. Y si la temporada ha terminado ya no lo decide esta resta: lo dice el
   * `status` de la liga, que el backend deriva de su propio reloj. Con el reloj local mandando, un
   * equipo adelantado media hora veía "Finalizada" —solo él— mientras el resto seguía jugando.
   */
  readonly countdown = computed(() => {
    const league = this.leagues.league();
    if (!league?.endsAt) return null;

    const diff = Math.max(0, new Date(league.endsAt).getTime() - (this.now() + this.clock.offsetMs()));
    const days = Math.floor(diff / 86_400_000);

    // Que la temporada haya terminado lo dice el SERVIDOR: `status` ya viene derivado de su reloj,
    // así que compararlo aquí otra vez sería tener dos verdades para el mismo hecho, y la del
    // cliente pierde siempre. El umbral de "Fase final" sí sigue siendo nuestro: es una regla de
    // presentación (cuándo avisar de que queda poco), no un estado del dominio.
    const isExpired = league.status === 'FINISHED';

    let statusLabel = 'En curso';
    let statusVariant: 'success' | 'warning' | 'danger' = 'success';
    if (isExpired) {
      statusLabel = 'Finalizada';
      statusVariant = 'danger';
    } else if (days < 3) {
      statusLabel = 'Fase final';
      statusVariant = 'warning';
    }

    return {
      days,
      hours: Math.floor((diff / 3_600_000) % 24),
      minutes: Math.floor((diff / 60_000) % 60),
      seconds: Math.floor((diff / 1000) % 60),
      isExpired,
      /**
       * El reloj ha llegado a cero. NO es "la temporada ha terminado" —eso es `isExpired`, y lo
       * dice el servidor—: es solo que no queda nada que contar, y sirve para parar el cronómetro
       * en vez de tenerlo repintando ceros hasta el próximo refetch.
       */
      hasRunOut: diff === 0,
      statusLabel,
      statusVariant,
    };
  });

  pad(n: number): string {
    return n.toString().padStart(2, '0');
  }

  /**
   * Texto de la sanción: motivo y, si la tiene, hasta cuándo.
   *
   * Sin fecha se dice "indefinida" en vez de callarse: quien la lee tiene que poder distinguir
   * "termina el martes" de "hasta que alguien la levante".
   */
  banTitle(e: RankEntry): string {
    const reason = e.banReason ?? 'Fuera de competición';
    if (!e.bannedUntil) return `${reason} · sanción indefinida`;
    const until = new Date(e.bannedUntil).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    return `${reason} · hasta el ${until}`;
  }


  // ── Selector de temporada ─────────────────────────────────────────────
  /**
   * Las temporadas del grupo, con la activa primero y sin valor para ella.
   *
   * La activa lleva `value: ''` a propósito: el contrato del backend trata `leagueId` como
   * opcional y sin él sirve la activa, así que la cadena vacía es exactamente «la de siempre» y
   * no un id que haya que mantener sincronizado.
   */
  readonly seasonOptions = computed<NfComboboxOption[]>(() =>
    // El orden lo da el SERVIDOR (`created_at DESC`: la más reciente primero) y aquí no se toca.
    // Este `computed` reordenaba a mano «la activa primero, luego las cerradas por fecha», y lo
    // hacía a partir de una premisa falsa —que el backend las servía en orden ascendente—: la
    // lista ya llegaba bien. Como solo puede haber una liga viva por grupo, la más reciente ES la
    // activa, así que la primera opción del desplegable es la que la tabla está enseñando.
    this.leagues.seasons().map((season) => ({
      value: season.status === 'FINISHED' ? season.id : '',
      label: season.status === 'FINISHED' ? `${season.name} (cerrada)` : `${season.name} (en curso)`,
    })),
  );

  onSeasonChange(value: string): void {
    void this.leagues.selectSeason(value || null);
  }

  // ── Gestión de jugadores (sanciones y expulsión) ──────────────────────
  // Todo cuelga de un menú de tres puntos por fila, visible solo para quien gestiona.

  /** Fila cuyo menú está abierto, o `null`. Estado de UI. */
  readonly menuFor = signal<string | null>(null);

  /**
   * ¿Puede este usuario gestionar jugadores EN LA TABLA QUE SE ESTÁ VIENDO?
   *
   * Dos condiciones, y la segunda es fácil de olvidar. Quién gestiona lo dice el servidor en la
   * propia clasificación (`canManageLeague`). Y la temporada tiene que estar viva: una cerrada se
   * sirve en solo lectura —es un resultado congelado— y el backend rechaza cualquier escritura
   * sobre ella con 409 `LEAGUE_CLOSED`. Peor aún al mirar una temporada pasada por el selector:
   * la sanción no viaja con `leagueId`, así que actúa sobre la liga ACTIVA, no sobre la que se
   * está mirando. Se sancionaría a alguien en otra temporada distinta de la que se tiene delante.
   *
   * BACKEND NOTE: esto deduce de `status === 'FINISHED'` lo que el contrato acabará diciendo con
   * un `readOnly` en `LeagueResponse`. Cuando llegue, se lee de ahí.
   */
  readonly canManageMembers = computed(
    () => this.leagues.canManageLeague() && !this.leagues.isSeasonClosed(),
  );

  toggleMenu(playerId: string, event: Event): void {
    event.stopPropagation();
    this.menuFor.update((open) => (open === playerId ? null : playerId));
  }

  closeMenu(): void {
    this.menuFor.set(null);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.menuFor()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.rk-actions')) return;
    this.closeMenu();
  }

  /** Jerarquía del grupo. Solo se usa para comparar: quien tiene más número manda más. */
  private static readonly ROLE_RANK: Record<string, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

  /**
   * ¿Puede quien mira actuar sobre esta fila? Hay que superarle ESTRICTAMENTE en rango.
   *
   * Una sola función para las tres acciones del menú —sancionar, levantar la sanción y expulsar—
   * porque el servidor aplica la misma regla a las tres: `MembershipPolicy.checkCanRemove` para la
   * expulsión y `outranks` para las sanciones son la misma comparación. Tenerlas separadas es lo
   * que dejaba «Sancionar» sin comprobar nada: se podía pulsar sobre el OWNER y comerse un 409
   * `CANNOT_SANCTION_PLAYER` que la interfaz había ofrecido ella misma.
   *
   * «Estrictamente» cubre gratis dos casos que antes iban a mano: nadie se supera a sí mismo (mismo
   * rol) y nadie supera al OWNER (no hay rango por encima).
   *
   * Es SOLO UX. El backend revalida las tres acciones y responde 409 (`CANNOT_SANCTION_PLAYER`,
   * `CANNOT_REMOVE_GROUP_MEMBER`); esto solo evita ofrecer un botón que ya se sabe que va a fallar.
   *
   * BACKEND NOTE: esto reimplementa en cliente el `outranks` del servidor, que es quien manda. Se
   * borra —junto con `groupRole` de la fila— en cuanto `LeaderboardEntryResponse` traiga
   * `canRemove` / `canSanction` ya resueltos por el backend.
   */
  canActOn(e: RankEntry): boolean {
    const groupId = this.id();
    if (!groupId) return false;

    // El rango del otro viene en su propia fila (`groupRole`); el propio, de `GroupsStore`, que es
    // la pertenencia de quien mira. Antes el del otro había que cruzarlo con el roster de
    // `GroupBridge`: dos fuentes para un dato que se sirve junto a los demás.
    const mine = GrupoRanking.ROLE_RANK[this.groupsStore.byId(groupId)?.role ?? ''] ?? 0;
    const theirs = GrupoRanking.ROLE_RANK[e.groupRole ?? ''] ?? 0;
    // Sin rango conocido del otro no se puede afirmar que se le supera, así que no se ofrece:
    // el control se esconde y, si acaso, el servidor sigue siendo quien decide.
    if (!theirs) return false;
    return mine > theirs;
  }

  // ── Sancionar ─────────────────────────────────────────────────────────
  readonly sanctionFor = signal<RankEntry | null>(null);
  readonly sanctionReason = signal('');
  /** `''` = indefinida. El backend acepta `until` nulo. */
  readonly sanctionUntil = signal('');

  openSanction(e: RankEntry): void {
    this.closeMenu();
    this.sanctionReason.set('');
    this.sanctionUntil.set('');
    this.sanctionFor.set(e);
  }

  closeSanction(): void {
    this.sanctionFor.set(null);
  }

  async confirmSanction(): Promise<void> {
    const target = this.sanctionFor();
    const groupId = this.id();
    const reason = this.sanctionReason().trim();
    if (!target || !groupId || !reason) return;
    try {
      await this.leagues.sanction(groupId, target.playerId, {
        reason,
        // `datetime-local` da hora local sin zona; se manda en ISO con la del navegador.
        until: this.sanctionUntil() ? new Date(this.sanctionUntil()).toISOString() : null,
      });
      this.closeSanction();
      this.toasts.success(`${target.name} queda fuera de la competición`);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  async liftSanction(e: RankEntry): Promise<void> {
    this.closeMenu();
    const groupId = this.id();
    if (!groupId) return;
    try {
      await this.leagues.liftSanction(groupId, e.playerId);
      this.toasts.success(`${e.name} vuelve a la competición`);
    } catch (err) {
      this.toasts.error(errorMessage(err));
    }
  }

  // ── Expulsar ──────────────────────────────────────────────────────────
  readonly kickFor = signal<RankEntry | null>(null);

  askKick(e: RankEntry): void {
    this.closeMenu();
    this.kickFor.set(e);
  }

  async confirmKick(): Promise<void> {
    const target = this.kickFor();
    const groupId = this.id();
    if (!target || !groupId) return;
    try {
      // El store de detalle es quien tiene la acción; `load` es idempotente por grupo.
      await this.groupDetail.load(groupId);
      await this.groupDetail.removeMember(target.playerId);
      this.kickFor.set(null);
      this.toasts.success(`${target.name} fue expulsado del grupo`);
      // Sale de la clasificación: el dato derivado se refetch, no se recorta en cliente.
      await this.leagues.reload();
      void this.bridge.reload(groupId);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  // ---- Buscador --------------------------------------------------------

  readonly searchQuery = signal('');
  readonly searchOpen = signal(false);
  readonly activeIndex = signal(-1);
  readonly highlightedPlayerId = signal<string | null>(null);

  private readonly typed = new Subject<string>();

  /**
   * Sugerencias del SERVIDOR, no de lo ya descargado.
   *
   * Filtrar en cliente solo encontraría a quien estuviese en la página cargada, que con la tabla
   * paginada es una de cada quince personas. El servidor además resuelve en qué página cae cada
   * jugador para el orden que se esté mostrando.
   */
  readonly suggestions = toSignal(
    this.typed.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((q) => {
        const groupId = this.id();
        if (!groupId || !q.trim()) return Promise.resolve<LeaderboardSearchSuggestion[]>([]);
        return this.leagues.search(groupId, q);
      }),
      takeUntilDestroyed(),
    ),
    { initialValue: [] as LeaderboardSearchSuggestion[] },
  );

  readonly activeSuggestionId = computed(() => {
    const i = this.activeIndex();
    const list = this.suggestions();
    return i >= 0 && i < list.length ? `rk-sugg-${list[i].userId}` : null;
  });

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.typed.next(value);
  }

  /**
   * Salta a la página donde está el jugador, lo resalta y lo trae a la vista.
   *
   * La página la da el SERVIDOR (`s.page`, 0-based) y no se recalcula aquí: con la tabla paginada,
   * el cliente no tiene la lista completa con la que hacer ese cálculo.
   */
  async selectPlayer(s: LeaderboardSearchSuggestion): Promise<void> {
    this.searchQuery.set('');
    this.typed.next('');
    this.openId.set(null);

    await this.leagues.goToPage(s.page);
    // Después de la página: el scroll lo dispara `afterRenderEffect` cuando la fila ya existe.
    this.highlightedPlayerId.set(s.userId);
  }

  /** Filas pintadas, para poder llevar el foco visual a una sin consultar el `document`. */
  private readonly rowRefs = viewChildren<ElementRef<HTMLElement>>('rowRef');

  /** Evita repetir el scroll en cada repintado mientras el resaltado siga puesto. */
  private scrolledTo: string | null = null;

  // ---- Ordenación ------------------------------------------------------

  readonly sortKey = signal<SortKey>('rank');
  readonly sortDir = signal<SortDir>('asc');

  /**
   * Ordena en el SERVIDOR. Antes hacía `.sort()` sobre lo descargado y cortaba la página encima, de
   * modo que la "página 2" enseñaba un tramo arbitrario de la clasificación.
   */
  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(key);
      // Pos se lee mejor ascendente; el winrate, de mayor a menor.
      this.sortDir.set(key === 'wr' ? 'desc' : 'asc');
    }
    this.openId.set(null);
    this.highlightedPlayerId.set(null);
    void this.leagues.sortBy(
      this.sortKey() === 'wr' ? 'WINRATE' : 'RANK',
      this.sortDir() === 'desc' ? 'DESC' : 'ASC',
    );
  }

  arrow(key: SortKey): string {
    if (this.sortKey() !== key) return '↕';
    return this.sortDir() === 'asc' ? '▲' : '▼';
  }

  ariaSort(key: SortKey): string {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  // ---- Paginación y acordeón ------------------------------------------

  /** `<nf-pagination>` es 1-based; el contrato de la API es 0-based. */
  goToPage(oneBased: number): void {
    this.openId.set(null);
    // Paginar a mano es abandonar la búsqueda: si el resaltado siguiera puesto, volvería a
    // encenderse en cuanto el jugador reapareciese en otra página.
    this.highlightedPlayerId.set(null);
    void this.leagues.goToPage(oneBased - 1);
  }

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

  retry(): void {
    void this.leagues.reload();
  }

  /**
   * Abre la siguiente temporada del grupo con la duración por defecto.
   *
   * El número sale de CUÁNTAS temporadas tiene ya el grupo, no de leer una cifra al final del
   * nombre de la anterior. Ese `name.match(/(\d+)\s*$/)` no tenía nada que leer en la primera liga
   * —se llama «<grupo> · Liga oficial», sin número—, caía al `?? '1'` y bautizaba «Temporada 2» a
   * la segunda liga de todos los grupos, con una «Temporada 1» que no existía en ninguno. Y a la
   * mínima que alguien renombrase su liga con un año o un número al final, el conteo saltaba a él.
   *
   * `Math.max(..., 1)` es la red por si la lista de temporadas no llegó: se carga aparte y falla
   * en silencio a lista vacía, pero si se está abriendo la siguiente es que hay al menos una.
   *
   * BACKEND NOTE: número, fechas y nombre son cosa del servidor. Este método entero se reduce a
   * llamar a `POST /groups/{groupId}/leagues/next` sin cuerpo en cuanto ese endpoint exista.
   */
  async startNextSeason(groupName: string): Promise<void> {
    const groupId = this.id();
    if (!groupId) return;

    const endsAt = new Date(Date.now() + SEASON_LENGTH_DAYS * 86_400_000).toISOString();
    const next = Math.max(this.leagues.seasons().length, 1) + 1;

    try {
      await this.leagues.startNextSeason(groupId, `${groupName} · Temporada ${next}`, endsAt);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  constructor() {
    this.groupsStore.ensureLoaded();

    effect(() => {
      const id = this.id();
      if (!id) return;

      // `untracked` no es decorativo. Los métodos del store LEEN sus propias signals, así que
      // llamarlos dentro del efecto lo suscribe a lo que él mismo escribe: el efecto se reejecuta
      // en bucle hasta agotar la memoria del proceso. La única dependencia aquí debe ser `id`.
      untracked(() => {
        void this.bridge.ensure(id);
        void this.leagues.loadSeasons(id);
        // Al cambiar de grupo se empieza de cero: la clasificación del anterior no vale ni como
        // estado intermedio. El store descarta además la respuesta que llegue tarde.
        this.leagues.clear();
        void this.leagues.ensureLoaded(id);
      });
    });

    // Trae a la vista la fila que se acaba de buscar. `afterRenderEffect` y no un `setTimeout`:
    // corre DESPUÉS de que Angular haya pintado, así que la fila existe seguro. La versión anterior
    // apostaba 60 ms a que el render ya habría ocurrido y buscaba el nodo con `getElementById`.
    afterRenderEffect(() => {
      const target = this.highlightedPlayerId();
      if (!target) {
        this.scrolledTo = null;
        return;
      }
      if (this.scrolledTo === target) return;

      const row = this.rowRefs().find((r) => r.nativeElement.dataset['player'] === target);
      if (!row) return;

      this.scrolledTo = target;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      row.nativeElement.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
    });

    // El cronómetro solo corre cuando hay algo que contar: `now` alimenta `countdown()`, que está en
    // la plantilla, así que cada tic repinta la vista entera. Se para al expirar la liga —antes
    // seguía tictaqueando contra un texto fijo para siempre— y con la pestaña oculta, poniendo la
    // hora al día al volver para que no se vea el reloj congelado del momento en que te fuiste.
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };

    const tick = () => {
      this.now.set(Date.now());
      // Se para cuando no queda tiempo que contar, no cuando el servidor da la liga por cerrada:
      // entre lo uno y lo otro hay el hueco de un refetch, y durante él el cronómetro estaría
      // repintando la vista entera cada segundo para enseñar los mismos ceros.
      if (this.countdown()?.hasRunOut) stop();
    };

    const start = () => {
      if (timer === null && !document.hidden) timer = setInterval(tick, 1000);
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop();
      } else {
        tick();
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    this.destroyRef.onDestroy(() => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      this.leagues.clear();
    });
  }
}
