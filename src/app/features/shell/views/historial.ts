import { Component } from '@angular/core';
import { NfBadge, NfWindow } from '../../../ui';
import { MATCHES } from '../../../core/lobby';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [NfWindow, NfBadge],
  template: `
    <div class="view">
      <p class="view__intro">Registro de todas tus partidas jugadas.</p>
      <div class="cards">
        @for (m of matches; track m.name) {
          <nf-window [title]="m.name" accent="cyan" bodyPadding="16px">
            <div class="pm-head">
              <div class="pm-avatar" [style.background]="'radial-gradient(circle at 32% 26%, ' + m.c1 + ', ' + m.c2 + ')'"></div>
              <div>
                <div class="pm-mode">{{ m.mode }}</div>
                <div class="pm-players nf-mono">{{ m.players }}</div>
              </div>
            </div>
            <div class="pm-foot">
              <nf-badge [color]="m.color" [dot]="true">{{ m.status }}</nf-badge>
            </div>
          </nf-window>
        }
      </div>
    </div>
  `,
  styleUrl: './views.scss',
})
export class Historial {
  readonly matches = MATCHES;
}
