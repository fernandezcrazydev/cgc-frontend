import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserSearchResult } from './models';

/**
 * Único sitio que conoce la URL del directorio de usuarios. Lo usa el buscador del cuadro
 * "invitar a alguien" del detalle de grupo: tiene un nombre de Discord y necesita el `userId`
 * (UUID) que pide la API de invitaciones.
 *
 * El Bearer lo añade `authInterceptor` porque `environment.apiUrl` está en `secureRoutes`.
 */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly http = inject(HttpClient);

  /** Busca usuarios por nombre de Discord (el backend limita y hace case-insensitive). */
  search(query: string): Observable<UserSearchResult[]> {
    return this.http.get<UserSearchResult[]>(`${environment.apiUrl}/users`, {
      params: { query },
    });
  }
}
