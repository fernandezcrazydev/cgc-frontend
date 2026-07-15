import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupsStore } from './groups-store';
import { CreateGroupRequest, GroupResponse } from './models';

/** Doble de `GroupsApi` que registra las llamadas y su orden, sin tocar la red. */
class GroupsApiStub {
  createCalls: CreateGroupRequest[] = [];
  uploadCalls: { groupId: string; file: Blob }[] = [];
  order: string[] = [];

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
});
