import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NfAvatar, NfSkeleton } from '../../../../ui';
import { GoldenDuo } from '../../../../core/group-stats';

export type DuoVariant = 'gold' | 'wood';

/**
 * Tarjeta destacada de sinergia entre miembros (§5.5.5):
 * Permite presentar tanto al «Dúo de oro» (mejor química) como al «Dúo de madera» (peor química).
 */
@Component({
  selector: 'app-stats-golden-duo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfSkeleton],
  template: `
    <section
      class="st-card gd-card"
      [attr.data-variant]="variant()"
      [attr.aria-busy]="loading() ? 'true' : null"
    >
      <header class="st-card__head">
        <div class="gd-card__title-wrap">
          <span class="gd-card__badge" aria-hidden="true">{{ badgeText() }}</span>
          <h2 class="st-card__title">{{ titleText() }}</h2>
        </div>
        <span class="gd-card__note">{{ noteText() }}</span>
      </header>

      @if (loading()) {
        <div class="gd-card__loading">
          <nf-skeleton width="100%" height="84px" radius="10px" />
        </div>
      } @else if (duo(); as d) {
        <div class="gd-card__body">
          <div class="gd-card__players">
            <div class="gd-card__avatars">
              <div class="gd-card__avatar-slot is-first">
                <nf-avatar
                  [src]="d.player1.avatar ?? null"
                  [fallback]="d.player1.name"
                  [tint]="d.player1.hue"
                  [size]="46"
                  shape="round"
                />
              </div>
              <div class="gd-card__avatar-slot is-second">
                <nf-avatar
                  [src]="d.player2.avatar ?? null"
                  [fallback]="d.player2.name"
                  [tint]="d.player2.hue"
                  [size]="46"
                  shape="round"
                />
              </div>
              <span class="gd-card__crown-icon" aria-hidden="true">{{ iconText() }}</span>
            </div>

            <div class="gd-card__meta">
              <div class="gd-card__names">
                <span class="gd-card__name">{{ d.player1.name }}</span>
                <span class="gd-card__amp">&amp;</span>
                <span class="gd-card__name">{{ d.player2.name }}</span>
              </div>
              <span class="gd-card__sub nf-mono">{{ d.wins }}V - {{ d.losses }}D · {{ d.games }} partidas juntos</span>
            </div>
          </div>

          <div class="gd-card__stats">
            <div class="gd-card__stat-group">
              <strong class="gd-card__winrate nf-mono">{{ d.winrate }}%</strong>
              <span class="gd-card__winrate-label">de victorias</span>
            </div>
            <div class="gd-card__bar" aria-hidden="true">
              <span class="gd-card__bar-fill" [style.width.%]="d.winrate"></span>
            </div>
          </div>
        </div>
      } @else {
        <p class="st-card__empty">
          Todavía no hay suficientes partidas compartidas entre miembros para coronar un dúo.
        </p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-golden-duo.component.scss'],
})
export class StatsGoldenDuoComponent {
  readonly variant = input<DuoVariant>('gold');
  readonly title = input<string | null>(null);
  readonly badge = input<string | null>(null);
  readonly note = input<string | null>(null);
  readonly duo = input<GoldenDuo | null>(null);
  readonly loading = input(false);

  readonly isWood = computed(() => this.variant() === 'wood');
  readonly titleText = computed(() => this.title() ?? (this.isWood() ? 'Dúo de madera' : 'Dúo de oro'));
  readonly badgeText = computed(() => this.badge() ?? (this.isWood() ? '🪵 Donantes de LP' : '👑 Sinergia de élite'));
  readonly noteText = computed(
    () =>
      this.note() ??
      (this.isWood()
        ? 'Menor porcentaje de victoria compartiendo equipo'
        : 'Mayor porcentaje de victoria compartiendo equipo'),
  );
  readonly iconText = computed(() => (this.isWood() ? '🪵' : '✨'));
}
