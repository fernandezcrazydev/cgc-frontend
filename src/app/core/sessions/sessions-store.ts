import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { parseApiError } from '../http';
import { ActiveSession } from './models';
import { SessionsApi } from './sessions-api';

export type SessionsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Sesiones activas de la cuenta. Clon del patrón `Session`: carga única y deduplicada, `status`
 * explícito y cierre pesimista.
 *
 * `sessions` es null hasta que el servidor responde (la vista pinta skeletons); nunca se inventa
 * una lista vacía local, que se leería como "no tienes ninguna sesión abierta" durante la carga —
 * y en esta pantalla en concreto eso es una mentira tranquilizadora sobre la seguridad de la
 * cuenta, que es la peor clase de mentira que puede contar una UI.
 */
@Injectable({ providedIn: 'root' })
export class SessionsStore {
  private readonly api = inject(SessionsApi);

  private readonly _sessions = signal<ActiveSession[] | null>(null);
  private readonly _status = signal<SessionsStatus>('idle');
  /** Ids con un cierre en vuelo: la vista deshabilita justo ese botón (no reentrante). */
  private readonly _closing = signal<ReadonlySet<string>>(new Set());

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<ActiveSession[] | null> | null = null;

  readonly sessions = this._sessions.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  readonly closing = this._closing.asReadonly();

  ensureLoaded(): Promise<ActiveSession[] | null> {
    if (this._status() === 'ready') return Promise.resolve(this._sessions());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza un refetch (reintento tras error, o al re-entrar en la vista). */
  reload(): Promise<ActiveSession[] | null> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  isClosing(id: string): boolean {
    return this._closing().has(id);
  }

  /**
   * Cierra una sesión de otro dispositivo. Pesimista: solo se quita de la lista cuando el servidor
   * confirma. Lanza si falla, para que la vista traduzca el error con `errorMessage()`.
   *
   * El 404 (`SESSION_NOT_FOUND`) se trata como éxito: es lo que llega al reintentar tras una
   * respuesta perdida, y también cuando la sesión ya había caducado. En los dos casos el usuario
   * consiguió lo que pedía, así que la fila se retira en vez de enseñar un error falso.
   *
   * El 409 (`CURRENT_SESSION_NOT_REVOCABLE`) NO: ahí la sesión sigue viva y quitarla de la lista
   * pintaría lo contrario de lo que pasó. La vista no ofrece ese botón para la sesión actual, pero
   * el 409 puede llegar igual si la lista se quedó vieja, y entonces hay que decirlo.
   */
  async close(id: string): Promise<void> {
    if (this._closing().has(id)) return;
    this._closing.update((set) => new Set(set).add(id));
    try {
      await firstValueFrom(this.api.close(id));
      this.removeFromList(id);
    } catch (e) {
      if (parseApiError(e).status === 404) {
        this.removeFromList(id);
        return;
      }
      throw e;
    } finally {
      this._closing.update((set) => {
        const next = new Set(set);
        next.delete(id);
        return next;
      });
    }
  }

  private removeFromList(id: string): void {
    this._sessions.update((sessions) => (sessions ?? []).filter((session) => session.id !== id));
  }

  /** Al cerrar sesión no debe quedar rastro de las sesiones del usuario anterior. */
  clear(): void {
    this.inFlight = null;
    this._sessions.set(null);
    this._status.set('idle');
    this._closing.set(new Set());
  }

  private async load(): Promise<ActiveSession[] | null> {
    this._status.set('loading');
    try {
      const sessions = await firstValueFrom(this.api.list());
      this._sessions.set(sessions);
      this._status.set('ready');
      return sessions;
    } catch {
      this._sessions.set(null);
      this._status.set('error');
      return null;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa rechazada y ningún
      // reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
