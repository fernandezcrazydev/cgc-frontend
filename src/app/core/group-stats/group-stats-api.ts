import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GroupStats, StatsQuery, StatsScope } from './models';

/**
 * Cliente HTTP de las estadísticas agregadas del grupo.
 *
 * Dos peticiones y no nueve: los once bloques de la pantalla son once lecturas del mismo conjunto
 * de partidas, y pedidos por separado acabarían calculados sobre conjuntos distintos sin que nada
 * en la página lo dijese. La otra existe porque los controles de filtro tienen que dibujarse antes
 * de que se pueda pedir un alcance.
 */
@Injectable({ providedIn: 'root' })
export class GroupStatsApi {
  private readonly http = inject(HttpClient);

  /** Qué modalidades y temporadas ha jugado el grupo. Las tres modalidades llegan siempre. */
  getScopes(groupId: string): Observable<StatsScope[]> {
    return this.http.get<StatsScope[]>(`${environment.apiUrl}/groups/${groupId}/stats/scopes`);
  }

  /**
   * El agregado entero de un alcance.
   *
   * `leagueId` solo viaja si lo hay: sin él, el backend contesta todas las temporadas de la
   * modalidad, que es el histórico con el que abre la pantalla. Mandarlo vacío sería pedir una
   * temporada con id en blanco.
   */
  getStats(groupId: string, query: StatsQuery): Observable<GroupStats> {
    const params: Record<string, string> = { preset: query.preset };
    if (query.leagueId) params['leagueId'] = query.leagueId;
    return this.http.get<GroupStats>(`${environment.apiUrl}/groups/${groupId}/stats`, { params });
  }
}
