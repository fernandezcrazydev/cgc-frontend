import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { LinkedDevice } from './models';
import { DevicesApi } from './devices-api';
import { DevicesStore } from './devices-store';

/**
 * Doble del API con emisiones resueltas a mano: así se puede observar el estado del store
 * MIENTRAS la petición está en vuelo (loading / revoking), que es justo lo que la vista pinta.
 */
class ApiStub {
  listCalls = 0;
  revokeCalls = 0;
  lastRevoked: string | null = null;

  private resolveList!: (d: LinkedDevice[]) => void;
  private resolveRevoke!: () => void;
  failList = false;
  revokeError: unknown = null;

  list(): Observable<LinkedDevice[]> {
    this.listCalls++;
    if (this.failList) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveList = (d) => {
        sub.next(d);
        sub.complete();
      };
    });
  }

  revoke(id: string): Observable<void> {
    this.revokeCalls++;
    this.lastRevoked = id;
    if (this.revokeError) return throwError(() => this.revokeError);
    return new Observable((sub) => {
      this.resolveRevoke = () => {
        sub.next();
        sub.complete();
      };
    });
  }

  async settleList(d: LinkedDevice[]): Promise<void> {
    this.resolveList(d);
    await Promise.resolve();
  }

  async settleRevoke(): Promise<void> {
    this.resolveRevoke();
    await Promise.resolve();
  }
}

const DEVICE_A: LinkedDevice = {
  id: 'dev-a', scopes: ['profile:read'], linkedAt: '2026-07-20T18:00:00Z', expiresAt: null,
};
const DEVICE_B: LinkedDevice = {
  id: 'dev-b', scopes: ['matches:upload'], linkedAt: '2026-07-21T18:00:00Z', expiresAt: null,
};

describe('DevicesStore', () => {
  let store: DevicesStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [DevicesStore, { provide: DevicesApi, useValue: api }],
    });
    store = TestBed.inject(DevicesStore);
  });

  it('arranca idle y sin lista, sin inventarse una vacía', () => {
    expect(store.status()).toBe('idle');
    expect(store.devices()).toBeNull();
  });

  it('ensureLoaded pasa por loading y deja la lista en ready', async () => {
    const load = store.ensureLoaded();
    expect(store.status()).toBe('loading');

    await api.settleList([DEVICE_A, DEVICE_B]);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.devices()).toEqual([DEVICE_A, DEVICE_B]);
  });

  it('ensureLoaded deduplica las llamadas concurrentes en una sola petición', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();

    await api.settleList([DEVICE_A]);
    await Promise.all([a, b]);

    expect(api.listCalls).toBe(1);
  });

  it('un fallo de carga deja status error y lista a null, y se puede reintentar', async () => {
    api.failList = true;
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.devices()).toBeNull();

    api.failList = false;
    const retry = store.reload();
    await api.settleList([DEVICE_A]);
    await retry;

    expect(api.listCalls).toBe(2);
    expect(store.devices()).toEqual([DEVICE_A]);
  });

  it('revoke marca el id como revoking y solo lo quita cuando el servidor confirma', async () => {
    const load = store.ensureLoaded();
    await api.settleList([DEVICE_A, DEVICE_B]);
    await load;

    const revoking = store.revoke('dev-a');
    expect(store.isRevoking('dev-a')).toBe(true);
    expect(store.devices()).toEqual([DEVICE_A, DEVICE_B]); // aún nada hasta confirmar

    await api.settleRevoke();
    await revoking;

    expect(store.isRevoking('dev-a')).toBe(false);
    expect(store.devices()).toEqual([DEVICE_B]);
  });

  /** Doble submit: dos toques al mismo botón no lanzan dos DELETE. */
  it('revoke es no reentrante para el mismo id', async () => {
    const load = store.ensureLoaded();
    await api.settleList([DEVICE_A]);
    await load;

    const first = store.revoke('dev-a');
    await store.revoke('dev-a'); // ignorado mientras el primero vuela

    await api.settleRevoke();
    await first;
    expect(api.revokeCalls).toBe(1);
  });

  /** Un 404 (ya no existía) es lo que el usuario quería: se retira la fila sin lanzar. */
  it('revoke trata el 404 como éxito y quita la fila', async () => {
    const load = store.ensureLoaded();
    await api.settleList([DEVICE_A, DEVICE_B]);
    await load;

    api.revokeError = new HttpErrorResponse({ status: 404, error: { code: 'DEVICE_NOT_FOUND' } });
    await store.revoke('dev-a');

    expect(store.devices()).toEqual([DEVICE_B]);
    expect(store.isRevoking('dev-a')).toBe(false);
  });

  /** Cualquier otro fallo se propaga para que la vista lo traduzca, y la fila se queda. */
  it('revoke propaga un fallo que no es 404 y no toca la lista', async () => {
    const load = store.ensureLoaded();
    await api.settleList([DEVICE_A]);
    await load;

    api.revokeError = new HttpErrorResponse({ status: 500 });
    await expect(store.revoke('dev-a')).rejects.toBeTruthy();

    expect(store.devices()).toEqual([DEVICE_A]);
    expect(store.isRevoking('dev-a')).toBe(false);
  });

  it('clear borra el rastro del usuario anterior', async () => {
    const load = store.ensureLoaded();
    await api.settleList([DEVICE_A]);
    await load;

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.devices()).toBeNull();
  });
});
