import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LinkedDevice } from './models';

/**
 * Los dispositivos de escritorio vinculados a la cuenta logueada. Único sitio que conoce la URL.
 *
 * No captura errores ni guarda estado — de eso se encarga `DevicesStore`. El Bearer lo añade
 * `authInterceptor` porque la URL cuelga de `environment.apiUrl`.
 *
 * Recurso bajo `/me`: el dueño sale del token, no de la ruta, así que no hay forma de listar ni
 * revocar los dispositivos de otro. Revocar es `DELETE` por id (idempotente desde el punto de
 * vista del usuario: un id que ya no es suyo responde 404 con `code` DEVICE_NOT_FOUND).
 */
@Injectable({ providedIn: 'root' })
export class DevicesApi {
  private readonly http = inject(HttpClient);

  private readonly url = `${environment.apiUrl}/me/devices`;

  list(): Observable<LinkedDevice[]> {
    return this.http.get<LinkedDevice[]>(this.url);
  }

  revoke(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
