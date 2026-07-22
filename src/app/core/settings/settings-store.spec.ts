import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { UserSettings } from './models';
import { SettingsApi } from './settings-api';
import { SettingsStore } from './settings-store';

/**
 * Doble del API con emisiones resueltas a mano: así se puede observar el estado del store
 * MIENTRAS la petición está en vuelo (loading / saving), que es justo lo que la vista pinta.
 */
class ApiStub {
  getCalls = 0;
  updateCalls = 0;
  lastUpdate: UserSettings | null = null;

  private resolveGet!: (s: UserSettings) => void;
  private resolveUpdate!: (s: UserSettings) => void;
  failGet = false;
  failUpdate = false;

  get(): Observable<UserSettings> {
    this.getCalls++;
    if (this.failGet) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveGet = (s) => {
        sub.next(s);
        sub.complete();
      };
    });
  }

  update(settings: UserSettings): Observable<UserSettings> {
    this.updateCalls++;
    this.lastUpdate = settings;
    if (this.failUpdate) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveUpdate = (s) => {
        sub.next(s);
        sub.complete();
      };
    });
  }

  /** Deja que el microtask de `firstValueFrom` corra tras emitir. */
  async settleGet(s: UserSettings): Promise<void> {
    this.resolveGet(s);
    await Promise.resolve();
  }

  async settleUpdate(s: UserSettings): Promise<void> {
    this.resolveUpdate(s);
    await Promise.resolve();
  }
}

const OPEN: UserSettings = { allowGroupInvites: true };
const CLOSED: UserSettings = { allowGroupInvites: false };

describe('SettingsStore', () => {
  let store: SettingsStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [SettingsStore, { provide: SettingsApi, useValue: api }],
    });
    store = TestBed.inject(SettingsStore);
  });

  /**
   * Nada de defaults locales: si el store arrancara con `allowGroupInvites: true`, quien las
   * tiene apagadas vería el interruptor encendido durante la carga y creería que se ha
   * reactivado solo.
   */
  it('arranca idle y sin ajustes, sin inventarse valores por defecto', () => {
    expect(store.status()).toBe('idle');
    expect(store.settings()).toBeNull();
  });

  it('ensureLoaded pasa por loading y deja los ajustes en ready', async () => {
    const load = store.ensureLoaded();
    expect(store.status()).toBe('loading');
    expect(store.isLoading()).toBe(true);

    await api.settleGet(CLOSED);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.settings()).toEqual(CLOSED);
  });

  it('ensureLoaded deduplica las llamadas concurrentes en una sola petición', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();

    await api.settleGet(OPEN);
    await Promise.all([a, b]);

    expect(api.getCalls).toBe(1);
  });

  it('ensureLoaded no vuelve a pedir nada una vez está ready', async () => {
    const load = store.ensureLoaded();
    await api.settleGet(OPEN);
    await load;

    await store.ensureLoaded();

    expect(api.getCalls).toBe(1);
  });

  it('un fallo de carga deja status error y ajustes a null', async () => {
    api.failGet = true;

    await store.ensureLoaded();

    expect(store.status()).toBe('error');
    expect(store.settings()).toBeNull();
  });

  /** Si la promesa rechazada quedara cacheada, el botón de reintentar no tocaría la red nunca más. */
  it('tras un fallo se puede reintentar y la segunda carga sí funciona', async () => {
    api.failGet = true;
    await store.ensureLoaded();

    api.failGet = false;
    const retry = store.reload();
    await api.settleGet(OPEN);
    await retry;

    expect(api.getCalls).toBe(2);
    expect(store.status()).toBe('ready');
    expect(store.settings()).toEqual(OPEN);
  });

  it('update marca saving y publica lo que confirma el servidor', async () => {
    const saving = store.update(CLOSED);
    expect(store.saving()).toBe(true);

    await api.settleUpdate(CLOSED);
    await saving;

    expect(api.lastUpdate).toEqual(CLOSED);
    expect(store.saving()).toBe(false);
    expect(store.status()).toBe('ready');
    expect(store.settings()).toEqual(CLOSED);
  });

  /** Escritura pesimista: un fallo no debe dejar el interruptor mostrando algo que no se guardó. */
  it('un update que falla lanza y no toca los ajustes publicados', async () => {
    const load = store.ensureLoaded();
    await api.settleGet(OPEN);
    await load;

    api.failUpdate = true;
    await expect(store.update(CLOSED)).rejects.toThrow();

    expect(store.settings()).toEqual(OPEN);
    expect(store.saving()).toBe(false);
  });

  /** Doble submit: dos toques seguidos al interruptor no pueden lanzar dos PUT. */
  it('update es no reentrante mientras hay uno en vuelo', async () => {
    const first = store.update(CLOSED);

    await expect(store.update(OPEN)).rejects.toThrow();

    await api.settleUpdate(CLOSED);
    await first;
    expect(api.updateCalls).toBe(1);
  });

  it('clear borra el rastro del usuario anterior', async () => {
    const load = store.ensureLoaded();
    await api.settleGet(CLOSED);
    await load;

    store.clear();

    expect(store.settings()).toBeNull();
    expect(store.status()).toBe('idle');
  });
});
