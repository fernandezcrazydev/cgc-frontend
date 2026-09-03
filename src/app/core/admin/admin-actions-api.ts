import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RiotAccountRefreshReport } from './admin-models';

/**
 * Único sitio que conoce las URLs de las acciones puntuales de administración (el
 * directorio `/app/admin`). No captura errores ni guarda estado — eso lo hace la vista que
 * llama; aquí solo se traduce cada endpoint a un Observable tipado. El Bearer lo pone
 * `authInterceptor`; el backend revalida el rol ADMIN en cada endpoint.
 */
@Injectable({ providedIn: 'root' })
export class AdminActionsApi {
  private readonly http = inject(HttpClient);

  /**
   * Dispara ya el refresco nocturno de cuentas de Riot (icono + rango), fuera del cron.
   *
   * La ruta cambió con la issue #46 del backend: era `/admin/riot/profile-icons/sync` y el
   * barrido detrás ya no va solo de iconos. Puede tardar segundos por cuenta — el backend se
   * marca un ritmo a propósito para no comerse la cuota de Riot que necesita quien está
   * montando una sala; no es un cuelgue.
   */
  refreshRiotAccounts(): Observable<RiotAccountRefreshReport> {
    return this.http.post<RiotAccountRefreshReport>(
      `${environment.apiUrl}/admin/riot/accounts/refresh`,
      {},
    );
  }
}
