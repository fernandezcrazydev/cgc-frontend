import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NfSkeleton } from '../../../../ui';
import { GroupVision } from '../../../../core/group-stats';

/**
 * Control y guerra de visión del grupo (§5.5.5):
 * Total de centinelas colocados, wards destruidos y puntuación media de visión,
 * destacando al rey de la visión del equipo.
 */
@Component({
  selector: 'app-stats-vision',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton],
  template: `
    <section class="st-card vi-card" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Guerra de visión</h2>
        <span class="vi-card__note">Control de mapa y centinelas en este período</span>
      </header>

      @if (loading()) {
        <div class="vi-card__grid">
          @for (s of [0, 1, 2]; track s) {
            <nf-skeleton width="100%" height="70px" radius="8px" />
          }
        </div>
      } @else if (vision(); as v) {
        <div class="vi-card__grid">
          <article class="vi-item vi-item--placed">
            <div class="vi-item__badge">
              <span class="vi-item__tier">Colocados</span>
            </div>
            <div class="vi-item__count nf-mono">{{ v.wardsPlaced.toLocaleString('es-ES') }}</div>
            <div class="vi-item__sub">
              <span>Wards plantados</span>
            </div>
          </article>

          <article class="vi-item vi-item--cleared">
            <div class="vi-item__badge">
              <span class="vi-item__tier">Destruidos</span>
            </div>
            <div class="vi-item__count nf-mono">{{ v.wardsCleared.toLocaleString('es-ES') }}</div>
            <div class="vi-item__sub">
              <span>Denegación rival</span>
            </div>
          </article>

          <article class="vi-item vi-item--leader">
            <div class="vi-item__badge">
              <span class="vi-item__tier">Rey de la visión</span>
            </div>
            <div class="vi-item__count nf-mono">{{ v.visionPerMin }} <span class="vi-item__unit">VPM</span></div>
            <div class="vi-item__sub">
              @if (v.topVisionary; as leader) {
                <span class="vi-item__leader">Líder: <strong>{{ leader.name }}</strong></span>
              } @else {
                <span>Media del grupo</span>
              }
            </div>
          </article>
        </div>
      } @else {
        <p class="st-card__empty">No hay datos de visión disponibles.</p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-vision.component.scss'],
})
export class StatsVisionComponent {
  readonly vision = input<GroupVision | null>(null);
  readonly loading = input(false);
}
