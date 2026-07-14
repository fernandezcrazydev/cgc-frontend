import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CurrentUser, initialsOf } from './current-user';
import { UserApi } from './user-api';

export type SessionStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * El usuario logueado, cargado una sola vez desde `GET /api/v1/me` y compartido
 * por toda la app como signals.
 *
 * Por qué no un `httpResource`: el guard de rutas necesita ESPERAR a que el
 * usuario esté cargado antes de dejar entrar en /app, y un resource es lazy y
 * reactivo, no algo que se pueda "await-ear" sin trucos. `ensureLoaded()` da esa
 * garantía y de paso deduplica: si el guard y un componente la llaman a la vez,
 * sale una única petición.
 */
@Injectable({ providedIn: 'root' })
export class Session {
  private readonly api = inject(UserApi);

  private readonly _user = signal<CurrentUser | null>(null);
  private readonly _status = signal<SessionStatus>('idle');

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<CurrentUser | null> | null = null;

  readonly user = this._user.asReadonly();
  readonly status = this._status.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly isReady = computed(() => this._status() === 'ready');

  /** Vacío mientras no haya usuario: las vistas deben tratarlo como "aún no sé". */
  readonly displayName = computed(() => this._user()?.discordUsername ?? '');
  readonly initials = computed(() => initialsOf(this._user()?.discordUsername));
  readonly avatarUrl = computed(() => this._user()?.avatarUrl ?? null);
  /** ISO-8601 tal cual lo manda el backend: formatear es cosa de la vista. */
  readonly createdAt = computed(() => this._user()?.createdAt ?? null);

  /**
   * Devuelve el usuario, cargándolo si hace falta. Idempotente: una vez cargado
   * no vuelve a llamar a la red. Nunca lanza — un fallo se traduce en `null` y
   * en `status === 'error'`, que es lo que el guard sabe interpretar.
   */
  ensureLoaded(): Promise<CurrentUser | null> {
    if (this._status() === 'ready') return Promise.resolve(this._user());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza una recarga contra el backend (p. ej. tras cambiar el avatar). */
  reload(): Promise<CurrentUser | null> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  /** Al cerrar sesión no debe quedar rastro del usuario anterior en memoria. */
  clear(): void {
    this.inFlight = null;
    this._user.set(null);
    this._status.set('idle');
  }

  private async load(): Promise<CurrentUser | null> {
    this._status.set('loading');
    try {
      const user = await firstValueFrom(this.api.me());
      this._user.set(user);
      this._status.set('ready');
      return user;
    } catch {
      this._user.set(null);
      this._status.set('error');
      return null;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa rechazada
      // y ningún reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
