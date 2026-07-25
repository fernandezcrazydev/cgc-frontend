import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { RiotAccountApi } from './riot-account-api';
import { RiotAccountStore } from './riot-account-store';
import { LinkRiotAccountRequest, PairingCode, RiotAccount, RiotAccountStatus } from './models';

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
  pairingCodeCalls = 0;
  lastLink: LinkRiotAccountRequest | null = null;
  nextStatus: RiotAccountStatus = LINKED;
  failLink = false;
  failPairingCode = false;

  private resolveLink!: (status: RiotAccountStatus) => void;
  private resolvePairingCode!: (code: PairingCode) => void;

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

  pairingCode(): Observable<PairingCode> {
    this.pairingCodeCalls++;
    if (this.failPairingCode) return throwError(() => new Error('boom'));
    return new Observable<PairingCode>((sub) => {
      this.resolvePairingCode = (code) => {
        sub.next(code);
        sub.complete();
      };
    });
  }

  /** Deja que el microtask de `firstValueFrom` corra tras emitir. */
  async settleLink(status: RiotAccountStatus = LINKED): Promise<void> {
    this.resolveLink(status);
    await Promise.resolve();
  }

  async settlePairingCode(code: PairingCode = CODE): Promise<void> {
    this.resolvePairingCode(code);
    await Promise.resolve();
  }
}

const CODE: PairingCode = { code: 'K7QM-3XPD', expiresAt: '2026-07-23T18:05:00Z' };

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

  it('genera un código de emparejamiento y marca generatingCode mientras vuela', async () => {
    const pending = store.requestPairingCode();
    expect(store.generatingCode()).toBe(true);

    await api.settlePairingCode();
    const code = await pending;

    expect(code).toEqual(CODE);
    expect(store.generatingCode()).toBe(false);
    expect(api.pairingCodeCalls).toBe(1);
  });

  /** El código es una credencial efímera: no se guarda en el estado del store. */
  it('no cachea el código ni toca el estado de la cuenta', async () => {
    await store.ensureLoaded();
    const pending = store.requestPairingCode();
    await api.settlePairingCode();
    await pending;

    expect(store.account()).toEqual(ACCOUNT);
    expect(store.status()).toBe('ready');
  });

  it('no lanza dos peticiones de código a la vez', async () => {
    const first = store.requestPairingCode();

    await expect(store.requestPairingCode()).resolves.toBeNull();
    expect(api.pairingCodeCalls).toBe(1);

    await api.settlePairingCode();
    await first;
  });

  it('propaga el fallo al pedir código y deja de generar', async () => {
    api.failPairingCode = true;

    await expect(store.requestPairingCode()).rejects.toThrow();
    expect(store.generatingCode()).toBe(false);
  });

  it('clear() no deja rastro de la cuenta del usuario anterior', async () => {
    await store.ensureLoaded();

    store.clear();

    expect(store.account()).toBeNull();
    expect(store.status()).toBe('idle');
  });

  /**
   * `refresh()` es el refetch silencioso para las notificaciones en vivo de vinculación
   * (`RIOT_ACCOUNT_PAIRED`/`VERIFIED`/`TAKEN_OVER`): a diferencia de `reload()`, no puede
   * pasar por `loading` porque el perfil pintaría un skeleton sobre un bloque que ya
   * funciona.
   */
  describe('refresh()', () => {
    const OTHER_ACCOUNT: RiotAccount = {
      ...ACCOUNT,
      riotId: 'Otro#EUW',
      gameName: 'Otro',
      tagLine: 'EUW',
      region: 'EUW',
    };

    /** La misma cuenta ya verificada: lo que devuelve el GET posterior al confirm del reto. */
    const VERIFIED_ACCOUNT: RiotAccount = {
      ...ACCOUNT,
      strength: 'VERIFIED',
      verifiedAt: '2026-07-25T10:03:40Z',
    };

    it('no toca status (se queda en ready durante y después) y sustituye los datos', async () => {
      await store.ensureLoaded();
      expect(store.status()).toBe('ready');

      const subject = new Subject<RiotAccountStatus>();
      api.status = () => subject.asObservable();

      const pending = store.refresh();
      // Mientras vuela, el skeleton NO debe reaparecer: sigue en ready.
      expect(store.status()).toBe('ready');

      subject.next({ account: OTHER_ACCOUNT, relinkAvailableAt: null });
      subject.complete();
      await pending;

      expect(store.status()).toBe('ready');
      expect(store.account()).toEqual(OTHER_ACCOUNT);
    });

    /**
     * El caso que de verdad ocurre: `PAIRED` y `VERIFIED` llegan con segundos de diferencia y
     * el GET del primero puede seguir en vuelo cuando entra el segundo. Si el segundo se
     * conformase con esa respuesta —que salió del servidor ANTES de la verificación— el perfil
     * se quedaría clavado en "vinculada desde el cliente" con la cuenta ya verificada, y nada
     * lo volvería a pedir hasta que el usuario navegase. Si este test se pone rojo, ese es el
     * bug que ha vuelto.
     */
    it('encadena otro GET cuando llega un evento con uno en vuelo, en vez de reutilizar su respuesta', async () => {
      await store.ensureLoaded();
      const subjects: Subject<RiotAccountStatus>[] = [];
      api.status = () => {
        const subject = new Subject<RiotAccountStatus>();
        subjects.push(subject);
        return subject.asObservable();
      };

      const first = store.refresh(); // llegó RIOT_ACCOUNT_PAIRED
      const second = store.refresh(); // llegó RIOT_ACCOUNT_VERIFIED, con el anterior en vuelo
      // Sin solaparse: el segundo espera su turno en vez de lanzar un GET en paralelo.
      expect(subjects.length).toBe(1);

      // El primer GET responde la cuenta aún sin verificar: salió antes del confirm.
      subjects[0].next(LINKED);
      subjects[0].complete();
      await first;
      await Promise.resolve();

      expect(subjects.length).toBe(2);
      subjects[1].next({ account: VERIFIED_ACCOUNT, relinkAvailableAt: null });
      subjects[1].complete();
      await second;

      expect(store.account()).toEqual(VERIFIED_ACCOUNT);
    });

    it('encadena UNO solo por muchos eventos que lleguen: la última lectura empieza tras el último', async () => {
      await store.ensureLoaded();
      const subjects: Subject<RiotAccountStatus>[] = [];
      api.status = () => {
        const subject = new Subject<RiotAccountStatus>();
        subjects.push(subject);
        return subject.asObservable();
      };

      const all = [store.refresh(), store.refresh(), store.refresh(), store.refresh()];
      subjects[0].next(LINKED);
      subjects[0].complete();
      await all[0];
      await Promise.resolve();
      subjects[1].next(LINKED);
      subjects[1].complete();
      await Promise.all(all);

      // Cuatro eventos, dos lecturas: la del primero y una que empieza después del último.
      expect(subjects.length).toBe(2);
    });

    it('permite un refresh nuevo una vez terminado el anterior', async () => {
      await store.ensureLoaded();
      let calls = 0;
      api.status = () => {
        calls++;
        return of(LINKED);
      };

      await store.refresh();
      await store.refresh();

      expect(calls).toBe(2);
    });

    it('ante un fallo deja status intacto y conserva los datos previos (no rompe una vista que ya funcionaba)', async () => {
      await store.ensureLoaded();
      api.status = () => throwError(() => new Error('boom'));

      await store.refresh();

      expect(store.status()).toBe('ready');
      expect(store.account()).toEqual(ACCOUNT);
    });
  });
});
