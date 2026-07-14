import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LaneRole, RolePreferences } from './models';
import { PreferencesApi } from './preferences-api';

export type PreferencesStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Lo que ve una vista mientras aún no hay datos: nada seleccionado. */
const EMPTY: RolePreferences = { roles: [], primary: null };

/**
 * Preferencias globales del jugador (hoy: sus roles). Clon del patrón `Session`:
 * carga única y deduplicada, `status` explícito y escritura pesimista.
 *
 * La escritura es no-reentrante (`saving`) y solo publica el nuevo estado cuando
 * el servidor lo confirma: la vista nunca muestra como guardado algo que no lo está.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesStore {
  private readonly api = inject(PreferencesApi);

  private readonly _prefs = signal<RolePreferences | null>(null);
  private readonly _status = signal<PreferencesStatus>('idle');
  private readonly _saving = signal(false);

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<RolePreferences | null> | null = null;

  readonly status = this._status.asReadonly();
  /** Hay una escritura en vuelo: la vista deshabilita el botón de guardar. */
  readonly saving = this._saving.asReadonly();

  /** Última versión confirmada por el servidor. `EMPTY` mientras no haya datos. */
  readonly prefs = computed<RolePreferences>(() => this._prefs() ?? EMPTY);
  readonly roles = computed<LaneRole[]>(() => this.prefs().roles);
  readonly primary = computed<LaneRole | null>(() => this.prefs().primary);

  ensureLoaded(): Promise<RolePreferences | null> {
    if (this._status() === 'ready') return Promise.resolve(this._prefs());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza un refetch (reintento tras error, o al re-entrar en la vista). */
  reload(): Promise<RolePreferences | null> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  clear(): void {
    this.inFlight = null;
    this._prefs.set(null);
    this._status.set('idle');
  }

  /**
   * Guarda las preferencias. Pesimista: solo actualiza el estado local con la
   * respuesta del servidor. Devuelve `false` si falló (la vista decide el toast)
   * y se ignora si ya hay otra escritura en vuelo (anti doble submit).
   */
  async save(next: RolePreferences): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);
    try {
      const saved = await firstValueFrom(this.api.update(next));
      this._prefs.set(saved);
      this._status.set('ready');
      return true;
    } catch {
      // No tocamos `_prefs`: el borrador de la vista sigue vivo para reintentar.
      return false;
    } finally {
      this._saving.set(false);
    }
  }

  private async load(): Promise<RolePreferences | null> {
    this._status.set('loading');
    try {
      const prefs = await firstValueFrom(this.api.get());
      this._prefs.set(prefs);
      this._status.set('ready');
      return prefs;
    } catch {
      this._prefs.set(null);
      this._status.set('error');
      return null;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa rechazada
      // y ningún reintento posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
