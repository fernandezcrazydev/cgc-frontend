import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

/** Una opción cuyo valor y etiqueta no coinciden: un enum del backend con su nombre en español. */
export interface NfSelectOption {
  value: string;
  label: string;
}

/**
 * NEXUS//FORGE Select — native select styled as a boxy inset control with a
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
      <select class="nf-select__field" [value]="value" (change)="onChange($event)">
        @for (opt of normalized; track opt.value) {
          <option [value]="opt.value">{{ opt.label }}</option>
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
  @Output() valueChange = new EventEmitter<string>();

  onChange(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value;
    this.valueChange.emit(this.value);
  }
}
