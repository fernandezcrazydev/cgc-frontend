import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EpicRecordIcon } from '../../../../core/group-stats';

/**
 * Icono vectorial para los récords históricos (§5.5.5, bloque 3).
 * Hereda currentColor y se dimensiona mediante el host.
 */
@Component({
  selector: 'app-stats-record-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (icon()) {
        @case ('blood') {
          <path d="M12 3.5c3.2 4 5 6.6 5 9a5 5 0 0 1-10 0c0-2.4 1.8-5 5-9z" />
          <path d="M9.6 13.4a2.6 2.6 0 0 0 2.4 3.1" />
        }
        @case ('damage') {
          <path d="M4 20l7-7M14 4l6 6-9 9-6-6zM15 9l-2-2" />
        }
        @case ('marathon') {
          <circle cx="12" cy="12.6" r="7.6" />
          <path d="M12 8.6v4.4l2.8 1.8M9.4 3.4h5.2" />
        }
        @case ('comeback') {
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M21 3v5h-5" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          <path d="M3 21v-5h5" />
        }
        @case ('speedrun') {
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2.5" />
          <path d="M10 2h4M4.9 6.5l1.6-1.6M17.5 4.9l1.6 1.6" />
        }
        @case ('monsters') {
          <path d="M4 18l4-4 4 4 4-4 4 4" />
          <path d="M6 14V6l6-3 6 3v8" />
          <path d="M10 9h4" />
        }
        @case ('kills') {
          <circle cx="9" cy="9" r="1.5" />
          <circle cx="15" cy="9" r="1.5" />
          <path d="M12 2a8 8 0 0 0-8 8c0 3 1.8 5.6 4.4 7v3a1 1 0 0 0 1 1h5.2a1 1 0 0 0 1-1v-3c2.6-1.4 4.4-4 4.4-7a8 8 0 0 0-8-8z" />
          <path d="M10 18v3M14 18v3" />
        }
        @case ('gold') {
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 6.5v11" />
          <path d="M15 9.5a2.5 2.5 0 0 0-2.5-2H10a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4h-3a2.5 2.5 0 0 1-2.5-2" />
        }
        @case ('tank') {
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 6v12M8 10h8" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      color: inherit;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class StatsRecordIconComponent {
  readonly icon = input.required<EpicRecordIcon>();
}
