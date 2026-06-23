import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

export type NfToggleAccent = 'cyan' | 'pink';

/**
 * NEXUS//FORGE Toggle — boxy 48×28 switch with a neon track when on.
 *
 *   <nf-toggle [checked]="voice" accent="cyan" (checkedChange)="voice = $event" />
 */
@Component({
  selector: 'nf-toggle',
  standalone: true,
  template: `
    <button
      type="button"
      role="switch"
      class="nf-toggle"
      [class.nf-toggle--on]="checked"
      [class.nf-toggle--pink]="accent === 'pink'"
      [attr.aria-checked]="checked"
      (click)="toggle()"
    >
      <span class="nf-toggle__knob"></span>
    </button>
  `,
  styleUrl: './nf-toggle.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfToggle {
  @Input() checked = false;
  @Input() accent: NfToggleAccent = 'cyan';
  @Output() checkedChange = new EventEmitter<boolean>();

  toggle(): void {
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
  }
}
