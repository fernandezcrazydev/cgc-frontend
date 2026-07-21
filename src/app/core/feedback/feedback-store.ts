import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FeedbackApi } from './feedback-api';
import { FeedbackReport } from './models';

/**
 * Envío de reportes. No cachea nada (es un dominio de solo escritura), así que
 * del patrón `Session` solo hereda lo que aplica: escritura pesimista, estado
 * `submitting` expuesto como readonly y no-reentrancia (anti doble submit).
 *
 * El diálogo decide los toasts: aquí solo se dice si el servidor confirmó o no.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackStore {
  private readonly api = inject(FeedbackApi);

  private readonly _submitting = signal(false);

  /** Hay un envío en vuelo: la vista deshabilita el botón. */
  readonly submitting = this._submitting.asReadonly();

  /**
   * Envía el reporte. Devuelve `true` si el servidor confirmó y `false` si ya
   * había otro envío en vuelo (anti doble submit); el borrador de la vista sigue
   * intacto en ambos casos.
   *
   * Los fallos **se propagan**: el error del backend es un ProblemDetail con `code`
   * y solo la vista sabe traducirlo (`errorMessage` de `core/http`). Tragárselo aquí
   * obligaría a un mensaje fijo que oculta el motivo real.
   */
  async submit(report: FeedbackReport): Promise<boolean> {
    if (this._submitting()) return false;
    this._submitting.set(true);
    try {
      await firstValueFrom(this.api.submit(report));
      return true;
    } finally {
      this._submitting.set(false);
    }
  }
}
