import { ChangeDetectionStrategy, Component, ViewEncapsulation, input, output } from '@angular/core';

/** Tono del toast. Se nombra por lo que significa, nunca por el color que salga hoy. */
export type NfToastVariant = 'success' | 'error' | 'info';

/**
 * Un toast a pintar. Es una copia deliberada de `Toast` (`core/toast.ts`): `ui/` no
 * importa de nadie, y al ser interfaces estructuralmente idénticas TypeScript acepta la
 * de `core/` sin conversión. La de `core/` es la que manda si el contrato cambia.
 */
export interface NfToastItem {
  id: number;
  message: string;
  variant: NfToastVariant;
  /** Vida útil total en ms; el host la usa para sincronizar la barra de progreso. */
  durationMs: number;
  /** Marcado para cerrarse: sigue en la lista mientras dura la animación de salida. */
  leaving: boolean;
}

/**
 * toast host — pinta la pila de toasts activos en una esquina fija.
 *
 * Es una primitiva presentacional: **no inyecta el `ToastService`**, recibe la pila y
 * emite las intenciones. Antes lo inyectaba, y era la única dependencia `ui/ → core/` del
 * repo, prohibida por la dirección de capas (`npm run arch`, regla `layers`). El cableado
 * vive donde toca, en el shell:
 *
 *   <nf-toast-host
 *     [toasts]="toasts.toasts()"
 *     [paused]="toasts.paused()"
 *     (dismiss)="toasts.dismiss($event)"
 *     (pause)="toasts.pause()"
 *     (resume)="toasts.resume()" />
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
      [class.is-paused]="paused()"
      aria-live="polite"
      (pointerover)="pause.emit()"
      (pointerout)="resume.emit()"
      (focusin)="pause.emit()"
      (focusout)="resume.emit()"
    >
      @for (t of toasts(); track t.id) {
        <div class="nf-toast-slot" [class.is-leaving]="t.leaving">
          <div class="nf-toast-clip">
            <div class="nf-toast nf-toast--{{ t.variant }}" [style.--nf-toast-life]="t.durationMs + 'ms'">
              <span class="nf-toast__glyph" aria-hidden="true">{{ glyph(t.variant) }}</span>
              <p class="nf-toast__msg">{{ t.message }}</p>
              <button
                type="button"
                class="nf-toast__close"
                (click)="dismiss.emit(t.id)"
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
  readonly toasts = input<readonly NfToastItem[]>([]);
  /** Cierto mientras el puntero o el foco están sobre la pila: congela las barras. */
  readonly paused = input(false);

  readonly dismiss = output<number>();
  readonly pause = output<void>();
  readonly resume = output<void>();

  glyph(variant: NfToastVariant): string {
    return variant === 'success' ? '✓' : variant === 'error' ? '✕' : 'ℹ';
  }
}
