import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { RolePreferences } from './models';
import { PreferencesApi } from './preferences-api';
import { PreferencesStore } from './preferences-store';

/**
 * Doble del API con promesas resueltas a mano: así se puede observar el estado
 * del store MIENTRAS la petición está en vuelo (loading / saving), que es
 * justo lo que la vista pinta.
 */
class ApiStub {
  getCalls = 0;
  updateCalls = 0;
  lastUpdate: RolePreferences | null = null;

  private resolveGet!: (p: RolePreferences) => void;
  private resolveUpdate!: (p: RolePreferences) => void;
  failGet = false;
  failUpdate = false;

  get(): Observable<RolePreferences> {
    this.getCalls++;
    if (this.failGet) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveGet = (p) => {
        sub.next(p);
        sub.complete();
      };
    });
  }

  update(prefs: RolePreferences): Observable<RolePreferences> {
    this.updateCalls++;
    this.lastUpdate = prefs;
    if (this.failUpdate) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveUpdate = (p) => {
        sub.next(p);
        sub.complete();
      };
    });
  }

  /** Deja que el microtask de `firstValueFrom` corra tras emitir. */
  async settleGet(p: RolePreferences): Promise<void> {
    this.resolveGet(p);
    await Promise.resolve();
  }

  async settleUpdate(p: RolePreferences): Promise<void> {
    this.resolveUpdate(p);
    await Promise.resolve();
  }
}

const PREFS: RolePreferences = { roles: ['JUNGLA', 'MID'], primary: 'MID' };

describe('PreferencesStore', () => {
  let store: PreferencesStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [PreferencesStore, { provide: PreferencesApi, useValue: api }],
    });
    store = TestBed.inject(PreferencesStore);
  });

  it('arranca idle y sin roles', () => {
    expect(store.status()).toBe('idle');
    expect(store.roles()).toEqual([]);
    expect(store.primary()).toBeNull();
  });

  it('ensureLoaded pasa por loading y deja los datos en ready', async () => {
    const load = store.ensureLoaded();
    expect(store.status()).toBe('loading');

    await api.settleGet(PREFS);
    await load;

    expect(store.status()).toBe('ready');
    expect(store.roles()).toEqual(['JUNGLA', 'MID']);
    expect(store.primary()).toBe('MID');
  });

  it('deduplica las cargas concurrentes en una sola petición', async () => {
    const a = store.ensureLoaded();
    const b = store.ensureLoaded();
    await api.settleGet(PREFS);
    await Promise.all([a, b]);

    expect(api.getCalls).toBe(1);
  });

  it('no vuelve a pedir una vez cargado, y reload sí fuerza el refetch', async () => {
    const load = store.ensureLoaded();
    await api.settleGet(PREFS);
    await load;

    await store.ensureLoaded();
    expect(api.getCalls).toBe(1);

    const again = store.reload();
    expect(store.status()).toBe('loading');
    await api.settleGet(PREFS);
    await again;
    expect(api.getCalls).toBe(2);
  });

  it('un fallo de carga deja status error y permite reintentar', async () => {
    api.failGet = true;
    await store.ensureLoaded();
    expect(store.status()).toBe('error');

    api.failGet = false;
    const retry = store.reload();
    await api.settleGet(PREFS);
    await retry;

    expect(store.status()).toBe('ready');
    expect(store.roles()).toEqual(['JUNGLA', 'MID']);
  });

  it('save es pesimista: no publica el cambio hasta que el servidor confirma', async () => {
    const load = store.ensureLoaded();
    await api.settleGet(PREFS);
    await load;

    const next: RolePreferences = { roles: ['TOP'], primary: 'TOP' };
    const saving = store.save(next);

    expect(store.saving()).toBe(true);
    expect(store.roles()).toEqual(['JUNGLA', 'MID']); // todavía el valor viejo

    await api.settleUpdate(next);
    expect(await saving).toBe(true);

    expect(store.saving()).toBe(false);
    expect(store.roles()).toEqual(['TOP']);
    expect(store.primary()).toBe('TOP');
  });

  it('save no es reentrante: un segundo submit mientras hay uno en vuelo se ignora', async () => {
    const first = store.save(PREFS);
    const second = await store.save({ roles: ['ADC'], primary: 'ADC' });

    expect(second).toBe(false);
    expect(api.updateCalls).toBe(1);

    await api.settleUpdate(PREFS);
    expect(await first).toBe(true);
  });

  it('si save falla devuelve false y conserva el último valor confirmado', async () => {
    const load = store.ensureLoaded();
    await api.settleGet(PREFS);
    await load;

    api.failUpdate = true;
    const ok = await store.save({ roles: ['TOP'], primary: 'TOP' });

    expect(ok).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.roles()).toEqual(['JUNGLA', 'MID']);
  });

  it('clear borra el estado (logout)', async () => {
    const load = store.ensureLoaded();
    await api.settleGet(PREFS);
    await load;

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.roles()).toEqual([]);
  });
});
