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
  SanctionPlayerRequest,
  SortDirection,
} from './models';

/** Parámetros de página y orden de la tabla. `page` es 0-based (contrato `PageResponse`). */
export interface LeaderboardQuery {
  page: number;
  size: number;
  sort: LeaderboardSort;
  dir: SortDirection;
  /** Temporada a consultar. `null` = la activa, que es el caso de siempre. */
  leagueId?: string | null;
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
    // `leagueId` solo viaja si lo hay: el backend lo trata como opcional y sin él sirve la
    // temporada activa. Mandarlo vacío sería pedir una liga con id en blanco.
    const params: Record<string, string | number> = {
      page: query.page,
      size: query.size,
      sort: query.sort,
      dir: query.dir,
    };
    if (query.leagueId) params['leagueId'] = query.leagueId;
    return this.http.get<LeaderboardResponse>(`${environment.apiUrl}/groups/${groupId}/leaderboard`, {
      params,
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
    leagueId?: string | null,
  ): Observable<LeaderboardSearchSuggestion[]> {
    // La MISMA temporada que la tabla: resolver la página contra la liga activa mientras se mira
    // una pasada mandaría al usuario a una página donde ese jugador no está.
    const params: Record<string, string | number> = { q: query, pageSize, sort, dir };
    if (leagueId) params['leagueId'] = leagueId;
    return this.http.get<LeaderboardSearchSuggestion[]>(
      `${environment.apiUrl}/groups/${groupId}/leaderboard/search`,
      { params },
    );
  }

  /**
   * Lista todas las ligas del grupo (preparado para multi-liga).
   */
  listLeagues(groupId: string): Observable<LeagueResponse[]> {
    return this.http.get<LeagueResponse[]>(`${environment.apiUrl}/groups/${groupId}/leagues`);
  }

  /**
   * Aparta a un jugador de la liga activa. Requiere OWNER o ADMIN del grupo; el backend lo
   * revalida con `@groupSecurity.isAdmin`, así que esconder el control es solo comodidad.
   */
  sanction(groupId: string, userId: string, request: SanctionPlayerRequest): Observable<void> {
    return this.http.put<void>(
      `${environment.apiUrl}/groups/${groupId}/leaderboard/${userId}/sanction`,
      request,
    );
  }

  /** Devuelve al jugador a la competición. Idempotente: levantar lo ya levantado no es un error. */
  liftSanction(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/groups/${groupId}/leaderboard/${userId}/sanction`,
    );
  }

  /**
   * Crea una nueva liga dentro del grupo (requiere rol OWNER o ADMIN).
   */
  createLeague(groupId: string, request: CreateLeagueRequest): Observable<LeagueResponse> {
    return this.http.post<LeagueResponse>(`${environment.apiUrl}/groups/${groupId}/leagues`, request);
  }
}
