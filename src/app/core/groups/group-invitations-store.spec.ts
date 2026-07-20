import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { InvitationsApi } from './invitations-api';
import { GroupInvitationsStore } from './group-invitations-store';
import { GroupInvitationResponse } from './models';

function gi(id: string, inviteeUserId = `u-${id}`): GroupInvitationResponse {
  return { id, inviteeUserId, discordUsername: `name-${id}`, avatarUrl: null, createdAt: '2026-07-18T12:00:00Z' };
}

/** Doble de `InvitationsApi` con implementaciones swappables por método. */
class ApiStub {
  forGroupCalls: string[] = [];
  cancelCalls: { groupId: string; invitationId: string }[] = [];

  forGroupImpl: (groupId: string) => Observable<GroupInvitationResponse[]> = () => of([gi('a'), gi('b')]);
  cancelImpl: () => Observable<void> = () => of(undefined);

  forGroup(groupId: string): Observable<GroupInvitationResponse[]> {
    this.forGroupCalls.push(groupId);
    return this.forGroupImpl(groupId);
  }
  cancel(groupId: string, invitationId: string): Observable<void> {
    this.cancelCalls.push({ groupId, invitationId });
    return this.cancelImpl();
  }
}

describe('GroupInvitationsStore', () => {
  let store: GroupInvitationsStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [GroupInvitationsStore, { provide: InvitationsApi, useValue: api }],
    });
    store = TestBed.inject(GroupInvitationsStore);
  });

  it('load trae las pendientes del grupo y expone pendingInviteeIds', async () => {
    await store.load('g1');
    expect(api.forGroupCalls).toEqual(['g1']);
    expect(store.status()).toBe('ready');
    expect(store.pendingInviteeIds()).toEqual(new Set(['u-a', 'u-b']));
  });

  it('un fallo deja status error sin romper la vista', async () => {
    api.forGroupImpl = () => throwError(() => new Error('down'));
    await store.load('g1');
    expect(store.status()).toBe('error');
  });

  it('descarta la respuesta de un grupo ya abandonado (guard de id)', async () => {
    const g1 = new Subject<GroupInvitationResponse[]>();
    api.forGroupImpl = (groupId) => (groupId === 'g1' ? g1.asObservable() : of([gi('z')]));
    const first = store.load('g1'); // queda en vuelo
    await store.load('g2'); // cambia de grupo antes de que responda g1
    g1.next([gi('a')]);
    g1.complete();
    await first;
    // La respuesta tardía de g1 no debe pisar la de g2.
    expect(store.pendingInviteeIds()).toEqual(new Set(['u-z']));
  });

  it('cancel saca la invitación de la lista y llama con el grupo activo', async () => {
    await store.load('g1');
    await store.cancel('a');
    expect(api.cancelCalls).toEqual([{ groupId: 'g1', invitationId: 'a' }]);
    expect(store.invitations().map((i) => i.id)).toEqual(['b']);
  });

  it('cancel no es reentrante por id', async () => {
    await store.load('g1');
    const gate = new Subject<void>();
    api.cancelImpl = () => gate.asObservable();
    const first = store.cancel('a');
    const second = store.cancel('a');
    expect(store.isCancelling('a')).toBe(true);
    gate.next();
    gate.complete();
    await Promise.all([first, second]);
    expect(api.cancelCalls).toHaveLength(1);
    expect(store.isCancelling('a')).toBe(false);
  });

  it('cancel propaga el error dejando la lista intacta', async () => {
    await store.load('g1');
    api.cancelImpl = () => throwError(() => new Error('409'));
    await expect(store.cancel('a')).rejects.toBeDefined();
    expect(store.invitations().map((i) => i.id)).toEqual(['a', 'b']);
    expect(store.isCancelling('a')).toBe(false);
  });

  it('reload vuelve a pedir la lista del grupo activo', async () => {
    await store.load('g1');
    await store.reload();
    expect(api.forGroupCalls).toEqual(['g1', 'g1']);
  });

  it('clear resetea lista y estado', async () => {
    await store.load('g1');
    store.clear();
    expect(store.invitations()).toEqual([]);
    expect(store.status()).toBe('idle');
    // Tras clear, reload no tiene grupo activo y es no-op.
    await store.reload();
    expect(api.forGroupCalls).toEqual(['g1']);
  });
});
