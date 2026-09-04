import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { ActiveSession } from './models';
import { SessionsApi } from './sessions-api';
import { SessionsStore } from './sessions-store';

/**
 * Doble del API con emisiones resueltas a mano: así se puede observar el estado del store
 * MIENTRAS la petición está en vuelo (loading / closing), que es justo lo que la vista pinta.
 */
class ApiStub {
  listCalls = 0;
  closeCalls = 0;
  lastClosed: string | null = null;

  private resolveList!: (s: ActiveSession[]) => void;
  private resolveClose!: () => void;
  failList = false;
  closeError: unknown = null;

  list(): Observable<ActiveSession[]> {
    this.listCalls++;
    if (this.failList) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveList = (s) => {
        sub.next(s);
        sub.complete();
      };
    });
  }

  close(id: string): Observable<void> {
    this.closeCalls++;
    this.lastClosed = id;
    if (this.closeError) return throwError(() => this.closeError);
    return new Observable((sub) => {
      this.resolveClose = () => {
        sub.next();
        sub.complete();
      };
    });
  }

  async settleList(s: ActiveSession[]): Promise<void> {
    this.resolveList(s);
    await Promise.resolve();
  }

  async settleClose(): Promise<void> {
    this.resolveClose();
    await Promise.resolve();
  }
}

function session(id: string, current = false): ActiveSession {
  return {
    id,
    kind: 'WEB',
    browser: 'Chrome',
    operatingSystem: 'Windows',
    scopes: [],
    startedAt: '2026-09-01T10:00:00Z',
    lastSeenAt: '2026-09-04T09:00:00Z',
    expiresAt: '2026-10-01T10:00:00Z',
    current,
  };
}

const CURRENT = session('sess-current', true);
const PHONE = session('sess-phone');

describe('SessionsStore', () => {
  let store: SessionsStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [SessionsStore, { provide: SessionsApi, useValue: api }],
    });
    store = TestBed.inject(SessionsStore);
  });

  it('arranca idle y sin lista, sin inventarse una vacía', () => {
    expect(store.status()).toBe('idle');
    expect(store.sessions()).toBeNull();
  });

  it('ensureLoaded pasa por loading y deja la lista en ready', async () => {
    const load = store.ensureLoaded();
    expect(store.status()).toBe('loading');

    await api.settleList([CURRENT, PHONE]);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.sessions()).toEqual([CURRENT, PHONE]);
  });

  it('ensureLoaded deduplica las llamadas concurrentes en una sola petición', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();

    await api.settleList([CURRENT]);
    await Promise.all([a, b]);

    expect(api.listCalls).toBe(1);
  });

  it('un fallo de carga deja status error y lista a null, y se puede reintentar', async () => {
    api.failList = true;
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.sessions()).toBeNull();

    api.failList = false;
    const retry = store.reload();
    await api.settleList([CURRENT]);
    await retry;

    expect(api.listCalls).toBe(2);
    expect(store.sessions()).toEqual([CURRENT]);
  });

  it('close marca el id como closing y solo lo quita cuando el servidor confirma', async () => {
    const load = store.ensureLoaded();
    await api.settleList([CURRENT, PHONE]);
    await load;

    const closing = store.close('sess-phone');
    expect(store.isClosing('sess-phone')).toBe(true);
    expect(store.sessions()).toEqual([CURRENT, PHONE]); // aún nada hasta confirmar

    await api.settleClose();
    await closing;

    expect(store.isClosing('sess-phone')).toBe(false);
    expect(store.sessions()).toEqual([CURRENT]);
  });

  /** Doble submit: dos toques al mismo botón no lanzan dos DELETE. */
  it('close es no reentrante para el mismo id', async () => {
    const load = store.ensureLoaded();
    await api.settleList([CURRENT, PHONE]);
    await load;

    const first = store.close('sess-phone');
    await store.close('sess-phone'); // ignorado mientras el primero vuela

    await api.settleClose();
    await first;
    expect(api.closeCalls).toBe(1);
  });

  /**
   * Un 404 es el reintento tras una respuesta perdida, o una sesión que ya había caducado. En los
   * dos casos el usuario consiguió lo que pedía: se retira la fila sin lanzar.
   */
  it('close trata el 404 como éxito y quita la fila', async () => {
    const load = store.ensureLoaded();
    await api.settleList([CURRENT, PHONE]);
    await load;

    api.closeError = new HttpErrorResponse({ status: 404, error: { code: 'SESSION_NOT_FOUND' } });
    await store.close('sess-phone');

    expect(store.sessions()).toEqual([CURRENT]);
    expect(store.isClosing('sess-phone')).toBe(false);
  });

  /**
   * El 409 NO es lo mismo que el 404, y es el caso que se cuela solo si alguien copia el `catch`
   * del 404 sin mirar: la sesión sigue viva, así que quitarla de la lista pintaría lo contrario de
   * lo que ha pasado. Se propaga para que la vista lo diga.
   */
  it('close propaga el 409 de la sesión actual y NO la quita de la lista', async () => {
    const load = store.ensureLoaded();
    await api.settleList([CURRENT, PHONE]);
    await load;

    api.closeError = new HttpErrorResponse({
      status: 409,
      error: { code: 'CURRENT_SESSION_NOT_REVOCABLE' },
    });
    await expect(store.close('sess-current')).rejects.toBeTruthy();

    expect(store.sessions()).toEqual([CURRENT, PHONE]);
    expect(store.isClosing('sess-current')).toBe(false);
  });

  /** Cualquier otro fallo se propaga para que la vista lo traduzca, y la fila se queda. */
  it('close propaga un fallo que no es 404 y no toca la lista', async () => {
    const load = store.ensureLoaded();
    await api.settleList([PHONE]);
    await load;

    api.closeError = new HttpErrorResponse({ status: 500 });
    await expect(store.close('sess-phone')).rejects.toBeTruthy();

    expect(store.sessions()).toEqual([PHONE]);
    expect(store.isClosing('sess-phone')).toBe(false);
  });

  it('clear borra el rastro del usuario anterior', async () => {
    const load = store.ensureLoaded();
    await api.settleList([CURRENT]);
    await load;

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.sessions()).toBeNull();
  });
});
