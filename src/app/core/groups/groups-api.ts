import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateGroupRequest, GroupMembershipResponse, GroupResponse } from './models';

/**
 * Único sitio que conoce las URLs de la API de grupos. Nadie más monta strings con
 * `environment.apiUrl`. No captura errores ni guarda estado — de eso se encarga
 * `GroupsStore`; aquí solo se traduce "un endpoint" a "un Observable tipado".
 *
 * El Bearer lo añade `authInterceptor` porque `environment.apiUrl` está en `secureRoutes`.
 */
@Injectable({ providedIn: 'root' })
export class GroupsApi {
  private readonly http = inject(HttpClient);

  /** Crea el grupo; el llamante queda como OWNER. 409 si supera el tope por usuario. */
  create(body: CreateGroupRequest): Observable<GroupResponse> {
    return this.http.post<GroupResponse>(`${environment.apiUrl}/groups`, body);
  }

  /**
   * Sube (o reemplaza) la foto del grupo. Multipart, campo `file`. Solo OWNER/ADMIN (el
   * backend lo revalida). NO se fija Content-Type a mano: con `FormData` el navegador pone
   * el `multipart/form-data` con su boundary; ponerlo nosotros rompería el parseo.
   */
  uploadAvatar(groupId: string, file: Blob, filename = 'avatar'): Observable<GroupResponse> {
    const form = new FormData();
    form.append('file', file, filename);
    return this.http.put<GroupResponse>(`${environment.apiUrl}/groups/${groupId}/avatar`, form);
  }

  /** Los grupos del usuario logueado, con su rol en cada uno (para el perfil). */
  myGroups(): Observable<GroupMembershipResponse[]> {
    return this.http.get<GroupMembershipResponse[]>(`${environment.apiUrl}/me/groups`);
  }
}
