import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RiotAccountApi } from './riot-account-api';
import { LinkRiotAccountRequest, PairingCode, RiotAccount } from './models';

export type RiotAccountStatusState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * La cuenta de Riot vinculada, cargada una vez y compartida como signals — mismo patrón que
 * `Session`, del que hereda el `ensureLoaded()` deduplicado.
 *
 * **Escrituras pesimistas.** Vincular y desvincular no tocan las signals hasta que el servidor
 * confirma: el estado local nunca puede afirmar una vinculación que el backend rechazó (la
 * cuenta ya la tiene otro, o el cooldown está vivo). El servidor devuelve el estado completo en
 * el `PUT`, así que tras vincular no hace falta un `GET` extra.
 *
 * Los fallos **se propagan**: llegan como ProblemDetail con `code` y solo la vista sabe
 * traducirlos (`errorMessage` de `core/http`).
 */
@Injectable({ providedIn: 'root' })
export class RiotAccountStore {
  private readonly api = inject(RiotAccountApi);

  private readonly _account = signal<RiotAccount | null>(null);
  private readonly _relinkAvailableAt = signal<string | null>(null);
  private readonly _status = signal<RiotAccountStatusState>('idle');
  private readonly _saving = signal(false);
  private readonly _generatingCode = signal(false);

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<void> | null = null;

  /** `null` = no hay cuenta vinculada, o aún no se sabe (mirar `status`). */
  readonly account = this._account.asReadonly();
  readonly status = this._status.asReadonly();
  /** Hay una escritura en vuelo: la vista deshabilita los botones (anti doble submit). */
  readonly saving = this._saving.asReadonly();
  /** Hay un código de emparejamiento generándose: el botón queda deshabilitado mientras. */
  readonly generatingCode = this._generatingCode.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');
  readonly isReady = computed(() => this._status() === 'ready');

  /**
   * Instante (ISO-8601) a partir del cual se puede vincular una cuenta **distinta**, o `null`
   * si no hay cooldown. Vincular de nuevo la misma cuenta que se acaba de quitar siempre se
   * puede: el cooldown persigue el cambio de cuenta, no arreglar un error de tecleo.
   */
  readonly relinkAvailableAt = this._relinkAvailableAt.asReadonly();
  readonly relinkBlocked = computed(() => this._relinkAvailableAt() !== null);

  /**
   * Carga el estado si hace falta. Idempotente y no lanza: un fallo deja
   * `status === 'error'` y la vista decide qué pintar.
   */
  ensureLoaded(): Promise<void> {
    if (this._status() === 'ready') return Promise.resolve();
    return (this.inFlight ??= this.load());
  }

  /** Fuerza una relectura contra el backend (reintento tras un fallo de red). */
  reload(): Promise<void> {
    this.inFlight = null;
    this._status.set('idle');
    return this.ensureLoaded();
  }

  /**
   * Vincula (o cambia) la cuenta. Devuelve `true` si el servidor confirmó y `false` si ya había
   * otra escritura en vuelo. Un rechazo del backend se propaga: la vista lo traduce.
   */
  async link(request: LinkRiotAccountRequest): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);
    try {
      const status = await firstValueFrom(this.api.link(request));
      this._account.set(status.account);
      this._relinkAvailableAt.set(status.relinkAvailableAt);
      this._status.set('ready');
      return true;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Desvincula. Lo que deja de funcionar es solo lo que necesita la cuenta **de aquí en
   * adelante**; nada del histórico se toca (partidas, rating y estadísticas cuelgan del usuario,
   * no de la cuenta de Riot), así que la vista no tiene que refrescar nada más.
   *
   * Tras desvincular hay que releer el estado: el backend responde 204 y solo un `GET` trae el
   * `relinkAvailableAt` que abre esta operación.
   */
  async unlink(): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);
    try {
      await firstValueFrom(this.api.unlink());
      this._account.set(null);
      await this.load();
      return true;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Emite un código de emparejamiento para pegar en la app de escritorio. Devuelve `null` si ya hay
   * uno generándose (anti doble submit). **No se cachea**: es una credencial de un solo uso y corta
   * vida, así que vive solo en la vista que lo enseña, nunca en el estado compartido. Un fallo se
   * propaga para que la vista lo traduzca.
   */
  async requestPairingCode(): Promise<PairingCode | null> {
    if (this._generatingCode()) return null;
    this._generatingCode.set(true);
    try {
      return await firstValueFrom(this.api.pairingCode());
    } finally {
      this._generatingCode.set(false);
    }
  }

  /** Al cerrar sesión no debe quedar rastro de la cuenta anterior en memoria. */
  clear(): void {
    this.inFlight = null;
    this._account.set(null);
    this._relinkAvailableAt.set(null);
    this._status.set('idle');
  }

  private async load(): Promise<void> {
    this._status.set('loading');
    try {
      const status = await firstValueFrom(this.api.status());
      this._account.set(status.account);
      this._relinkAvailableAt.set(status.relinkAvailableAt);
      this._status.set('ready');
    } catch {
      this._account.set(null);
      this._relinkAvailableAt.set(null);
      this._status.set('error');
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa y ningún reintento
      // posterior volvería a tocar la red.
      this.inFlight = null;
    }
  }
}
