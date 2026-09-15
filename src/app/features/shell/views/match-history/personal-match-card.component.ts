import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Match } from '../../../../core/matches/models';
import {
  csPerMin,
  formatKda,
  matchOutcomeLabel,
} from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { formatCompact, formatDurationUnits } from '../../../../shared/date-format';
import { NfAvatar, NfLaneIcon, NfSkeleton } from '../../../../ui';
import { MatchCardShellComponent } from './match-card-shell.component';

/**
 * Fila del historial personal. Responde a una sola pregunta: **¿cómo me fue?** Todo lo que
 * pinta está medido desde el usuario de la sesión —su campeón, su KDA, su oro, sus LP— y el
 * único dato ajeno es la etiqueta de la liga, que dice dónde se disputó.
 *
 * ## La variante reducida (`hasStats: false`)
 *
 * Una partida que el grupo jugó y nadie exportó desde el cliente de LoL **sale igual**, porque
 * contó para el LP y para el rating: esconderla dejaría una clasificación que el historial no
 * puede explicar. Lo que no sale es lo que dependía de esa subida —campeón, KDA, CS, oro,
 * duración—, y no sale como cero: un `0/0/0` se lee como una partida real en la que no pasó
 * nada, y esa mentira no la detecta nadie mirando la pantalla. En su lugar queda el resultado,
 * la línea que jugaste, los LP y un aviso de por qué falta el resto.
 */
@Component({
  selector: 'app-personal-match-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfLaneIcon, NfSkeleton, MatchCardShellComponent],
  styleUrl: './personal-match-card.component.scss',
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
        @if (duration(); as d) {
          <span class="m-card__duration nf-mono">{{ d }}</span>
        }
      </div>

      <!-- Campeón, posición y liga -->
      <div class="m-card__champ">
        <div class="m-card__avatar-wrap">
          @if (championId(); as champId) {
            <a
              [routerLink]="['/app', 'tierlist']"
              [title]="'Ver estadísticas de ' + championName()"
              (click)="$event.stopPropagation()"
            >
              <nf-avatar
                class="m-card__champ-icon"
                [loading]="champsLoading()"
                [src]="championIcon()"
                [fallback]="championName()"
                [tint]="champId"
                [size]="46"
                shape="square"
              />
            </a>
          } @else {
            <!--
              Sin subida no hay campeón que enseñar. El hueco se pinta como hueco: ni una
              silueta genérica que parezca un campeón, ni el icono de otra partida.
            -->
            <span class="m-card__champ-icon pm-card__no-champ" aria-hidden="true"></span>
          }
          <div class="m-card__role-badge">
            <nf-lane-icon [lane]="me().role" mode="original" />
          </div>
        </div>
        <div class="m-card__champ-meta">
          @if (champsLoading()) {
            <nf-skeleton width="90px" height="14px" />
          } @else if (championId()) {
            <a
              class="m-card__champ-name"
              [routerLink]="['/app', 'tierlist']"
              [title]="'Ver estadísticas de ' + championName()"
              (click)="$event.stopPropagation()"
            >
              {{ championName() }}
            </a>
          } @else {
            <span class="m-card__champ-name pm-card__unknown">Campeón sin registrar</span>
          }
          @if (groupLink(); as link) {
            <a
              class="m-card__group-link nf-mono"
              [routerLink]="link"
              (click)="$event.stopPropagation()"
            >
              {{ match().group?.name }}
            </a>
          }
        </div>
      </div>

      @if (match().hasStats) {
        <!-- KDA -->
        <div class="m-card__kda">
          <div class="m-card__kda-line">
            <strong>{{ me().stats.kills }}</strong>
            <span class="m-card__sep">/</span>
            <strong class="m-deaths">{{ me().stats.deaths }}</strong>
            <span class="m-card__sep">/</span>
            <strong>{{ me().stats.assists }}</strong>
          </div>
          @if (kda(); as k) {
            <span class="m-card__kda-ratio nf-mono">{{ k }} KDA</span>
          }
        </div>

        <!-- Farmeo y oro -->
        <div class="m-card__stats">
          @if (csLabel(); as cs) {
            <span class="m-card__stat-item nf-mono">{{ cs }}</span>
          }
          @if (gold(); as g) {
            <span class="m-card__stat-item m-card__stat-item--gold nf-mono">{{ g }} de oro</span>
          }
        </div>
      } @else {
        <!--
          El aviso ocupa el sitio del marcador y de la build. No es un error ni una carga: la
          partida está completa, lo que falta es la exportación desde el cliente de LoL.
        -->
        <div class="pm-card__no-stats">
          <span class="pm-card__no-stats-title nf-mono">Sin estadísticas</span>
          <span class="pm-card__no-stats-hint">
            Nadie subió esta partida desde el cliente de LoL. Contó para la clasificación igual.
          </span>
        </div>
      }
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

  /** `null` sin subida: no hay duración, y «0:00» sería una partida instantánea. */
  protected readonly duration = computed(() => {
    const seconds = this.match().durationSeconds;
    return seconds == null ? null : formatDurationUnits(seconds);
  });

  protected readonly gold = computed(() => {
    const gold = this.me().stats.gold;
    return gold == null ? null : formatCompact(gold);
  });

  /** «213 CS (6,1/min)», o solo los CS si la partida no trae duración con la que dividir. */
  protected readonly csLabel = computed(() => {
    const cs = this.me().stats.cs;
    if (cs == null) return null;
    const perMin = csPerMin(this.me().stats, this.match().durationSeconds);
    return perMin == null ? `${cs} CS` : `${cs} CS (${perMin}/min)`;
  });

  protected readonly kda = computed(() => formatKda(this.me().stats));

  protected readonly championId = computed(() => this.me().championId);

  protected readonly championIcon = computed(() => {
    const id = this.championId();
    return id == null ? null : (this.gameData.championById().get(id)?.iconUrl ?? null);
  });

  /**
   * El nombre sale del catálogo, que es la única fuente: el asiento solo trae el id. Mientras el
   * catálogo carga, el `nf-skeleton` de arriba ocupa su sitio en vez de enseñar un nombre falso.
   */
  protected readonly championName = computed(() => {
    const id = this.championId();
    if (id == null) return 'Campeón sin registrar';
    return this.gameData.championById().get(id)?.name ?? `Campeón ${id}`;
  });

  /**
   * El enlace al historial del grupo, cuando se sabe de qué grupo es la fila.
   *
   * BACKEND NOTE: en `/me/matches` NO se sabe — `GroupMatchResponse` no trae `groupId`— así que
   * la píldora no se pinta en vez de llevar a una ruta inventada. Pedido en la issue #69.
   */
  protected readonly groupLink = computed(() => {
    const groupId = this.match().groupId;
    return groupId ? ['/app', 'grupos', groupId, 'historial'] : null;
  });
}
