import { Component } from '@angular/core';
import { CHAMPIONS } from '../../../core/lobby';

@Component({
  selector: 'app-campeones',
  standalone: true,
  template: `
    <div class="view">
      <p class="view__intro">Pool de campeones disponibles para el draft.</p>
      <div class="champ-grid">
        @for (c of champions; track c.name) {
          <div class="champ">
            <div class="champ__art" [style.background]="'radial-gradient(circle at 32% 26%, ' + c.c1 + ', ' + c.c2 + ')'">
              <div class="champ__hatch"></div>
              <div class="champ__initials">{{ c.initials }}</div>
            </div>
            <div>
              <div class="champ__name">{{ c.name }}</div>
              <div class="champ__role nf-mono">{{ c.role }}</div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './views.scss',
})
export class Campeones {
  readonly champions = CHAMPIONS;
}
