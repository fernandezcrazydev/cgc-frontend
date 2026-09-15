import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { GameDataStore } from '../../../../core/game-data';
import {
  CrossMatch,
  MatchParticipant,
  formatKda,
  matchOutcomeLabel,
  participantName,
} from '../../../../core/matches';
import { formatDuration } from '../../../../shared/date-format';
import { NfAvatar, NfLaneIcon, NfSkeleton } from '../../../../ui';
import { MatchCardShellComponent } from '../match-history/match-card-shell.component';
import { nameOf } from './cross-player';

/**
 * Fila del historial cruzado con desplegable idéntico al historial personal (alineación de 10 jugadores).
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
  ],
  template: `
    <app-match-card-shell
      [match]="cross().match"
      [accent]="accent()"
      variant="cross"
      [returnTo]="returnTo()"
      [crossContext]="{ playerId: playerId(), relation: cross().relation }"
    >
      <!-- Resultado -->
      <div class="m-card__result">
        <span class="m-card__result-label" [class.is-win]="isWin()" [class.is-loss]="isLoss()">
          {{ outcomeLabel() }}
        </span>
        @if (duration(); as d) {
          <span class="m-card__duration nf-mono">{{ d }}</span>
        }
      </div>

      <!-- Tu mitad -->
      <div class="cx-card__side cx-card__side--me">
        <div class="m-card__avatar-wrap">
          <nf-avatar
            class="m-card__champ-icon"
            [loading]="champsLoading()"
            [src]="icon(cross().me)"
            [fallback]="championName(cross().me)"
            [tint]="cross().me.championId ?? 0"
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
          @if (cross().me.stats.kills != null) {
            <span class="cx-card__kda nf-mono">
              {{ cross().me.stats.kills }}<span class="m-card__sep">/</span
              ><span class="m-deaths">{{ cross().me.stats.deaths }}</span
              ><span class="m-card__sep">/</span>{{ cross().me.stats.assists }}
              @if (myKda(); as k) {
                <span class="cx-card__ratio">{{ k }} KDA</span>
              }
            </span>
          }
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
          @if (cross().them.stats.kills != null) {
            <span class="cx-card__kda nf-mono">
              {{ cross().them.stats.kills }}<span class="m-card__sep">/</span
              ><span class="m-deaths">{{ cross().them.stats.deaths }}</span
              ><span class="m-card__sep">/</span>{{ cross().them.stats.assists }}
              @if (theirKda(); as k) {
                <span class="cx-card__ratio">{{ k }} KDA</span>
              }
            </span>
          }
        </div>
        <div class="m-card__avatar-wrap">
          <nf-avatar
            class="m-card__champ-icon"
            [loading]="champsLoading()"
            [src]="icon(cross().them)"
            [fallback]="championName(cross().them)"
            [tint]="cross().them.championId ?? 0"
            [size]="42"
            shape="square"
          />
          <div class="m-card__role-badge">
            <nf-lane-icon [lane]="cross().them.role" mode="original" />
          </div>
        </div>
      </div>
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

  /** `null` sin subida: no hay duración, y «0:00» sería una partida instantánea. */
  protected readonly duration = computed(() => {
    const seconds = this.cross().match.durationSeconds;
    return seconds == null ? null : formatDuration(seconds);
  });

  protected readonly theirName = computed(() => nameOf(participantName(this.cross().them)));

  protected readonly myKda = computed(() => formatKda(this.cross().me.stats));
  protected readonly theirKda = computed(() => formatKda(this.cross().them.stats));

  protected icon(p: MatchParticipant): string | null {
    if (p.championId == null) return null;
    return this.gameData.championById().get(p.championId)?.iconUrl ?? null;
  }

  /** Solo el catálogo sabe el nombre: el asiento trae el id y nada más. */
  protected championName(p: MatchParticipant): string {
    if (p.championId == null) return 'Campeón sin registrar';
    return this.gameData.championById().get(p.championId)?.name ?? `Campeón ${p.championId}`;
  }
}
