import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UserSettings } from './models';
import { SettingsApi } from './settings-api';

export type SettingsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Ajustes de la cuenta del usuario. Clon del patrón `Session`: carga única y deduplicada,
 * `status` explícito y escritura pesimista.
 *
 * No hay valores por defecto aquí a propósito: `settings` es null hasta que el servidor
 * responde, y la vista pinta un skeleton mientras tanto. Inventar un `true` local haría que
 * alguien que tiene las invitaciones apagadas viera el interruptor encendido durante la carga
 * y creyera que se le ha desactivado solo.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly api = inject(SettingsApi);

  private readonly _settings = signal<UserSettings | null>(null);
  private readonly _status = signal<SettingsStatus>('idle');
  private readonly _saving = signal(false);

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<UserSettings | null> | null = null;

  /** Última versión confirmada por el servidor. null mientras no haya datos. */
  readonly settings = this._settings.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  /** Hay una escritura en vuelo: la vista deshabilita el interruptor. */
  readonly saving = this._saving.asReadonly();

  ensureLoaded(): Promise<UserSettings | null> {
    if (this._status() === 'ready') return Promise.resolve(this._settings());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza un refetch (reintento tras error, o al re-entrar en la vista). */
  reload(): Promise<UserSettings | null> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  /**
   * Guarda los ajustes. Pesimista: solo publica lo que el servidor confirma, así que un fallo
   * deja el interruptor donde estaba y la vista puede reintentar. Lanza si falla, para que la
   * vista traduzca el error con `errorMessage()`.
   */
  async update(next: UserSettings): Promise<UserSettings> {
    if (this._saving()) throw new Error('Ya hay un guardado en curso');
    this._saving.set(true);
    try {
      const saved = await firstValueFrom(this.api.update(next));
      this._settings.set(saved);
      this._status.set('ready');
      return saved;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Cambia un ajuste dejando los demás como están.
   *
   * El endpoint es un PUT completo —omitir un campo es un 422— así que alguien tiene que rellenar
   * los otros dos. Que lo haga cada pantalla es el patrón que ya falló una vez en potencia: al
   * entrar el tercer ajuste, un componente que sigue mandando dos lo apagaría sin que nadie lo
   * pidiera, y no hay forma de verlo en su diff. Aquí la base es siempre la última versión que
   * confirmó el servidor.
   *
   * Lanza si los ajustes no están cargados todavía: sin una base que completar, un PUT parcial
   * escribiría valores por defecto encima de lo que el usuario tenga guardado. La vista nunca llega
   * ahí porque pinta un skeleton mientras `settings()` es null.
   */
  patch(change: Partial<UserSettings>): Promise<UserSettings> {
    const current = this._settings();
    if (!current) {
      return Promise.reject(new Error('Los ajustes todavía no están cargados'));
    }
    return this.update({ ...current, ...change });
  }

  /** Al cerrar sesión no debe quedar rastro de los ajustes del usuario anterior. */
  clear(): void {
    this.inFlight = null;
    this._settings.set(null);
    this._status.set('idle');
    this._saving.set(false);
  }

  private async load(): Promise<UserSettings | null> {
    this._status.set('loading');
    try {
      const settings = await firstValueFrom(this.api.get());
      this._settings.set(settings);
      this._status.set('ready');
      return settings;
    } catch {
      this._settings.set(null);
      this._status.set('error');
      return null;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa rechazada y ningún
      // reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
