import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../http/page';
import { ChampionDetail, ChampionSummary, GameDataManifest, GameItem, SummonerSpell } from './models';

/**
 * Único sitio de `core/game-data` que conoce las URLs del catálogo de Data
 * Dragon cacheado en el backend. No captura errores ni guarda estado — de eso
 * se encarga `GameDataStore`; aquí solo se traduce cada endpoint a un
 * Observable tipado. El Bearer lo añade `authInterceptor`.
 *
 * Los objetos (`items`) NO tienen store propio a propósito: es una colección
 * paginada que solo usa el buscador del selector, así que se queda como
 * método suelto aquí (ver CLAUDE.md del módulo).
 */
@Injectable({ providedIn: 'root' })
export class GameDataApi {
  private readonly http = inject(HttpClient);

  /** `version: null` si el backend nunca ha importado — 200 válido, no error. */
  manifest(): Observable<GameDataManifest> {
    return this.http.get<GameDataManifest>(`${environment.apiUrl}/game-data/manifest`);
  }

  /** Array plano de los ~173 campeones: es la excepción consciente al "todo paginado". */
  champions(): Observable<ChampionSummary[]> {
    return this.http.get<ChampionSummary[]>(`${environment.apiUrl}/game-data/champions`);
  }

  /** Detalle de un campeón (splash + las 5 habilidades). 404 `CHAMPION_NOT_FOUND` si no existe. */
  champion(id: number): Observable<ChampionDetail> {
    return this.http.get<ChampionDetail>(`${environment.apiUrl}/game-data/champions/${id}`);
  }

  summonerSpells(): Observable<SummonerSpell[]> {
    return this.http.get<SummonerSpell[]>(`${environment.apiUrl}/game-data/summoner-spells`);
  }

  /** Paginado por offset (`core/http/page.ts`). `q` es opcional: ausente, no filtra. */
  items(page: number, size: number, q?: string): Observable<PageResponse<GameItem>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    return this.http.get<PageResponse<GameItem>>(`${environment.apiUrl}/game-data/items`, { params });
  }
}
