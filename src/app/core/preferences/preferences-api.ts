import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RolePreferences, UpdateRolePreferencesRequest } from './models';

/**
 * Único sitio que conoce las URLs de los roles preferidos. No captura errores ni guarda
 * estado — de eso se encarga `PreferencesStore`; aquí solo se traduce "un endpoint" a "un
 * Observable tipado".
 *
 * El Bearer lo añade `authInterceptor` porque `environment.apiUrl` está en `secureRoutes`.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesApi {
  private readonly http = inject(HttpClient);

  /** Los roles del usuario logueado. Quien nunca ha elegido recibe `{ roles: [], primary: null }`. */
  get(): Observable<RolePreferences> {
    return this.http.get<RolePreferences>(`${environment.apiUrl}/me/preferences`);
  }

  /** Escritura completa (PUT): el servidor devuelve el estado que ha quedado guardado. */
  update(prefs: UpdateRolePreferencesRequest): Observable<RolePreferences> {
    return this.http.put<RolePreferences>(`${environment.apiUrl}/me/preferences`, prefs);
  }
}
