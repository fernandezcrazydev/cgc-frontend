import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { InvitationsApi } from './invitations-api';
import { InvitationsStore } from './invitations-store';
import { InvitationResponse } from './models';

function inv(id: string): InvitationResponse {
  return { id, groupId: `g-${id}`, inviteeUserId: 'me', status: 'PENDING', createdAt: '2026-07-18T12:00:00Z' };
}

/** Doble de `InvitationsApi` con implementaciones swappables por método. */
class ApiStub {
  mineCalls = 0;
  acceptCalls: string[] = [];
  declineCalls: string[] = [];
  inviteCalls: { groupId: string; userId: string }[] = [];

  mineImpl: () => Observable<InvitationResponse[]> = () => of([inv('a'), inv('b')]);
  acceptImpl: (id: string) => Observable<void> = () => of(undefined);

  mine(): Observable<InvitationResponse[]> {
    this.mineCalls++;
    return this.mineImpl();
  }
  accept(id: string): Observable<void> {
    this.acceptCalls.push(id);
    return this.acceptImpl(id);
  }
  decline(id: string): Observable<void> {
    this.declineCalls.push(id);
    return of(undefined);
  }
  invite(groupId: string, userId: string): Observable<InvitationResponse> {
    this.inviteCalls.push({ groupId, userId });
    return of({ ...inv('new'), groupId, inviteeUserId: userId });
  }
}

describe('InvitationsStore', () => {
  let store: InvitationsStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [InvitationsStore, { provide: InvitationsApi, useValue: api }],
    });
    store = TestBed.inject(InvitationsStore);
  });

  it('ensureLoaded carga las pendientes y expone pendingIds', async () => {
    await store.ensureLoaded();
    expect(store.status()).toBe('ready');
    expect(store.pendingIds()).toEqual(new Set(['a', 'b']));
  });

  it('ensureLoaded es idempotente tras ready; reload fuerza refetch', async () => {
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(api.mineCalls).toBe(1);
    await store.reload();
    expect(api.mineCalls).toBe(2);
  });

  it('un fallo deja status error y lista vacía', async () => {
    api.mineImpl = () => throwError(() => new Error('down'));
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.invitations()).toEqual([]);
  });

  it('accept saca la invitación de las pendientes', async () => {
    await store.ensureLoaded();
    await store.accept('a');
    expect(api.acceptCalls).toEqual(['a']);
    expect(store.pendingIds().has('a')).toBe(false);
    expect(store.pendingIds().has('b')).toBe(true);
  });

  it('decline saca la invitación de las pendientes', async () => {
    await store.ensureLoaded();
    await store.decline('b');
    expect(api.declineCalls).toEqual(['b']);
    expect(store.pendingIds().has('b')).toBe(false);
  });

  it('no es reentrante: un segundo accept de la misma id en vuelo no dispara otra llamada', async () => {
    await store.ensureLoaded();
    const gate = new Subject<void>();
    api.acceptImpl = () => gate.asObservable();
    const first = store.accept('a');
    const second = store.accept('a');
    expect(store.isResponding('a')).toBe(true);
    gate.next();
    gate.complete();
    await Promise.all([first, second]);
    expect(api.acceptCalls).toEqual(['a']);
    expect(store.isResponding('a')).toBe(false);
  });

  it('invite es no reentrante y devuelve la invitación creada', async () => {
    const created = await store.invite('g1', 'u9');
    expect(api.inviteCalls).toEqual([{ groupId: 'g1', userId: 'u9' }]);
    expect(created.groupId).toBe('g1');
    expect(store.inviting()).toBe(false);
  });

  it('clear resetea las pendientes y el estado', async () => {
    await store.ensureLoaded();
    store.clear();
    expect(store.invitations()).toEqual([]);
    expect(store.status()).toBe('idle');
  });
});
