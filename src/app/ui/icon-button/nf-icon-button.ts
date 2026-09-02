import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';

export type NfIconButtonVariant = 'ghost' | 'subtle' | 'accent';
export type NfIconButtonSize = 'sm' | 'md';

/**
 * Icon button — la acción que se explica con una forma, no con una frase.
 *
 * Componente de selector de atributo, como `NfButton`, para que siga siendo un
 * `<button>` de verdad:
 *
 *   <button nfIconButton label="Ver el catálogo completo de campeones">
 *     <svg …>…</svg>
 *   </button>
 *
 * `label` es **obligatorio** y hace dos trabajos a la vez: es el `aria-label`
 * (sin él un botón que solo contiene un `<svg>` no tiene nombre accesible) y es
 * el `title`, que es el tooltip explicativo. Se resuelven con el mismo texto a
 * propósito: si el tooltip y el nombre accesible divergen, el usuario de lector
 * de pantalla y el de ratón dejan de estar leyendo el mismo botón.
 *
 * El icono se proyecta como SVG inline con `currentColor` —la convención de la
 * app, que no tiene librería de iconos— y el componente le fija el tamaño, así
 * que el SVG no necesita traer `width`/`height` propios.
 */
@Component({
  selector: 'button[nfIconButton]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ng-content></ng-content>`,
  styleUrl: './nf-icon-button.scss',
  encapsulation: ViewEncapsulation.None,
  host: {
    type: 'button',
    '[class]': 'hostClasses()',
    '[attr.aria-label]': 'label()',
    '[attr.title]': 'label()',
    '[attr.disabled]': 'disabled() ? "" : null',
  },
})
export class NfIconButton {
  /** Qué hace el botón, en frase normal. Es a la vez el tooltip y el nombre accesible. */
  readonly label = input.required<string>();
  readonly variant = input<NfIconButtonVariant>('ghost');
  readonly size = input<NfIconButtonSize>('md');
  readonly disabled = input(false);

  protected readonly hostClasses = computed(
    () => `nf-icon-btn nf-icon-btn--${this.variant()} nf-icon-btn--${this.size()}`,
  );
}
