import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupsStore } from './groups-store';
import { CreateGroupRequest, GroupMembershipResponse, GroupResponse, GroupRole } from './models';

function membership(groupId: string, role: GroupRole, name = groupId): GroupMembershipResponse {
  return {
    group: { groupId, name, region: 'EUW', avatarUrl: null },
    role,
    joinedAt: '2026-07-18T12:00:00Z',
  };
}

/** Doble de `GroupsApi` que registra las llamadas y su orden, sin tocar la red. */
class GroupsApiStub {
  createCalls: CreateGroupRequest[] = [];
  createAvatars: (Blob | null)[] = [];
  uploadCalls: { groupId: string; file: Blob }[] = [];
  order: string[] = [];

  leaveCalls: string[] = [];
  deleteCalls: string[] = [];
  removeCalls: { groupId: string; userId: string }[] = [];
  roleCalls: { groupId: string; userId: string; role: GroupRole }[] = [];
  transferCalls: { groupId: string; newOwnerId: string }[] = [];
  /** Compuerta para la próxima escritura void (leave/delete/...): controla el "en vuelo". */
  gate: Subject<void> | null = null;

  myGroupsCalls = 0;
  myGroupsImpl: () => Observable<GroupMembershipResponse[]> = () =>
    of([membership('g1', 'OWNER', 'Los Cracks'), membership('g2', 'MEMBER', 'Otro')]);

  created: GroupResponse = { groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: null };
  uploaded: GroupResponse = { groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: 'http://cdn/g1.jpg' };

  myGroups(): Observable<GroupMembershipResponse[]> {
    this.myGroupsCalls++;
    return this.myGroupsImpl();
  }

  create(body: CreateGroupRequest, avatar?: Blob | null): Observable<GroupResponse> {
    this.createCalls.push(body);
    this.createAvatars.push(avatar ?? null);
    this.order.push('create');
    // Con foto el backend devuelve el grupo ya con su avatarUrl; sin foto, sin ella.
    return of(avatar ? this.uploaded : this.created);
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

  it('sin foto hace una sola llamada (POST /groups) sin avatar', async () => {
    const group = await store.create({ name: 'Los Cracks', region: 'EUW' });

    expect(api.createCalls).toEqual([{ name: 'Los Cracks', region: 'EUW' }]);
    expect(api.createAvatars).toEqual([null]);
    expect(api.uploadCalls).toHaveLength(0);
    expect(group).toEqual(api.created);
  });

  it('con foto hace una sola llamada multipart que ya lleva el avatar dentro', async () => {
    const group = await store.create({ name: 'Los Cracks', region: 'EUW', avatarDataUrl: PNG });

    // Una sola llamada: la foto viaja en el mismo POST, no en un segundo paso (adiós huérfanos).
    expect(api.order).toEqual(['create']);
    expect(api.uploadCalls).toHaveLength(0);
    expect(api.createAvatars[0]?.type).toBe('image/png');
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

  it('ensureLoaded carga /me/groups como vistas y resuelve byId', async () => {
    await store.ensureLoaded();
    expect(store.status()).toBe('ready');
    expect(store.groups().map((g) => g.id)).toEqual(['g1', 'g2']);
    expect(store.byId('g1')?.name).toBe('Los Cracks');
    expect(store.byId('nope')).toBeNull();
  });

  it('ensureLoaded es idempotente tras ready; reload fuerza refetch', async () => {
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(api.myGroupsCalls).toBe(1);
    await store.reload();
    expect(api.myGroupsCalls).toBe(2);
  });

  it('un fallo de /me/groups deja status error y lista vacía', async () => {
    api.myGroupsImpl = () => throwError(() => new Error('down'));
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.groups()).toEqual([]);
  });

  it('select fija el grupo activo y selected() lo resuelve', async () => {
    await store.ensureLoaded();
    store.select('g2');
    expect(store.selectedId()).toBe('g2');
    expect(store.selected()?.id).toBe('g2');
  });

  it('create refetch la lista tras crear', async () => {
    await store.create({ name: 'Nuevo', region: 'EUW' });
    expect(api.myGroupsCalls).toBe(1);
  });

  it('leave y transferOwnership refetch la lista; changeRole no', async () => {
    await store.leave('g1');
    expect(api.myGroupsCalls).toBe(1);
    await store.transferOwnership('g1', 'u9');
    expect(api.myGroupsCalls).toBe(2);
    await store.changeRole('g1', 'u9', 'ADMIN');
    expect(api.myGroupsCalls).toBe(2);
  });

  it('clear resetea lista, estado y selección', async () => {
    await store.ensureLoaded();
    store.select('g1');
    store.clear();
    expect(store.groups()).toEqual([]);
    expect(store.status()).toBe('idle');
    expect(store.selectedId()).toBeNull();
  });
});
