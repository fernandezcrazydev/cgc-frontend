import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, model } from '@angular/core';

export type NfToggleAccent = 'cyan' | 'pink';

/**
 * NEXUS//FORGE Toggle — boxy 48×28 switch with a neon track when on.
 *
 *   <nf-toggle [checked]="voice()" accent="cyan" (checkedChange)="voice.set($event)"
 *     ariaLabel="Chat de voz" />
 *
 * `ariaLabel` es obligatorio en la práctica: el switch no tiene texto propio, así
 * que sin él un lector de pantalla anuncia "conmutador" y poco más.
 */
@Component({
  selector: 'nf-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      role="switch"
      class="nf-toggle"
      [class.nf-toggle--on]="checked()"
      [class.nf-toggle--pink]="accent() === 'pink'"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="ariaLabel() || null"
      (click)="checked.set(!checked())"
    >
      <span class="nf-toggle__knob"></span>
    </button>
  `,
  styleUrl: './nf-toggle.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfToggle {
  readonly checked = model(false);
  readonly accent = input<NfToggleAccent>('cyan');
  readonly ariaLabel = input<string>('');
}
