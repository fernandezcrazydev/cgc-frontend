import { Component, Input, ViewEncapsulation } from '@angular/core';

export type NfButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
export type NfButtonSize = 'sm' | 'md' | 'lg';

/**
 * Button.
 * Attribute-selector component so it stays a real <button>:
 *   <button nfButton variant="primary" size="md">Crear</button>
 *
 * 5 variantes (primary · secondary · ghost · accent · danger), 3 tamaños (sm/md/lg).
 * El copy va en frase normal: el botón no transforma el texto.
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
