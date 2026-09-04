import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MedalIcon } from '../../../../core/group-medals';

/**
 * El dibujo de una medalla del Hall of Fame (§5.5.5).
 *
 * Veinte trazos vectoriales en un solo `@switch`, con la misma convención que el
 * resto del proyecto: `viewBox` de 24, sin relleno, trazo `currentColor` de 1.6 y
 * uniones redondeadas. Al heredar el color, la misma medalla vale para la tarjeta,
 * para el modal y para la vitrina del hub sin duplicar nada.
 *
 * Está aparte y no dentro de la rejilla porque lo consumen tres sitios distintos:
 * el Hall of Fame, el modal de detalle y la vitrina de trofeos del hub. El color lo
 * hereda y el tamaño lo pone quien lo coloca, dimensionando `app-medal-icon`.
 */
@Component({
  selector: 'app-medal-icon',
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
        @case ('penta') {
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z" />
        }
        @case ('quadra') {
          <path d="M12 4.2l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z" />
          <path d="M17.5 19.5l3 1.5-.6-3.3" />
        }
        @case ('first-blood') {
          <path d="M12 3.5c3.2 4 5 6.6 5 9a5 5 0 0 1-10 0c0-2.4 1.8-5 5-9z" />
          <path d="M9.6 13.4a2.6 2.6 0 0 0 2.4 3.1" />
        }
        @case ('immortal') {
          <path d="M12 3.2l7 3v5.2c0 4-2.9 7.4-7 9.4-4.1-2-7-5.4-7-9.4V6.2z" />
          <path d="M9 12.2l2.2 2.2L15.4 10" />
        }
        @case ('silent-carry') {
          <path d="M3 12s3.4-5.4 9-5.4S21 12 21 12s-3.4 5.4-9 5.4S3 12 3 12z" />
          <path d="M4.5 4.5l15 15" />
        }
        @case ('tower') {
          <path d="M7 20.5h10M8.2 20.5V9.4h7.6v11.1M8.2 9.4l1-4.2h5.6l1 4.2M10.4 5.2V3h3.2v2.2" />
        }
        @case ('dragon') {
          <path d="M4 12c3-6 9-8 16-7-1 7-4 11-10 12-3 .5-5-1-6-5z" />
          <path d="M8 17l-3 3" />
        }
        @case ('baron') {
          <path d="M5 9.5C5 6 8.1 3.5 12 3.5S19 6 19 9.5c0 3-1.7 4.6-1.7 7.2 0 1.9-1.4 3.8-5.3 3.8s-5.3-1.9-5.3-3.8C6.7 14.1 5 12.5 5 9.5z" />
          <path d="M9.5 9.2h.01M14.5 9.2h.01M9.5 14.5c1.7 1.2 3.3 1.2 5 0" />
        }
        @case ('steal') {
          <path d="M6.5 3.5l4 6.5M17.5 3.5l-4 6.5" />
          <path d="M7.5 10h9l1.5 6.5c.4 2-1 3.9-3 3.9h-6c-2 0-3.4-1.9-3-3.9z" />
          <path d="M12 13.5v3.5" />
        }
        @case ('farm') {
          <path d="M12 20.5V11" />
          <path d="M12 11c0-3 1.8-5.5 5-6.5.4 3.6-1.4 6.5-5 6.5z" />
          <path d="M12 13.5c-3.2 0-5-2.4-4.7-5.6C10 8.9 12 10.8 12 13.5z" />
          <path d="M6.5 20.5h11" />
        }
        @case ('gold') {
          <circle cx="12" cy="12" r="8.2" />
          <path d="M12 7.5v9M14.4 9.6c-.6-.7-1.5-1-2.4-1-1.4 0-2.4.8-2.4 1.9 0 2.6 4.8 1.4 4.8 4 0 1.1-1 1.9-2.4 1.9-1 0-1.9-.4-2.4-1.1" />
        }
        @case ('damage') {
          <path d="M4 20l7-7M14 4l6 6-9 9-6-6zM15 9l-2-2" />
        }
        @case ('shield') {
          <path d="M12 3.2l7 3v5.2c0 4-2.9 7.4-7 9.4-4.1-2-7-5.4-7-9.4V6.2z" />
          <path d="M12 7.8v8.4" />
        }
        @case ('heal') {
          <path d="M12 20.2S4.5 15.6 4.5 10.2A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.6c0 5.4-7.5 10-7.5 10z" />
          <path d="M8.6 12.2h2l1.1-2 1.3 3.4 1-1.4h1.4" />
        }
        @case ('freeze') {
          <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
          <path d="M12 6.6l-2 -2M12 6.6l2 -2M12 17.4l-2 2M12 17.4l2 2" />
        }
        @case ('vision') {
          <path d="M3 12s3.4-5.4 9-5.4S21 12 21 12s-3.4 5.4-9 5.4S3 12 3 12z" />
          <circle cx="12" cy="12" r="2.4" />
        }
        @case ('streak') {
          <path d="M4 16.5l4.8-5 3.4 3.2L20 7" />
          <path d="M15.4 7H20v4.6" />
        }
        @case ('anchor') {
          <circle cx="12" cy="5.2" r="2.2" />
          <path d="M12 7.4v12.4M8 11h8" />
          <path d="M4.6 14.4c0 3.1 3.3 5.4 7.4 5.4s7.4-2.3 7.4-5.4" />
        }
        @case ('pinata') {
          <path d="M12 4.6c3.6 0 6.4 2.6 6.4 6 0 4.3-3.4 8.8-6.4 8.8s-6.4-4.5-6.4-8.8c0-3.4 2.8-6 6.4-6z" />
          <path d="M12 4.6l-1.6-2.2M12 4.6l1.8-2.2M9.4 10.4h.01M14.6 10.4h.01M9.6 14.6c1.6-1.2 3.2-1.2 4.8 0" />
        }
        @default {
          <path d="M12 3.4c-3.9 0-7 3-7 6.7 0 2.3 1.2 4 2.6 5v3.3c0 1.2 1 2.2 2.2 2.2h4.4c1.2 0 2.2-1 2.2-2.2v-3.3c1.4-1 2.6-2.7 2.6-5 0-3.7-3.1-6.7-7-6.7z" />
          <path d="M9.4 10.2h.01M14.6 10.2h.01M10.6 15.4v4.2M13.4 15.4v4.2" />
        }
      }
    </svg>
  `,
  styleUrl: './medal-icon.component.scss',
})
export class MedalIconComponent {
  readonly icon = input.required<MedalIcon>();
}
