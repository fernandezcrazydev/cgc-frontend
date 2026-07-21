import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationResponse } from './models';

/**
 * Único sitio que conoce las URLs de la API de notificaciones. Nadie más monta strings
 * con `environment.apiUrl`. No captura errores ni guarda estado — de eso se encarga
 * `NotificationsStore`; aquí solo se traduce "un endpoint" a "un Observable tipado".
 *
 * El Bearer lo añade `authInterceptor` porque `environment.apiUrl` está en `secureRoutes`.
 * El stream SSE es la excepción: NO pasa por `HttpClient` (lo abre un `fetch` que fija el
 * Bearer a mano), así que aquí solo se expone su URL — la conexión vive en el store.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);

  /**
   * Una página de la bandeja durable del usuario, la más reciente primero (orden del
   * backend). Paginación por offset: `page` 0-based, `size` elementos por página.
   */
  list(page = 0, size = 30): Observable<NotificationResponse[]> {
    return this.http.get<NotificationResponse[]>(`${environment.apiUrl}/me/notifications`, {
      params: { page, size },
    });
  }

  /** Marca una notificación como leída. 204 sin cuerpo. */
  markRead(notificationId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/me/notifications/${notificationId}/read`,
      null,
    );
  }

  /** Marca TODA la bandeja como leída en una sola llamada (sin fan-out). 204 sin cuerpo. */
  markAllRead(): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/me/notifications/read-all`, null);
  }

  /** Borra una notificación de la bandeja. 404 si no existe o no es del llamante. 204 sin cuerpo. */
  delete(notificationId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/me/notifications/${notificationId}`);
  }

  /**
   * URL del stream SSE en vivo. El store la usa con `openNotificationStream` (fetch con
   * Bearer); no es un `HttpClient` porque el navegador no puede leer un `EventSource`
   * autenticado por cabecera.
   */
  get streamUrl(): string {
    return `${environment.apiUrl}/me/notifications/stream`;
  }
}
