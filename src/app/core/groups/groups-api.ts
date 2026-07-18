import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChangeRoleRequest,
  CreateGroupRequest,
  GroupMembershipResponse,
  GroupResponse,
  GroupRole,
  TransferOwnershipRequest,
} from './models';

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

  /**
   * Expulsa a otro miembro. El backend revalida que el llamante es admin del grupo Y que
   * supera en rango al expulsado (una regla de dominio: un ADMIN no expulsa a otro ADMIN).
   * 204 sin cuerpo.
   */
  removeMember(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/groups/${groupId}/members/${userId}`);
  }

  /**
   * El llamante abandona el grupo. Cualquier miembro puede; el owner lo tiene prohibido por
   * el backend (debe transferir o borrar antes) → 409. 204 sin cuerpo.
   */
  leave(groupId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/groups/${groupId}/membership`);
  }

  /** Cambia el rol de un miembro. Solo el owner; asignar OWNER por aquí es 409. 204 sin cuerpo. */
  changeRole(groupId: string, userId: string, role: GroupRole): Observable<void> {
    const body: ChangeRoleRequest = { role };
    return this.http.put<void>(`${environment.apiUrl}/groups/${groupId}/members/${userId}/role`, body);
  }

  /**
   * Transfiere la propiedad a otro miembro. Solo el owner sentado; el intercambio (owner
   * saliente → ADMIN, entrante → OWNER) es atómico en el backend. 204 sin cuerpo.
   */
  transferOwnership(groupId: string, newOwnerId: string): Observable<void> {
    const body: TransferOwnershipRequest = { newOwnerId };
    return this.http.put<void>(`${environment.apiUrl}/groups/${groupId}/owner`, body);
  }

  /** Borra el grupo. Solo el owner; las membresías caen en cascada. 204 sin cuerpo. */
  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/groups/${groupId}`);
  }
}
