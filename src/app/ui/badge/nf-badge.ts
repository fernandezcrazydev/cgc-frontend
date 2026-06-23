import { Component, Input, ViewEncapsulation } from '@angular/core';

export type NfBadgeColor = 'green' | 'yellow' | 'cyan' | 'pink' | 'red' | 'purple';

/**
 * NEXUS//FORGE Badge — small boxy status chip with a low-opacity tinted fill,
 * mono uppercase label and an optional status dot.
 *
 *   <nf-badge color="green" [dot]="true">EN CURSO</nf-badge>
 */
@Component({
  selector: 'nf-badge',
  standalone: true,
  template: `
    @if (dot) {
      <span class="nf-badge__dot" [class.nf-badge__dot--blink]="color === 'yellow'"></span>
    }
    <span class="nf-badge__label nf-mono"><ng-content></ng-content></span>
  `,
  styleUrl: './nf-badge.scss',
  encapsulation: ViewEncapsulation.None,
  host: { '[class]': '"nf-badge nf-badge--" + color' },
})
export class NfBadge {
  @Input() color: NfBadgeColor = 'cyan';
  @Input() dot = false;
}
