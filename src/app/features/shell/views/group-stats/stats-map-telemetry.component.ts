import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NfSkeleton } from '../../../../ui';
import { MapTelemetry, ObjectiveId } from '../../../../core/group-stats';

/**
 * Telemetría de mapa y control de objetivos (§5.5.5, bloque 1 de la pestaña de
 * rendimiento): balance de victorias entre Equipo azul y Equipo rojo, e impacto de
 * los cinco objetivos principales de la grieta (dragón, larvas, heraldo, barón y torre).
 */
@Component({
  selector: 'app-stats-map-telemetry',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton],
  template: `
    <section class="st-card" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Telemetría de mapa y control de objetivos</h2>
      </header>

      @if (loading()) {
        <nf-skeleton width="100%" height="70px" radius="10px" />
        <nf-skeleton width="100%" height="58px" radius="10px" />
        <div class="st-grid tm-objectives">
          @for (s of [0, 1, 2, 3, 4]; track s) {
            <nf-skeleton width="100%" height="110px" radius="12px" />
          }
        </div>
      } @else if (telemetry(); as t) {
        <div class="tm-sides">
          <div class="tm-sides__row">
            <div class="tm-sides__team tm-sides__team--blue">
              <span class="tm-sides__name">Equipo azul</span>
              <strong class="tm-sides__pct nf-mono">{{ t.side.bluePct }}%</strong>
            </div>
            <div class="tm-sides__team tm-sides__team--red">
              <strong class="tm-sides__pct nf-mono">{{ t.side.redPct }}%</strong>
              <span class="tm-sides__name">Equipo rojo</span>
            </div>
          </div>

          <div
            class="tm-sides__bar"
            role="img"
            [attr.aria-label]="
              'El equipo azul gana el ' +
              t.side.bluePct +
              ' por ciento de las partidas y el equipo rojo el ' +
              t.side.redPct +
              ' por ciento'
            "
          >
            <span class="tm-sides__fill tm-sides__fill--blue" [style.width.%]="t.side.bluePct"></span>
            <span class="tm-sides__fill tm-sides__fill--red" [style.width.%]="t.side.redPct"></span>
          </div>

          <p class="tm-sides__foot nf-mono">
            {{ t.side.blueWins }} victorias Equipo azul · {{ t.side.redWins }} victorias Equipo rojo ·
            {{ t.side.games }} partidas totales
          </p>
        </div>

        <div class="tm-pacing">
          <div class="tm-pacing__item">
            <span class="tm-pacing__label">Duración media</span>
            <div class="tm-pacing__stat">
              <strong class="tm-pacing__value nf-mono">{{ t.pacing.averageDuration }}</strong>
              <span class="tm-pacing__unit">min</span>
            </div>
            <span class="tm-pacing__sub">Ritmo de partida</span>
          </div>

          <div class="tm-pacing__item">
            <span class="tm-pacing__label">Kills por minuto</span>
            <div class="tm-pacing__stat">
              <strong class="tm-pacing__value nf-mono">{{ t.pacing.killsPerMinute }}</strong>
              <span class="tm-pacing__unit">KPM</span>
            </div>
            <span class="tm-pacing__sub nf-mono">~{{ t.pacing.totalKillsPerGame }} kills/partida</span>
          </div>

          <div class="tm-pacing__item">
            <span class="tm-pacing__label">Impacto 1.ª sangre</span>
            <div class="tm-pacing__stat">
              <strong class="tm-pacing__value tm-pacing__value--fb nf-mono">{{ t.pacing.firstBloodWinrate }}%</strong>
            </div>
            <span class="tm-pacing__sub">Winrate al abrir el marcador</span>
          </div>
        </div>

        <ul class="st-grid tm-objectives">
          @for (o of t.objectives; track o.id) {
            <li
              class="tm-objective"
              [class.is-highlighted]="highlightedObjectiveId() === o.id"
              [attr.data-impact]="o.impact"
              (mouseenter)="objectiveHover.emit(o.id)"
              (mouseleave)="objectiveHover.emit(null)"
            >
              <img
                class="tm-objective__watermark"
                [src]="o.iconUrl"
                alt=""
                aria-hidden="true"
                (error)="onIconError($event, o.id)"
              />

              <div class="tm-objective__top">
                <span class="tm-objective__badge" [attr.data-impact]="o.impact">
                  {{ o.impact }}
                </span>
                <div class="tm-objective__icon-halo">
                  <img
                    class="tm-objective__icon"
                    [src]="o.iconUrl"
                    [alt]="o.label"
                    width="38"
                    height="38"
                    loading="lazy"
                    (error)="onIconError($event, o.id)"
                  />
                </div>
              </div>

              <div class="tm-objective__middle">
                <span class="tm-objective__label">{{ o.label }}</span>
                @if (o.id === 'grubs') {
                  <span class="tm-objective__hint">Control de las 3 larvas</span>
                }
                <span class="tm-objective__value nf-mono">{{ o.winrate }}%</span>
              </div>

              <div class="tm-objective__bottom">
                <div class="tm-objective__segments" aria-hidden="true">
                  <span class="tm-objective__seg is-on"></span>
                  <span class="tm-objective__seg is-on"></span>
                  <span class="tm-objective__seg" [class.is-on]="o.winrate >= 70"></span>
                  <span class="tm-objective__seg" [class.is-on]="o.winrate >= 80"></span>
                </div>
                <span class="tm-objective__sub nf-mono">{{ o.wins }}/{{ o.games }} partidas</span>
              </div>
            </li>
          }
        </ul>
      } @else {
        <p class="st-card__empty">
          Todavía no hay partidas suficientes para medir el control del mapa.
        </p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-map-telemetry.component.scss'],
})
export class StatsMapTelemetryComponent {
  readonly telemetry = input<MapTelemetry | null>(null);
  readonly loading = input(false);
  readonly highlightedObjectiveId = input<string | null>(null);
  readonly objectiveHover = output<string | null>();

  protected onIconError(event: Event, id: ObjectiveId): void {
    const img = event.target as HTMLImageElement;
    const fallbacks: Record<ObjectiveId, string> = {
      dragon: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon.png',
      grubs: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/grub.png',
      herald: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/riftherald.png',
      baron: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/baron.png',
      tower: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/tower.png',
    };
    if (img.src !== fallbacks[id]) {
      img.src = fallbacks[id];
    }
  }
}
