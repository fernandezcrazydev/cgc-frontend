import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Lane, Match, MatchParticipant, TeamSide } from '../../../../core/matches/models';
import { formatKda } from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { NfAvatar, NfLaneIcon } from '../../../../ui';

/**
 * Alineación de la partida: lo que se abre al desplegar una fila del historial.
 *
 * Deliberadamente MÍNIMA y distinta de `<app-match-scoreboard>` (la página de análisis):
 * responde a una sola pregunta —"¿quién jugaba y cómo le fue?"— con los diez jugadores,
 * su campeón, su línea y su KDA, y nada más. Objetos, oro, daño, runas, duelos de línea
 * y pestañas viven en `/app/historial/:id`, porque una fila desplegada que repite la
 * página entera convierte la lista en una pared de datos y deja la página sin motivo
 * para existir: el desplegable se ojea, la página se estudia.
 */
@Component({
  selector: 'app-match-lineup',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfLaneIcon],
  template: `
    <div class="m-lineup">
      <div class="m-lineup__teams">
        @for (team of teams(); track team.side) {
          <div
            class="m-lineup__team"
            [class.m-lineup__team--blue]="team.side === 'blue'"
            [class.m-lineup__team--red]="team.side === 'red'"
          >
            <div class="m-lineup__team-head">
              <span class="m-lineup__team-name">{{ team.side === 'blue' ? 'Equipo azul' : 'Equipo rojo' }}</span>
              <span class="m-lineup__team-outcome nf-mono" [class.is-win]="team.won" [class.is-loss]="!team.won">
                {{ team.won ? 'Victoria' : 'Derrota' }}
              </span>
              <span class="m-lineup__team-kills nf-mono">{{ team.kills }} bajas</span>
            </div>

            @for (p of team.participants; track p.id) {
              <div class="m-lineup__row" [class.is-you]="isCurrentUser(p)">
                <nf-lane-icon class="m-lineup__lane" [lane]="p.role" mode="original" />
                <a
                  class="m-lineup__champ-link"
                  [routerLink]="['/app', 'tierlist']"
                  [title]="'Ver estadísticas de ' + championName(p)"
                  (click)="$event.stopPropagation()"
                >
                  <nf-avatar
                    class="m-lineup__champ"
                    [loading]="champsLoading()"
                    [src]="champion(p.championId)?.iconUrl ?? null"
                    [fallback]="p.championName"
                    [tint]="p.championId"
                    [size]="28"
                    shape="square"
                  />
                </a>
                <div class="m-lineup__who">
                  <a
                    class="m-lineup__player"
                    [routerLink]="isCurrentUser(p) ? ['/app', 'perfil'] : ['/app', 'perfil', p.userId]"
                    [title]="p.riotId"
                    (click)="$event.stopPropagation()"
                  >
                    {{ p.riotId }}
                  </a>
                  <a
                    class="m-lineup__champ-name nf-mono"
                    [routerLink]="['/app', 'tierlist']"
                    [title]="'Ver estadísticas de ' + championName(p)"
                    (click)="$event.stopPropagation()"
                  >
                    {{ championName(p) }}
                  </a>
                </div>
                @if (isCurrentUser(p)) {
                  <span class="m-lineup__tag nf-mono">Tú</span>
                }
                @if (p.id === match().mvpParticipantId) {
                  <span class="m-lineup__tag m-lineup__tag--mvp nf-mono">MVP</span>
                }
                <span class="m-lineup__kda nf-mono">
                  {{ p.stats.kills }}<span class="m-lineup__slash">/</span
                  ><span class="m-lineup__deaths">{{ p.stats.deaths }}</span
                  ><span class="m-lineup__slash">/</span>{{ p.stats.assists }}
                </span>
                <span class="m-lineup__ratio nf-mono">{{ kdaRatio(p) }}</span>
              </div>
            }
          </div>
        }
      </div>

      <div class="m-lineup__actions">
        <a
          class="m-lineup__more nf-mono"
          [routerLink]="['/app', 'historial', match().id]"
          [queryParams]="queryParams()"
        >
          Análisis completo
        </a>
      </div>
    </div>
  `,
})
export class MatchLineupComponent {
  readonly match = input.required<Match>();
  /**
   * De dónde se abre la partida, para que la página de detalle sepa a dónde volver. La vista
   * no puede deducirlo sola: una partida pertenece a un grupo Y sale en el historial personal.
   */
  readonly returnTo = input<string | null>(null);

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly queryParams = computed(() => {
    const to = this.returnTo();
    return to ? { volver: to } : {};
  });

  protected readonly teams = computed(() => {
    const m = this.match();
    return [m.blueTeam, m.redTeam].map((t) => ({
      side: t.side as TeamSide,
      won: t.won,
      kills: t.totalKills,
      participants: [...t.participants].sort(
        (a, b) => LANE_ORDER.indexOf(a.role) - LANE_ORDER.indexOf(b.role),
      ),
    }));
  });

  protected champion(id: number) {
    return this.gameData.championById().get(id);
  }

  /**
   * Mientras el catálogo carga no hay nombre real que enseñar, y el del participante es
   * el que grabó la partida: se pinta ese en vez de un hueco, y se sustituye por el del
   * catálogo cuando llega (mismo texto en la práctica, cero salto de layout).
   */
  protected championName(p: MatchParticipant): string {
    return this.champion(p.championId)?.name ?? p.championName;
  }

  /**
   * Por id de participante, no por `riotId`: la partida ya trae resuelto quién es el
   * usuario de la sesión (`userParticipant`), así que la vista no tiene que conocer
   * ninguna identidad.
   */
  protected isCurrentUser(p: MatchParticipant): boolean {
    return p.id === this.match().userParticipant?.id;
  }

  protected kdaRatio(p: MatchParticipant): string {
    return `${formatKda(p.stats, 1)} KDA`;
  }
}

/** Orden de lectura de una alineación de LoL, de calle superior a soporte. */
const LANE_ORDER: Lane[] = ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'];
