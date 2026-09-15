import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChampionBoard, ChampionStats } from './models';

export interface ChampionStatsSource {
  board(groupId: string | null): Observable<ChampionBoard>;
  stats(groupId: string | null, championId: number): Observable<ChampionStats | null>;
}

/**
 * Cliente HTTP para las estadísticas y metagame de campeones.
 * ÚNICO sitio de core/champions que construye URLs con environment.apiUrl.
 *
 * BACKEND NOTE: sustituirá al suplente `champion-stats-mock.ts` cuando los endpoints existan:
 * - GET /api/v1/groups/{groupId}/champions
 * - GET /api/v1/groups/{groupId}/champions/{championId}
 * - GET /api/v1/me/champions/{championId}
 */
@Injectable({ providedIn: 'root' })
export class ChampionStatsApi implements ChampionStatsSource {
  private readonly http = inject(HttpClient);

  /** Tablero de metagame del grupo (o global si groupId es null). */
  board(groupId: string | null): Observable<ChampionBoard> {
    const url = groupId
      ? `${environment.apiUrl}/groups/${groupId}/champions`
      : `${environment.apiUrl}/me/champions`;
    return this.http.get<ChampionBoard>(url);
  }

  /** Ficha detallada de estadísticas de un campeón. */
  stats(groupId: string | null, championId: number): Observable<ChampionStats | null> {
    const url = groupId
      ? `${environment.apiUrl}/groups/${groupId}/champions/${championId}`
      : `${environment.apiUrl}/me/champions/${championId}`;
    return this.http.get<ChampionStats>(url);
  }
}
