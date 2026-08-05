import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DiscordBotInfo, GroupDiscordLink, LinkDiscordRequest } from './models';

/**
 * Único sitio que conoce las URLs de la integración con Discord. No captura errores ni guarda
 * estado — de eso se encarga `DiscordStore`.
 */
@Injectable({ providedIn: 'root' })
export class DiscordApi {
  private readonly http = inject(HttpClient);

  /** Dónde escribe este grupo. 200 con `linked: false` si no está conectado. */
  linkOf(groupId: string): Observable<GroupDiscordLink> {
    return this.http.get<GroupDiscordLink>(`${environment.apiUrl}/groups/${groupId}/discord-link`);
  }

  /**
   * Conecta el grupo. Responde 409 si el bot no ve el canal (`DISCORD_CHANNEL_UNREACHABLE`) o si
   * el canal no pertenece a ese servidor (`DISCORD_GUILD_MISMATCH`): se comprueba contra Discord
   * antes de guardar nada.
   */
  link(groupId: string, request: LinkDiscordRequest): Observable<GroupDiscordLink> {
    return this.http.put<GroupDiscordLink>(
      `${environment.apiUrl}/groups/${groupId}/discord-link`,
      request,
    );
  }

  unlink(groupId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/groups/${groupId}/discord-link`);
  }

  /** Si la integración está viva aquí, y el enlace que añade el bot a un servidor. */
  botInfo(): Observable<DiscordBotInfo> {
    return this.http.get<DiscordBotInfo>(`${environment.apiUrl}/discord/bot-info`);
  }
}
