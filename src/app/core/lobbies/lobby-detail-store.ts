import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { LobbiesApi } from './lobbies-api';
import { LobbyResponse, LobbySlotResponse } from './models';

/** `not-found` = no existe, o no eres del grupo (403/404): un estado 404 de la vista. */
export type LobbyDetailStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-found';

/**
 * UNA convocatoria: sus franjas, quién está en cada una, y las acciones de apuntarse, bajarse y
 * cancelar. Cancela respuestas obsoletas al cambiar de `:id` comprobando el id activo antes de
 * escribir en las signals.
 *
 * Las escrituras son pesimistas y no reentrantes, y todas devuelven la convocatoria entera: el
 * backend la manda de vuelta porque apuntarse cambia lo que ven los demás —puede ser justo la
 * acción que confirma la partida—, así que no hace falta un segundo viaje para verlo.
 */
@Injectable({ providedIn: 'root' })
export class LobbyDetailStore {
  private readonly api = inject(LobbiesApi);

  private readonly _status = signal<LobbyDetailStatus>('idle');
  private readonly _lobby = signal<LobbyResponse | null>(null);
  private currentId: string | null = null;
  private seq = 0;

  readonly status = this._status.asReadonly();
  readonly lobby = this._lobby.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  /** La franja ya cuadrada, o null mientras se recoge disponibilidad. */
  readonly confirmedSlot = computed<LobbySlotResponse | null>(() => {
    const lobby = this._lobby();
    if (!lobby?.confirmedSlotId) return null;
    return lobby.slots.find((slot) => slot.id === lobby.confirmedSlotId) ?? null;
  });

  /** Franjas por hora ascendente, que es como se leen en pantalla. */
  readonly slots = computed<LobbySlotResponse[]>(() =>
    [...(this._lobby()?.slots ?? [])].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
  );

  /** Ids de franja con una acción en vuelo: deshabilita ese botón y solo ese. */
  private readonly _acting = signal<ReadonlySet<string>>(new Set());
  isActing(slotId: string): boolean {
    return this._acting().has(slotId);
  }

  /** Cancelar la convocatoria entera está en vuelo. */
  private readonly _cancelling = signal(false);
  readonly cancelling = this._cancelling.asReadonly();

  /** Carga (o recarga) la convocatoria. Un 403/404 es `not-found`, no un error de red. */
  async load(lobbyId: string): Promise<void> {
    const seq = ++this.seq;
    this.currentId = lobbyId;
    this._status.set('loading');
    this._lobby.set(null);
    try {
      const lobby = await firstValueFrom(this.api.detail(lobbyId));
      if (seq !== this.seq) return;
      this._lobby.set(lobby);
      this._status.set('ready');
    } catch (error) {
      if (seq !== this.seq) return;
      this._status.set(isMissing(error) ? 'not-found' : 'error');
    }
  }

  /**
   * Refetch silencioso: NO vacía lo que hay en pantalla ni vuelve a `loading`. Lo llama el aviso
   * en vivo, que puede llegar en cualquier momento — parpadear la sala entera cada vez que
   * alguien se apunta sería peor que no tener aviso.
   */
  async refresh(): Promise<void> {
    const lobbyId = this.currentId;
    if (!lobbyId) return;
    const seq = ++this.seq;
    try {
      const lobby = await firstValueFrom(this.api.detail(lobbyId));
      if (seq === this.seq && this.currentId === lobbyId) this._lobby.set(lobby);
    } catch {
      // Un refresco que falla deja lo que ya estaba: mejor un dato de hace un segundo que un error.
    }
  }

  /** "Puedo a esa hora". Lanza si falla; la vista pinta el mensaje. */
  async signUp(slotId: string): Promise<void> {
    await this.act(slotId, (lobbyId) => firstValueFrom(this.api.signUp(lobbyId, slotId)));
  }

  /** "Al final no puedo". */
  async withdraw(slotId: string): Promise<void> {
    await this.act(slotId, (lobbyId) => firstValueFrom(this.api.withdraw(lobbyId, slotId)));
  }

  private async act(slotId: string, call: (lobbyId: string) => Promise<LobbyResponse>): Promise<void> {
    const lobbyId = this.currentId;
    if (!lobbyId || this._acting().has(slotId)) return;
    this._acting.update((set) => new Set(set).add(slotId));
    try {
      const updated = await call(lobbyId);
      if (this.currentId === lobbyId) {
        this._lobby.set(updated);
        this._status.set('ready');
      }
    } finally {
      this._acting.update((set) => {
        const next = new Set(set);
        next.delete(slotId);
        return next;
      });
    }
  }

  /** Cancela la convocatoria y refresca su estado. Lanza si el backend dice que no puedes. */
  async cancel(): Promise<void> {
    const lobbyId = this.currentId;
    if (!lobbyId || this._cancelling()) return;
    this._cancelling.set(true);
    try {
      await firstValueFrom(this.api.cancel(lobbyId));
      await this.refresh();
    } finally {
      this._cancelling.set(false);
    }
  }

  clear(): void {
    this.currentId = null;
    this.seq++;
    this._status.set('idle');
    this._lobby.set(null);
    this._acting.set(new Set());
    this._cancelling.set(false);
  }

  /** El id que se está mostrando, para que el aviso en vivo sepa si le concierne. */
  get showingId(): string | null {
    return this.currentId;
  }
}

/** Un 403 (no eres del grupo) o un 404 (no existe) se tratan igual: la vista muestra su 404. */
function isMissing(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
}
