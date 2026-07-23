import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { RiotAccountApi } from './riot-account-api';
import { RiotAccountStore } from './riot-account-store';
import { LinkRiotAccountRequest, RiotAccount, RiotAccountStatus } from './models';

const ACCOUNT: RiotAccount = {
  riotId: 'N1ghtfang#LAN',
  gameName: 'N1ghtfang',
  tagLine: 'LAN',
  region: 'LAN',
  strength: 'DECLARED',
  verifiedAt: null,
  linkedAt: '2026-07-20T18:00:00Z',
};

const LINKED: RiotAccountStatus = { account: ACCOUNT, relinkAvailableAt: null };
const ON_COOLDOWN: RiotAccountStatus = { account: null, relinkAvailableAt: '2026-07-23T10:00:00Z' };

/** Doble del API con el `link` resuelto a mano, para observar `saving` MIENTRAS está en vuelo. */
class ApiStub {
  statusCalls = 0;
  linkCalls = 0;
  unlinkCalls = 0;
  lastLink: LinkRiotAccountRequest | null = null;
  nextStatus: RiotAccountStatus = LINKED;
  failLink = false;

  private resolveLink!: (status: RiotAccountStatus) => void;

  status(): Observable<RiotAccountStatus> {
    this.statusCalls++;
    return of(this.nextStatus);
  }

  link(request: LinkRiotAccountRequest): Observable<RiotAccountStatus> {
    this.linkCalls++;
    this.lastLink = request;
    if (this.failLink) return throwError(() => new Error('boom'));
    return new Observable<RiotAccountStatus>((sub) => {
      this.resolveLink = (status) => {
        sub.next(status);
        sub.complete();
      };
    });
  }

  unlink(): Observable<void> {
    this.unlinkCalls++;
    return of(void 0);
  }

  /** Deja que el microtask de `firstValueFrom` corra tras emitir. */
  async settleLink(status: RiotAccountStatus = LINKED): Promise<void> {
    this.resolveLink(status);
    await Promise.resolve();
  }
}

describe('RiotAccountStore', () => {
  let store: RiotAccountStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [RiotAccountStore, { provide: RiotAccountApi, useValue: api }],
    });
    store = TestBed.inject(RiotAccountStore);
  });

  it('arranca sin saber nada y sin haber tocado la red', () => {
    expect(store.account()).toBeNull();
    expect(store.status()).toBe('idle');
    expect(api.statusCalls).toBe(0);
  });

  it('carga la cuenta vinculada una sola vez', async () => {
    await store.ensureLoaded();
    await store.ensureLoaded();

    expect(store.account()).toEqual(ACCOUNT);
    expect(store.status()).toBe('ready');
    expect(api.statusCalls).toBe(1);
  });

  it('no tener cuenta no es un error: expone el cooldown si lo hay', async () => {
    api.nextStatus = ON_COOLDOWN;

    await store.ensureLoaded();

    expect(store.account()).toBeNull();
    expect(store.status()).toBe('ready');
    expect(store.relinkBlocked()).toBe(true);
    expect(store.relinkAvailableAt()).toBe('2026-07-23T10:00:00Z');
  });

  /** El estado local no puede afirmar una vinculación que el servidor aún no ha confirmado. */
  it('no publica la cuenta hasta que el servidor confirma', async () => {
    const pending = store.link({ riotId: 'N1ghtfang#LAN', region: 'LAN' });

    expect(store.saving()).toBe(true);
    expect(store.account()).toBeNull();

    await api.settleLink();
    await pending;

    expect(store.saving()).toBe(false);
    expect(store.account()).toEqual(ACCOUNT);
  });

  it('ignora un segundo intento mientras hay otro en vuelo', async () => {
    const first = store.link({ riotId: 'N1ghtfang#LAN', region: 'LAN' });

    await expect(store.link({ riotId: 'Otro#EUW', region: 'EUW' })).resolves.toBe(false);
    expect(api.linkCalls).toBe(1);

    await api.settleLink();
    await first;
  });

  /** El motivo del rechazo vive en el `code` del ProblemDetail y solo la vista sabe traducirlo. */
  it('propaga el fallo del backend y deja de estar guardando', async () => {
    api.failLink = true;

    await expect(store.link({ riotId: 'N1ghtfang#LAN', region: 'LAN' })).rejects.toThrow();
    expect(store.saving()).toBe(false);
    expect(store.account()).toBeNull();
  });

  it('al desvincular relee el estado para conocer el cooldown que se acaba de abrir', async () => {
    await store.ensureLoaded();
    api.nextStatus = ON_COOLDOWN;

    await expect(store.unlink()).resolves.toBe(true);

    expect(api.unlinkCalls).toBe(1);
    expect(store.account()).toBeNull();
    expect(store.relinkAvailableAt()).toBe('2026-07-23T10:00:00Z');
  });

  it('un fallo de carga deja el store en error, no colgado', async () => {
    api.status = () => throwError(() => new Error('boom'));

    await store.ensureLoaded();

    expect(store.status()).toBe('error');
    expect(store.account()).toBeNull();
  });

  it('clear() no deja rastro de la cuenta del usuario anterior', async () => {
    await store.ensureLoaded();

    store.clear();

    expect(store.account()).toBeNull();
    expect(store.status()).toBe('idle');
  });
});
