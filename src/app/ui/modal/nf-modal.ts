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
import { NfWindow, NfWindowAccent } from '../window/nf-window';

/** Selector de los controles que pueden recibir foco dentro del diálogo. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * NEXUS//FORGE Modal — diálogo centrado sobre un fondo difuminado, con una
 * `nf-window` como marco.
 *
 * El consumidor controla la apertura con `@if`; el modal solo *pide* cerrarse
 * (backdrop, Escape) mediante `(closed)`, para que la vista pueda vetar el
 * cierre si hay una escritura en vuelo.
 *
 *   @if (abierto()) {
 *     <nf-modal title="vincular_riot.exe" (closed)="cerrar()">…</nf-modal>
 *   }
 *
 * Mientras vive: bloquea el scroll de fondo, atrapa el foco y lo devuelve al
 * elemento que lo tenía al destruirse.
 */
@Component({
  selector: 'nf-modal',
  standalone: true,
  imports: [NfWindow],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'nf-modal-host',
    '(document:keydown.escape)': 'closed.emit()',
    '(keydown)': 'trapFocus($event)',
  },
  template: `
    <div class="nf-modal__overlay" (click)="closed.emit()">
      <div
        class="nf-modal"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="title()"
        [style.max-width]="width()"
        (click)="$event.stopPropagation()"
      >
        <nf-window [title]="title()" [accent]="accent()" [bodyPadding]="bodyPadding()">
          <ng-content />
        </nf-window>
      </div>
    </div>
  `,
  styleUrl: './nf-modal.scss',
})
export class NfModal {
  /** Título de la barra de la ventana (convención `*.exe`). */
  readonly title = input('ventana.exe');
  readonly accent = input<NfWindowAccent>('cyan');
  readonly bodyPadding = input('22px 22px 26px');
  /** Ancho máximo del diálogo (cualquier medida CSS). */
  readonly width = input('460px');

  /** Petición de cierre (backdrop o Escape). Cerrar es cosa del consumidor. */
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

    // solo intervenimos en los extremos: en el resto, el Tab nativo ya hace lo correcto
    const edge = key.shiftKey ? items[0] : items[items.length - 1];
    if (this.host.nativeElement.ownerDocument.activeElement !== edge) return;

    event.preventDefault();
    (key.shiftKey ? items[items.length - 1] : items[0]).focus();
  }

  private focusable(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>(FOCUSABLE));
  }
}
