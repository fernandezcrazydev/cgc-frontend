import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NfLaneIcon, NfSkeleton } from '../../../../ui';
import { LaneImpact } from '../../../../core/group-stats';

/**
 * Visualización del impacto de las líneas ordenadas de mayor a menor probabilidad
 * de victoria al dominar cada rol (§5.5.5).
 */
@Component({
  selector: 'app-stats-lane-impact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfLaneIcon, NfSkeleton],
  template: `
    <section class="st-card li-card" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Impacto por líneas</h2>
        <span class="li-card__note">Líneas con mayor winrate cuando van por delante antes del min. 14</span>
      </header>

      @if (loading()) {
        <div class="li-card__list">
          @for (s of [0, 1, 2, 3, 4]; track s) {
            <nf-skeleton width="100%" height="42px" radius="6px" />
          }
        </div>
      } @else if (lanes().length) {
        <ol class="li-card__list">
          @for (item of lanes(); track item.lane; let i = $index) {
            <li
              class="li-entry"
              [attr.data-podium]="i < 3 ? i + 1 : null"
              [attr.data-rank]="item.impactOrder"
            >
              @if (i < 3) {
                <img
                  class="li-entry__trophy"
                  [src]="'/assets/trofeos/Trofeo' + (i + 1) + '.webp'"
                  [alt]="'Puesto ' + (i + 1)"
                  width="22"
                  height="22"
                />
              } @else {
                <span class="li-entry__rank nf-mono">
                  #{{ item.impactOrder }}
                </span>
              }
              <div class="li-entry__icon">
                <nf-lane-icon [lane]="item.lane" mode="original" />
              </div>
              <span class="li-entry__meta">
                <span class="li-entry__name">{{ item.label }}</span>
                <span class="li-entry__sub nf-mono">{{ item.description }}</span>
              </span>
              <span class="li-entry__value nf-mono">{{ item.winrate }}% WR</span>
            </li>
          }
        </ol>
      } @else {
        <p class="st-card__empty">No hay suficientes datos de líneas disponibles.</p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-lane-impact.component.scss'],
})
export class StatsLaneImpactComponent {
  readonly lanes = input<readonly LaneImpact[]>([]);
  readonly loading = input(false);
}
