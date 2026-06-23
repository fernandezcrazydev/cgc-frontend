import { Component } from '@angular/core';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { MATCHES } from '../../../core/lobby';

@Component({
  selector: 'app-partidas',
  standalone: true,
  imports: [NfWindow, NfBadge, NfButton],
  template: `
    <div class="view">
      <p class="view__intro">Tus lobbies activos y partidas finalizadas.</p>
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
              <button nfButton variant="ghost" size="sm">ABRIR ►</button>
            </div>
          </nf-window>
        }
      </div>
    </div>
  `,
  styleUrl: './views.scss',
})
export class Partidas {
  readonly matches = MATCHES;
}
