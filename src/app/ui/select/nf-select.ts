import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

/**
 * NEXUS//FORGE Select — native select styled as a boxy inset control with a
 * mono `▾` caret.
 *
 *   <nf-select [options]="['LAN','BR']" value="LAN" (valueChange)="region = $event" />
 */
@Component({
  selector: 'nf-select',
  standalone: true,
  template: `
    <div class="nf-select">
      <select class="nf-select__field" [value]="value" (change)="onChange($event)">
        @for (opt of options; track opt) {
          <option [value]="opt">{{ opt }}</option>
        }
      </select>
      <span class="nf-select__caret nf-mono">▾</span>
    </div>
  `,
  styleUrl: './nf-select.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfSelect {
  @Input() options: string[] = [];
  @Input() value = '';
  @Output() valueChange = new EventEmitter<string>();

  onChange(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value;
    this.valueChange.emit(this.value);
  }
}
