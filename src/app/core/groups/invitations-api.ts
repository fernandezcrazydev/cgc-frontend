import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GroupInvitationResponse, InvitationResponse, InviteRequest } from './models';

/**
 * Único sitio que conoce las URLs de la API de invitaciones. Nadie más monta strings con
 * `environment.apiUrl`. No captura errores ni guarda estado — de eso se encarga
 * `InvitationsStore`; aquí solo se traduce "un endpoint" a "un Observable tipado".
 *
 * El Bearer lo añade `authInterceptor` porque `environment.apiUrl` está en `secureRoutes`.
 */
@Injectable({ providedIn: 'root' })
export class InvitationsApi {
  private readonly http = inject(HttpClient);

  /**
   * Invita a un usuario (por su UUID) al grupo. Solo owner/admin del grupo (el backend lo
   * revalida). 404 si el invitado no existe, 409 si ya es miembro o ya tiene una invitación
   * pendiente. Devuelve la invitación creada.
   */
  invite(groupId: string, inviteeUserId: string): Observable<InvitationResponse> {
    const body: InviteRequest = { inviteeUserId };
    return this.http.post<InvitationResponse>(
      `${environment.apiUrl}/groups/${groupId}/invitations`,
      body,
    );
  }

  /** Las invitaciones pendientes del usuario logueado (para el badge / la bandeja). */
  mine(): Observable<InvitationResponse[]> {
    return this.http.get<InvitationResponse[]>(`${environment.apiUrl}/me/invitations`);
  }

  /**
   * Las invitaciones pendientes que un grupo tiene enviadas (para la pestaña "Invitados"), cada una
   * con el nombre y avatar del invitado. Solo owner/admin del grupo (el backend lo revalida) → 403 si no.
   */
  forGroup(groupId: string): Observable<GroupInvitationResponse[]> {
    return this.http.get<GroupInvitationResponse[]>(
      `${environment.apiUrl}/groups/${groupId}/invitations`,
    );
  }

  /**
   * Cancela (revoca) una invitación pendiente del grupo. Solo owner/admin del grupo. 404 si la
   * invitación no es de ese grupo o no existe; 409 si ya fue respondida. 204 sin cuerpo.
   */
  cancel(groupId: string, invitationId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/groups/${groupId}/invitations/${invitationId}`,
    );
  }

  /** El invitado acepta: pasa a MEMBER y la invitación se cierra. 204 sin cuerpo. */
  accept(invitationId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/invitations/${invitationId}/accept`, null);
  }

  /** El invitado rechaza: la invitación se cierra sin crear membresía. 204 sin cuerpo. */
  decline(invitationId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/invitations/${invitationId}/decline`, null);
  }
}
