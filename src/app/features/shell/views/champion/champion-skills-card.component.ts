import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChampionAbility } from '../../../../core/game-data/models';

interface SkillDisplayItem {
  key: 'Q' | 'W' | 'E';
  name: string;
  icon: string;
}

@Component({
  selector: 'app-champion-skills-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cf-card-inner s-alt2">
      <header class="s-alt2__header">
        <h2 class="cf-card__title">Orden de habilidades</h2>
      </header>
      <div class="cf-card__content s-alt2__body">
        <span class="s-alt2__eyebrow nf-mono">SE SUBE EN ESTE ORDEN</span>
        <div class="s-alt2__chain">
          @for (skill of skillChain(); track skill.key; let last = $last) {
            <div class="s-alt2__item">
              <div class="s-alt2__icon-wrap">
                <img [src]="skill.icon" [alt]="skill.name" class="s-alt2__icon" />
                <span class="s-alt2__key nf-mono">{{ skill.key }}</span>
              </div>
              <span class="s-alt2__name">{{ skill.name }}</span>
            </div>
            @if (!last) {
              <span class="s-alt2__arrow">›</span>
            }
          }
        </div>
        <p class="s-alt2__footnote">La definitiva, en los niveles 6, 11 y 16.</p>
      </div>
    </article>
  `,
  styleUrls: ['./champion-skills-card.component.scss'],
})
export class ChampionSkillsCardComponent {
  readonly abilities = input<ChampionAbility[]>([]);
  readonly order = input<('Q' | 'W' | 'E')[]>(['Q', 'W', 'E']);

  protected readonly skillChain = computed<SkillDisplayItem[]>(() => {
    const list = this.abilities();
    const ord = this.order();
    return ord.map((key) => {
      const found = list.find((a) => a.slot === key);
      return {
        key,
        name: found?.name ?? `Habilidad ${key}`,
        icon: found?.iconUrl ?? '',
      };
    });
  });
}
