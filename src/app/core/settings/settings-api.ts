import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UpdateUserSettingsRequest, UserSettings } from './models';

/**
 * Único sitio que conoce las URLs de los ajustes de cuenta. No captura errores ni guarda
 * estado — de eso se encarga `SettingsStore`; aquí solo se traduce "un endpoint" a "un
 * Observable tipado".
 *
 * El Bearer lo añade `authInterceptor` porque `environment.apiUrl` está en `secureRoutes`.
 */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly http = inject(HttpClient);

  /** Los ajustes del usuario logueado. Quien nunca ha guardado nada recibe los valores por defecto. */
  get(): Observable<UserSettings> {
    return this.http.get<UserSettings>(`${environment.apiUrl}/me/settings`);
  }

  /** Escritura completa (PUT): el servidor devuelve el estado que ha quedado guardado. */
  update(settings: UpdateUserSettingsRequest): Observable<UserSettings> {
    return this.http.put<UserSettings>(`${environment.apiUrl}/me/settings`, settings);
  }
}
