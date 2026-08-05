import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DiscordApi } from './discord-api';
import { DiscordBotInfo, GroupDiscordLink, LinkDiscordRequest } from './models';

export type DiscordLinkStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * El vínculo con Discord del grupo que se está mirando. Clon del patrón `Session`: carga
 * deduplicada, `status` explícito y escritura pesimista.
 *
 * Guarda de qué grupo son los datos que tiene. Se navega entre grupos por el sidebar, así que
 * una respuesta lenta del grupo anterior puede llegar después de haber cambiado de pantalla: sin
 * comprobar el id, pintaría el canal de otro grupo como si fuera el de este.
 */
@Injectable({ providedIn: 'root' })
export class DiscordStore {
  private readonly api = inject(DiscordApi);

  private readonly _link = signal<GroupDiscordLink | null>(null);
  private readonly _status = signal<DiscordLinkStatus>('idle');
  private readonly _botInfo = signal<DiscordBotInfo | null>(null);
  private readonly _saving = signal(false);

  /** De qué grupo son los datos actuales. */
  private loadedGroupId: string | null = null;
  /** Qué grupo se está mirando AHORA. Una carga que termine para otro no debe escribir nada. */
  private requestedGroupId: string | null = null;
  private inFlight: Promise<GroupDiscordLink | null> | null = null;

  readonly link = this._link.asReadonly();
  readonly status = this._status.asReadonly();
  readonly botInfo = this._botInfo.asReadonly();
  readonly saving = this._saving.asReadonly();
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

  /** Conecta el grupo. Lanza si falla, para que la vista traduzca el error con `errorMessage()`. */
  async link_(groupId: string, request: LinkDiscordRequest): Promise<GroupDiscordLink> {
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
          channelId: null,
          linkedAt: null,
          linkedByName: null,
          linkHealthy: true,
        });
      }
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
