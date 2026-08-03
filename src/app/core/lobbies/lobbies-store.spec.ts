import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { LobbiesApi } from './lobbies-api';
import { LobbiesStore } from './lobbies-store';
import { LobbyResponse, LobbyStatus } from './models';
import { PageResponse } from '../http';

function lobby(id: string, status: LobbyStatus = 'POLLING'): LobbyResponse {
  return {
    id,
    groupId: 'g1',
    code: id.toUpperCase(),
    mode: 'OPEN',
    status,
    capacity: 10,
    note: null,
    openedBy: { userId: 'u1', discordUsername: 'pepe', avatarUrl: null, joinedAt: '2026-08-02T18:00:00Z' },
    confirmedSlotId: null,
    createdAt: '2026-08-02T18:00:00Z',
    slots: [],
  };
}

function page(content: LobbyResponse[], pageNumber = 0): PageResponse<LobbyResponse> {
  return { content, page: pageNumber, size: 10, totalElements: content.length, totalPages: 1 };
}

class ApiStub {
  listImpl: (page: number) => Observable<PageResponse<LobbyResponse>> = () => of(page([lobby('a')]));
  createImpl: () => Observable<LobbyResponse> = () => of(lobby('new'));
  listCalls = 0;
  listPages: number[] = [];
  createCalls = 0;

  listForGroup(_groupId: string, pageNumber: number): Observable<PageResponse<LobbyResponse>> {
    this.listCalls++;
    this.listPages.push(pageNumber);
    return this.listImpl(pageNumber);
  }
  create(): Observable<LobbyResponse> {
    this.createCalls++;
    return this.createImpl();
  }
}

describe('LobbiesStore', () => {
  let api: ApiStub;
  let store: LobbiesStore;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({ providers: [{ provide: LobbiesApi, useValue: api }] });
    store = TestBed.inject(LobbiesStore);
  });

  it('carga la primera página del grupo', async () => {
    await store.ensureLoaded('g1');

    expect(store.status()).toBe('ready');
    expect(store.lobbies()).toHaveLength(1);
    expect(store.totalElements()).toBe(1);
    expect(api.listPages).toEqual([0]);
  });

  it('no vuelve a pedir si ya está cargado ese grupo', async () => {
    await store.ensureLoaded('g1');
    await store.ensureLoaded('g1');

    expect(api.listCalls).toBe(1);
  });

  it('cambiar de grupo sí recarga', async () => {
    await store.ensureLoaded('g1');
    await store.ensureLoaded('g2');

    expect(api.listCalls).toBe(2);
  });

  it('un fallo deja error y el reintento lo arregla', async () => {
    api.listImpl = () => throwError(() => new HttpErrorResponse({ status: 0 }));
    await store.ensureLoaded('g1');
    expect(store.status()).toBe('error');

    api.listImpl = () => of(page([lobby('a')]));
    await store.reload();
    expect(store.status()).toBe('ready');
  });

  /** La lista de "partidas activas" no debe enseñar lo que ya terminó o se canceló. */
  it('open() deja fuera las canceladas y las ya jugadas', async () => {
    api.listImpl = () =>
      of(page([lobby('a', 'POLLING'), lobby('b', 'CONFIRMED'), lobby('c', 'CANCELLED'), lobby('d', 'FINISHED')]));

    await store.ensureLoaded('g1');

    expect(store.open().map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('convocar refetch la lista para no reordenarla a mano', async () => {
    await store.ensureLoaded('g1');
    const callsBefore = api.listCalls;

    await store.create('g1', { slotStartTimes: ['2026-08-07T20:00:00Z'] });

    expect(api.createCalls).toBe(1);
    expect(api.listCalls).toBe(callsBefore + 1);
  });

  it('convocar no reentra: el segundo intento simultáneo se rechaza', async () => {
    let resolve: (value: LobbyResponse) => void = () => {};
    api.createImpl = () => new Observable((sub) => {
      resolve = (value) => {
        sub.next(value);
        sub.complete();
      };
    });

    const first = store.create('g1', { slotStartTimes: ['2026-08-07T20:00:00Z'] });
    expect(store.creating()).toBe(true);
    await expect(store.create('g1', { slotStartTimes: ['2026-08-07T20:00:00Z'] })).rejects.toThrow();

    resolve(lobby('new'));
    await first;
    expect(store.creating()).toBe(false);
    expect(api.createCalls).toBe(1);
  });

  it('un fallo al convocar libera el botón y propaga el error a la vista', async () => {
    api.createImpl = () => throwError(() => new HttpErrorResponse({ status: 400 }));

    await expect(store.create('g1', { slotStartTimes: ['2026-08-07T20:00:00Z'] })).rejects.toBeDefined();
    expect(store.creating()).toBe(false);
  });

  it('clear deja el store vacío para el siguiente usuario', async () => {
    await store.ensureLoaded('g1');

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.lobbies()).toEqual([]);
    expect(store.totalElements()).toBe(0);
  });
});
