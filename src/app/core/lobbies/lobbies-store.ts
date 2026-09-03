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

  /**
   * Refetch SIN vaciar la pantalla: el estado no pasa por `loading`, así que la vista
   * no se cae a esqueletos ni pierde el scroll.
   *
   * Es lo que va después de una escritura **y lo que debe usar el aviso en vivo**.
   * Apuntarse a una hora cambia una cifra de una tarjeta, y hacer parpadear el panel
   * entero para eso se leía como si la página se recargara: la vista se caía a
   * esqueletos, el documento se encogía y el navegador tiraba el scroll al principio.
   * Lo mismo valía cuando quien se apuntaba era otro y llegaba su aviso por SSE.
   *
   * Si el refetch falla tampoco se marca error: lo que hay en pantalla sigue siendo
   * válido, solo un poco viejo, y borrarlo sería peor que mantenerlo. `reload()`, la
   * ruidosa, se reserva para el reintento explícito, que es cuando el usuario ha
   * pedido que se vuelva a cargar y espera verlo.
   */
  async refreshQuietly(): Promise<void> {
    if (this.currentGroupId) await this.load(this.currentGroupId, this._page(), true);
  }

  /** Salta a una página (0-based). */
  async goToPage(page: number): Promise<void> {
    if (this.currentGroupId) await this.load(this.currentGroupId, Math.max(0, page));
  }

  private async load(groupId: string, page: number, silent = false): Promise<void> {
    const seq = ++this.seq;
    this.currentGroupId = groupId;
    if (!silent) this._status.set('loading');
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
      if (seq !== this.seq || silent) return;
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
      // reimplementar en cliente el orden que decide el servidor. En silencio, para que
      // la pantalla no parpadee entera por una tarjeta nueva.
      await this.load(groupId, 0, true);
      return created;
    } finally {
      this._creating.set(false);
    }
  }

  /**
   * Ids de franja con una acción en vuelo. Se guarda por franja y no con un único
   * booleano porque el panel de convocatorias (§5.5.6) pinta varias a la vez: un
   * `pending` global apagaría todos los botones de la columna por pulsar uno.
   */
  private readonly _acting = signal<ReadonlySet<string>>(new Set());
  isActing(slotId: string): boolean {
    return this._acting().has(slotId);
  }

  /** «Cuenta conmigo a esa hora». Lanza si falla; la vista pinta el mensaje. */
  async signUp(lobbyId: string, slotId: string): Promise<void> {
    await this.act(slotId, () => firstValueFrom(this.api.signUp(lobbyId, slotId)));
  }

  /** «Al final no puedo». */
  async withdraw(lobbyId: string, slotId: string): Promise<void> {
    await this.act(slotId, () => firstValueFrom(this.api.withdraw(lobbyId, slotId)));
  }

  /**
   * Aplica de una vez a qué horas puede alguien: se apunta a `join` y se borra de
   * `leave`.
   *
   * Existe además de `signUp`/`withdraw` porque decir «puedo a dos de las tres» es UNA
   * decisión: hacerlo con tres llamadas sueltas eran tres refetch y la lista saltando
   * bajo el dedo tres veces. Aquí se manda todo y se refresca una sola vez al final.
   *
   * No es atómico —el backend no ofrece un endpoint de disponibilidad— así que si una
   * de las llamadas falla, las anteriores ya se aplicaron. Se refresca igualmente antes
   * de propagar el error, para que la pantalla enseñe lo que de verdad quedó guardado
   * en vez de lo que el usuario había marcado.
   */
  async setAvailability(lobbyId: string, join: string[], leave: string[]): Promise<void> {
    if (this._savingAvailability()) return;
    this._savingAvailability.set(true);
    try {
      for (const slotId of join) {
        await firstValueFrom(this.api.signUp(lobbyId, slotId));
      }
      for (const slotId of leave) {
        await firstValueFrom(this.api.withdraw(lobbyId, slotId));
      }
    } finally {
      this._savingAvailability.set(false);
      await this.refreshQuietly();
    }
  }

  /** Guardar la disponibilidad está en vuelo: bloquea el botón del modal. */
  private readonly _savingAvailability = signal(false);
  readonly savingAvailability = this._savingAvailability.asReadonly();

  /**
   * Escritura pesimista y no reentrante sobre una franja: se espera la confirmación
   * y solo entonces se refresca la lista. Se refetchea en vez de meter la respuesta
   * a mano porque quién queda titular y quién suplente lo decide el servidor, y
   * recolocarlo aquí sería una segunda versión de esa regla.
   */
  private async act(slotId: string, call: () => Promise<unknown>): Promise<void> {
    if (this._acting().has(slotId)) return;
    this._acting.update((set) => new Set(set).add(slotId));
    try {
      await call();
      await this.refreshQuietly();
    } finally {
      this._acting.update((set) => {
        const next = new Set(set);
        next.delete(slotId);
        return next;
      });
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
    this._acting.set(new Set());
    this._savingAvailability.set(false);
  }
}
