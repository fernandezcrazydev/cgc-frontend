import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PlayerTileIcon } from '../../../../core/group-stats';

/**
 * Icono vectorial para una métrica del desglose de jugador (§5.5.5).
 * Hereda currentColor y se dimensiona por el host o su contenedor.
 */
@Component({
  selector: 'app-stats-tile-icon',
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
        @case ('games') {
          <rect x="2" y="6" width="20" height="12" rx="4" />
          <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
        }
        @case ('winrate') {
          <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2M6 3h12v7a6 6 0 0 1-12 0V3zM12 16v5M8 21h8" />
        }
        @case ('kda') {
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="2" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        }
        @case ('kda-split') {
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l3 3" />
        }
        @case ('cs') {
          <path d="M12 20.5V11M12 11c0-3 1.8-5.5 5-6.5.4 3.6-1.4 6.5-5 6.5zM12 13.5c-3.2 0-5-2.4-4.7-5.6C10 8.9 12 10.8 12 13.5zM6.5 20.5h11" />
        }
        @case ('gold') {
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.5v9M14.4 9.6c-.6-.7-1.5-1-2.4-1-1.4 0-2.4.8-2.4 1.9 0 2.6 4.8 1.4 4.8 4 0 1.1-1 1.9-2.4 1.9-1 0-1.9-.4-2.4-1.1" />
        }
        @case ('damage') {
          <path d="M4 20l7-7M14 4l6 6-9 9-6-6zM15 9l-2-2" />
        }
        @case ('vision') {
          <path d="M3 12s3.4-5.4 9-5.4S21 12 21 12s-3.4 5.4-9 5.4S3 12 3 12z" />
          <circle cx="12" cy="12" r="2.4" />
        }
        @case ('penta') {
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
        }
        @case ('streak') {
          <path d="M4 16.5l4.8-5 3.4 3.2L20 7M15.4 7H20v4.6" />
        }
        @case ('ranking') {
          <path d="M4 21v-7h4v7M10 21V9h4v12M16 21v-4h4v7" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      color: inherit;
    }
    svg {
      width: 100%;
      height: 100%;
    }
  `,
})
export class StatsTileIconComponent {
  readonly icon = input.required<PlayerTileIcon>();
}
