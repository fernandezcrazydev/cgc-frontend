import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DiscordAuthorizationStart,
  DiscordBotInfo,
  DiscordGuildChannels,
  GroupDiscordLink,
  LinkDiscordChannelRequest,
} from './models';

/**
 * Único sitio que conoce las URLs de la integración con Discord. No captura errores ni guarda
 * estado — de eso se encarga `DiscordStore`.
 */
@Injectable({ providedIn: 'root' })
export class DiscordApi {
  private readonly http = inject(HttpClient);

  /** Dónde escribe este grupo, y por qué paso del asistente va. 200 siempre. */
  linkOf(groupId: string): Observable<GroupDiscordLink> {
    return this.http.get<GroupDiscordLink>(`${environment.apiUrl}/groups/${groupId}/discord-link`);
  }

  /**
   * Paso 1: pide la URL a la que mandar el navegador para que Discord pregunte en qué servidor va
   * el bot. Es un POST porque escribe: cada llamada emite un `state` de un solo uso y quema el
   * anterior.
   */
  beginAuthorization(groupId: string): Observable<DiscordAuthorizationStart> {
    return this.http.post<DiscordAuthorizationStart>(
      `${environment.apiUrl}/groups/${groupId}/discord/authorization`,
      {},
    );
  }

  /**
   * Paso 2: los canales del servidor autorizado. Responde 409 `DISCORD_GUILD_NOT_SELECTED` si no
   * hay servidor —otro admin desconectó el grupo mientras este elegía—.
   */
  channels(groupId: string): Observable<DiscordGuildChannels> {
    return this.http.get<DiscordGuildChannels>(
      `${environment.apiUrl}/groups/${groupId}/discord/channels`,
    );
  }

  /**
   * Conecta el grupo al canal elegido. El backend publica ahí el mensaje de bienvenida ANTES de
   * guardar nada, así que un 409 `DISCORD_CHANNEL_WRITE_FAILED` significa que el bot ve el canal
   * pero no puede escribir en él.
   */
  link(groupId: string, request: LinkDiscordChannelRequest): Observable<GroupDiscordLink> {
    return this.http.put<GroupDiscordLink>(
      `${environment.apiUrl}/groups/${groupId}/discord-link`,
      request,
    );
  }

  unlink(groupId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/groups/${groupId}/discord-link`);
  }

  /** Si la integración está viva en este servidor. */
  botInfo(): Observable<DiscordBotInfo> {
    return this.http.get<DiscordBotInfo>(`${environment.apiUrl}/discord/bot-info`);
  }
}
