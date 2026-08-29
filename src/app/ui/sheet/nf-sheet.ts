import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  inject,
  input,
  output,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Selector de los controles que pueden recibir foco dentro del panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Sheet — panel anclado al borde inferior de la pantalla, para móvil.
 *
 * Es el hermano de `nf-modal` para la mano: mismo contrato (`@if` para abrir, `(closed)`
 * para pedir cierre) y mismo cableado de accesibilidad —bloqueo del scroll de fondo,
 * trampa de foco, foco devuelto al destruirse—, pero entra desde abajo y ocupa el ancho
 * completo, que es donde llega el pulgar. Un diálogo centrado en una pantalla de 360px
 * es un modal con márgenes; esto es el patrón que la gente ya conoce.
 *
 *   @if (abierto()) {
 *     <nf-sheet title="Filtros" (closed)="cerrar()">
 *       …controles…
 *       <div sheetFoot>…acciones…</div>
 *     </nf-sheet>
 *   }
 *
 * El pie (`[sheetFoot]`) es opcional y se queda fijo abajo mientras el cuerpo hace
 * scroll: es donde va el botón de confirmar, que en un panel largo no puede depender de
 * que el usuario llegue hasta el final.
 */
@Component({
  selector: 'nf-sheet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'nf-sheet-host',
    '(document:keydown.escape)': 'closed.emit()',
    '(keydown)': 'trapFocus($event)',
  },
  template: `
    <div class="nf-sheet__overlay" (click)="closed.emit()">
      <div
        class="nf-sheet"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        (click)="$event.stopPropagation()"
      >
        <!-- Asa: no arrastra (no hay gesto), pero es la señal de «esto es un panel que
             se cierra» que la gente ya lee sin instrucciones. -->
        <span class="nf-sheet__handle" aria-hidden="true"></span>

        <div class="nf-sheet__head">
          <h2 class="nf-sheet__title">{{ title() }}</h2>
          <button
            type="button"
            class="nf-sheet__close"
            aria-label="Cerrar"
            (click)="closed.emit()"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              aria-hidden="true"
              focusable="false"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        <div class="nf-sheet__body">
          <ng-content />
        </div>

        <div class="nf-sheet__foot">
          <ng-content select="[sheetFoot]" />
        </div>
      </div>
    </div>
  `,
  styleUrl: './nf-sheet.scss',
})
export class NfSheet {
  /** Encabezado del panel. Es también su nombre accesible. */
  readonly title = input('');

  /** Petición de cierre (backdrop, Escape o aspa). Cerrar es cosa del consumidor. */
  readonly closed = output<void>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    const doc = inject(DOCUMENT);
    const body = doc.body;
    const restoreFocusTo = doc.activeElement as HTMLElement | null;
    const previousOverflow = body.style.overflow;
    body.style.overflow = 'hidden';

    afterNextRender(() => this.focusable()[0]?.focus());

    inject(DestroyRef).onDestroy(() => {
      body.style.overflow = previousOverflow;
      restoreFocusTo?.focus?.();
    });
  }

  /** Ciclo cerrado de tabulación: el foco no se escapa al fondo inerte. */
  protected trapFocus(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.key !== 'Tab') return;

    const items = this.focusable();
    if (!items.length) return;

    const edge = key.shiftKey ? items[0] : items[items.length - 1];
    if (this.host.nativeElement.ownerDocument.activeElement !== edge) return;

    event.preventDefault();
    (key.shiftKey ? items[items.length - 1] : items[0]).focus();
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
  }
}
