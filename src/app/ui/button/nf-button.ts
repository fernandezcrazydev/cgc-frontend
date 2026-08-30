import { Component, Input, ViewEncapsulation } from '@angular/core';

export type NfButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'riot';
export type NfButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Button.
 * Attribute-selector component so it stays a real <button>:
 *   <button nfButton variant="primary" size="md">Crear</button>
 *
 * 6 variantes (primary · secondary · ghost · accent · danger · riot), 4 tamaños (xs/sm/md/lg).
 * El copy va en frase normal: el botón no transforma el texto.
 *
 * `riot` es la única variante de marca de un tercero: pinta el rojo oficial de Riot
 * Games para que el control de vinculación se reconozca como tal (el patrón estándar
 * de "iniciar sesión con…"). No usarla para nada que no sea la cuenta de Riot.
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
