import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupBridge } from './group-bridge';
import { GroupMemberResponse, GroupMembershipResponse, GroupRole } from './models';
import { PageResponse } from '../http';
import { GroupStore } from '../group-store';

const GROUP_ID = 'cb9f6bda-c6fe-4499-8c15-0379e7ffe231';

function detailOf(role: GroupRole = 'OWNER'): GroupMembershipResponse {
  return {
    group: { groupId: GROUP_ID, name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'BALANCED', avatarUrl: null },
    role,
    joinedAt: '2026-07-18T12:00:00Z',
  };
}

function member(userId: string, role: GroupRole = 'MEMBER', riotId: string | null = null): GroupMemberResponse {
  return {
    userId,
    discordUsername: `disc_${userId}`,
    avatarUrl: null,
    role,
    joinedAt: '2026-07-18T12:00:00Z',
    riotId,
    riotStrength: riotId ? 'VERIFIED' : null,
  };
}

function pageOf(
  content: GroupMemberResponse[],
  page: number,
  totalElements: number,
  size = 100,
): PageResponse<GroupMemberResponse> {
  return { content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}

class ApiStub {
  detailImpl: () => Observable<GroupMembershipResponse> = () => of(detailOf());
  membersPages: number[] = [];
  membersImpl: (page: number) => Observable<PageResponse<GroupMemberResponse>> = () =>
    of(pageOf([member('u1', 'OWNER'), member('u2')], 0, 2));

  detail(): Observable<GroupMembershipResponse> {
    return this.detailImpl();
  }
  members(_groupId: string, page: number): Observable<PageResponse<GroupMemberResponse>> {
    this.membersPages.push(page);
    return this.membersImpl(page);
  }
}

describe('GroupBridge', () => {
  let api: ApiStub;
  let bridge: GroupBridge;
  let mock: GroupStore;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({ providers: [{ provide: GroupsApi, useValue: api }] });
    bridge = TestBed.inject(GroupBridge);
    mock = TestBed.inject(GroupStore);
  });

  it('siembra identidad y roster reales en el store mock', async () => {
    await bridge.ensure(GROUP_ID);

    expect(bridge.status()).toBe('ready');
    const group = mock.byId(GROUP_ID);
    expect(group?.name).toBe('Los Cracks');
    expect(group?.tag).toBe('EUW');
    expect(group?.members).toBe(2);
    expect(mock.rosterOf(GROUP_ID).length).toBe(2);
  });

  it('mapea el miembro: el owner primero, el tag sale del Riot ID y si no del nombre de Discord', async () => {
    api.membersImpl = () =>
      of(pageOf([member('u1', 'OWNER', 'Pepe#EUW'), member('u2', 'ADMIN')], 0, 2));

    await bridge.ensure(GROUP_ID);

    const [owner, admin] = mock.rosterOf(GROUP_ID);
    expect(owner.owner).toBe(true);
    expect(owner.tag).toBe('Pepe#EUW');
    expect(admin.owner).toBe(false);
    expect(admin.admin).toBe(true);
    expect(admin.tag).toBe('disc_u2');
  });

  it('el hue depende del userId, no de la posición en la lista', async () => {
    api.membersImpl = () => of(pageOf([member('u1', 'OWNER'), member('u2')], 0, 2));
    await bridge.ensure(GROUP_ID);
    const before = mock.rosterOf(GROUP_ID).find((m) => m.tag === 'disc_u2')?.hue;

    api.membersImpl = () => of(pageOf([member('u1', 'OWNER'), member('u9'), member('u2')], 0, 3));
    await bridge.reload(GROUP_ID);
    const after = mock.rosterOf(GROUP_ID).find((m) => m.tag === 'disc_u2')?.hue;

    expect(after).toBe(before);
  });

  it('pagina hasta traer el grupo entero, no solo la primera página', async () => {
    const first = Array.from({ length: 100 }, (_, i) => member(`u${i}`));
    const second = [member('u100'), member('u101')];
    api.membersImpl = (page) => of(page === 0 ? pageOf(first, 0, 102) : pageOf(second, 1, 102));

    await bridge.ensure(GROUP_ID);

    expect(api.membersPages).toEqual([0, 1]);
    expect(mock.rosterOf(GROUP_ID).length).toBe(102);
  });

  it('no vuelve a pedir nada si el grupo ya está cargado', async () => {
    await bridge.ensure(GROUP_ID);
    await bridge.ensure(GROUP_ID);

    expect(api.membersPages.length).toBe(1);
  });

  it('deduplica dos peticiones simultáneas del mismo grupo', async () => {
    await Promise.all([bridge.ensure(GROUP_ID), bridge.ensure(GROUP_ID)]);

    expect(api.membersPages.length).toBe(1);
  });

  it('reload sí refetch: el roster pudo cambiar sin que este cliente hiciera nada', async () => {
    await bridge.ensure(GROUP_ID);
    api.membersImpl = () => of(pageOf([member('u1', 'OWNER')], 0, 1));

    await bridge.reload(GROUP_ID);

    expect(mock.rosterOf(GROUP_ID).length).toBe(1);
  });

  it('un 403 o un 404 es not-found, no un error de red', async () => {
    api.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 403 }));

    await bridge.ensure(GROUP_ID);

    expect(bridge.status()).toBe('not-found');
    expect(mock.byId(GROUP_ID)).toBeUndefined();
  });

  it('un fallo de red deja la vista en error para poder reintentar', async () => {
    api.membersImpl = () => throwError(() => new HttpErrorResponse({ status: 0 }));

    await bridge.ensure(GROUP_ID);
    expect(bridge.status()).toBe('error');

    api.membersImpl = () => of(pageOf([member('u1', 'OWNER')], 0, 1));
    await bridge.reload(GROUP_ID);
    expect(bridge.status()).toBe('ready');
  });

  it('clear() devuelve el puente a idle para que no quede el grupo del usuario anterior', async () => {
    await bridge.ensure(GROUP_ID);

    bridge.clear();

    expect(bridge.status()).toBe('idle');
  });
});
