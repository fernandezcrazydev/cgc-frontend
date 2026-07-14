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
   * Envía el reporte. Devuelve `false` si falló o si ya había otro envío en
   * vuelo; en ese caso el borrador de la vista sigue intacto para reintentar.
   */
  async submit(report: FeedbackReport): Promise<boolean> {
    if (this._submitting()) return false;
    this._submitting.set(true);
    try {
      await firstValueFrom(this.api.submit(report));
      return true;
    } catch {
      return false;
    } finally {
      this._submitting.set(false);
    }
  }
}
