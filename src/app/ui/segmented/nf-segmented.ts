import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, model } from '@angular/core';

export interface NfSegmentOption {
  value: string;
  label: string;
}

/**
 * NEXUS//FORGE Segmented — control segmentado tipo iOS para elegir entre pocas
 * opciones mutuamente excluyentes. Estilado con tokens, así que adopta el look
 * del tema activo.
 *
 *   <nf-segmented
 *     [options]="opts"
 *     [value]="tema()"
 *     (valueChange)="setTema($event)"
 *     ariaLabel="Tema visual" />
 */
@Component({
  selector: 'nf-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="nf-seg" role="tablist" [attr.aria-label]="ariaLabel()">
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          class="nf-seg__btn"
          [class.nf-seg__btn--on]="opt.value === value()"
          [attr.aria-selected]="opt.value === value()"
          (click)="value.set(opt.value)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
  styleUrl: './nf-segmented.scss',
})
export class NfSegmented {
  readonly options = input.required<NfSegmentOption[]>();
  readonly value = model.required<string>();
  readonly ariaLabel = input<string>('');
}
