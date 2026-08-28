import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfBadge, NfButton, NfSkeleton } from '../../../ui';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { GameDataStore } from '../../../core/game-data';
import { MatchScoreboardComponent } from './match-history/match-scoreboard.component';

@Component({
  selector: 'app-partida-detalle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfBadge, NfButton, NfAvatar, NfSkeleton, MatchScoreboardComponent],
  template: `
    <div class="view">
      @if (match(); as m) {
        <!-- VOLVER AL HISTORIAL -->
        <a class="view-back nf-mono" [routerLink]="['/app', 'historial']">
          <span class="view-back__arrow" aria-hidden="true">←</span> Volver al historial
        </a>

        <!-- HERO DE LA PARTIDA -->
        <div
          class="md-hero"
          [class.is-win]="m.userOutcome === 'win' || m.winningTeam === 'blue'"
          [class.is-loss]="m.userOutcome === 'loss' || m.winningTeam === 'red'"
          [attr.aria-busy]="champsLoading() ? 'true' : null"
        >
          @if (m.userParticipant; as u) {
            <nf-avatar
              class="md-hero__icon"
              [loading]="champsLoading()"
              [src]="champion(u.championId)?.iconUrl ?? null"
              [fallback]="u.championName"
              [tint]="u.championId"
              [size]="68"
              shape="square"
            />
            <div class="md-hero__meta">
              <div class="md-hero__top nf-mono">
                <span class="md-hero__result">{{ m.userOutcome === 'win' ? 'Victoria' : 'Derrota' }}</span>
                <span class="md-hero__dot">·</span>
                <span>{{ m.mode }}</span>
                <span class="md-hero__dot">·</span>
                <span>{{ m.durationFormatted }}</span>
              </div>
              @if (champsLoading()) {
                <nf-skeleton width="220px" height="clamp(22px, 5vw, 30px)" />
              } @else {
                <h1 class="md-hero__champ">{{ championName(u.championId) }}</h1>
              }
              <div class="md-hero__sub nf-mono">◆ {{ m.group.name }} ▪ {{ m.dateFormatted }}</div>
            </div>
            <nf-badge [color]="m.userOutcome === 'win' ? 'success' : 'primary'" [dot]="true">
              {{ m.userOutcome === 'win' ? 'Victoria' : 'Derrota' }}
            </nf-badge>
          } @else {
            <div class="md-hero__meta">
              <div class="md-hero__top nf-mono">
                <span class="md-hero__result">{{ m.winningTeam === 'blue' ? 'Equipo Azul' : 'Equipo Rojo' }}</span>
                <span class="md-hero__dot">·</span>
                <span>{{ m.mode }}</span>
                <span class="md-hero__dot">·</span>
                <span>{{ m.durationFormatted }}</span>
              </div>
              <h1 class="md-hero__champ">5v5 · {{ m.group.name }}</h1>
              <div class="md-hero__sub nf-mono">◆ {{ m.group.name }} ▪ {{ m.dateFormatted }}</div>
            </div>
            <nf-badge color="secondary" [dot]="true">Finalizada</nf-badge>
          }
        </div>

        <!-- SCOREBOARD 5v5 Y ESTADÍSTICAS AVANZADAS -->
        <div class="m-card" style="border: 1px solid var(--nf-border); margin-bottom: 24px;">
          <app-match-scoreboard [match]="m" [showDetailedPageLink]="false" />
        </div>

        <div class="actions md-actions">
          <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'historial']">
            ← Volver al historial
          </button>
        </div>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Partida no encontrada</h1>
          <p class="view__lead">Esta partida no existe o ya no está disponible.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'historial']">
          ← Volver al historial
        </button>
      }
    </div>
  `,
})
export class PartidaDetalle {
  private readonly route = inject(ActivatedRoute);
  private readonly matchHistoryStore = inject(MatchHistoryStore);
  protected readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly match = computed(() => {
    const id = this.id();
    return id ? this.matchHistoryStore.matchById(id) ?? null : null;
  });

  constructor() {
    this.gameData.ensureLoaded();
  }

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }
}
