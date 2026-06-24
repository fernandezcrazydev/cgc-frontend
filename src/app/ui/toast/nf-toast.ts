import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ToastService, ToastVariant } from '../../core/toast';

/**
 * NEXUS//FORGE toast host — renders the active toast stack in a fixed corner.
 * Drop a single `<nf-toast-host />` near the app root; push toasts from anywhere
 * via the injected {@link ToastService}.
 */
@Component({
  selector: 'nf-toast-host',
  standalone: true,
  template: `
    <div class="nf-toasts" aria-live="polite" aria-atomic="true">
      @for (t of toasts.toasts(); track t.id) {
        <button
          type="button"
          class="nf-toast nf-toast--{{ t.variant }}"
          (click)="toasts.dismiss(t.id)"
          aria-label="Cerrar notificación"
        >
          <span class="nf-toast__glyph">{{ glyph(t.variant) }}</span>
          <span class="nf-toast__msg nf-mono">{{ t.message }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './nf-toast.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfToastHost {
  readonly toasts = inject(ToastService);

  glyph(variant: ToastVariant): string {
    return variant === 'success' ? '✓' : variant === 'error' ? '✕' : 'ℹ';
  }
}
