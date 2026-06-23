import { Component, Input, ViewEncapsulation } from '@angular/core';

export type NfButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
export type NfButtonSize = 'sm' | 'md' | 'lg';

/**
 * NEXUS//FORGE Button.
 * Attribute-selector component so it stays a real <button>:
 *   <button nfButton variant="primary" size="md">CREAR ►</button>
 *
 * 5 variants (primary · secondary · ghost · accent · danger), 3 sizes (sm/md/lg).
 * Signature look: thick 2px border + hard offset shadow; on hover the offset
 * grows and the button lifts 1px.
 */
@Component({
  selector: 'button[nfButton]',
  standalone: true,
  template: `<ng-content></ng-content>`,
  styleUrl: './nf-button.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class]': 'hostClasses',
    '[attr.disabled]': 'disabled ? "" : null',
  },
})
export class NfButton {
  @Input() variant: NfButtonVariant = 'primary';
  @Input() size: NfButtonSize = 'md';
  @Input() disabled = false;

  get hostClasses(): string {
    return `nf-btn nf-btn--${this.variant} nf-btn--${this.size}`;
  }
}
