import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match, MatchParticipant, TeamSummary } from '../../../../core/matches/models';
import {
  matchWinnerLabel,
  participantName,
  teamLabel,
  teamShortLabel,
} from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { formatCompact, formatDuration } from '../../../../shared/date-format';
import { NfAvatar } from '../../../../ui';
import { MatchCardShellComponent } from './match-card-shell.component';

/**
 * Fila del historial de grupo. Responde a otra pregunta distinta a la del historial personal:
 * **¿quién ganó a quién?** El protagonista es el enfrentamiento 5v5, no el usuario.
 *
 * Dónde aparece el usuario, si jugó: su campeón sale con anillo del color de su bando dentro
 * de la propia tira de diez, y sus cifras en un bloque compacto al final.
 *
 * ## Los dos equipos no siempre tienen color
 *
 * Quién vistió de azul lo decide la sala y **puede no haberse decidido nunca**. Cuando no se
 * decidió, la tarjeta dice «Equipo A» y «Equipo B» y pinta los dos en neutro. No se rellena por
 * nuestra cuenta: derivar el lado del orden de entrada a la sala es literalmente el bug de la
 * app anterior, que produjo un jugador 14-0 «en azul» sin que nadie lo hubiera elegido.
 */
@Component({
  selector: 'app-group-match-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, MatchCardShellComponent],
  styleUrl: './group-match-card.component.scss',
  template: `
    <app-match-card-shell
      [match]="match()"
      [accent]="accent()"
      [returnTo]="returnTo()"
      [reactionScope]="match().groupId"
      variant="group"
    >
      <!-- Quién ganó -->
      <div class="m-card__group-summary">
        <div
          class="m-card__winner-pill nf-mono"
          [class.is-blue]="match().winningSide === 'blue'"
          [class.is-red]="match().winningSide === 'red'"
        >
          <span class="m-card__side-dot" aria-hidden="true"></span>
          {{ winnerLabel() }}
        </div>
        @if (duration(); as d) {
          <span class="m-card__duration nf-mono">{{ d }}</span>
        }
      </div>

      <!-- El enfrentamiento -->
      <div class="m-card__vs-block">
        @for (team of teams(); track team.slot; let first = $first) {
          @if (!first) {
            <div class="m-card__score-meta">
              <span class="m-card__vs-badge nf-mono">VS</span>
              @if (goldDiff(); as g) {
                <span class="m-card__gold-diff nf-mono">{{ g }}</span>
              }
            </div>
          }

          <div
            class="m-card__team-roster"
            [class.m-card__team-roster--blue]="team.side === 'blue'"
            [class.m-card__team-roster--red]="team.side === 'red'"
            [class.m-card__team-roster--reverse]="!first"
          >
            <div class="m-card__champ-avatars">
              @for (p of team.participants; track p.userId) {
                <span class="m-card__slot" [class.is-you]="isCurrentUser(p)">
                  <a
                    [routerLink]="isCurrentUser(p) ? ['/app', 'perfil'] : ['/app', 'perfil', p.userId]"
                    (click)="$event.stopPropagation()"
                  >
                    <nf-avatar
                      class="m-card__mini-avatar"
                      [loading]="champsLoading()"
                      [src]="championIcon(p.championId)"
                      [fallback]="playerName(p)"
                      [tint]="p.championId ?? 0"
                      [size]="24"
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
            <span class="m-card__team-score nf-mono">
              {{ team.totalKills ?? '—' }}
            </span>
            <!--
              Sin color decidido, el equipo se nombra por su hueco. Es lo único que siempre
              existe, y por eso viajan las dos cosas.
            -->
            @if (!team.side) {
              <span class="gm-card__slot-name nf-mono">{{ shortLabel(team) }}</span>
            }
          </div>
        }
      </div>

      <!-- MVP, balance en la clasificación y tus cifras -->
      <div class="m-card__mvp-block">
        @if (mvp(); as best) {
          <a
            class="m-card__mvp-chip nf-mono"
            [routerLink]="isCurrentUser(best) ? ['/app', 'perfil'] : ['/app', 'perfil', best.userId]"
            (click)="$event.stopPropagation()"
          >
            MVP · {{ playerName(best) }}
          </a>
        }

        @if (lpSummary(); as lp) {
          <span class="m-card__lp-impact nf-mono">Balance LP: {{ lp }}</span>
        }

        @if (me(); as u) {
          <div
            class="m-card__you-stats"
            [class.is-blue]="u.side === 'blue'"
            [class.is-red]="u.side === 'red'"
          >
            <nf-avatar
              class="m-card__you-champ"
              [loading]="champsLoading()"
              [src]="championIcon(u.championId)"
              [fallback]="playerName(u)"
              [tint]="u.championId ?? 0"
              [size]="24"
              shape="square"
              [title]="championName(u.championId)"
            />
            @if (u.stats.kills != null) {
              <span class="m-card__you-kda nf-mono">
                {{ u.stats.kills }}<span class="m-card__you-sep">/</span
                ><span class="m-deaths">{{ u.stats.deaths }}</span
                ><span class="m-card__you-sep">/</span>{{ u.stats.assists }}
              </span>
            }
            @if (u.lpDelta) {
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

  /** Los dos equipos en orden de hueco. Con color o sin él, siempre son dos y siempre en A, B. */
  protected readonly teams = computed(() => this.match().teams);

  /** Abrir el detalle desde aquí debe poder volver aquí, no al historial personal. */
  protected readonly returnTo = computed(() => `grupo:${this.match().groupId ?? ''}`);

  /** Sin lado decidido no hay acento de color: el borde se queda neutro, como la tarjeta. */
  protected readonly accent = computed<'blue' | 'red' | 'neutral'>(
    () => this.match().winningSide ?? 'neutral',
  );

  protected readonly winnerLabel = computed(
    () => matchWinnerLabel(this.match()) ?? 'Sin resultado',
  );

  protected readonly duration = computed(() => {
    const seconds = this.match().durationSeconds;
    return seconds == null ? null : formatDuration(seconds);
  });

  protected readonly mvp = computed<MatchParticipant | undefined>(() => {
    const id = this.match().mvpUserId;
    if (!id) return undefined;
    const m = this.match();
    return [...m.teams[0].participants, ...m.teams[1].participants].find((p) => p.userId === id);
  });

  /**
   * La ventaja de oro, `null` sin subida. El equipo se nombra por su color si lo tiene y por su
   * hueco si no: «+4,2k azul» o «+4,2k A».
   */
  protected readonly goldDiff = computed<string | null>(() => {
    const [a, b] = this.match().teams;
    if (a.totalGold == null || b.totalGold == null) return null;
    const diff = Math.abs(a.totalGold - b.totalGold);
    const leader = a.totalGold >= b.totalGold ? a : b;
    return `+${formatCompact(diff)} ${teamShortLabel(leader).toLowerCase()}`;
  });

  /**
   * `null` cuando la partida no reparte puntos: se prefiere no pintar el bloque a inventarse
   * una cifra. `lpDelta` nulo es «no contó para ninguna liga», que no es cero, así que esos
   * asientos no entran en la media en vez de tirarla hacia abajo.
   */
  protected readonly lpSummary = computed<string | null>(() => {
    const m = this.match();
    if (!m.winningSlot) return null;
    const winners = m.teams.find((t) => t.slot === m.winningSlot);
    const losers = m.teams.find((t) => t.slot !== m.winningSlot);

    const gain = average(winners?.participants ?? []);
    const loss = average(losers?.participants ?? []);
    if (gain === null || loss === null) return null;
    if (gain === 0 && loss === 0) return null;

    return `+${Math.round(gain)} / ${Math.round(loss)} LP`;
  });

  /** Por `userId`, que es la identidad del asiento: la vista no compara nombres a mano. */
  protected isCurrentUser(p: MatchParticipant): boolean {
    return p.userId === this.match().userParticipant?.userId;
  }

  protected championIcon(championId: number | null): string | null {
    if (championId == null) return null;
    return this.gameData.championById().get(championId)?.iconUrl ?? null;
  }

  protected championName(championId: number | null): string {
    if (championId == null) return 'Campeón sin registrar';
    return this.gameData.championById().get(championId)?.name ?? `Campeón ${championId}`;
  }

  protected playerName(p: MatchParticipant): string {
    return participantName(p);
  }

  protected shortLabel(team: TeamSummary): string {
    return teamLabel(team);
  }

  protected playerTitle(p: MatchParticipant): string {
    const you = this.isCurrentUser(p) ? ' · tú' : '';
    return `${this.playerName(p)} · ${this.championName(p.championId)} · ${p.role}${you}`;
  }
}

/** La media de los LP que SÍ contaron; `null` si no contó ninguno. */
function average(participants: readonly MatchParticipant[]): number | null {
  const values = participants.map((p) => p.lpDelta).filter((lp): lp is number => lp != null);
  if (values.length === 0) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}
