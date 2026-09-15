import { Component, Input, ViewEncapsulation } from '@angular/core';

export type NfButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'riot';
export type NfButtonSize = 'xs' | 'sm' | 'md' | 'lg';

/**
 * Button.
 * Attribute-selector component so it stays a real <button>:
 *   <button nfButton variant="primary" size="md">Crear</button>
 *
 * También sobre `<a>`, para lo que navega en vez de actuar:
 *   <a nfButton variant="secondary" size="sm" [routerLink]="...">Historial cruzado</a>
 *
 * El selector llevaba solo `button[nfButton]`, así que los `<a nfButton>` que ya había en la app
 * no recibían ni una clase: el atributo estaba puesto y no hacía nada, y el enlace se pintaba
 * como texto suelto. Un enlace que navega NO debe convertirse en `<button>` para parecer un
 * botón —perdería el clic con el botón central, el «abrir en pestaña nueva» y el `href` que lee
 * un lector de pantalla—, así que lo que se amplía es el selector.
 *
 * `disabled` no aplica a un `<a>`: un enlace no se deshabilita, se quita.
 *
 * 6 variantes (primary · secondary · ghost · accent · danger · riot), 4 tamaños (xs/sm/md/lg).
 * El copy va en frase normal: el botón no transforma el texto.
 *
 * `riot` es la única variante de marca de un tercero: pinta el rojo oficial de Riot
 * Games para que el control de vinculación se reconozca como tal (el patrón estándar
 * de "iniciar sesión con…"). No usarla para nada que no sea la cuenta de Riot.
 */
@Component({
  selector: 'button[nfButton], a[nfButton]',
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
