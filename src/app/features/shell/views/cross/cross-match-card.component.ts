import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { GameDataStore } from '../../../../core/game-data';
import {
  CrossMatch,
  MatchParticipant,
  formatKda,
  matchOutcomeLabel,
} from '../../../../core/matches';
import { formatDuration } from '../../../../shared/date-format';
import { NfAvatar, NfLaneIcon, NfSkeleton } from '../../../../ui';
import { MatchCardShellComponent } from '../match-history/match-card-shell.component';
import { CrossBreakdownComponent } from './cross-breakdown.component';
import { nameOf } from './cross-player';

/**
 * Fila del historial cruzado. Hermana de `<app-personal-match-card>` y `<app-group-match-card>`:
 * el mismo armazón, la misma caja y el mismo acento por resultado, con las columnas que contesta
 * esta vista.
 *
 * La fila personal responde «¿cómo me fue?» y la de grupo «¿quién ganó?»; esta responde «¿cómo
 * nos fue a los dos?», así que reparte la rejilla en dos mitades simétricas con la relación en
 * medio. El acento sigue siendo cómo TE fue, igual que en el historial personal: es tu registro,
 * visto a través de otro jugador.
 */
@Component({
  selector: 'app-cross-match-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NfAvatar,
    NfLaneIcon,
    NfSkeleton,
    MatchCardShellComponent,
    CrossBreakdownComponent,
  ],
  template: `
    <app-match-card-shell
      [match]="cross().match"
      [accent]="accent()"
      variant="cross"
      panelNoun="comparativa"
      [returnTo]="returnTo()"
    >
      <!-- Resultado -->
      <div class="m-card__result">
        <span class="m-card__result-label" [class.is-win]="isWin()" [class.is-loss]="isLoss()">
          {{ outcomeLabel() }}
        </span>
        <span class="m-card__duration nf-mono">{{ duration() }}</span>
      </div>

      <!-- Tu mitad -->
      <div class="cx-card__side cx-card__side--me">
        <div class="m-card__avatar-wrap">
          <nf-avatar
            class="m-card__champ-icon"
            [loading]="champsLoading()"
            [src]="icon(cross().me)"
            [fallback]="cross().me.championName"
            [tint]="cross().me.championId"
            [size]="42"
            shape="square"
          />
          <div class="m-card__role-badge">
            <nf-lane-icon [lane]="cross().me.role" mode="original" />
          </div>
        </div>
        <div class="cx-card__meta">
          <span class="cx-card__who nf-mono">Tú</span>
          @if (champsLoading()) {
            <nf-skeleton width="80px" height="13px" />
          } @else {
            <span class="cx-card__champ">{{ championName(cross().me) }}</span>
          }
          <span class="cx-card__kda nf-mono">
            {{ cross().me.stats.kills }}<span class="m-card__sep">/</span
            ><span class="m-deaths">{{ cross().me.stats.deaths }}</span
            ><span class="m-card__sep">/</span>{{ cross().me.stats.assists }}
            <span class="cx-card__ratio">{{ myKda() }} KDA</span>
          </span>
        </div>
      </div>

      <!-- Relación -->
      <div class="cx-card__relation">
        <span
          class="cx-card__relation-tag nf-mono"
          [class.cx-card__relation-tag--ally]="isAlly()"
        >
          {{ isAlly() ? 'Juntos' : 'En contra' }}
        </span>
        @if (cross().sameLane) {
          <span class="cx-card__relation-lane nf-mono">Misma línea</span>
        }
      </div>

      <!-- Su mitad -->
      <div class="cx-card__side cx-card__side--them">
        <div class="cx-card__meta cx-card__meta--end">
          <span class="cx-card__who nf-mono">{{ theirName() }}</span>
          @if (champsLoading()) {
            <nf-skeleton width="80px" height="13px" />
          } @else {
            <span class="cx-card__champ">{{ championName(cross().them) }}</span>
          }
          <span class="cx-card__kda nf-mono">
            {{ cross().them.stats.kills }}<span class="m-card__sep">/</span
            ><span class="m-deaths">{{ cross().them.stats.deaths }}</span
            ><span class="m-card__sep">/</span>{{ cross().them.stats.assists }}
            <span class="cx-card__ratio">{{ theirKda() }} KDA</span>
          </span>
        </div>
        <div class="m-card__avatar-wrap">
          <nf-avatar
            class="m-card__champ-icon"
            [loading]="champsLoading()"
            [src]="icon(cross().them)"
            [fallback]="cross().them.championName"
            [tint]="cross().them.championId"
            [size]="42"
            shape="square"
          />
          <div class="m-card__role-badge">
            <nf-lane-icon [lane]="cross().them.role" mode="original" />
          </div>
        </div>
      </div>

      <app-cross-breakdown
        matchAccordion
        [cross]="cross()"
        [playerId]="playerId()"
        [returnTo]="returnTo()"
      />
    </app-match-card-shell>
  `,
})
export class CrossMatchCardComponent {
  readonly cross = input.required<CrossMatch>();
  readonly playerId = input.required<string>();
  readonly returnTo = input<string | null>(null);

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly isAlly = computed(() => this.cross().relation === 'ally');
  protected readonly isWin = computed(() => this.cross().match.userOutcome === 'win');
  protected readonly isLoss = computed(() => this.cross().match.userOutcome === 'loss');

  protected readonly outcomeLabel = computed(() =>
    matchOutcomeLabel(this.cross().match.userOutcome),
  );

  /** Una partida anulada no es una derrota: se pinta en neutro, no en rojo. */
  protected readonly accent = computed<'win' | 'loss' | 'neutral'>(() => {
    if (this.isWin()) return 'win';
    if (this.isLoss()) return 'loss';
    return 'neutral';
  });

  protected readonly duration = computed(() => formatDuration(this.cross().match.durationSeconds));
  protected readonly theirName = computed(() => nameOf(this.cross().them.riotId));
  protected readonly myKda = computed(() => formatKda(this.cross().me.stats));
  protected readonly theirKda = computed(() => formatKda(this.cross().them.stats));

  protected icon(p: MatchParticipant): string | null {
    return this.gameData.championById().get(p.championId)?.iconUrl ?? null;
  }

  protected championName(p: MatchParticipant): string {
    return this.gameData.championById().get(p.championId)?.name ?? p.championName;
  }
}
