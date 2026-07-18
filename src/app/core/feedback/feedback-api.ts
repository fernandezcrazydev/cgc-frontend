import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FeedbackReport } from './models';

/**
 * Envío de reportes de los usuarios.
 *
 * Único sitio que conoce la URL de `POST /api/v1/feedback`. No captura errores ni guarda
 * estado — de eso se encarga `FeedbackStore`; aquí solo se traduce "un endpoint" a un
 * Observable tipado. El Bearer lo añade `authInterceptor` porque la URL cuelga de
 * `environment.apiUrl`.
 *
 * El servidor genera id, timestamp y autor (del bearer): el cuerpo es exactamente el
 * `FeedbackReport` que arma el diálogo, y la respuesta (`{ id }`) no le hace falta a nadie,
 * así que se descarta para mantener la firma `Observable<void>` que ya usan store y vista.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackApi {
  private readonly http = inject(HttpClient);

  submit(report: FeedbackReport): Observable<void> {
    return this.http
      .post<{ id: string }>(`${environment.apiUrl}/feedback`, report)
      .pipe(map(() => void 0));
  }
}
