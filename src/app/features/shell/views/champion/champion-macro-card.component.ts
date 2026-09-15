import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChampionStats } from '../../../../core/champions';

@Component({
  selector: 'app-champion-macro-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cf-card-inner m-macro-card">
      <h2 class="cf-card__title">Fase temprana y macro</h2>
      <div class="cf-card__content">
        <div class="m-macro-grid">
          <div class="m-macro-kpi">
            <span class="m-macro-kpi__lbl">ORO AL MIN 14</span>
            <span class="m-macro-kpi__val nf-mono">{{ oro14() }}</span>
          </div>
          <div class="m-macro-kpi">
            <span class="m-macro-kpi__lbl">CS POR MINUTO</span>
            <span class="m-macro-kpi__val nf-mono">{{ csMin() }}</span>
          </div>
          <div class="m-macro-kpi">
            <span class="m-macro-kpi__lbl">PRIMERA SANGRE</span>
            <span class="m-macro-kpi__val nf-mono">{{ primeraSangre() }}</span>
          </div>
          <div class="m-macro-kpi">
            <span class="m-macro-kpi__lbl">PRIMERA TORRE</span>
            <span class="m-macro-kpi__val nf-mono">{{ primeraTorre() }}</span>
          </div>
        </div>
      </div>
    </article>
  `,
  styleUrls: ['./champion-macro-card.component.scss'],
})
export class ChampionMacroCardComponent {
  readonly stats = input.required<ChampionStats>();

  protected readonly oro14 = computed(() => this.stats().avgGoldAt14.toLocaleString('es-ES'));
  protected readonly csMin = computed(() => this.stats().avgCsPerMin.toLocaleString('es-ES'));
  protected readonly primeraSangre = computed(() => `${this.stats().firstBloodRate}%`);
  protected readonly primeraTorre = computed(() => `${this.stats().firstTowerRate}%`);
}
