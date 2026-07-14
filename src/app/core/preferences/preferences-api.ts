import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { RolePreferences } from './models';

/**
 * Acceso a las preferencias del jugador.
 *
 * PLACEHOLDER: hoy no hay endpoint, así que el cuerpo de los métodos es un mock
 * en memoria. Es el ÚNICO fichero del dominio que sabe que los datos son falsos:
 * el store y las vistas ya trabajan contra la firma definitiva (Observable,
 * latencia, posibilidad de fallo).
 *
 * BACKEND NOTE: al migrar, este fichero pasa a inyectar `HttpClient` y a llamar a
 * `GET/PUT ${environment.apiUrl}/me/preferences`, y `MOCK_PREFERENCES` se borra.
 * Las firmas no cambian, así que ni el store ni la vista se tocan.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesApi {
  /** Semilla del mock. Vive aquí (y solo aquí) para poder borrarla de un tirón. */
  private mock: RolePreferences = { roles: ['JUNGLA', 'MID'], primary: 'MID' };

  /** Latencia simulada: obliga a las vistas a tratar de verdad el estado `loading`. */
  private static readonly LATENCY_MS = 400;

  get(): Observable<RolePreferences> {
    return of(this.clone(this.mock)).pipe(delay(PreferencesApi.LATENCY_MS));
  }

  /** Escritura completa (PUT): el servidor devuelve el estado que ha quedado guardado. */
  update(prefs: RolePreferences): Observable<RolePreferences> {
    this.mock = this.clone(prefs);
    return of(this.clone(this.mock)).pipe(delay(PreferencesApi.LATENCY_MS));
  }

  /** Copia defensiva: sin backend, el mock y el store compartirían el mismo array. */
  private clone(p: RolePreferences): RolePreferences {
    return { roles: [...p.roles], primary: p.primary };
  }
}
