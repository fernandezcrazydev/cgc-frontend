import { Component } from '@angular/core';
import { NfWindow } from '../../../ui';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [NfWindow],
  template: `
    <div class="view max-520">
      <p class="view__intro">Tus grupos y equipos de juego.</p>
      <nf-window title="grupos.exe" accent="pink" bodyPadding="22px">
        <div class="settings-eyebrow nf-mono">// SIN GRUPOS AÚN</div>
      </nf-window>
    </div>
  `,
  styleUrl: './views.scss',
})
export class Grupos {}
