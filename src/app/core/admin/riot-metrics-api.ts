import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RiotApiMetrics, RiotApiUsage } from './admin-models';

/**
 * Único sitio que conoce las URLs de observabilidad de la API de Riot. Sin estado y sin
 * try/catch: eso es cosa de los stores. El Bearer lo pone `authInterceptor` y el backend
 * revalida el rol ADMIN en los dos endpoints.
 */
@Injectable({ providedIn: 'root' })
export class RiotMetricsApi {
  private readonly http = inject(HttpClient);

  /**
   * La ventana deslizante ahora mismo. Se lee de memoria en el backend, no de la BD, porque
   * cada pestaña de admin abierta la pide cada pocos segundos.
   */
  usage(): Observable<RiotApiUsage> {
    return this.http.get<RiotApiUsage>(`${environment.apiUrl}/admin/riot/usage`);
  }

  /**
   * Las métricas agregadas de las últimas `hours` horas. El backend acepta de 1 a 168 (la
   * retención del log); fuera de ese rango responde 400 con `INVALID_METRICS_WINDOW`.
   */
  metrics(hours: number): Observable<RiotApiMetrics> {
    return this.http.get<RiotApiMetrics>(`${environment.apiUrl}/admin/riot/metrics`, {
      params: new HttpParams().set('hours', hours),
    });
  }
}
