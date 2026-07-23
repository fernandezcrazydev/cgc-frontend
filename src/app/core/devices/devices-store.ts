import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { parseApiError } from '../http';
import { LinkedDevice } from './models';
import { DevicesApi } from './devices-api';

export type DevicesStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Dispositivos de escritorio vinculados. Clon del patrón `Session`: carga única y deduplicada,
 * `status` explícito y revocación pesimista.
 *
 * `devices` es null hasta que el servidor responde (la vista pinta skeletons); nunca se inventa
 * una lista vacía local, que se leería como "no tienes dispositivos" durante la carga.
 */
@Injectable({ providedIn: 'root' })
export class DevicesStore {
  private readonly api = inject(DevicesApi);

  private readonly _devices = signal<LinkedDevice[] | null>(null);
  private readonly _status = signal<DevicesStatus>('idle');
  /** Ids con una revocación en vuelo: la vista deshabilita justo ese botón (no reentrante). */
  private readonly _revoking = signal<ReadonlySet<string>>(new Set());

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<LinkedDevice[] | null> | null = null;

  readonly devices = this._devices.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  readonly revoking = this._revoking.asReadonly();

  ensureLoaded(): Promise<LinkedDevice[] | null> {
    if (this._status() === 'ready') return Promise.resolve(this._devices());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza un refetch (reintento tras error, o al re-entrar en la vista). */
  reload(): Promise<LinkedDevice[] | null> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  /** Si ya hay una revocación en curso para este id, ¿se puede pulsar el botón? */
  isRevoking(id: string): boolean {
    return this._revoking().has(id);
  }

  /**
   * Revoca una sesión de escritorio. Pesimista: solo se quita de la lista cuando el servidor
   * confirma. Lanza si falla, para que la vista traduzca el error con `errorMessage()`. Un id que
   * ya no es del usuario responde 404 (`DEVICE_NOT_FOUND`); ahí también se retira de la lista, que
   * es lo que el usuario quería de todos modos.
   */
  async revoke(id: string): Promise<void> {
    if (this._revoking().has(id)) return;
    this._revoking.update((set) => new Set(set).add(id));
    try {
      await firstValueFrom(this.api.revoke(id));
      this.removeFromList(id);
    } catch (e) {
      // 404 (DEVICE_NOT_FOUND) means the session is already gone — which is exactly what the user
      // asked for. Retire the row and treat it as success instead of toasting a false error. Any
      // other failure rethrows so the view can translate it.
      if (parseApiError(e).status === 404) {
        this.removeFromList(id);
        return;
      }
      throw e;
    } finally {
      this._revoking.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }
  }

  private removeFromList(id: string): void {
    this._devices.update((devices) => (devices ?? []).filter((device) => device.id !== id));
  }

  /** Al cerrar sesión no debe quedar rastro de los dispositivos del usuario anterior. */
  clear(): void {
    this.inFlight = null;
    this._devices.set(null);
    this._status.set('idle');
    this._revoking.set(new Set());
  }

  private async load(): Promise<LinkedDevice[] | null> {
    this._status.set('loading');
    try {
      const devices = await firstValueFrom(this.api.list());
      this._devices.set(devices);
      this._status.set('ready');
      return devices;
    } catch {
      this._devices.set(null);
      this._status.set('error');
      return null;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa rechazada y ningún
      // reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
