import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match, MatchParticipant } from '../../../../core/matches/models';
import { GameDataStore } from '../../../../core/game-data';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { hash } from '../../../../core/group-ranking';
import { NfAvatar, NfLaneIcon, NfSkeleton } from '../../../../ui';
import { MatchScoreboardComponent } from './match-scoreboard.component';

@Component({
  selector: 'app-match-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfLaneIcon, NfSkeleton, MatchScoreboardComponent],
  template: `
    <div
      class="m-card"
      [class.is-win]="isPersonalWin()"
      [class.is-loss]="isPersonalLoss()"
      [class.is-group-blue-win]="mode() === 'group' && match().winningTeam === 'blue'"
      [class.is-group-red-win]="mode() === 'group' && match().winningTeam === 'red'"
      [class.is-expanded]="isExpanded()"
    >
      <!-- HEADER INTERACTIVO DE LA TARJETA (FILA PRINCIPAL) -->
      <div
        class="m-card__main"
        role="button"
        tabindex="0"
        [attr.aria-expanded]="isExpanded()"
        (click)="toggleAccordion()"
        (keydown.enter)="toggleAccordion()"
        (keydown.space)="$event.preventDefault(); toggleAccordion()"
      >
        <!-- =======================================================
             CASO 1: MODO PERSONAL (Enfoque en el jugador actual)
             ======================================================= -->
        @if (mode() === 'personal') {
          <!-- Resultado & Tiempo -->
          <div class="m-card__result">
            <span class="m-card__result-label nf-mono" [class.is-win]="isPersonalWin()" [class.is-loss]="isPersonalLoss()">
              {{ isPersonalWin() ? 'Victoria' : 'Derrota' }}
            </span>
            <span class="m-card__mode nf-mono">{{ match().mode }}</span>
            <span class="m-card__duration nf-mono">{{ match().durationFormatted }}</span>
          </div>

          <!-- Campeón & Rol -->
          <div class="m-card__champ">
            <div class="m-card__avatar-wrap">
              <nf-avatar
                class="m-card__champ-icon"
                [loading]="champsLoading()"
                [src]="champion(userParticipant()?.championId ?? 0)?.iconUrl ?? null"
                [fallback]="userParticipant()?.championName ?? 'Campeón'"
                [tint]="userParticipant()?.championId ?? 0"
                [size]="46"
                shape="square"
              />
              @if (userParticipant()?.role; as role) {
                <div class="m-card__role-badge">
                  <nf-lane-icon [lane]="role" mode="original" />
                </div>
              }
            </div>
            <div class="m-card__champ-meta">
              @if (champsLoading()) {
                <nf-skeleton width="90px" height="14px" />
              } @else {
                <span class="m-card__champ-name">{{ championName(userParticipant()?.championId ?? 0) }}</span>
              }
              <a
                class="m-card__group-link nf-mono"
                [routerLink]="['/app', 'grupos', match().groupId, 'historial']"
                (click)="$event.stopPropagation()"
              >
                ◆ {{ match().group.name }}
              </a>
            </div>
          </div>

          <!-- KDA & Ratio -->
          <div class="m-card__kda">
            <div class="m-card__kda-line">
              <strong>{{ userParticipant()?.stats?.kills ?? 0 }}</strong>
              <span class="m-card__sep">/</span>
              <strong class="m-deaths">{{ userParticipant()?.stats?.deaths ?? 0 }}</strong>
              <span class="m-card__sep">/</span>
              <strong>{{ userParticipant()?.stats?.assists ?? 0 }}</strong>
            </div>
            <span class="m-card__kda-ratio nf-mono">{{ userKdaRatio() }} KDA</span>
          </div>

          <!-- CS, Oro & Puntos de Liga (LP) -->
          <div class="m-card__stats">
            <span class="m-card__stat-item nf-mono">
              <span class="m-card__stat-icon">◉</span>
              {{ userParticipant()?.stats?.cs ?? 0 }} CS ({{ userParticipant()?.stats?.csPerMin ?? 0 }}/m)
            </span>
            <span class="m-card__stat-item nf-mono">
              <span class="m-card__stat-icon m-card__stat-icon--gold">⬣</span>
              {{ formatGold(userParticipant()?.stats?.gold ?? 0) }}
            </span>
            @if (userParticipant()?.lpDelta !== undefined) {
              <span class="m-card__lp-badge nf-mono" [class.is-gain]="(userParticipant()?.lpDelta ?? 0) > 0" [class.is-loss]="(userParticipant()?.lpDelta ?? 0) < 0">
                {{ (userParticipant()?.lpDelta ?? 0) > 0 ? '+' : '' }}{{ userParticipant()?.lpDelta }} LP
              </span>
            }
          </div>

          <!-- Build de Objetos -->
          <div class="m-card__items">
            <div class="m-card__items-grid">
              @for (it of userParticipant()?.stats?.items; track $index) {
                @if (it) {
                  <span
                    class="m-card__item-slot"
                    [style.background]="itemBg(it.name)"
                    [title]="it.name"
                  ></span>
                } @else {
                  <span class="m-card__item-slot m-card__item-slot--empty"></span>
                }
              }
            </div>
          </div>

          <!-- Fecha & Botón de Acordeón -->
          <div class="m-card__end">
            <span class="m-card__date nf-mono">{{ match().dateFormatted }}</span>
            <button type="button" class="m-card__expand-btn nf-mono" aria-hidden="true">
              {{ isExpanded() ? '▲ Ocultar' : '▼ Desglose' }}
            </button>
          </div>
        }

        <!-- =======================================================
             CASO 2: MODO GRUPO (Enfoque en el choque 5v5 de equipos)
             ======================================================= -->
        @if (mode() === 'group') {
          <!-- Bando Ganador & Tiempo -->
          <div class="m-card__group-summary">
            <div class="m-card__winner-pill nf-mono" [class.is-blue]="match().winningTeam === 'blue'" [class.is-red]="match().winningTeam === 'red'">
              <span class="m-card__side-dot"></span>
              {{ match().winningTeam === 'blue' ? 'Equipo Azul' : 'Equipo Rojo' }}
            </div>
            <span class="m-card__mode nf-mono">{{ match().mode }}</span>
            <span class="m-card__duration nf-mono">{{ match().durationFormatted }}</span>
          </div>

          <!-- Enfrentamiento 5v5: Equipo Azul vs Rojo -->
          <div class="m-card__vs-block">
            <!-- 5 Campeones Equipo Azul -->
            <div class="m-card__team-roster m-card__team-roster--blue">
              <div class="m-card__champ-avatars">
                @for (p of match().blueTeam.participants; track p.id) {
                  <nf-avatar
                    class="m-card__mini-avatar"
                    [src]="champion(p.championId)?.iconUrl ?? null"
                    [fallback]="p.championName"
                    [tint]="p.championId"
                    [size]="28"
                    shape="square"
                    [title]="p.riotId + ' (' + p.championName + ' - ' + p.role + ')'"
                  />
                }
              </div>
              <span class="m-card__team-score nf-mono">{{ match().blueTeam.totalKills }}</span>
            </div>

            <div class="m-card__score-meta">
              <span class="m-card__vs-badge nf-mono">VS</span>
              <span class="m-card__gold-diff nf-mono">{{ goldDiffFormatted() }}</span>
            </div>

            <!-- 5 Campeones Equipo Rojo -->
            <div class="m-card__team-roster m-card__team-roster--red">
              <span class="m-card__team-score nf-mono">{{ match().redTeam.totalKills }}</span>
              <div class="m-card__champ-avatars">
                @for (p of match().redTeam.participants; track p.id) {
                  <nf-avatar
                    class="m-card__mini-avatar"
                    [src]="champion(p.championId)?.iconUrl ?? null"
                    [fallback]="p.championName"
                    [tint]="p.championId"
                    [size]="28"
                    shape="square"
                    [title]="p.riotId + ' (' + p.championName + ' - ' + p.role + ')'"
                  />
                }
              </div>
            </div>
          </div>

          <!-- MVP, Impacto de LP & Indicador si participaste -->
          <div class="m-card__mvp-block">
            @if (mvpParticipant(); as mvp) {
              <div class="m-card__mvp-chip">
                <span class="m-card__mvp-star">★</span>
                <span class="m-card__mvp-text">MVP: <strong>{{ mvp.riotId }}</strong> ({{ mvp.championName }})</span>
              </div>
            }

            <div class="m-card__lp-impact nf-mono">
              Impacto: <strong>{{ groupLpSummary() }}</strong>
            </div>

            @if (userParticipant(); as u) {
              <span class="m-card__played-chip nf-mono">
                Jugaste con {{ u.championName }} ({{ u.stats.kills }}/{{ u.stats.deaths }}/{{ u.stats.assists }})
              </span>
            }
          </div>

          <!-- Fecha & Botón de Acordeón -->
          <div class="m-card__end">
            <span class="m-card__date nf-mono">{{ match().dateFormatted }}</span>
            <button type="button" class="m-card__expand-btn nf-mono" aria-hidden="true">
              {{ isExpanded() ? '▲ Ocultar' : '▼ Desglose 5v5' }}
            </button>
          </div>
        }
      </div>

      <!-- ACORDEÓN DESPLEGABLE CON EL SCOREBOARD 5v5 DE 10 JUGADORES -->
      @if (isExpanded()) {
        <div class="m-card__accordion">
          <app-match-scoreboard [match]="match()" [showDetailedPageLink]="true" />
        </div>
      }
    </div>
  `,
})
export class MatchCardComponent {
  readonly match = input.required<Match>();
  readonly mode = input<'personal' | 'group'>('personal');

  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);

  readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  readonly userParticipant = computed(() => {
    return this.match().userParticipant;
  });

  readonly isPersonalWin = computed(() => {
    return this.match().userOutcome === 'win';
  });

  readonly isPersonalLoss = computed(() => {
    return this.match().userOutcome === 'loss';
  });

  readonly isExpanded = computed(() => {
    return this.store.expandedMatchId() === this.match().id;
  });

  readonly mvpParticipant = computed<MatchParticipant | undefined>(() => {
    const id = this.match().mvpParticipantId;
    if (!id) return undefined;
    const all = [...this.match().blueTeam.participants, ...this.match().redTeam.participants];
    return all.find((p) => p.id === id);
  });

  readonly goldDiffFormatted = computed(() => {
    const m = this.match();
    const diff = Math.abs(m.blueTeam.totalGold - m.redTeam.totalGold);
    const diffK = (diff / 1000).toFixed(1) + 'k';
    return m.blueTeam.totalGold >= m.redTeam.totalGold
      ? `+${diffK} Azul`
      : `+${diffK} Rojo`;
  });

  readonly groupLpSummary = computed(() => {
    const m = this.match();
    const winners = m.winningTeam === 'blue' ? m.blueTeam.participants : m.redTeam.participants;
    const losers = m.winningTeam === 'blue' ? m.redTeam.participants : m.blueTeam.participants;
    const avgGain = Math.round(winners.reduce((acc, p) => acc + (p.lpDelta || 0), 0) / (winners.length || 1)) || 18;
    const avgLoss = Math.round(Math.abs(losers.reduce((acc, p) => acc + (p.lpDelta || 0), 0) / (losers.length || 1))) || 15;
    return `+${avgGain} / -${avgLoss} LP`;
  });

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  userKdaRatio(): string {
    const stats = this.userParticipant()?.stats;
    if (!stats) return '0.00';
    const ratio = stats.deaths === 0 ? stats.kills + stats.assists : (stats.kills + stats.assists) / stats.deaths;
    return ratio.toFixed(2);
  }

  formatGold(gold: number): string {
    return (gold / 1000).toFixed(1) + 'k oro';
  }

  itemBg(name: string): string {
    const h = hash(name) % 360;
    return `linear-gradient(135deg, hsl(${h},70%,46%), hsl(${h},60%,24%))`;
  }

  toggleAccordion(): void {
    this.store.toggleExpand(this.match().id);
  }
}
