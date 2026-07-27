import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RiotProfileIconSyncReport } from './admin-models';

/**
 * Único sitio que conoce las URLs de las acciones puntuales de administración (el
 * directorio `/app/admin`). No captura errores ni guarda estado — eso lo hace la vista que
 * llama; aquí solo se traduce cada endpoint a un Observable tipado. El Bearer lo pone
 * `authInterceptor`; el backend revalida el rol ADMIN en cada endpoint.
 */
@Injectable({ providedIn: 'root' })
export class AdminActionsApi {
  private readonly http = inject(HttpClient);

  /** Dispara ya la sincronización de iconos de perfil de Riot (fuera del cron nocturno). */
  syncRiotProfileIcons(): Observable<RiotProfileIconSyncReport> {
    return this.http.post<RiotProfileIconSyncReport>(
      `${environment.apiUrl}/admin/riot/profile-icons/sync`,
      {},
    );
  }
}
