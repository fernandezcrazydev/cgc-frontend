import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LobbiesApi } from './lobbies-api';
import { CreateLobbyRequest, LobbyResponse } from './models';

export type LobbiesStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Las convocatorias de UN grupo: la lista que pinta "partidas activas" y la acción de convocar.
 * El detalle de una convocatoria concreta vive en `LobbyDetailStore`, igual que `GroupsStore` y
 * `GroupDetailStore` están separados.
 *
 * Paginado EN SERVIDOR: `lobbies()` es solo la página visible y el total real es
 * `totalElements()`. Cualquier vista que diga "N partidas" lee ese contador.
 */
@Injectable({ providedIn: 'root' })
export class LobbiesStore {
  private readonly api = inject(LobbiesApi);

  /** Convocatorias por página. Un grupo tiene pocas vivas; el resto es historia. */
  static readonly PAGE_SIZE = 10;

  private readonly _status = signal<LobbiesStatus>('idle');
  private readonly _lobbies = signal<LobbyResponse[]>([]);
  private readonly _totalElements = signal(0);
  private readonly _page = signal(0);
  /** El grupo que se está mostrando; descarta respuestas de un id ya abandonado. */
  private currentGroupId: string | null = null;
  /** Secuencia de peticiones: descarta la respuesta de una página ya abandonada. */
  private seq = 0;

  readonly status = this._status.asReadonly();
  readonly lobbies = this._lobbies.asReadonly();
  readonly totalElements = this._totalElements.asReadonly();
  readonly page = this._page.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  /** Las que siguen vivas: se pintan arriba y son a las que uno se puede apuntar. */
  readonly open = computed(() =>
    this._lobbies().filter((lobby) => lobby.status === 'POLLING' || lobby.status === 'CONFIRMED'),
  );

  /** Convocar está en vuelo: bloquea el botón para que un doble clic no cree dos. */
  private readonly _creating = signal(false);
  readonly creating = this._creating.asReadonly();

  /**
   * Carga la primera página del grupo si no está ya cargada. Idempotente: volver a la vista no
   * vuelve a pedir. Para forzar el refetch, {@link reload}.
   */
  async ensureLoaded(groupId: string): Promise<void> {
    if (this.currentGroupId === groupId && this._status() === 'ready') return;
    await this.load(groupId, 0);
  }

  /** Fuerza el refetch de la página visible. Lo llama el aviso en vivo y el reintento. */
  async reload(): Promise<void> {
    if (this.currentGroupId) await this.load(this.currentGroupId, this._page());
  }

  /** Salta a una página (0-based). */
  async goToPage(page: number): Promise<void> {
    if (this.currentGroupId) await this.load(this.currentGroupId, Math.max(0, page));
  }

  private async load(groupId: string, page: number): Promise<void> {
    const seq = ++this.seq;
    this.currentGroupId = groupId;
    this._status.set('loading');
    try {
      const result = await firstValueFrom(
        this.api.listForGroup(groupId, page, LobbiesStore.PAGE_SIZE),
      );
      // Otro grupo o otra página pidió mientras viajaba: esta respuesta ya no interesa.
      if (seq !== this.seq) return;
      this._lobbies.set(result.content);
      this._totalElements.set(result.totalElements);
      this._page.set(result.page);
      this._status.set('ready');
    } catch {
      if (seq !== this.seq) return;
      this._status.set('error');
    }
  }

  /**
   * Convoca una partida. PESIMISTA y no reentrante: el llamante espera la confirmación antes de
   * navegar o cantar victoria, y `creating` impide el doble envío. Lanza si falla, para que la
   * vista pinte el mensaje con `errorMessage(e)`.
   */
  async create(groupId: string, body: CreateLobbyRequest): Promise<LobbyResponse> {
    if (this._creating()) throw new Error('create already in flight');
    this._creating.set(true);
    try {
      const created = await firstValueFrom(this.api.create(groupId, body));
      // La lista acaba de quedarse vieja: refetch en vez de insertar a mano, que sería
      // reimplementar en cliente el orden que decide el servidor.
      await this.load(groupId, 0);
      return created;
    } finally {
      this._creating.set(false);
    }
  }

  /** Al cerrar sesión no debe quedar rastro de las convocatorias del usuario anterior. */
  clear(): void {
    this.currentGroupId = null;
    this.seq++;
    this._status.set('idle');
    this._lobbies.set([]);
    this._totalElements.set(0);
    this._page.set(0);
    this._creating.set(false);
  }
}
