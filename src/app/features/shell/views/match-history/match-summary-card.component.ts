import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { personalSummaryQuery } from '../../../../core/matches/match-filtering';
import { kdaRatio, laneLabel } from '../../../../core/matches/match-view';
import { MatchHistoryUiState } from './match-history-ui';
import { GameDataStore } from '../../../../core/game-data';
import { NfAvatar, NfLaneIcon, NfSkeleton } from '../../../../ui';

/**
 * Las tres tarjetas de cabecera del historial personal (`GET /me/matches/summary`).
 *
 * **El servidor manda sumas, no medias, y los denominadores no son el mismo número.** El récord
 * se divide entre `totalMatches` y el KDA entre `matchesWithStats`, que son las partidas que
 * alguien llegó a exportar: en cuanto una noche se queda sin subir, dejan de coincidir. Dividir
 * las dos cosas entre el mismo total es el error que esta separación evita, y por eso cada
 * tarjeta dice sobre cuántas partidas habla.
 */
@Component({
  selector: 'app-match-summary-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfLaneIcon, NfSkeleton],
  styleUrl: './match-summary-card.component.scss',
  template: `
    @if (loading()) {
      <div class="m-summary" aria-busy="true">
        @for (i of skeletonCards; track i) {
          <div class="m-summary__stat-card" aria-hidden="true">
            <nf-skeleton width="140px" height="12px" />
            <nf-skeleton width="110px" height="28px" />
            <nf-skeleton width="160px" height="12px" />
          </div>
        }
      </div>
    } @else if (summary(); as s) {
      @if (s.totalMatches > 0) {
        <div class="m-summary">
          <!-- Bloque 1: récord, sobre TODAS las partidas -->
          <div class="m-summary__stat-card">
            <div class="m-summary__title nf-mono">Rendimiento reciente</div>
            <div class="m-summary__wr-row">
              <div
                class="m-summary__wr-val"
                [class.is-positive]="winrate() >= 50"
                [class.is-negative]="winrate() < 50"
              >
                {{ winrate() }}%
              </div>
              <!--
                El total del resumen deja fuera las partidas anuladas, que sí salen en la lista
                de abajo. Por eso puede ser menor que el del contador de los filtros:
                la lista es el registro de lo que pasó, el resumen es lo que cuenta.
              -->
              <div class="m-summary__wr-counts nf-mono">
                <span class="m-summary__win-text">{{ s.wins }}V</span> -
                <span class="m-summary__loss-text">{{ s.losses }}D</span>
                <span class="m-summary__total-text">({{ s.totalMatches }} partidas)</span>
              </div>
            </div>
            <div class="m-summary__progress-bar">
              <div class="m-summary__progress-win" [style.width.%]="winrate()"></div>
              <div class="m-summary__progress-loss" [style.width.%]="100 - winrate()"></div>
            </div>
          </div>

          <!-- Bloque 2: KDA, sobre las partidas SUBIDAS -->
          <div class="m-summary__stat-card">
            <div class="m-summary__title nf-mono">Promedio de KDA</div>
            @if (s.matchesWithStats > 0) {
              <div class="m-summary__kda-line">
                <strong>{{ avgKills() }}</strong>
                <span class="m-summary__sep">/</span>
                <strong class="m-summary__deaths">{{ avgDeaths() }}</strong>
                <span class="m-summary__sep">/</span>
                <strong>{{ avgAssists() }}</strong>
              </div>
              <div class="m-summary__ratio nf-mono">
                <span class="m-summary__ratio-badge">{{ kdaLabel() }}:1</span> Relación KDA
              </div>
              <!--
                El denominador se dice: este KDA NO se divide entre las mismas partidas que el
                récord de al lado, y sin esta línea las dos tarjetas parecen hablar del mismo
                conjunto.
              -->
              <div class="ms-card__note nf-mono">
                Sobre {{ s.matchesWithStats }} de {{ s.totalMatches }} con estadísticas subidas
              </div>
            } @else {
              <div class="m-summary__kda-line">
                <strong>Sin datos</strong>
              </div>
              <div class="m-summary__ratio nf-mono">
                Ninguna de tus partidas se ha subido todavía desde el cliente de LoL
              </div>
            }
          </div>

          <!-- Bloque 3: posición y campeón más jugados -->
          <div class="m-summary__stat-card m-summary__stat-card--pref">
            <div class="m-summary__title nf-mono">Posición y campeón predilectos</div>
            <div class="m-summary__pref-grid">
              @if (s.mostPlayedLane; as lane) {
                <div class="m-summary__pref-item">
                  <div class="m-summary__role-icon-wrap">
                    <nf-lane-icon [lane]="lane" mode="original" />
                  </div>
                  <div class="m-summary__pref-meta">
                    <span class="m-summary__pref-label nf-mono">{{ laneName(lane) }}</span>
                    <span class="m-summary__pref-sub">{{ s.mostPlayedLaneCount }} partidas</span>
                  </div>
                </div>
              }

              <!--
                La posición existe sin subidas —la repartimos nosotros—, el campeón no. Por eso
                una tarjeta puede tener la primera mitad y no la segunda, y eso es correcto.
              -->
              @if (s.mostPlayedChampionId; as champId) {
                <div class="m-summary__pref-item">
                  <nf-avatar
                    [src]="championIcon(champId)"
                    [fallback]="championName(champId)"
                    [tint]="champId"
                    [size]="34"
                    shape="square"
                  />
                  <div class="m-summary__pref-meta">
                    <span class="m-summary__pref-label">{{ championName(champId) }}</span>
                    <span class="m-summary__pref-sub">
                      {{ s.mostPlayedChampionCount }} partidas
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    }
  `,
})
export class MatchSummaryCardComponent {
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);
  private readonly ui = inject(MatchHistoryUiState);

  protected readonly skeletonCards = [1, 2, 3];

  /**
   * El resumen de la MISMA consulta que pide la lista: el endpoint acepta los mismos filtros, así
   * que las tarjetas siguen a los controles en vez de describir siempre el historial completo.
   */
  readonly summary = computed(() =>
    this.store.personalSummaryFor(personalSummaryQuery(this.ui.filters())),
  );

  protected readonly loading = computed(() => {
    const status = this.store.personalSummaryStatus();
    return status === 'idle' || status === 'loading';
  });

  /** Récord sobre TODAS las partidas: una anulada no suma ni a victorias ni a derrotas. */
  protected readonly winrate = computed(() => {
    const s = this.summary();
    if (!s) return 0;
    const decided = s.wins + s.losses;
    return decided > 0 ? Math.round((s.wins / decided) * 100) : 0;
  });

  protected readonly avgKills = computed(() => this.perStatsMatch((s) => s.kills));
  protected readonly avgDeaths = computed(() => this.perStatsMatch((s) => s.deaths));
  protected readonly avgAssists = computed(() => this.perStatsMatch((s) => s.assists));

  /** El ratio se calcula sobre las SUMAS, no promediando los ratios de cada partida. */
  protected readonly kdaLabel = computed(() => {
    const s = this.summary();
    if (!s) return '0.00';
    return (
      kdaRatio({ kills: s.kills, deaths: s.deaths, assists: s.assists })?.toFixed(2) ?? '0.00'
    );
  });

  protected laneName = laneLabel;

  protected championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  /** Solo el catálogo sabe el nombre: el resumen manda el id y nada más. */
  protected championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? `Campeón ${id}`;
  }

  private perStatsMatch(pick: (s: { kills: number; deaths: number; assists: number }) => number): number {
    const s = this.summary();
    if (!s || s.matchesWithStats === 0) return 0;
    return +(pick(s) / s.matchesWithStats).toFixed(1);
  }
}
