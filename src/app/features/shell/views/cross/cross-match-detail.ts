import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { GameDataStore } from '../../../../core/game-data';
import {
  CrossMatch,
  CrossRelation,
  MatchParticipant,
  formatKda,
  itemBg,
  laneLabel,
  matchOutcomeLabel,
} from '../../../../core/matches';
import { formatDuration, formatLongDate, formatNumber } from '../../../../shared/date-format';
import { NfAvatar, NfButton, NfSkeleton } from '../../../../ui';
import { crossMetricRows } from './cross-compare';
import { CrossViewState } from './cross-view-state';
import { nameOf } from './cross-player';

/**
 * El duelo o la cooperación de UNA partida concreta entre dos jugadores.
 *
 * Sirve a las dos rutas (`/app/versus/:playerId/:matchId` y `/app/synergy/:playerId/:matchId`)
 * porque es la misma página con dos encabezados: lo que cambia es de qué lado estabais, y eso
 * ya lo dice la partida. La ruta declara cuál espera, y si no coincide se responde 404 en vez
 * de pintar una cooperación bajo una URL que dice «versus».
 *
 * Es la versión larga del desplegable de la lista: mismas barras, más métricas, las dos builds
 * y la fase de líneas. El marcador 5v5 completo sigue siendo `/app/historial/:id`, que es donde
 * están los otros ocho jugadores.
 */
@Component({
  selector: 'app-cross-match-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfButton, NfSkeleton],
  styleUrl: './cross-match-detail.scss',
  template: `
    <div class="view cx-view">
      @if (state.loading()) {
        <div class="cx-boot" aria-busy="true">
          <nf-skeleton width="180px" height="12px" />
          <nf-skeleton width="260px" height="28px" />
          <nf-skeleton width="100%" height="180px" radius="10px" />
        </div>
      } @else if (state.status() === 'error') {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error de carga</div>
          <h1 class="view__title">No se ha podido cargar</h1>
          <p class="view__lead">
            No hemos podido traer esta partida. Puede ser cosa de la conexión.
          </p>
        </div>
        <button nfButton variant="primary" size="md" (click)="state.reload()">Reintentar</button>
      } @else if (cross(); as c) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'jugador', state.playerId(), c.relation === 'enemy' ? 'contra' : 'juntos']">
          <span class="view-back__arrow" aria-hidden="true">←</span>
          Volver a {{ c.relation === 'enemy' ? 'Cara a cara' : 'Sinergia' }}
        </a>

        <header class="cx-detail__head" [class.is-win]="isWin()" [class.is-loss]="isLoss()">
          <div class="cx-detail__eyebrow nf-mono">{{ relationLabel() }}</div>
          <h1 class="cx-detail__title">Tú y {{ theirName() }}</h1>
          <p class="cx-detail__meta nf-mono">
            {{ outcomeLabel() }} · {{ duration() }} · {{ date() }} · {{ c.match.group.name }}
          </p>
        </header>

        <section class="cx-panel">
          <h2 class="cx-panel__title nf-mono">Comparativa de la partida</h2>
          <div class="cx-compare cx-compare--flat">
            <div class="cx-compare__legend nf-mono">
              <span class="cx-compare__legend-me">Tú · {{ championName(c.me) }}</span>
              <span class="cx-compare__legend-them">
                {{ theirName() }} · {{ championName(c.them) }}
              </span>
            </div>
            @for (r of rows(); track r.key) {
              <div class="cx-metric">
                <div class="cx-metric__val cx-metric__val--me" [class.is-best]="r.winner === 'me'">
                  <span class="cx-metric__num nf-mono">{{ r.mineText }}</span>
                  @if (r.mineSub) {
                    <span class="cx-metric__sub nf-mono">{{ r.mineSub }}</span>
                  }
                </div>
                <div class="cx-metric__center">
                  <span class="cx-metric__label nf-mono">{{ r.label }}</span>
                  <div class="cx-metric__bar" role="presentation">
                    <span class="cx-metric__fill cx-metric__fill--me" [style.width.%]="r.minePct"></span>
                    <span class="cx-metric__fill cx-metric__fill--them" [style.width.%]="r.theirsPct"></span>
                  </div>
                </div>
                <div class="cx-metric__val cx-metric__val--them" [class.is-best]="r.winner === 'them'">
                  <span class="cx-metric__num nf-mono">{{ r.theirsText }}</span>
                  @if (r.theirsSub) {
                    <span class="cx-metric__sub nf-mono">{{ r.theirsSub }}</span>
                  }
                </div>
              </div>
            }
          </div>
        </section>

        @if (lanePhase(); as lp) {
          <section class="cx-panel">
            <h2 class="cx-panel__title nf-mono">Fase de líneas</h2>
            <p class="cx-panel__lead">
              {{
                c.sameLane
                  ? 'Compartisteis posición, así que estas cifras comparan el mismo duelo.'
                  : 'Jugasteis posiciones distintas: las cifras se leen como contexto, no como un duelo.'
              }}
            </p>
            <div class="cx-tiles">
              <div class="cx-tile">
                <span
                  class="cx-tile__value nf-mono"
                  [class.cx-pos]="lp.goldDiff > 0"
                  [class.cx-neg]="lp.goldDiff < 0"
                >
                  {{ lp.goldDiff > 0 ? '+' : '' }}{{ gold(lp.goldDiff) }}
                </span>
                <span class="cx-tile__label nf-mono">Oro en el minuto 14</span>
                <span class="cx-tile__sub nf-mono">
                  tú {{ gold(lp.myGold) }} · {{ theirName() }} {{ gold(lp.theirGold) }}
                </span>
              </div>
              @if (lp.myCs !== null && lp.theirCs !== null) {
                <div class="cx-tile">
                  <span
                    class="cx-tile__value nf-mono"
                    [class.cx-pos]="lp.csDiff > 0"
                    [class.cx-neg]="lp.csDiff < 0"
                  >
                    {{ lp.csDiff > 0 ? '+' : '' }}{{ lp.csDiff }}
                  </span>
                  <span class="cx-tile__label nf-mono">CS en el minuto 14</span>
                  <span class="cx-tile__sub nf-mono">
                    tú {{ lp.myCs }} · {{ theirName() }} {{ lp.theirCs }}
                  </span>
                </div>
              }
            </div>
            @if (laneNote(); as note) {
              <p class="cx-panel__note nf-mono">{{ note }}</p>
            }
          </section>
        }

        <section class="cx-panel">
          <h2 class="cx-panel__title nf-mono">Cómo acabasteis</h2>
          <div class="cx-builds">
            <div class="cx-build">
              <div class="cx-build__who">
                <nf-avatar
                  [loading]="champsLoading()"
                  [src]="icon(c.me)"
                  [fallback]="c.me.championName"
                  [tint]="c.me.championId"
                  [size]="36"
                  shape="square"
                />
                <div class="cx-build__id">
                  <span class="cx-build__name">Tú</span>
                  @if (champsLoading()) {
                    <nf-skeleton width="80px" height="11px" />
                  } @else {
                    <span class="cx-build__champ nf-mono">
                      {{ championName(c.me) }} · nivel {{ c.me.championLevel }}
                    </span>
                  }
                </div>
              </div>
              <div class="cx-build__items">
                @for (it of c.me.stats.items; track $index) {
                  @if (it) {
                    <nf-avatar
                      class="m-card__item-slot"
                      [src]="it.iconUrl ?? null"
                      [fallback]="it.name"
                      [tint]="0"
                      [size]="28"
                      shape="square"
                      [style.background]="slotBg(it.name)"
                      [title]="it.name"
                    />
                  } @else {
                    <span class="m-card__item-slot m-card__item-slot--empty"></span>
                  }
                }
              </div>
            </div>

            <div class="cx-build cx-build--them">
              <div class="cx-build__who">
                <nf-avatar
                  [loading]="champsLoading()"
                  [src]="icon(c.them)"
                  [fallback]="c.them.championName"
                  [tint]="c.them.championId"
                  [size]="36"
                  shape="square"
                />
                <div class="cx-build__id">
                  <span class="cx-build__name">{{ theirName() }}</span>
                  @if (champsLoading()) {
                    <nf-skeleton width="80px" height="11px" />
                  } @else {
                    <span class="cx-build__champ nf-mono">
                      {{ championName(c.them) }} · nivel {{ c.them.championLevel }}
                    </span>
                  }
                </div>
              </div>
              <div class="cx-build__items">
                @for (it of c.them.stats.items; track $index) {
                  @if (it) {
                    <nf-avatar
                      class="m-card__item-slot"
                      [src]="it.iconUrl ?? null"
                      [fallback]="it.name"
                      [tint]="0"
                      [size]="28"
                      shape="square"
                      [style.background]="slotBg(it.name)"
                      [title]="it.name"
                    />
                  } @else {
                    <span class="m-card__item-slot m-card__item-slot--empty"></span>
                  }
                }
              </div>
            </div>
          </div>
        </section>

        <nav class="cx-detail__nav">
          <a
            class="m-lineup__more nf-mono"
            [routerLink]="['/app', 'historial', c.id]"
            [queryParams]="{ volver: '/app/historial-cruzado/' + state.playerId() }"
          >
            Ver el análisis 5v5 completo
          </a>
          @if (neighbours().prev; as prev) {
            <a class="m-lineup__more nf-mono" [routerLink]="linkTo(prev)">Cruce más reciente</a>
          }
          @if (neighbours().next; as next) {
            <a class="m-lineup__more nf-mono" [routerLink]="linkTo(next)">Cruce anterior</a>
          }
        </nav>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Ese cruce no existe</h1>
          <p class="view__lead">{{ notFoundHint() }}</p>
        </div>
        <button
          nfButton
          variant="secondary"
          size="md"
          [routerLink]="['/app', 'historial-cruzado', state.playerId()]"
        >
          Volver al historial cruzado
        </button>
      }
    </div>
  `,
})
export class CrossMatchDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly gameData = inject(GameDataStore);

  protected readonly state = inject(CrossViewState);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  private readonly matchId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('matchId') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('matchId') ?? '' },
  );

  /** La relación que declara la ruta: `versus` espera rivales y `synergy` compañeros. */
  private readonly expected = toSignal(
    this.route.data.pipe(map((d) => d['relation'] as CrossRelation)),
    { initialValue: this.route.snapshot.data['relation'] as CrossRelation },
  );

  /**
   * La partida cruzada, solo si además cuadra con lo que dice la URL. Enseñar una partida como
   * compañeros bajo `/versus/` sería pintar un dato correcto con una etiqueta falsa.
   */
  protected readonly cross = computed<CrossMatch | null>(() => {
    const found = this.state.all().find((c) => c.id === this.matchId());
    if (!found) return null;
    return found.relation === this.expected() ? found : null;
  });

  protected readonly notFoundHint = computed(() =>
    this.expected() === 'enemy'
      ? 'Esa partida no existe, o no es un enfrentamiento entre vosotros dos.'
      : 'Esa partida no existe, o no la jugasteis en el mismo equipo.',
  );

  protected readonly theirName = computed(() =>
    nameOf(this.cross()?.them.riotId ?? this.state.playerId()),
  );

  protected readonly isWin = computed(() => this.cross()?.match.userOutcome === 'win');
  protected readonly isLoss = computed(() => this.cross()?.match.userOutcome === 'loss');

  protected readonly outcomeLabel = computed(() =>
    matchOutcomeLabel(this.cross()?.match.userOutcome),
  );

  protected readonly duration = computed(() =>
    formatDuration(this.cross()?.match.durationSeconds ?? 0),
  );

  protected readonly date = computed(() => formatLongDate(this.cross()?.match.decidedAt ?? ''));

  protected readonly rows = computed(() => {
    const c = this.cross();
    return c ? crossMetricRows(c, true) : [];
  });

  protected readonly relationLabel = computed(() => {
    const c = this.cross();
    if (!c) return '';
    const mine = laneLabel(c.me.role);
    const theirs = laneLabel(c.them.role);
    if (c.relation === 'ally') return `Sinergia · ${mine} + ${theirs}`;
    return c.sameLane ? `Duelo de línea · ${mine}` : `Enfrentamiento · ${mine} contra ${theirs}`;
  });

  /** Solo si los dos traen el dato: media fase de líneas no es una fase de líneas. */
  protected readonly lanePhase = computed(() => {
    const c = this.cross();
    if (!c) return null;
    const myGold = c.me.stats.goldAt14;
    const theirGold = c.them.stats.goldAt14;
    if (myGold === undefined || theirGold === undefined) return null;

    const myCs = c.me.stats.csAt14 ?? null;
    const theirCs = c.them.stats.csAt14 ?? null;

    return {
      myGold,
      theirGold,
      goldDiff: myGold - theirGold,
      myCs,
      theirCs,
      csDiff: myCs !== null && theirCs !== null ? myCs - theirCs : 0,
    };
  });

  protected readonly laneNote = computed(() => {
    const c = this.cross();
    if (!c || !c.sameLane) return null;
    const mine = c.me.stats.wonLane;
    const theirs = c.them.stats.wonLane;
    if (mine === undefined || theirs === undefined) return null;
    if (mine === theirs) return 'La línea acabó igualada.';
    return mine
      ? `Ganaste la línea a ${this.theirName()}.`
      : `${this.theirName()} te ganó la línea.`;
  });

  /**
   * El cruce anterior y el siguiente dentro de la misma relación. Sin esto la página es una vía
   * muerta: para comparar dos duelos seguidos había que volver a la lista y buscarlos.
   */
  protected readonly neighbours = computed(() => {
    const c = this.cross();
    if (!c) return { prev: null as CrossMatch | null, next: null as CrossMatch | null };
    const scope = this.state.all().filter((x) => x.relation === c.relation);
    const i = scope.findIndex((x) => x.id === c.id);
    return { prev: scope[i - 1] ?? null, next: scope[i + 1] ?? null };
  });

  protected linkTo(c: CrossMatch): unknown[] {
    return ['/app', c.relation === 'ally' ? 'synergy' : 'versus', this.state.playerId(), c.id];
  }

  protected gold(value: number): string {
    return formatNumber(value);
  }

  protected slotBg(name: string): string {
    return itemBg(name);
  }

  protected icon(p: MatchParticipant): string | null {
    return this.gameData.championById().get(p.championId)?.iconUrl ?? null;
  }

  protected championName(p: MatchParticipant): string {
    return this.gameData.championById().get(p.championId)?.name ?? p.championName;
  }

  protected kda(p: MatchParticipant): string {
    return formatKda(p.stats);
  }
}
