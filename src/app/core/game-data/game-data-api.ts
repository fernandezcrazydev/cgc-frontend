import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../http/page';
import { ChampionDetail, ChampionSummary, GameDataManifest, GameItem, Perk, SummonerSpell } from './models';

/**
 * Único sitio de `core/game-data` que conoce las URLs del catálogo de Data
 * Dragon cacheado en el backend. No captura errores ni guarda estado — de eso
 * se encarga `GameDataStore`; aquí solo se traduce cada endpoint a un
 * Observable tipado. El Bearer lo añade `authInterceptor`.
 *
 * Los objetos (`items`) se cargan enteros en `GameDataStore` de forma perezosa
 * barriendo las páginas de `items(page, size)` la primera vez que se consulta
 * un objeto por id (F5.5-19: no hay endpoint `/items/{id}` y la ficha de campeón
 * necesita resolver objetos por id para la tarjeta de builds). El selector
 * sigue pudiendo usar la búsqueda paginada con `q` a través de este API.
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

  /** Las ~103 runas más los 5 árboles, en un array plano: misma excepción consciente que los campeones. */
  perks(): Observable<Perk[]> {
    return this.http.get<Perk[]>(`${environment.apiUrl}/game-data/perks`);
  }

  /** Paginado por offset (`core/http/page.ts`). `q` es opcional: ausente, no filtra. */
  items(page: number, size: number, q?: string): Observable<PageResponse<GameItem>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (q) params = params.set('q', q);
    return this.http.get<PageResponse<GameItem>>(`${environment.apiUrl}/game-data/items`, { params });
  }
}
