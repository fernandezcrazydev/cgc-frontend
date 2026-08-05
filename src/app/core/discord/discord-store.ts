import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DiscordApi } from './discord-api';
import {
  DiscordBotInfo,
  DiscordGuildChannels,
  GroupDiscordLink,
  LinkDiscordChannelRequest,
} from './models';

export type DiscordLinkStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * El vínculo con Discord del grupo que se está mirando. Clon del patrón `Session`: carga
 * deduplicada, `status` explícito y escritura pesimista.
 *
 * Guarda de qué grupo son los datos que tiene. Se navega entre grupos por el sidebar, así que
 * una respuesta lenta del grupo anterior puede llegar después de haber cambiado de pantalla: sin
 * comprobar el id, pintaría el canal de otro grupo como si fuera el de este.
 *
 * La lista de canales lleva su propio `status` y no el del vínculo. Son dos peticiones con dos
 * ciclos de vida: el vínculo se lee al entrar, y los canales solo cuando el asistente llega al
 * paso 2 —y se pueden recargar solos si el bot acaba de entrar a un canal nuevo—. Compartir un
 * `status` obligaría a poner toda la pantalla en `loading` para refrescar un desplegable.
 */
@Injectable({ providedIn: 'root' })
export class DiscordStore {
  private readonly api = inject(DiscordApi);

  private readonly _link = signal<GroupDiscordLink | null>(null);
  private readonly _status = signal<DiscordLinkStatus>('idle');
  private readonly _botInfo = signal<DiscordBotInfo | null>(null);
  private readonly _saving = signal(false);
  private readonly _authorizing = signal(false);

  private readonly _channels = signal<DiscordGuildChannels | null>(null);
  private readonly _channelsStatus = signal<DiscordLinkStatus>('idle');

  /** De qué grupo son los datos actuales. */
  private loadedGroupId: string | null = null;
  /** Qué grupo se está mirando AHORA. Una carga que termine para otro no debe escribir nada. */
  private requestedGroupId: string | null = null;
  private inFlight: Promise<GroupDiscordLink | null> | null = null;
  private channelsGroupId: string | null = null;

  readonly link = this._link.asReadonly();
  readonly status = this._status.asReadonly();
  readonly botInfo = this._botInfo.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly authorizing = this._authorizing.asReadonly();
  readonly channels = this._channels.asReadonly();
  readonly channelsStatus = this._channelsStatus.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  ensureLoaded(groupId: string): Promise<GroupDiscordLink | null> {
    if (this._status() === 'ready' && this.loadedGroupId === groupId) {
      return Promise.resolve(this._link());
    }
    if (this.requestedGroupId !== groupId) {
      // Otro grupo: lo que hubiera cargado ya no describe esta pantalla.
      this.requestedGroupId = groupId;
      this.inFlight = null;
      this._link.set(null);
      this._status.set('idle');
      this.forgetChannels();
    }
    return (this.inFlight ??= this.load(groupId));
  }

  reload(groupId: string): Promise<GroupDiscordLink | null> {
    this.inFlight = null;
    this._status.set('idle');
    this.loadedGroupId = null;
    this.requestedGroupId = groupId;
    return this.ensureLoaded(groupId);
  }

  /** Se pide una vez por sesión: es configuración del servidor, no cambia entre grupos. */
  async ensureBotInfo(): Promise<DiscordBotInfo | null> {
    if (this._botInfo()) return this._botInfo();
    try {
      const info = await firstValueFrom(this.api.botInfo());
      this._botInfo.set(info);
      return info;
    } catch {
      return null;
    }
  }

  /**
   * Paso 1: pide la URL de autorización. Devuelve la URL en vez de navegar porque quien navega es
   * la vista, y tiene que hacerlo en el mismo tick del clic o el bloqueador de ventanas lo para.
   *
   * Lanza si falla, para que la vista traduzca el error con `errorMessage()`.
   */
  async beginAuthorization(groupId: string): Promise<string> {
    if (this._authorizing()) throw new Error('Ya hay una autorización en curso');
    this._authorizing.set(true);
    try {
      const start = await firstValueFrom(this.api.beginAuthorization(groupId));
      return start.authorizationUrl;
    } finally {
      this._authorizing.set(false);
    }
  }

  /** Paso 2: los canales del servidor autorizado. Idempotente por grupo. */
  ensureChannels(groupId: string): Promise<void> {
    if (this.channelsGroupId === groupId && this._channelsStatus() === 'ready') {
      return Promise.resolve();
    }
    return this.reloadChannels(groupId);
  }

  async reloadChannels(groupId: string): Promise<void> {
    this.channelsGroupId = groupId;
    this._channelsStatus.set('loading');
    try {
      const channels = await firstValueFrom(this.api.channels(groupId));
      // Igual que el vínculo: una respuesta lenta puede llegar cuando ya se mira otro grupo, y
      // ofrecer los canales del servidor de otra gente sería difícil de detectar mirando.
      if (this.channelsGroupId !== groupId) return;
      this._channels.set(channels);
      this._channelsStatus.set('ready');
    } catch {
      if (this.channelsGroupId !== groupId) return;
      this._channels.set(null);
      this._channelsStatus.set('error');
    }
  }

  /**
   * Conecta el grupo al canal. Pesimista y no reentrante: el backend publica el mensaje de
   * bienvenida antes de guardar, así que esto tarda lo que tarde Discord y un doble clic mandaría
   * dos mensajes. Lanza si falla, para que la vista traduzca el error con `errorMessage()`.
   */
  async linkChannel(groupId: string, request: LinkDiscordChannelRequest): Promise<GroupDiscordLink> {
    if (this._saving()) throw new Error('Ya hay un guardado en curso');
    this._saving.set(true);
    try {
      const saved = await firstValueFrom(this.api.link(groupId, request));
      if (this.loadedGroupId === groupId) {
        this._link.set(saved);
        this._status.set('ready');
      }
      return saved;
    } finally {
      this._saving.set(false);
    }
  }

  async unlink(groupId: string): Promise<void> {
    if (this._saving()) throw new Error('Ya hay un guardado en curso');
    this._saving.set(true);
    try {
      await firstValueFrom(this.api.unlink(groupId));
      if (this.loadedGroupId === groupId) {
        this._link.set({
          linked: false,
          guildId: null,
          guildName: null,
          channelId: null,
          channelName: null,
          linkedAt: null,
          linkedByName: null,
          linkHealthy: true,
        });
      }
      // El servidor ya no es el de este grupo: dejar la lista cargada haría que volver al paso 2
      // enseñase los canales del servidor que se acaba de desconectar.
      this.forgetChannels();
    } finally {
      this._saving.set(false);
    }
  }

  clear(): void {
    this.inFlight = null;
    this.loadedGroupId = null;
    this.requestedGroupId = null;
    this._link.set(null);
    this._status.set('idle');
    this._botInfo.set(null);
    this._saving.set(false);
    this._authorizing.set(false);
    this.forgetChannels();
  }

  private forgetChannels(): void {
    this.channelsGroupId = null;
    this._channels.set(null);
    this._channelsStatus.set('idle');
  }

  private async load(groupId: string): Promise<GroupDiscordLink | null> {
    this._status.set('loading');
    try {
      const link = await firstValueFrom(this.api.linkOf(groupId));
      // La respuesta puede llegar cuando ya se está mirando OTRO grupo: navegando por el sidebar,
      // una petición lenta termina después del cambio de pantalla. Escribirla aquí pintaría el
      // canal de un grupo como si fuera el de otro, y un canal equivocado tiene toda la pinta de
      // ser el correcto.
      if (this.requestedGroupId !== groupId) return link;
      this._link.set(link);
      this.loadedGroupId = groupId;
      this._status.set('ready');
      return link;
    } catch {
      if (this.requestedGroupId !== groupId) return null;
      this._link.set(null);
      this._status.set('error');
      return null;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa rechazada y ningún
      // reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
