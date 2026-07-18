import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupsStore } from './groups-store';
import { CreateGroupRequest, GroupResponse, GroupRole } from './models';

/** Doble de `GroupsApi` que registra las llamadas y su orden, sin tocar la red. */
class GroupsApiStub {
  createCalls: CreateGroupRequest[] = [];
  uploadCalls: { groupId: string; file: Blob }[] = [];
  order: string[] = [];

  leaveCalls: string[] = [];
  deleteCalls: string[] = [];
  removeCalls: { groupId: string; userId: string }[] = [];
  roleCalls: { groupId: string; userId: string; role: GroupRole }[] = [];
  transferCalls: { groupId: string; newOwnerId: string }[] = [];
  /** Compuerta para la próxima escritura void (leave/delete/...): controla el "en vuelo". */
  gate: Subject<void> | null = null;

  created: GroupResponse = { groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: null };
  uploaded: GroupResponse = { groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: 'http://cdn/g1.jpg' };

  create(body: CreateGroupRequest): Observable<GroupResponse> {
    this.createCalls.push(body);
    this.order.push('create');
    return of(this.created);
  }

  uploadAvatar(groupId: string, file: Blob): Observable<GroupResponse> {
    this.uploadCalls.push({ groupId, file });
    this.order.push('upload');
    return of(this.uploaded);
  }

  private voidResult(): Observable<void> {
    return this.gate ? this.gate.asObservable() : of(undefined);
  }

  leave(groupId: string): Observable<void> {
    this.leaveCalls.push(groupId);
    return this.voidResult();
  }
  deleteGroup(groupId: string): Observable<void> {
    this.deleteCalls.push(groupId);
    return this.voidResult();
  }
  removeMember(groupId: string, userId: string): Observable<void> {
    this.removeCalls.push({ groupId, userId });
    return this.voidResult();
  }
  changeRole(groupId: string, userId: string, role: GroupRole): Observable<void> {
    this.roleCalls.push({ groupId, userId, role });
    return this.voidResult();
  }
  transferOwnership(groupId: string, newOwnerId: string): Observable<void> {
    this.transferCalls.push({ groupId, newOwnerId });
    return this.voidResult();
  }
}

const PNG = 'data:image/png;base64,AAAA';

describe('GroupsStore', () => {
  let store: GroupsStore;
  let api: GroupsApiStub;

  beforeEach(() => {
    api = new GroupsApiStub();
    TestBed.configureTestingModule({
      providers: [GroupsStore, { provide: GroupsApi, useValue: api }],
    });
    store = TestBed.inject(GroupsStore);
  });

  it('sin foto hace una sola llamada (POST /groups) y no sube avatar', async () => {
    const group = await store.create({ name: 'Los Cracks', region: 'EUW' });

    expect(api.createCalls).toEqual([{ name: 'Los Cracks', region: 'EUW' }]);
    expect(api.uploadCalls).toHaveLength(0);
    expect(group).toEqual(api.created);
  });

  it('con foto hace el doble call: crea primero y sube después contra el id devuelto', async () => {
    const group = await store.create({ name: 'Los Cracks', region: 'EUW', avatarDataUrl: PNG });

    // El orden es lo que importa: la foto se sube con el groupId que dio el backend.
    expect(api.order).toEqual(['create', 'upload']);
    expect(api.uploadCalls[0].groupId).toBe('g1');
    expect(api.uploadCalls[0].file.type).toBe('image/png');
    expect(group).toEqual(api.uploaded);
  });

  it('recorta el nombre antes de enviarlo', async () => {
    await store.create({ name: '  Los Cracks  ', region: 'NA' });
    expect(api.createCalls[0]).toEqual({ name: 'Los Cracks', region: 'NA' });
  });

  it('pending es false al terminar y una segunda creación concurrente se rechaza', async () => {
    const first = store.create({ name: 'A', region: 'EUW' });
    // Reentrante mientras la primera está en vuelo: se rechaza (guard anti doble submit).
    await expect(store.create({ name: 'B', region: 'EUW' })).rejects.toThrow();
    await first;
    expect(store.pending()).toBe(false);
  });

  it('leave y deleteGroup delegan en el api con el groupId', async () => {
    await store.leave('g1');
    await store.deleteGroup('g2');
    expect(api.leaveCalls).toEqual(['g1']);
    expect(api.deleteCalls).toEqual(['g2']);
    expect(store.pending()).toBe(false);
  });

  it('removeMember / changeRole / transferOwnership delegan con sus argumentos', async () => {
    await store.removeMember('g1', 'u9');
    await store.changeRole('g1', 'u9', 'ADMIN');
    await store.transferOwnership('g1', 'u9');
    expect(api.removeCalls).toEqual([{ groupId: 'g1', userId: 'u9' }]);
    expect(api.roleCalls).toEqual([{ groupId: 'g1', userId: 'u9', role: 'ADMIN' }]);
    expect(api.transferCalls).toEqual([{ groupId: 'g1', newOwnerId: 'u9' }]);
  });

  it('las escrituras void son no reentrantes (guard anti doble submit)', async () => {
    api.gate = new Subject<void>();
    const first = store.leave('g1');
    // Otra escritura mientras la primera está en vuelo: se rechaza.
    await expect(store.deleteGroup('g1')).rejects.toThrow();
    api.gate.next();
    api.gate.complete();
    await first;
    expect(store.pending()).toBe(false);
    expect(api.deleteCalls).toHaveLength(0);
  });
});
