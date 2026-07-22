import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { ToastService, ToastVariant } from '../../core/toast';

/**
 * NEXUS//FORGE toast host — pinta la pila de toasts activos en una esquina fija.
 * Basta un `<nf-toast-host />` cerca de la raíz de la app; los toasts se empujan
 * desde cualquier sitio con el {@link ToastService} inyectado.
 *
 * Estructura de tres capas por toast, cada una con un trabajo:
 *   `slot`  → colapsa el hueco (grid 1fr→0fr) para que la pila se recoloque sola.
 *   `clip`  → entra/sale (opacidad + desplazamiento) y recorta durante el colapso.
 *   `toast` → la tarjeta; su transform queda libre para el hover.
 */
@Component({
  selector: 'nf-toast-host',
  standalone: true,
  template: `
    <!-- pointerover/pointerout (no mouseenter/mouseleave): burbujean desde cada
         toast, así que un único par de handlers en el contenedor sobrevive a que
         el toast señalado desaparezca bajo el puntero. -->
    <div
      class="nf-toasts"
      [class.is-paused]="toasts.paused()"
      aria-live="polite"
      (pointerover)="toasts.pause()"
      (pointerout)="toasts.resume()"
      (focusin)="toasts.pause()"
      (focusout)="toasts.resume()"
    >
      @for (t of toasts.toasts(); track t.id) {
        <div class="nf-toast-slot" [class.is-leaving]="t.leaving">
          <div class="nf-toast-clip">
            <div class="nf-toast nf-toast--{{ t.variant }}" [style.--nf-toast-life]="t.durationMs + 'ms'">
              <span class="nf-toast__glyph" aria-hidden="true">{{ glyph(t.variant) }}</span>
              <p class="nf-toast__msg">{{ t.message }}</p>
              <button
                type="button"
                class="nf-toast__close"
                (click)="toasts.dismiss(t.id)"
                aria-label="Cerrar notificación"
              >
                <span aria-hidden="true">✕</span>
              </button>
              <span class="nf-toast__progress" aria-hidden="true"></span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './nf-toast.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NfToastHost {
  readonly toasts = inject(ToastService);

  glyph(variant: ToastVariant): string {
    return variant === 'success' ? '✓' : variant === 'error' ? '✕' : 'ℹ';
  }
}
