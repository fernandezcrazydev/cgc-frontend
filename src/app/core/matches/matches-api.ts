/**
 * Los cinco endpoints del historial de partidas. Único sitio del dominio que conoce
 * `environment.apiUrl`; el Bearer lo añade `authInterceptor` porque la URL cuelga de ahí.
 *
 * No captura errores ni guarda estado: de eso se encarga `MatchHistoryStore`. Aquí solo se
 * traduce «un endpoint» a un Observable tipado.
 *
 * Las dos consultas son tipos distintos a propósito (`GroupMatchQuery` / `PersonalMatchQuery`):
 * los mismos filtros no significan lo mismo en las dos listas, así que el compilador impide
 * mandar `winningSide` a `/me/matches` o `lane` a la lista de grupo. El porqué, en
 * `match-filtering.ts`.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { components } from '../http/api-types';
import { PageResponse } from '../http';
import { GroupMatchQuery, PersonalMatchQuery, PersonalSummaryQuery } from './match-filtering';
import { GroupHistorySummary, Match, MatchDetail, PersonalHistorySummary } from './models';
import {
  MatchMappingContext,
  toGroupSummary,
  toMatch,
  toMatchDetail,
  toPersonalSummary,
} from './match-mapper';

type PageDto = components['schemas']['PageResponseGroupMatchResponse'];
type GroupSummaryDto = components['schemas']['GroupHistorySummaryResponse'];
type PersonalSummaryDto = components['schemas']['PersonalHistorySummaryResponse'];
type MatchDetailDto = components['schemas']['MatchDetailResponse'];

@Injectable({ providedIn: 'root' })
export class MatchesApi {
  private readonly http = inject(HttpClient);

  /** `GET /groups/{groupId}/matches` — el historial del grupo, paginado y filtrado en servidor. */
  groupMatches(
    groupId: string,
    query: GroupMatchQuery,
    ctx: MatchMappingContext,
  ): Observable<PageResponse<Match>> {
    return this.http
      .get<PageDto>(`${environment.apiUrl}/groups/${groupId}/matches`, { params: paramsOf(query) })
      .pipe(map((dto) => toPage(dto, ctx)));
  }

  /**
   * `GET /groups/{groupId}/matches/summary` — las tres tarjetas de cabecera.
   *
   * **No acepta filtros**, al contrario que el resumen personal: describe el grupo entero, no la
   * lista que tiene debajo. La cabecera lo dice para que no parezca que los filtros no funcionan.
   */
  groupSummary(groupId: string): Observable<GroupHistorySummary> {
    return this.http
      .get<GroupSummaryDto>(`${environment.apiUrl}/groups/${groupId}/matches/summary`)
      .pipe(map(toGroupSummary));
  }

  /** `GET /me/matches` — mi historial, que cruza grupos. */
  myMatches(query: PersonalMatchQuery, ctx: MatchMappingContext): Observable<PageResponse<Match>> {
    return this.http
      .get<PageDto>(`${environment.apiUrl}/me/matches`, { params: paramsOf(query) })
      .pipe(map((dto) => toPage(dto, ctx)));
  }

  /**
   * `GET /me/matches/summary` — mi recuento, y también el del cruce: acepta los MISMOS
   * parámetros que el listado, así que sin `with` dice «cómo me ha ido», con él «cómo nos ha
   * ido cuando coincidimos», y con la relación encima «juntos» o «enfrentados».
   */
  mySummary(query: PersonalSummaryQuery): Observable<PersonalHistorySummary> {
    return this.http
      .get<PersonalSummaryDto>(`${environment.apiUrl}/me/matches/summary`, {
        params: paramsOf(query),
      })
      .pipe(map(toPersonalSummary));
  }

  /**
   * `GET /matches/{matchId}` — el detalle, con marcador y objetivos.
   *
   * Un `404 MATCH_NOT_FOUND` cubre tanto «no existe» como «es de un grupo del que no eres»,
   * y es a propósito: un 403 confirmaría que el id existe.
   */
  detail(matchId: string, ctx: MatchMappingContext): Observable<MatchDetail> {
    return this.http
      .get<MatchDetailDto>(`${environment.apiUrl}/matches/${matchId}`)
      .pipe(map((dto) => toMatchDetail(dto, ctx)));
  }
}

function toPage(dto: PageDto, ctx: MatchMappingContext): PageResponse<Match> {
  return {
    content: (dto.content ?? []).map((row) => toMatch(row, ctx)),
    page: dto.page ?? 0,
    size: dto.size ?? 0,
    totalElements: dto.totalElements ?? 0,
    totalPages: dto.totalPages ?? 0,
  };
}

/** Un parámetro ausente no viaja. Mandar `championId=all` sería mandar un filtro que no existe. */
function paramsOf(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}
