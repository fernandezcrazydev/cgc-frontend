import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../http';
import {
  SecurityAuditClient,
  SecurityAuditEvent,
  SecurityAuditFilters,
  SecurityAuditSummary,
} from './security-audit-models';

/**
 * Único sitio que conoce las URLs del log de seguridad. No captura errores ni guarda estado —
 * de eso se encarga `SecurityAuditStore`. El Bearer lo pone `authInterceptor` y el backend
 * revalida el rol ADMIN, así que esto solo funciona para un admin de verdad.
 */
@Injectable({ providedIn: 'root' })
export class SecurityAuditApi {
  private readonly http = inject(HttpClient);

  private get base(): string {
    return `${environment.apiUrl}/admin/security-audit`;
  }

  /** Una página del log. Un filtro ausente no viaja: el backend entonces no filtra por él. */
  list(
    filters: SecurityAuditFilters,
    page: number,
    size: number,
  ): Observable<PageResponse<SecurityAuditEvent>> {
    const params = this.withFilters(filters).set('page', page).set('size', size);
    return this.http.get<PageResponse<SecurityAuditEvent>>(this.base, { params });
  }

  /**
   * Un evento suelto. Un 404 aquí no significa solo «no existió»: con retención de 90 días
   * también puede querer decir «se purgó», y son respuestas distintas al investigar.
   */
  detail(id: number): Observable<SecurityAuditEvent> {
    return this.http.get<SecurityAuditEvent>(`${this.base}/${encodeURIComponent(String(id))}`);
  }

  /** Totales por tipo dentro de la ventana filtrada. */
  summary(filters: SecurityAuditFilters): Observable<SecurityAuditSummary> {
    return this.http.get<SecurityAuditSummary>(`${this.base}/summary`, {
      params: this.withFilters(filters),
    });
  }

  /** Las direcciones más activas, la que más arriba. El backend recorta `limit` a 100. */
  topClients(filters: SecurityAuditFilters, limit: number): Observable<SecurityAuditClient[]> {
    return this.http.get<SecurityAuditClient[]>(`${this.base}/top-clients`, {
      params: this.withFilters(filters).set('limit', limit),
    });
  }

  /**
   * Los filtros comunes a los cuatro endpoints. Un valor vacío se omite en vez de mandarse:
   * `clientIp=''` llegaría al backend como un filtro literal por cadena vacía, y eso es un 400
   * por IP inválida en lugar de «no filtres por dirección».
   */
  private withFilters(filters: SecurityAuditFilters): HttpParams {
    let params = new HttpParams();
    if (filters.kind) params = params.set('kind', filters.kind);
    if (filters.clientIp) params = params.set('clientIp', filters.clientIp);
    if (filters.userId) params = params.set('userId', filters.userId);
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    return params;
  }
}
