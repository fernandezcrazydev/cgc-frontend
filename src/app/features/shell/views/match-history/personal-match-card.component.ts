import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match } from '../../../../core/matches/models';
import { formatKda, itemBg, matchOutcomeLabel } from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { formatCompact, formatDuration } from '../../../../shared/date-format';
import { NfAvatar, NfLaneIcon, NfSkeleton } from '../../../../ui';
import { MatchCardShellComponent } from './match-card-shell.component';

/**
 * Fila del historial personal. Responde a una sola pregunta: **¿cómo me fue?** Todo lo que
 * pinta está medido desde el usuario de la sesión —su campeón, su KDA, su oro, sus LP— y el
 * único dato ajeno es la etiqueta del grupo, que dice en qué liga se disputó y lleva a su
 * registro colectivo.
 */
@Component({
  selector: 'app-personal-match-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfLaneIcon, NfSkeleton, MatchCardShellComponent],
  template: `
    <app-match-card-shell
      [match]="match()"
      [accent]="accent()"
      variant="personal"
      [returnTo]="returnTo()"
    >
      <!-- Resultado -->
      <div class="m-card__result">
        <span class="m-card__result-label" [class.is-win]="isWin()" [class.is-loss]="isLoss()">
          {{ outcomeLabel() }}
        </span>
        <span class="m-card__duration nf-mono">{{ duration() }}</span>
      </div>

      <!-- Campeón, posición y liga -->
      <div class="m-card__champ">
        <div class="m-card__avatar-wrap">
          <a
            [routerLink]="['/app', 'tierlist']"
            [title]="'Ver estadísticas de ' + championName()"
            (click)="$event.stopPropagation()"
          >
            <nf-avatar
              class="m-card__champ-icon"
              [loading]="champsLoading()"
              [src]="championIcon()"
              [fallback]="me().championName"
              [tint]="me().championId"
              [size]="46"
              shape="square"
            />
          </a>
          <div class="m-card__role-badge">
            <nf-lane-icon [lane]="me().role" mode="original" />
          </div>
        </div>
        <div class="m-card__champ-meta">
          @if (champsLoading()) {
            <nf-skeleton width="90px" height="14px" />
          } @else {
            <a
              class="m-card__champ-name"
              [routerLink]="['/app', 'tierlist']"
              [title]="'Ver estadísticas de ' + championName()"
              (click)="$event.stopPropagation()"
            >
              {{ championName() }}
            </a>
          }
          <a
            class="m-card__group-link nf-mono"
            [routerLink]="['/app', 'grupos', match().groupId, 'historial']"
            (click)="$event.stopPropagation()"
          >
            {{ match().group.name }}
          </a>
        </div>
      </div>

      <!-- KDA -->
      <div class="m-card__kda">
        <div class="m-card__kda-line">
          <strong>{{ me().stats.kills }}</strong>
          <span class="m-card__sep">/</span>
          <strong class="m-deaths">{{ me().stats.deaths }}</strong>
          <span class="m-card__sep">/</span>
          <strong>{{ me().stats.assists }}</strong>
        </div>
        <span class="m-card__kda-ratio nf-mono">{{ kda() }} KDA</span>
      </div>

      <!-- Farmeo y oro -->
      <div class="m-card__stats">
        <span class="m-card__stat-item nf-mono">
          {{ me().stats.cs }} CS ({{ me().stats.csPerMin }}/min)
        </span>
        <span class="m-card__stat-item m-card__stat-item--gold nf-mono">
          {{ gold() }} de oro
        </span>
      </div>

      <!-- Build -->
      <div class="m-card__items">
        <div class="m-card__items-grid">
          @for (it of me().stats.items; track $index) {
            @if (it) {
              <nf-avatar
                class="m-card__item-slot"
                [src]="it.iconUrl ?? null"
                [fallback]="it.name"
                [tint]="0"
                [size]="24"
                shape="square"
                [style.background]="itemFallback(it.name)"
                [title]="it.name"
              />
            } @else {
              <span class="m-card__item-slot m-card__item-slot--empty"></span>
            }
          }
        </div>
      </div>
    </app-match-card-shell>
  `,
})
export class PersonalMatchCardComponent {
  readonly match = input.required<Match>();
  readonly returnTo = input<string | null>(null);

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  /**
   * En esta vista la lista ya está acotada a partidas del usuario, así que su participante
   * existe siempre. El `!` es la forma honesta de decirlo: si algún día no fuese cierto, el
   * fallo debe salir aquí y no pintarse como una fila con ceros.
   */
  protected readonly me = computed(() => this.match().userParticipant!);

  protected readonly isWin = computed(() => this.match().userOutcome === 'win');
  protected readonly isLoss = computed(() => this.match().userOutcome === 'loss');

  protected readonly outcomeLabel = computed(() => matchOutcomeLabel(this.match().userOutcome));

  /** Una partida anulada no es una derrota: se pinta en neutro, no en rojo. */
  protected readonly accent = computed<'win' | 'loss' | 'neutral'>(() => {
    const outcome = this.match().userOutcome;
    if (outcome === 'win') return 'win';
    if (outcome === 'loss') return 'loss';
    return 'neutral';
  });

  protected readonly duration = computed(() => formatDuration(this.match().durationSeconds));
  protected readonly gold = computed(() => formatCompact(this.me().stats.gold));
  protected readonly kda = computed(() => formatKda(this.me().stats));

  protected readonly championIcon = computed(
    () => this.gameData.championById().get(this.me().championId)?.iconUrl ?? null,
  );

  protected readonly championName = computed(
    () => this.gameData.championById().get(this.me().championId)?.name ?? this.me().championName,
  );

  protected itemFallback(name: string): string {
    return itemBg(name);
  }
}
