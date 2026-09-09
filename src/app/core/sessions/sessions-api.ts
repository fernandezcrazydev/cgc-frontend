import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActiveSession } from './models';

/**
 * Las sesiones vivas de la cuenta logueada. Único sitio que conoce la URL.
 *
 * No captura errores ni guarda estado — de eso se encarga `SessionsStore`. El Bearer lo añade
 * `authInterceptor` porque la URL cuelga de `environment.apiUrl`.
 *
 * Recurso bajo `/me`: el dueño sale del token, no de la ruta, así que no hay forma de listar ni
 * cerrar las sesiones de otro. Cerrar es `DELETE` por id; un id ajeno o inexistente responde 404
 * con `code` SESSION_NOT_FOUND (el mismo para ambos, para que no se pueda sondear qué ids
 * existen), y la sesión desde la que se llama responde 409 CURRENT_SESSION_NOT_REVOCABLE.
 */
@Injectable({ providedIn: 'root' })
export class SessionsApi {
  private readonly http = inject(HttpClient);

  private readonly url = `${environment.apiUrl}/me/sessions`;

  list(): Observable<ActiveSession[]> {
    return this.http.get<ActiveSession[]>(this.url);
  }

  close(id: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${encodeURIComponent(id)}`);
  }
}
