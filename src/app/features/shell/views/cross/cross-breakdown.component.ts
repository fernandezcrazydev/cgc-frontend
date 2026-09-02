import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDataStore } from '../../../../core/game-data';
import { CrossMatch, MatchParticipant, laneLabel } from '../../../../core/matches';
import { formatDuration } from '../../../../shared/date-format';
import { NfAvatar, NfLaneIcon, NfSkeleton } from '../../../../ui';
import { crossMetricRows } from './cross-compare';
import { nameOf } from './cross-player';

/**
 * El desglose rápido de una fila del historial cruzado: los dos jugadores enfrentados métrica a
 * métrica, y nada más.
 *
 * Es lo que se proyecta en la ranura del acordeón en lugar de la alineación de los diez. En esta
 * vista los otros ocho participantes son ruido: la pregunta de la pantalla no es «quién jugaba»
 * —eso lo contesta el historial normal— sino «cómo nos fue a nosotros dos». Sigue la misma regla
 * de contención que la alineación: el desplegable se ojea, la página se estudia, así que las
 * builds, las runas y el marcador 5v5 siguen viviendo un clic más allá.
 */
@Component({
  selector: 'app-cross-breakdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfLaneIcon, NfSkeleton],
  template: `
    <div class="cx-breakdown">
      <div class="cx-breakdown__head">
        <span
          class="cx-breakdown__relation nf-mono"
          [class.cx-breakdown__relation--ally]="isAlly()"
        >
          {{ relationLabel() }}
        </span>
        <span class="cx-breakdown__meta nf-mono">
          {{ duration() }} · {{ cross().match.group.name }}
        </span>
      </div>

      <div class="cx-compare">
        <div class="cx-compare__players">
          <div class="cx-compare__player cx-compare__player--me">
            <nf-avatar
              class="cx-compare__champ"
              [loading]="champsLoading()"
              [src]="icon(cross().me)"
              [fallback]="cross().me.championName"
              [tint]="cross().me.championId"
              [size]="32"
              shape="square"
            />
            <div class="cx-compare__who">
              <span class="cx-compare__name">Tú</span>
              @if (champsLoading()) {
                <nf-skeleton width="70px" height="11px" />
              } @else {
                <span class="cx-compare__champ-name nf-mono">{{ championName(cross().me) }}</span>
              }
            </div>
            <nf-lane-icon class="cx-compare__lane" [lane]="cross().me.role" mode="original" />
          </div>

          <span class="cx-compare__vs nf-mono" aria-hidden="true">{{ isAlly() ? '+' : 'vs' }}</span>

          <div class="cx-compare__player cx-compare__player--them">
            <nf-lane-icon class="cx-compare__lane" [lane]="cross().them.role" mode="original" />
            <div class="cx-compare__who">
              <span class="cx-compare__name">{{ theirName() }}</span>
              @if (champsLoading()) {
                <nf-skeleton width="70px" height="11px" />
              } @else {
                <span class="cx-compare__champ-name nf-mono">{{ championName(cross().them) }}</span>
              }
            </div>
            <nf-avatar
              class="cx-compare__champ"
              [loading]="champsLoading()"
              [src]="icon(cross().them)"
              [fallback]="cross().them.championName"
              [tint]="cross().them.championId"
              [size]="32"
              shape="square"
            />
          </div>
        </div>

        @for (r of rows(); track r.key) {
          <div class="cx-metric">
            <div class="cx-metric__val cx-metric__val--me" [class.is-best]="r.winner === 'me'">
              <span class="cx-metric__num nf-mono">{{ r.mineText }}</span>
              @if (r.mineSub) {
                <span class="cx-metric__sub nf-mono">{{ r.mineSub }}</span>
              }
            </div>

            <div class="cx-metric__center">
              <span class="cx-metric__label nf-mono">{{ r.label }}</span>
              <div class="cx-metric__bar" role="presentation">
                <span class="cx-metric__fill cx-metric__fill--me" [style.width.%]="r.minePct"></span>
                <span
                  class="cx-metric__fill cx-metric__fill--them"
                  [style.width.%]="r.theirsPct"
                ></span>
              </div>
            </div>

            <div class="cx-metric__val cx-metric__val--them" [class.is-best]="r.winner === 'them'">
              <span class="cx-metric__num nf-mono">{{ r.theirsText }}</span>
              @if (r.theirsSub) {
                <span class="cx-metric__sub nf-mono">{{ r.theirsSub }}</span>
              }
            </div>
          </div>
        }
      </div>

      @if (laneNote(); as note) {
        <p class="cx-breakdown__note nf-mono">{{ note }}</p>
      }

      <div class="m-lineup__actions">
        <a
          class="m-lineup__more nf-mono"
          [routerLink]="['/app', 'historial', cross().id]"
          [queryParams]="queryParams()"
        >
          Análisis completo
        </a>
        <a class="m-lineup__more cx-more nf-mono" [routerLink]="detailLink()">
          {{ isAlly() ? 'Ver sinergia completa' : 'Ver duelo completo' }}
        </a>
      </div>
    </div>
  `,
})
export class CrossBreakdownComponent {
  readonly cross = input.required<CrossMatch>();
  /** El jugador tal y como viaja en la URL, para construir el enlace al detalle. */
  readonly playerId = input.required<string>();
  /** De dónde se abre, para que «volver» del análisis completo regrese aquí. */
  readonly returnTo = input<string | null>(null);

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly isAlly = computed(() => this.cross().relation === 'ally');

  protected readonly theirName = computed(() => nameOf(this.cross().them.riotId));

  protected readonly duration = computed(() => formatDuration(this.cross().match.durationSeconds));

  protected readonly rows = computed(() => crossMetricRows(this.cross()));

  protected readonly relationLabel = computed(() => {
    const c = this.cross();
    const mine = laneLabel(c.me.role);
    const theirs = laneLabel(c.them.role);
    if (c.relation === 'ally') return `Juntos · ${mine} + ${theirs}`;
    return c.sameLane ? `Duelo de línea · ${mine}` : `En contra · ${mine} contra ${theirs}`;
  });

  /**
   * Quién ganó su línea, pero solo cuando el dato existe y hubo duelo directo. Fuera de la
   * misma posición «ganar la línea» compara dos calles distintas y no dice nada del cruce.
   */
  protected readonly laneNote = computed(() => {
    const c = this.cross();
    if (!c.sameLane) return null;
    const mine = c.me.stats.wonLane;
    const theirs = c.them.stats.wonLane;
    if (mine === undefined || theirs === undefined) return null;
    if (mine === theirs) return 'La línea acabó igualada.';
    return mine
      ? `Ganaste la línea a ${this.theirName()}.`
      : `${this.theirName()} te ganó la línea.`;
  });

  protected readonly detailLink = computed(() => [
    '/app',
    this.isAlly() ? 'synergy' : 'versus',
    this.playerId(),
    this.cross().id,
  ]);

  protected readonly queryParams = computed(() => {
    const to = this.returnTo();
    return to ? { volver: to } : {};
  });

  protected icon(p: MatchParticipant): string | null {
    return this.gameData.championById().get(p.championId)?.iconUrl ?? null;
  }

  /**
   * Mientras el catálogo carga se pinta el nombre que grabó la partida, no un hueco: en la
   * práctica es el mismo texto, y así no salta el layout cuando llega el del catálogo.
   */
  protected championName(p: MatchParticipant): string {
    return this.gameData.championById().get(p.championId)?.name ?? p.championName;
  }
}
