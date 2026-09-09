import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LobbiesApi } from './lobbies-api';
import { BalanceExplanationResponse } from './models';
import { parseApiError } from '../http';

/**
 * Los cuatro finales que tiene esta lectura, además de los tres de siempre:
 *
 * - `not-recorded`: 404 `BALANCE_NOT_RECORDED`. La sala existe pero no guardó el porqué. NO es
 *   un error: es el estado normal de toda sala repartida antes de que el backend empezara a
 *   escribirlo, y de toda sala que no llegó a repartirse.
 * - `not-found`: 404 `LOBBY_NOT_FOUND`. La convocatoria no existe.
 * - `forbidden`: 403. No eres admin del grupo. La vista esconde la entrada, así que llegar
 *   aquí es haber pegado la URL a mano o haber perdido el rol mientras mirabas.
 */
export type BalanceExplanationStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'not-recorded'
  | 'not-found'
  | 'forbidden';

/**
 * Por qué salió ESE reparto y no otro, para UNA sala. Solo lectura: no hay ninguna escritura
 * que hacer sobre una explicación ya escrita.
 *
 * Cancela respuestas obsoletas al cambiar de `:salaId` comprobando el id activo antes de
 * escribir en las signals, igual que `LobbyDetailStore`.
 */
@Injectable({ providedIn: 'root' })
export class BalanceExplanationStore {
  private readonly api = inject(LobbiesApi);

  private readonly _status = signal<BalanceExplanationStatus>('idle');
  private readonly _explanation = signal<BalanceExplanationResponse | null>(null);
  private currentId: string | null = null;
  private seq = 0;
  /** Carga en vuelo, para que dos interesados a la vez no pidan lo mismo dos veces. */
  private inFlight: { id: string; promise: Promise<void> } | null = null;

  readonly status = this._status.asReadonly();
  readonly explanation = this._explanation.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading' || this._status() === 'idle');

  /** Ya está cargada esta sala: no repite la petición. Para forzarla, {@link reload}. */
  ensureLoaded(lobbyId: string): Promise<void> {
    if (!lobbyId) return Promise.resolve();
    if (this.currentId === lobbyId && this._status() !== 'idle' && this._status() !== 'loading') {
      return Promise.resolve();
    }
    if (this.inFlight?.id === lobbyId) return this.inFlight.promise;
    return this.load(lobbyId);
  }

  /** Fuerza el refetch de la explicación de esta sala. */
  reload(): Promise<void> {
    const lobbyId = this.currentId;
    return lobbyId ? this.load(lobbyId) : Promise.resolve();
  }

  /** Carga (o recarga) la explicación. Cada final del backend tiene su `status`. */
  load(lobbyId: string): Promise<void> {
    const promise = this.fetch(lobbyId);
    this.inFlight = { id: lobbyId, promise };
    return promise.finally(() => {
      if (this.inFlight?.id === lobbyId) this.inFlight = null;
    });
  }

  private async fetch(lobbyId: string): Promise<void> {
    const seq = ++this.seq;
    this.currentId = lobbyId;
    this._status.set('loading');
    this._explanation.set(null);
    try {
      const explanation = await firstValueFrom(this.api.balanceExplanation(lobbyId));
      if (seq !== this.seq) return;
      this._explanation.set(explanation);
      this._status.set('ready');
    } catch (error) {
      if (seq !== this.seq) return;
      this._status.set(statusFor(error));
    }
  }

  clear(): void {
    this.currentId = null;
    this.seq++;
    this.inFlight = null;
    this._status.set('idle');
    this._explanation.set(null);
  }

  /** El id que se está mostrando, para que quien recargue sepa si le concierne. */
  get showingId(): string | null {
    return this.currentId;
  }
}

/**
 * El `code` es lo que separa los dos 404, y por eso se mira antes que el `status`: "no se
 * guardó el porqué" y "esa sala no existe" se cuentan distinto aunque viajen con el mismo
 * número. Un 404 sin `code` cae en `not-found`, que es lo que dice el número.
 */
function statusFor(error: unknown): BalanceExplanationStatus {
  const api = parseApiError(error);
  if (api.code === 'BALANCE_NOT_RECORDED') return 'not-recorded';
  if (api.status === 403) return 'forbidden';
  if (api.status === 404) return 'not-found';
  return 'error';
}
