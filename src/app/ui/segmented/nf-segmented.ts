import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, model } from '@angular/core';

export interface NfSegmentOption {
  value: string;
  label: string;
}

/**
 * Cómo se dibuja el control, con la MISMA semántica (`tablist`) en ambos casos:
 *
 * - `pill`: píldora suelta tipo iOS, para cuando el control flota en la página.
 * - `tabs`: pestañas a ancho completo, sin bordes ni radio propios, pensadas para ir
 *   pegadas al borde superior del contenedor que gobiernan (típicamente el cuerpo de una
 *   `<nf-window>`, justo bajo su barra de título). La pestaña activa comparte fondo con
 *   ese cuerpo y rompe la línea inferior, así que las dos piezas se leen como una sola.
 */
export type NfSegmentedVariant = 'pill' | 'tabs';

/**
 * NEXUS//FORGE Segmented — control segmentado para elegir entre pocas opciones
 * mutuamente excluyentes. Estilado con tokens, así que adopta el look del tema activo.
 *
 *   <nf-segmented
 *     [options]="opts"
 *     [value]="tema()"
 *     (valueChange)="setTema($event)"
 *     ariaLabel="Tema visual" />
 *
 * Con `variant="tabs"` es el navegador de secciones de una ventana:
 *
 *   <nf-window title="miembros.exe" bodyPadding="0">
 *     <nf-segmented variant="tabs" [options]="tabs" [value]="tab()" … />
 *     …contenido de la sección…
 *   </nf-window>
 */
@Component({
  selector: 'nf-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="nf-seg"
      [class.nf-seg--tabs]="variant() === 'tabs'"
      role="tablist"
      [attr.aria-label]="ariaLabel()"
    >
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
  readonly variant = input<NfSegmentedVariant>('pill');
}
