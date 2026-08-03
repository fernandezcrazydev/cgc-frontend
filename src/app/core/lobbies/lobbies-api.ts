import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageResponse } from '../http';
import { CreateLobbyRequest, LobbyResponse } from './models';

/**
 * Único sitio que conoce las URLs de la API de convocatorias. Nadie más monta strings con
 * `environment.apiUrl`. No captura errores ni guarda estado — de eso se encarga `LobbiesStore`.
 *
 * El Bearer lo añade `authInterceptor` porque `environment.apiUrl` está en `secureRoutes`.
 */
@Injectable({ providedIn: 'root' })
export class LobbiesApi {
  private readonly http = inject(HttpClient);

  /**
   * Convoca una partida en el grupo proponiendo una o varias horas. Cualquier miembro puede;
   * que dependiera de una persona concreta era la fricción que esto viene a quitar.
   *
   * 400 `SLOT_IN_THE_PAST` si alguna hora ya pasó, 422 si la lista está vacía o pasa de 8.
   */
  create(groupId: string, body: CreateLobbyRequest): Observable<LobbyResponse> {
    return this.http.post<LobbyResponse>(`${environment.apiUrl}/groups/${groupId}/lobbies`, body);
  }

  /**
   * Las convocatorias del grupo, de la más reciente a la más antigua. Paginado en SERVIDOR
   * (`?page=&size=`, `page` 0-based), igual que el roster.
   */
  listForGroup(groupId: string, page: number, size: number): Observable<PageResponse<LobbyResponse>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<LobbyResponse>>(
      `${environment.apiUrl}/groups/${groupId}/lobbies`,
      { params },
    );
  }

  /** Una convocatoria con sus franjas y quién está en cada una. 403 si no eres del grupo. */
  detail(lobbyId: string): Observable<LobbyResponse> {
    return this.http.get<LobbyResponse>(`${environment.apiUrl}/lobbies/${lobbyId}`);
  }

  /**
   * "Puedo a esa hora". Idempotente en el backend, y conserva la posición original en la cola:
   * un doble toque no cuesta la plaza.
   *
   * Devuelve la convocatoria entera, no 204: apuntarse cambia lo que ven los demás —puede ser
   * justo la acción que confirma la partida— así que el estado nuevo hace falta igualmente.
   */
  signUp(lobbyId: string, slotId: string): Observable<LobbyResponse> {
    return this.http.post<LobbyResponse>(
      `${environment.apiUrl}/lobbies/${lobbyId}/slots/${slotId}/signup`,
      null,
    );
  }

  /** "Al final no puedo". Idempotente; devuelve la convocatoria actualizada. */
  withdraw(lobbyId: string, slotId: string): Observable<LobbyResponse> {
    return this.http.delete<LobbyResponse>(
      `${environment.apiUrl}/lobbies/${lobbyId}/slots/${slotId}/signup`,
    );
  }

  /** Cancela la convocatoria. Solo quien la abrió, o un owner/admin del grupo. 204 sin cuerpo. */
  cancel(lobbyId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/lobbies/${lobbyId}`);
  }
}
