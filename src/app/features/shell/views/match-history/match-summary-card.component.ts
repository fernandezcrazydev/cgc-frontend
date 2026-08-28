import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { GameDataStore } from '../../../../core/game-data';
import { NfAvatar, NfLaneIcon } from '../../../../ui';

@Component({
  selector: 'app-match-summary-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfLaneIcon],
  template: `
    @if (summary().totalMatches > 0) {
      <div class="m-summary">
        <!-- Bloque 1: Winrate & Partidas -->
        <div class="m-summary__stat-card">
          <div class="m-summary__title nf-mono">Rendimiento reciente</div>
          <div class="m-summary__wr-row">
            <div class="m-summary__wr-val" [class.is-positive]="summary().winrate >= 50" [class.is-negative]="summary().winrate < 50">
              {{ summary().winrate }}%
            </div>
            <div class="m-summary__wr-counts nf-mono">
              <span class="m-summary__win-text">{{ summary().wins }}V</span> -
              <span class="m-summary__loss-text">{{ summary().losses }}D</span>
              <span class="m-summary__total-text">({{ summary().totalMatches }} partidas)</span>
            </div>
          </div>
          <div class="m-summary__progress-bar">
            <div class="m-summary__progress-win" [style.width.%]="summary().winrate"></div>
            <div class="m-summary__progress-loss" [style.width.%]="100 - summary().winrate"></div>
          </div>
        </div>

        <!-- Bloque 2: KDA promedio -->
        <div class="m-summary__stat-card">
          <div class="m-summary__title nf-mono">Promedio de KDA</div>
          <div class="m-summary__kda-line">
            <strong>{{ summary().avgKills }}</strong>
            <span class="m-summary__sep">/</span>
            <strong class="m-summary__deaths">{{ summary().avgDeaths }}</strong>
            <span class="m-summary__sep">/</span>
            <strong>{{ summary().avgAssists }}</strong>
          </div>
          <div class="m-summary__ratio nf-mono">
            <span class="m-summary__ratio-badge">{{ summary().avgKdaRatio }}:1</span> Relación KDA
          </div>
        </div>

        <!-- Bloque 3: Rol y Campeón más jugado -->
        <div class="m-summary__stat-card m-summary__stat-card--pref">
          <div class="m-summary__title nf-mono">Rol & Campeón predilecto</div>
          <div class="m-summary__pref-grid">
            @if (summary().mostPlayedRole; as role) {
              <div class="m-summary__pref-item">
                <div class="m-summary__role-icon-wrap">
                  <nf-lane-icon [lane]="role" mode="original" />
                </div>
                <div class="m-summary__pref-meta">
                  <span class="m-summary__pref-label nf-mono">{{ role }}</span>
                  <span class="m-summary__pref-sub">{{ summary().mostPlayedRoleCount }} partidas</span>
                </div>
              </div>
            }

            @if (summary().mostPlayedChampionId; as champId) {
              <div class="m-summary__pref-item">
                <nf-avatar
                  [src]="champion(champId)?.iconUrl ?? null"
                  [fallback]="championName(champId)"
                  [tint]="champId"
                  [size]="34"
                  shape="square"
                />
                <div class="m-summary__pref-meta">
                  <span class="m-summary__pref-label">{{ championName(champId) }}</span>
                  <span class="m-summary__pref-sub">Favorito</span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class MatchSummaryCardComponent {
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);

  readonly summary = this.store.personalSummary;

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? this.summary().mostPlayedChampionName ?? 'Campeón';
  }
}
