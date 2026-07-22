import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LinkRiotAccountRequest, RiotAccountStatus } from './models';

/**
 * La cuenta de Riot del usuario logueado. Único sitio que conoce la URL.
 *
 * No captura errores ni guarda estado — de eso se encarga `RiotAccountStore`. El Bearer lo
 * añade `authInterceptor` porque la URL cuelga de `environment.apiUrl`.
 *
 * El recurso es un singleton bajo `/me`: no lleva id en la ruta, así que no hay forma de
 * nombrar la cuenta de otro. Vincular es `PUT` (idempotente) y cambiar de cuenta es ese mismo
 * `PUT`, no un `DELETE` + `PUT` que el front tendría que secuenciar.
 */
@Injectable({ providedIn: 'root' })
export class RiotAccountApi {
  private readonly http = inject(HttpClient);

  private readonly url = `${environment.apiUrl}/me/riot-account`;

  status(): Observable<RiotAccountStatus> {
    return this.http.get<RiotAccountStatus>(this.url);
  }

  link(request: LinkRiotAccountRequest): Observable<RiotAccountStatus> {
    return this.http.put<RiotAccountStatus>(this.url, request);
  }

  unlink(): Observable<void> {
    return this.http.delete<void>(this.url);
  }
}
