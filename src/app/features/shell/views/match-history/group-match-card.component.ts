import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match, MatchParticipant } from '../../../../core/matches/models';
import { matchWinnerLabel } from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { formatCompact, formatDuration } from '../../../../shared/date-format';
import { NfAvatar } from '../../../../ui';
import { MatchCardShellComponent } from './match-card-shell.component';

/**
 * Fila del historial de grupo. Responde a otra pregunta distinta a la del historial personal:
 * **¿quién ganó a quién?** El protagonista es el enfrentamiento 5v5, no el usuario.
 *
 * Dónde aparece el usuario, si jugó: su campeón sale con anillo del color de su bando dentro
 * de la propia tira de diez, y sus cifras en un bloque compacto al final. Antes había una
 * frase —«Jugaste con Lux (8/2/11)»— que repetía el campeón que ya estaba dos bloques más
 * arriba, y que hablaba en segunda persona dentro de un registro colectivo.
 */
@Component({
  selector: 'app-group-match-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, MatchCardShellComponent],
  template: `
    <app-match-card-shell
      [match]="match()"
      [accent]="match().winningTeam"
      [returnTo]="returnTo()"
      [reactionScope]="match().groupId"
      variant="group"
    >
      <!-- Quién ganó -->
      <div class="m-card__group-summary">
        <div
          class="m-card__winner-pill nf-mono"
          [class.is-blue]="match().winningTeam === 'blue'"
          [class.is-red]="match().winningTeam === 'red'"
        >
          <span class="m-card__side-dot" aria-hidden="true"></span>
          {{ winnerLabel() }}
        </div>
        <span class="m-card__duration nf-mono">{{ duration() }}</span>
      </div>

      <!-- El enfrentamiento -->
      <div class="m-card__vs-block">
        <div class="m-card__team-roster m-card__team-roster--blue">
          <div class="m-card__champ-avatars">
            @for (p of match().blueTeam.participants; track p.id) {
              <span class="m-card__slot" [class.is-you]="isCurrentUser(p)">
                <a
                  [routerLink]="isCurrentUser(p) ? ['/app', 'perfil'] : ['/app', 'perfil', p.userId]"
                  (click)="$event.stopPropagation()"
                >
                  <nf-avatar
                    class="m-card__mini-avatar"
                    [loading]="champsLoading()"
                    [src]="championIcon(p.championId)"
                    [fallback]="p.championName"
                    [tint]="p.championId"
                    [size]="28"
                    shape="square"
                    [title]="playerTitle(p)"
                  />
                </a>
                @if (isCurrentUser(p)) {
                  <span class="m-card__slot-tag nf-mono">Tú</span>
                }
              </span>
            }
          </div>
          <span class="m-card__team-score nf-mono">{{ match().blueTeam.totalKills }}</span>
        </div>

        <div class="m-card__score-meta">
          <span class="m-card__vs-badge nf-mono">VS</span>
          <span class="m-card__gold-diff nf-mono">{{ goldDiff() }}</span>
        </div>

        <div class="m-card__team-roster m-card__team-roster--red">
          <span class="m-card__team-score nf-mono">{{ match().redTeam.totalKills }}</span>
          <div class="m-card__champ-avatars">
            @for (p of match().redTeam.participants; track p.id) {
              <span class="m-card__slot" [class.is-you]="isCurrentUser(p)">
                <a
                  [routerLink]="isCurrentUser(p) ? ['/app', 'perfil'] : ['/app', 'perfil', p.userId]"
                  (click)="$event.stopPropagation()"
                >
                  <nf-avatar
                    class="m-card__mini-avatar"
                    [loading]="champsLoading()"
                    [src]="championIcon(p.championId)"
                    [fallback]="p.championName"
                    [tint]="p.championId"
                    [size]="28"
                    shape="square"
                    [title]="playerTitle(p)"
                  />
                </a>
                @if (isCurrentUser(p)) {
                  <span class="m-card__slot-tag nf-mono">Tú</span>
                }
              </span>
            }
          </div>
        </div>
      </div>

      <!-- MVP, balance en la clasificación y tus cifras -->
      <div class="m-card__mvp-block">
        @if (mvp(); as best) {
          <a
            class="m-card__mvp-chip nf-mono"
            [routerLink]="isCurrentUser(best) ? ['/app', 'perfil'] : ['/app', 'perfil', best.userId]"
            (click)="$event.stopPropagation()"
          >
            MVP · {{ best.riotId }}
          </a>
        }

        @if (lpSummary(); as lp) {
          <span class="m-card__lp-impact nf-mono">Balance LP: {{ lp }}</span>
        }

        @if (me(); as u) {
          <div class="m-card__you-stats" [class.is-blue]="u.team === 'blue'" [class.is-red]="u.team === 'red'">
            <nf-avatar
              class="m-card__you-champ"
              [loading]="champsLoading()"
              [src]="championIcon(u.championId)"
              [fallback]="u.championName"
              [tint]="u.championId"
              [size]="24"
              shape="square"
              [title]="championName(u.championId)"
            />
            <span class="m-card__you-kda nf-mono">
              {{ u.stats.kills }}<span class="m-card__you-sep">/</span
              ><span class="m-deaths">{{ u.stats.deaths }}</span
              ><span class="m-card__you-sep">/</span>{{ u.stats.assists }}
            </span>
            @if (u.lpDelta !== 0) {
              <span class="m-card__you-lp nf-mono" [class.is-gain]="u.lpDelta > 0" [class.is-loss]="u.lpDelta < 0">
                {{ u.lpDelta > 0 ? '+' : '' }}{{ u.lpDelta }} LP
              </span>
            }
          </div>
        } @else {
          <div class="m-card__you-stats m-card__you-stats--none nf-mono">
            <span class="m-card__you-none">Sin participación</span>
          </div>
        }
      </div>
    </app-match-card-shell>
  `,
})
export class GroupMatchCardComponent {
  readonly match = input.required<Match>();

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly me = computed(() => this.match().userParticipant);

  /** Abrir el detalle desde aquí debe poder volver aquí, no al historial personal. */
  protected readonly returnTo = computed(() => `grupo:${this.match().groupId}`);

  protected readonly winnerLabel = computed(() => matchWinnerLabel(this.match().winningTeam));

  protected readonly duration = computed(() => formatDuration(this.match().durationSeconds));

  protected readonly mvp = computed<MatchParticipant | undefined>(() => {
    const id = this.match().mvpParticipantId;
    if (!id) return undefined;
    const m = this.match();
    return [...m.blueTeam.participants, ...m.redTeam.participants].find((p) => p.id === id);
  });

  protected readonly goldDiff = computed(() => {
    const m = this.match();
    const diff = Math.abs(m.blueTeam.totalGold - m.redTeam.totalGold);
    const leader = m.blueTeam.totalGold >= m.redTeam.totalGold ? 'azul' : 'rojo';
    return `+${formatCompact(diff)} ${leader}`;
  });

  /**
   * `null` cuando la partida no reparte puntos: se prefiere no pintar el bloque a inventarse
   * una cifra. La versión anterior tenía un `|| 18` / `|| 15` que fabricaba «+18 / -15 LP»
   * cuando la media real daba cero, y eso se leía como un dato real.
   */
  protected readonly lpSummary = computed<string | null>(() => {
    const m = this.match();
    const winners = m.winningTeam === 'blue' ? m.blueTeam.participants : m.redTeam.participants;
    const losers = m.winningTeam === 'blue' ? m.redTeam.participants : m.blueTeam.participants;

    const gain = average(winners.map((p) => p.lpDelta));
    const loss = average(losers.map((p) => p.lpDelta));
    if (gain === 0 && loss === 0) return null;

    return `+${Math.round(gain)} / ${Math.round(loss)} LP`;
  });

  /** Por id de participante, nunca por `riotId`: la vista no compara identidades a mano. */
  protected isCurrentUser(p: MatchParticipant): boolean {
    return p.id === this.match().userParticipant?.id;
  }

  protected championIcon(championId: number): string | null {
    return this.gameData.championById().get(championId)?.iconUrl ?? null;
  }

  protected championName(championId: number): string {
    return this.gameData.championById().get(championId)?.name ?? 'Campeón';
  }

  protected playerTitle(p: MatchParticipant): string {
    const name = this.gameData.championById().get(p.championId)?.name ?? p.championName;
    const you = this.isCurrentUser(p) ? ' · tú' : '';
    return `${p.riotId} · ${name} · ${p.role}${you}`;
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((acc, v) => acc + v, 0) / values.length;
}
