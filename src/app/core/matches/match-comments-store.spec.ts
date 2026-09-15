import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { Session } from '../auth';
import { MatchCommentsStore } from './match-comments-store';
import { MatchesApi } from './matches-api';
import { MatchComment } from './models';

const ME = 'me-uuid';
const OTHER = 'other-uuid';

function comment(id: string, userId: string, text = 'lo que sea'): MatchComment {
  return {
    id,
    userId,
    discordUsername: 'Ana',
    avatarUrl: null,
    text,
    createdAt: '2026-09-15T21:04:00Z',
  };
}

/**
 * Doble del API con emisiones resueltas a mano, igual que el de `SettingsStore`: así se puede
 * observar el estado MIENTRAS la petición viaja (`loading`, `saving`, `deleting`), que es
 * exactamente lo que la vista pinta.
 */
class ApiStub {
  listCalls = 0;
  leaveCalls = 0;
  deleteCalls = 0;
  failList = false;

  /**
   * Una COLA de resolvedores y no uno solo: el test de la respuesta obsoleta necesita tener dos
   * peticiones vivas a la vez y resolver la vieja DESPUES de la nueva, que es justo el orden que
   * el numero de secuencia del store tiene que ignorar.
   */
  private readonly pendingLists: ((thread: MatchComment[]) => void)[] = [];
  private resolveLeave!: (saved: MatchComment) => void;
  private resolveDelete!: () => void;

  comments(): Observable<MatchComment[]> {
    this.listCalls++;
    if (this.failList) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.pendingLists.push((thread) => {
        sub.next(thread);
        sub.complete();
      });
    });
  }

  leaveComment(): Observable<MatchComment> {
    this.leaveCalls++;
    return new Observable((sub) => {
      this.resolveLeave = (saved) => {
        sub.next(saved);
        sub.complete();
      };
    });
  }

  deleteComment(): Observable<void> {
    this.deleteCalls++;
    return new Observable((sub) => {
      this.resolveDelete = () => {
        sub.next(undefined);
        sub.complete();
      };
    });
  }

  /** Resuelve la peticion mas antigua sin resolver (FIFO). */
  async settleList(thread: MatchComment[]): Promise<void> {
    this.pendingLists.shift()!(thread);
    await Promise.resolve();
  }

  /** Resuelve la que se pidio en la posicion `index`, para poder resolverlas fuera de orden. */
  async settleListAt(index: number, thread: MatchComment[]): Promise<void> {
    this.pendingLists.splice(index, 1)[0](thread);
    await Promise.resolve();
  }

  async settleLeave(saved: MatchComment): Promise<void> {
    this.resolveLeave(saved);
    await Promise.resolve();
  }

  async settleDelete(): Promise<void> {
    this.resolveDelete();
    await Promise.resolve();
  }
}

describe('MatchCommentsStore', () => {
  let store: MatchCommentsStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [
        MatchCommentsStore,
        { provide: MatchesApi, useValue: api },
        { provide: Session, useValue: { user: signal({ userId: ME }) } },
      ],
    });
    store = TestBed.inject(MatchCommentsStore);
  });

  it('arranca idle y con el hilo vacio', () => {
    expect(store.status()).toBe('idle');
    expect(store.comments()).toEqual([]);
  });

  it('ensureLoaded pasa por loading y deja el hilo en ready', async () => {
    const load = store.ensureLoaded('m1');
    expect(store.status()).toBe('loading');

    await api.settleList([comment('c1', OTHER)]);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.comments()).toHaveLength(1);
  });

  it('no vuelve a pedir el hilo de la misma partida una vez esta ready', async () => {
    const load = store.ensureLoaded('m1');
    await api.settleList([]);
    await load;

    await store.ensureLoaded('m1');

    expect(api.listCalls).toBe(1);
  });

  it('cambiar de partida si vuelve a pedirlo', async () => {
    const first = store.ensureLoaded('m1');
    await api.settleList([]);
    await first;

    const second = store.ensureLoaded('m2');
    await api.settleList([comment('c9', OTHER)]);
    await second;

    expect(api.listCalls).toBe(2);
    expect(store.comments()).toHaveLength(1);
  });

  it('un fallo deja status error y el hilo vacio, no a medias', async () => {
    api.failList = true;

    await store.ensureLoaded('m1');

    expect(store.status()).toBe('error');
    expect(store.comments()).toEqual([]);
  });

  /**
   * `alreadyCommented` sale del hilo que ya está en pantalla y no de otra petición: si estás en el
   * hilo, ya comentaste. Es lo que decide si se pinta la caja de texto.
   */
  it('sabe si ya he comentado mirando el hilo, sin preguntar al servidor', async () => {
    const load = store.ensureLoaded('m1');
    await api.settleList([comment('c1', OTHER)]);
    await load;
    expect(store.alreadyCommented()).toBe(false);

    const saving = store.leave('m1', 'el mio');
    await api.settleLeave(comment('c2', ME, 'el mio'));
    await saving;

    expect(store.alreadyCommented()).toBe(true);
  });

  /** El hilo va de más antiguo a más nuevo, y el que acaba de escribirse es el más nuevo. */
  it('el comentario nuevo se anade al final del hilo', async () => {
    const load = store.ensureLoaded('m1');
    await api.settleList([comment('c1', OTHER)]);
    await load;

    const saving = store.leave('m1', 'el mio');
    await api.settleLeave(comment('c2', ME, 'el mio'));
    await saving;

    expect(store.comments().map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  /**
   * Doble toque en un móvil con mala cobertura: sin este guard, el segundo POST se come el
   * `409 COMMENT_ALREADY_EXISTS` que este store existe para no provocar.
   */
  it('leave es no reentrante mientras hay uno en vuelo', async () => {
    const load = store.ensureLoaded('m1');
    await api.settleList([]);
    await load;

    const first = store.leave('m1', 'el mio');
    expect(store.saving()).toBe(true);
    await expect(store.leave('m1', 'otra vez')).rejects.toThrow();

    await api.settleLeave(comment('c2', ME, 'el mio'));
    await first;

    expect(api.leaveCalls).toBe(1);
    expect(store.saving()).toBe(false);
  });

  /** Pesimista: la fila se va cuando el servidor dice que se ha ido, no antes. */
  it('remove quita la fila solo despues de que el servidor confirme', async () => {
    const load = store.ensureLoaded('m1');
    await api.settleList([comment('c1', OTHER), comment('c2', ME)]);
    await load;

    const removing = store.remove('m1', 'c1');
    expect(store.deleting()).toBe('c1');
    expect(store.comments()).toHaveLength(2);

    await api.settleDelete();
    await removing;

    expect(store.comments().map((c) => c.id)).toEqual(['c2']);
    expect(store.deleting()).toBeNull();
  });

  /**
   * Respuesta obsoleta: si el hilo de la partida anterior llega tarde, no puede escribir sobre el
   * de la que está abierta ahora. Es el mismo número de secuencia que usa el resto de stores.
   */
  it('una respuesta que llega tarde no pisa el hilo de la partida actual', async () => {
    const stale = store.ensureLoaded('m1');
    const fresh = store.ensureLoaded('m2');

    // La de m2 (indice 1) contesta primero; la de m1 llega despues y ya no le toca escribir.
    await api.settleListAt(1, [comment('nuevo', OTHER)]);
    await fresh;
    await api.settleListAt(0, [comment('viejo', OTHER)]);
    await stale;

    expect(store.comments().map((c) => c.id)).toEqual(['nuevo']);
  });

  it('clear no deja el hilo del usuario anterior en memoria', async () => {
    const load = store.ensureLoaded('m1');
    await api.settleList([comment('c1', ME)]);
    await load;

    store.clear();

    expect(store.comments()).toEqual([]);
    expect(store.status()).toBe('idle');
    expect(store.alreadyCommented()).toBe(false);
  });
});
