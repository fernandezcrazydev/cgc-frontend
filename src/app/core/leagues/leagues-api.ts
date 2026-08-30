import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CreateLeagueRequest,
  LeaderboardResponse,
  LeaderboardSearchSuggestion,
  LeaderboardSort,
  LeagueResponse,
  SortDirection,
} from './models';

/** Parámetros de página y orden de la tabla. `page` es 0-based (contrato `PageResponse`). */
export interface LeaderboardQuery {
  page: number;
  size: number;
  sort: LeaderboardSort;
  dir: SortDirection;
}

/**
 * Cliente HTTP del módulo de ligas y leaderboard (`/groups/{groupId}/league`,
 * `/groups/{groupId}/leaderboard`).
 */
@Injectable({ providedIn: 'root' })
export class LeaguesApi {
  private readonly http = inject(HttpClient);

  /**
   * Obtiene la liga activa del grupo.
   */
  getActiveLeague(groupId: string): Observable<LeagueResponse> {
    return this.http.get<LeagueResponse>(`${environment.apiUrl}/groups/${groupId}/league`);
  }

  /**
   * Una página de la clasificación, más la liga y el podio (que son de la liga entera).
   */
  getLeaderboard(groupId: string, query: LeaderboardQuery): Observable<LeaderboardResponse> {
    return this.http.get<LeaderboardResponse>(`${environment.apiUrl}/groups/${groupId}/leaderboard`, {
      params: { page: query.page, size: query.size, sort: query.sort, dir: query.dir },
    });
  }

  /**
   * Búsqueda predictiva con resolución de página en servidor.
   *
   * Se le pasa el orden que la tabla está mostrando: la página en la que cae un jugador depende
   * de él, así que resolverla contra un orden fijo mandaría al usuario a una página donde el
   * jugador que buscó no está — que es justo lo que este endpoint existe para evitar.
   */
  searchLeaderboard(
    groupId: string,
    query: string,
    pageSize: number,
    sort: LeaderboardSort,
    dir: SortDirection,
  ): Observable<LeaderboardSearchSuggestion[]> {
    return this.http.get<LeaderboardSearchSuggestion[]>(
      `${environment.apiUrl}/groups/${groupId}/leaderboard/search`,
      { params: { q: query, pageSize, sort, dir } },
    );
  }

  /**
   * Lista todas las ligas del grupo (preparado para multi-liga).
   */
  listLeagues(groupId: string): Observable<LeagueResponse[]> {
    return this.http.get<LeagueResponse[]>(`${environment.apiUrl}/groups/${groupId}/leagues`);
  }

  /**
   * Crea una nueva liga dentro del grupo (requiere rol OWNER o ADMIN).
   */
  createLeague(groupId: string, request: CreateLeagueRequest): Observable<LeagueResponse> {
    return this.http.post<LeagueResponse>(`${environment.apiUrl}/groups/${groupId}/leagues`, request);
  }
}
