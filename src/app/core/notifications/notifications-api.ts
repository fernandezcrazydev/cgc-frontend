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

  /** La bandeja durable del usuario, la más reciente primero (orden del backend). */
  list(): Observable<NotificationResponse[]> {
    return this.http.get<NotificationResponse[]>(`${environment.apiUrl}/me/notifications`);
  }

  /** Marca una notificación como leída. 204 sin cuerpo. */
  markRead(notificationId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/me/notifications/${notificationId}/read`,
      null,
    );
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
