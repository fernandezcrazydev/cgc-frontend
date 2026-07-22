import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupsStore } from './groups-store';
import { GroupDetailStore } from './group-detail-store';
import { GroupMemberResponse, GroupMembershipResponse, GroupRole } from './models';
import { PageResponse } from '../http';

function detailOf(role: GroupRole): GroupMembershipResponse {
  return { group: { groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: null }, role, joinedAt: '2026-07-18T12:00:00Z' };
}
function member(userId: string, role: GroupRole): GroupMemberResponse {
  return { userId, discordUsername: userId, avatarUrl: null, role, joinedAt: '2026-07-18T12:00:00Z' };
}
/** Una página del roster tal como la devuelve el backend (`page` 0-based). */
function pageOf(
  content: GroupMemberResponse[],
  page = 0,
  totalElements = content.length,
  size = 10,
): PageResponse<GroupMemberResponse> {
  return { content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}

/** Doble de `GroupsApi` que cubre lo que tocan `GroupDetailStore` y `GroupsStore`. */
class ApiStub {
  detailImpl: () => Observable<GroupMembershipResponse> = () => of(detailOf('OWNER'));
  membersCalls = 0;
  /** Página pedida en cada llamada, para comprobar qué offset viaja de verdad. */
  membersPages: number[] = [];
  membersImpl: (page: number) => Observable<PageResponse<GroupMemberResponse>> = () =>
    of(pageOf([member('me', 'OWNER'), member('u2', 'ADMIN'), member('u3', 'MEMBER')]));

  removeCalls: string[] = [];
  roleCalls: { userId: string; role: GroupRole }[] = [];
  transferCalls: string[] = [];
  leaveCalls = 0;
  deleteCalls = 0;

  detail(): Observable<GroupMembershipResponse> {
    return this.detailImpl();
  }
  members(_g: string, page: number): Observable<PageResponse<GroupMemberResponse>> {
    this.membersCalls++;
    this.membersPages.push(page);
    return this.membersImpl(page);
  }
  removeMember(_g: string, userId: string): Observable<void> {
    this.removeCalls.push(userId);
    return of(undefined);
  }
  changeRole(_g: string, userId: string, role: GroupRole): Observable<void> {
    this.roleCalls.push({ userId, role });
    return of(undefined);
  }
  transferOwnership(_g: string, newOwnerId: string): Observable<void> {
    this.transferCalls.push(newOwnerId);
    return of(undefined);
  }
  leave(): Observable<void> {
    this.leaveCalls++;
    return of(undefined);
  }
  deleteGroup(): Observable<void> {
    this.deleteCalls++;
    return of(undefined);
  }
  myGroups(): Observable<GroupMembershipResponse[]> {
    return of([]);
  }
}

describe('GroupDetailStore', () => {
  let store: GroupDetailStore;
  let groups: GroupsStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [GroupDetailStore, GroupsStore, { provide: GroupsApi, useValue: api }],
    });
    store = TestBed.inject(GroupDetailStore);
    groups = TestBed.inject(GroupsStore);
  });

  it('load trae detalle + primera página del roster y fija el grupo activo', async () => {
    await store.load('g1');
    expect(store.status()).toBe('ready');
    expect(store.group()?.name).toBe('Los Cracks');
    expect(store.roster()).toHaveLength(3);
    expect(store.membersPage()).toBe(0);
    expect(api.membersPages).toEqual([0]);
    expect(store.isOwner()).toBe(true);
    expect(groups.selectedId()).toBe('g1');
  });

  /** El contador de la cabecera es el total del grupo, no el tamaño de la página cargada. */
  it('memberCount es totalElements, no la longitud de la página', async () => {
    api.membersImpl = (page) => of(pageOf([member('a', 'OWNER'), member('b', 'MEMBER')], page, 24));
    await store.load('g1');
    expect(store.roster()).toHaveLength(2);
    expect(store.memberCount()).toBe(24);
  });

  it('goToMembersPage pide esa página y la deja como visible', async () => {
    api.membersImpl = (page) => of(pageOf([member(`p${page}`, 'MEMBER')], page, 24));
    await store.load('g1');
    await store.goToMembersPage(2);
    expect(api.membersPages).toEqual([0, 2]);
    expect(store.membersPage()).toBe(2);
    expect(store.membersLoading()).toBe(false);
  });

  /**
   * Expulsar al último miembro de la última página la deja vacía. Quedarse ahí pintaría una
   * lista vacía con el paginador jurando que hay miembros, así que el store retrocede una.
   */
  it('reloadRoster retrocede de página si la actual se ha quedado vacía', async () => {
    api.membersImpl = (page) =>
      of(page >= 2 ? pageOf([], page, 20) : pageOf([member('u1', 'MEMBER')], page, 20));
    await store.load('g1');
    await store.goToMembersPage(2);
    expect(store.roster()).toEqual([]);

    await store.reloadRoster();

    expect(store.membersPage()).toBe(1);
    expect(store.roster()).toHaveLength(1);
  });

  /** Una respuesta de una página ya abandonada no debe pisar a la que el usuario está viendo. */
  it('descarta la respuesta de una página abandonada', async () => {
    let releaseSlow: (p: PageResponse<GroupMemberResponse>) => void = () => {};
    api.membersImpl = (page) =>
      page === 1
        ? new Observable<PageResponse<GroupMemberResponse>>((sub) => {
            releaseSlow = (p) => {
              sub.next(p);
              sub.complete();
            };
          })
        : of(pageOf([member(`p${page}`, 'MEMBER')], page, 30));

    await store.load('g1');
    const slow = store.goToMembersPage(1);
    await store.goToMembersPage(2);
    releaseSlow(pageOf([member('vieja', 'MEMBER')], 1, 30));
    await slow;

    expect(store.membersPage()).toBe(2);
    expect(store.roster()[0].userId).toBe('p2');
  });

  it('un 403/404 en el detalle es not-found', async () => {
    api.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 403 }));
    await store.load('g1');
    expect(store.status()).toBe('not-found');
  });

  it('otro error del detalle es error', async () => {
    api.detailImpl = () => throwError(() => new HttpErrorResponse({ status: 500 }));
    await store.load('g1');
    expect(store.status()).toBe('error');
  });

  it('removeMember delega en el api y refetch el roster', async () => {
    await store.load('g1');
    const before = api.membersCalls;
    await store.removeMember('u3');
    expect(api.removeCalls).toEqual(['u3']);
    expect(api.membersCalls).toBe(before + 1);
  });

  it('changeRole delega con el rol y refetch el roster', async () => {
    await store.load('g1');
    await store.changeRole('u3', 'ADMIN');
    expect(api.roleCalls).toEqual([{ userId: 'u3', role: 'ADMIN' }]);
  });

  it('transferOwnership delega y recarga detalle + roster', async () => {
    await store.load('g1');
    const before = api.membersCalls;
    await store.transferOwnership('u2');
    expect(api.transferCalls).toEqual(['u2']);
    // recarga completa: el roster se vuelve a pedir.
    expect(api.membersCalls).toBeGreaterThan(before);
  });

  it('leave y deleteGroup delegan en el api', async () => {
    await store.load('g1');
    await store.leave();
    expect(api.leaveCalls).toBe(1);
    await store.deleteGroup();
    expect(api.deleteCalls).toBe(1);
  });

  it('clear resetea el detalle', async () => {
    await store.load('g1');
    store.clear();
    expect(store.status()).toBe('idle');
    expect(store.group()).toBeNull();
    expect(store.roster()).toEqual([]);
    expect(store.memberCount()).toBe(0);
  });
});
