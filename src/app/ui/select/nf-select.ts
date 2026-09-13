import { Component, EventEmitter, Input, Output, ViewEncapsulation, input } from '@angular/core';

/** Una opción cuyo valor y etiqueta no coinciden: un enum del backend con su nombre en español. */
export interface NfSelectOption {
  value: string;
  label: string;
}

/**
 * Select — el select nativo, presentado como control hundido con un
 * mono `▾` caret.
 *
 *   <nf-select [options]="['LAN','BR']" value="LAN" (valueChange)="region = $event" />
 *
 * Cuando lo que se enseña no es lo que viaja, se pasan pares. `valueChange` sigue emitiendo el
 * VALOR, así que la vista no tiene que mapear la etiqueta de vuelta a mano:
 *
 *   <nf-select [options]="[{ value: 'CHAOS', label: 'Caos' }]" ... />
 */
@Component({
  selector: 'nf-select',
  standalone: true,
  template: `
    <div class="nf-select">
      <select
        class="nf-select__field"
        [value]="value"
        [attr.aria-label]="ariaLabel() || null"
        (change)="onChange($event)"
      >
        @for (opt of normalized; track opt.value) {
          <!-- [selected] además del [value] del select de arriba: Angular aplica las propiedades
               del elemento ANTES de crear sus hijos, así que en el primer ciclo el select todavía
               no tiene ninguna option, el navegador descarta el valor y se queda con la primera.
               El binding no vuelve a cambiar, así que un valor preseleccionado que no fuera el
               primero de la lista NO se pintaba nunca; la región parecía funcionar solo porque
               'EUW' encabeza REGIONS. -->
          <option [value]="opt.value" [selected]="opt.value === value">{{ opt.label }}</option>
        }
      </select>
      <span class="nf-select__caret nf-mono">▾</span>
    </div>
  `,
  styleUrl: './nf-select.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfSelect {
  /** Strings sueltos (valor = etiqueta) o pares `{ value, label }`; se normalizan a lo segundo. */
  @Input()
  set options(options: readonly (string | NfSelectOption)[]) {
    this.normalized = options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
  }

  protected normalized: NfSelectOption[] = [];

  @Input() value = '';
  /** Nombre accesible del control cuando no hay una etiqueta visible a su lado. */
  readonly ariaLabel = input<string>('');
  @Output() valueChange = new EventEmitter<string>();

  onChange(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value;
    this.valueChange.emit(this.value);
  }
}
