import { Component, Input, ViewEncapsulation } from '@angular/core';

export type NfWindowAccent = 'cyan' | 'pink';

/**
 * NEXUS//FORGE Window — the hero "retro-OS" card.
 * A cyan→pink gradient title bar with three traffic-light dots, a mono `.exe`
 * title and two window-control squares, over a `surface` body.
 *
 *   <nf-window title="acceso.exe" accent="cyan" bodyPadding="0">…</nf-window>
 */
@Component({
  selector: 'nf-window',
  standalone: true,
  template: `
    <div class="nf-window" [class.nf-window--pink]="accent === 'pink'">
      <div class="nf-window__bar">
        <div class="nf-window__lights">
          <span class="nf-window__light nf-window__light--red"></span>
          <span class="nf-window__light nf-window__light--yellow"></span>
          <span class="nf-window__light nf-window__light--green"></span>
        </div>
        <span class="nf-window__title nf-mono">{{ title }}</span>
        <div class="nf-window__controls">
          <span class="nf-window__ctrl"></span>
          <span class="nf-window__ctrl"></span>
        </div>
      </div>
      <div class="nf-window__body" [style.padding]="bodyPadding">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styleUrl: './nf-window.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfWindow {
  @Input() title = 'window.exe';
  @Input() accent: NfWindowAccent = 'cyan';
  /** CSS padding applied to the body slot. */
  @Input() bodyPadding = '20px';
}
