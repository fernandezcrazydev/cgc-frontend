import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FeedbackDetail,
  FeedbackListFilters,
  FeedbackSummary,
  PageResponse,
  UpdateFeedbackRequest,
} from './admin-models';

/**
 * Único sitio que conoce las URLs de administración de feedback. No captura errores ni
 * guarda estado — de eso se encarga `FeedbackAdminStore`; aquí solo se traduce cada
 * endpoint a un Observable tipado. El Bearer lo pone `authInterceptor`; el backend revalida
 * el rol ADMIN, así que esto solo funciona para un admin real.
 */
@Injectable({ providedIn: 'root' })
export class FeedbackAdminApi {
  private readonly http = inject(HttpClient);

  /** Lista paginada con filtros opcionales. Un filtro ausente no viaja: el backend no filtra por él. */
  list(filters: FeedbackListFilters, page: number, size: number): Observable<PageResponse<FeedbackSummary>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.kind) params = params.set('kind', filters.kind);
    if (filters.area) params = params.set('area', filters.area);
    return this.http.get<PageResponse<FeedbackSummary>>(`${environment.apiUrl}/admin/feedback`, { params });
  }

  /** Detalle completo de un reporte. 404 si no existe. */
  detail(id: string): Observable<FeedbackDetail> {
    return this.http.get<FeedbackDetail>(`${environment.apiUrl}/admin/feedback/${id}`);
  }

  /** Mueve estado y/o nota interna. 409 si la transición es ilegal. Devuelve el detalle actualizado. */
  update(id: string, body: UpdateFeedbackRequest): Observable<FeedbackDetail> {
    return this.http.patch<FeedbackDetail>(`${environment.apiUrl}/admin/feedback/${id}`, body);
  }
}
