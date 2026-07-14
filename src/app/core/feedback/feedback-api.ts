import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { FeedbackReport } from './models';

/**
 * Envío de reportes de los usuarios.
 *
 * PLACEHOLDER: todavía no hay endpoint, así que el envío es un mock con latencia.
 * Es el ÚNICO fichero del dominio que sabe que el envío es falso: el store y el
 * diálogo ya trabajan contra la firma definitiva (Observable, latencia, fallo).
 *
 * BACKEND NOTE: al migrar, este fichero inyecta `HttpClient` y hace
 * `POST ${environment.apiUrl}/feedback` con el `FeedbackReport` como body; el
 * servidor genera id, timestamp y autor (del bearer). La firma no cambia, así que
 * ni el store ni la vista se tocan.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackApi {
  /** Latencia simulada: obliga al diálogo a tratar de verdad el estado `submitting`. */
  private static readonly LATENCY_MS = 600;

  submit(report: FeedbackReport): Observable<void> {
    // Sin backend, el reporte se perdería sin dejar rastro. Al menos que sea
    // visible en dev mientras dure el mock.
    console.info('[feedback] reporte (mock, aún sin backend):', report);
    return of(void 0).pipe(delay(FeedbackApi.LATENCY_MS));
  }
}
