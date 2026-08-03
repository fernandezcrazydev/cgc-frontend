import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { LobbiesApi } from './lobbies-api';
import { LobbyDetailStore } from './lobby-detail-store';
import { LobbyParticipantResponse, LobbyResponse, LobbySlotResponse } from './models';

const LOBBY_ID = 'lb1';

function participant(userId: string): LobbyParticipantResponse {
  return {
    userId,
    discordUsername: `user_${userId}`,
    avatarUrl: null,
    joinedAt: '2026-08-02T18:00:00Z',
  };
}

function slot(id: string, startsAt: string, starters: string[] = [], bench: string[] = []): LobbySlotResponse {
  return {
    id,
    startsAt,
    signedUp: starters.length + bench.length,
    starters: starters.map(participant),
    bench: bench.map(participant),
  };
}

function lobby(overrides: Partial<LobbyResponse> = {}): LobbyResponse {
  return {
    id: LOBBY_ID,
    groupId: 'g1',
    code: 'WX4K',
    mode: 'OPEN',
    status: 'POLLING',
    capacity: 10,
    note: null,
    openedBy: participant('u1'),
    confirmedSlotId: null,
    createdAt: '2026-08-02T18:00:00Z',
    slots: [slot('s2', '2026-08-09T20:00:00Z'), slot('s1', '2026-08-07T20:00:00Z')],
    ...overrides,
  };
}

class ApiStub {
  detailImpl: () => Observable<LobbyResponse> = () => of(lobby());
  signUpImpl: () => Observable<LobbyResponse> = () => of(lobby());
  withdrawImpl: () => Observable<LobbyResponse> = () => of(lobby());
  cancelImpl: () => Observable<void> = () => of(undefined);
  detailCalls = 0;
  signUpCalls = 0;
  cancelCalls = 0;

  detail(): Observable<LobbyResponse> {
    this.detailCalls++;
    return this.detailImpl();
  }
  signUp(): Observable<LobbyResponse> {
    this.signUpCalls++;
    return this.signUpImpl();
  }
  withdraw(): Observable<LobbyResponse> {
    return this.withdrawImpl();
  }
  cancel(): Observable<void> {
    this.cancelCalls++;
    return this.cancelImpl();
  }
}

describe('LobbyDetailStore', () => {
  let api: ApiStub;
  let store: LobbyDetailStore;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({ providers: [{ provide: LobbiesApi, useValue: api }] });
    store = TestBed.inject(LobbyDetailStore);
  });

  it('carga la convocatoria y queda ready', async () => {
    await store.load(LOBBY_ID);

    expect(store.status()).toBe('ready');
    expect(store.lobby()?.code).toBe('WX4K');
  });

  it('ordena las franjas por hora, no por como vengan', async () => {
    await store.load(LOBBY_ID);

    expect(store.slots().map((s) => s.id)).toEqual(['s1', 's2']);
  });

  it('un 403 o un 404 es not-found, no un error de red', async () => {
    api.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 403 }));

    await store.load(LOBBY_ID);

    expect(store.status()).toBe('not-found');
  });

  it('un fallo de red deja error y permite reintentar', async () => {
    api.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 0 }));
    await store.load(LOBBY_ID);
    expect(store.status()).toBe('error');

    api.detailImpl = () => of(lobby());
    await store.load(LOBBY_ID);
    expect(store.status()).toBe('ready');
  });

  it('expone la franja confirmada cuando la hay', async () => {
    api.detailImpl = () =>
      of(lobby({ status: 'CONFIRMED', confirmedSlotId: 's1', slots: [slot('s1', '2026-08-07T20:00:00Z')] }));

    await store.load(LOBBY_ID);

    expect(store.confirmedSlot()?.id).toBe('s1');
  });

  it('mientras se recoge disponibilidad no hay franja confirmada', async () => {
    await store.load(LOBBY_ID);

    expect(store.confirmedSlot()).toBeNull();
  });

  it('apuntarse escribe la respuesta del servidor sin pedir el detalle otra vez', async () => {
    await store.load(LOBBY_ID);
    const detailCallsAfterLoad = api.detailCalls;
    api.signUpImpl = () =>
      of(lobby({ slots: [slot('s1', '2026-08-07T20:00:00Z', ['u9'])] }));

    await store.signUp('s1');

    expect(store.lobby()?.slots[0].starters[0].userId).toBe('u9');
    expect(api.detailCalls).toBe(detailCallsAfterLoad);
  });

  /** Sin esto, un doble clic en "puedo" mandaría dos peticiones a la misma franja. */
  it('no reentra: dos apuntadas simultáneas a la misma franja son una sola petición', async () => {
    await store.load(LOBBY_ID);

    await Promise.all([store.signUp('s1'), store.signUp('s1')]);

    expect(api.signUpCalls).toBe(1);
  });

  it('marca la franja como ocupada mientras la acción viaja', async () => {
    await store.load(LOBBY_ID);
    let resolve: (value: LobbyResponse) => void = () => {};
    api.signUpImpl = () => new Observable((sub) => {
      resolve = (value) => {
        sub.next(value);
        sub.complete();
      };
    });

    const pending = store.signUp('s1');
    expect(store.isActing('s1')).toBe(true);
    expect(store.isActing('s2')).toBe(false);

    resolve(lobby());
    await pending;
    expect(store.isActing('s1')).toBe(false);
  });

  it('refresh no vacía lo que hay en pantalla ni vuelve a loading', async () => {
    await store.load(LOBBY_ID);
    let sawNull = false;
    api.detailImpl = () => {
      sawNull = store.lobby() === null;
      return of(lobby({ code: 'AB12' }));
    };

    await store.refresh();

    expect(sawNull).toBe(false);
    expect(store.status()).toBe('ready');
    expect(store.lobby()?.code).toBe('AB12');
  });

  /**
   * El bug del esqueleto eterno, reproducido. Al entrar en la sala llegaba un aviso en vivo
   * (el que quedaba de haberte apuntado antes) mientras el `load()` inicial seguía viajando; el
   * refresh subía el contador de secuencia, el `load()` se creía obsoleto al volver y salía sin
   * poner `ready`, y la vista se quedaba en `loading` para siempre. Si esto se pone rojo, la sala
   * vuelve a quedarse en esqueleto.
   */
  it('un refresh en vuelo no deja la carga inicial colgada en loading', async () => {
    let finishLoad: (value: LobbyResponse) => void = () => {};
    api.detailImpl = () => new Observable((sub) => {
      finishLoad = (value) => {
        sub.next(value);
        sub.complete();
      };
    });
    const loading = store.load(LOBBY_ID);

    // El aviso en vivo llega ANTES de que la carga inicial haya respondido.
    api.detailImpl = () => of(lobby());
    await store.refresh();

    finishLoad(lobby());
    await loading;

    expect(store.status()).toBe('ready');
    expect(store.lobby()).not.toBeNull();
  });

  it('un refresh que falla deja el dato anterior en pantalla', async () => {
    await store.load(LOBBY_ID);
    api.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 0 }));

    await store.refresh();

    expect(store.lobby()?.code).toBe('WX4K');
    expect(store.status()).toBe('ready');
  });

  it('cancelar no reentra', async () => {
    await store.load(LOBBY_ID);

    await Promise.all([store.cancel(), store.cancel()]);

    expect(api.cancelCalls).toBe(1);
  });

  it('clear deja el store vacío para el siguiente usuario', async () => {
    await store.load(LOBBY_ID);

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.lobby()).toBeNull();
    expect(store.showingId).toBeNull();
  });
});
