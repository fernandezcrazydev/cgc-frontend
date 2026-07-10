import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CurrentUser } from './current-user';

/**
 * Único sitio que conoce las URLs de la API de usuario. Nadie más monta strings
 * con `environment.apiUrl`: si la ruta o la versión cambian, se cambian aquí.
 *
 * No captura errores ni guarda estado — de eso se encarga `Session`. Aquí solo
 * se traduce "un endpoint" a "un Observable tipado".
 */
@Injectable({ providedIn: 'root' })
export class UserApi {
  private readonly http = inject(HttpClient);

  /**
   * El Bearer lo inyecta `authInterceptor` porque `environment.apiUrl` está en
   * `secureRoutes`. Sin token válido el backend responde 401; si el usuario no
   * existe en la BD, 404.
   */
  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${environment.apiUrl}/me`);
  }
}
