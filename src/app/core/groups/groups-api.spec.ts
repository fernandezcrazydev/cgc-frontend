import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { GroupsApi } from './groups-api';
import { GroupResponse } from './models';

const API = environment.apiUrl;

describe('GroupsApi', () => {
  let api: GroupsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GroupsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GroupsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('create hace POST /groups multipart con el nombre, la región y el preset', () => {
    const expected: GroupResponse = { groupId: 'g1', name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'BALANCED', avatarUrl: null };
    let received: GroupResponse | undefined;
    api.create({ name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'BALANCED' }).subscribe((g) => (received = g));

    const req = http.expectOne(`${API}/groups`);
    expect(req.request.method).toBe('POST');
    // FormData con name/region/preset y sin fichero; el Content-Type lo pone el navegador con su
    // boundary.
    expect(req.request.body).toBeInstanceOf(FormData);
    const body = req.request.body as FormData;
    expect(body.get('name')).toBe('Los Cracks');
    expect(body.get('region')).toBe('EUW');
    expect(body.get('matchmakingPreset')).toBe('BALANCED');
    expect(body.has('file')).toBe(false);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  /**
   * El preset se elige una vez y nunca más: si el `create` lo perdiera por el camino, el backend
   * respondería 422 y no habría forma de arreglarlo desde la app. Se comprueba con `CHAOS` para que
   * el test falle también si alguien lo cablea a `BALANCED` por defecto.
   */
  it('create manda el preset elegido, no uno por defecto', () => {
    api.create({ name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'CHAOS' }).subscribe();

    const req = http.expectOne(`${API}/groups`);
    expect((req.request.body as FormData).get('matchmakingPreset')).toBe('CHAOS');
    req.flush({ groupId: 'g1', name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'CHAOS', avatarUrl: null });
  });

  it('create con avatar mete el campo file en el mismo multipart', () => {
    const expected: GroupResponse = {
      groupId: 'g1', name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'BALANCED', avatarUrl: 'http://cdn/x.jpg',
    };
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    api.create({ name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'BALANCED' }, file).subscribe();

    const req = http.expectOne(`${API}/groups`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.has('file')).toBe(true);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush(expected);
  });

  it('uploadAvatar hace PUT multipart con el campo file al id del grupo', () => {
    const expected: GroupResponse = {
      groupId: 'g1', name: 'Los Cracks', region: 'EUW', matchmakingPreset: 'BALANCED', avatarUrl: 'http://cdn/x.jpg',
    };
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    let received: GroupResponse | undefined;
    api.uploadAvatar('g1', file).subscribe((g) => (received = g));

    const req = http.expectOne(`${API}/groups/g1/avatar`);
    expect(req.request.method).toBe('PUT');
    // FormData con el campo `file`, y sin Content-Type manual (lo pone el navegador).
    expect(req.request.body).toBeInstanceOf(FormData);
    expect((req.request.body as FormData).has('file')).toBe(true);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  it('myGroups hace GET /me/groups', () => {
    api.myGroups().subscribe();
    const req = http.expectOne(`${API}/me/groups`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('detail hace GET /groups/{id}', () => {
    api.detail('g1').subscribe();
    const req = http.expectOne(`${API}/groups/g1`);
    expect(req.request.method).toBe('GET');
    req.flush({ group: { groupId: 'g1', name: 'X', region: 'EUW', matchmakingPreset: 'BALANCED', avatarUrl: null }, role: 'OWNER', joinedAt: '2026-01-01T00:00:00Z' });
  });

  it('members hace GET /groups/{id}/members con page y size', () => {
    api.members('g1', 2, 10).subscribe();
    const req = http.expectOne(`${API}/groups/g1/members?page=2&size=10`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('10');
    req.flush({ content: [], page: 2, size: 10, totalElements: 0, totalPages: 0 });
  });

  it('removeMember hace DELETE /groups/{id}/members/{userId}', () => {
    api.removeMember('g1', 'u9').subscribe();
    const req = http.expectOne(`${API}/groups/g1/members/u9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('leave hace DELETE /groups/{id}/membership', () => {
    api.leave('g1').subscribe();
    const req = http.expectOne(`${API}/groups/g1/membership`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('changeRole hace PUT /groups/{id}/members/{userId}/role con el rol', () => {
    api.changeRole('g1', 'u9', 'ADMIN').subscribe();
    const req = http.expectOne(`${API}/groups/g1/members/u9/role`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ role: 'ADMIN' });
    req.flush(null);
  });

  it('transferOwnership hace PUT /groups/{id}/owner con el newOwnerId', () => {
    api.transferOwnership('g1', 'u9').subscribe();
    const req = http.expectOne(`${API}/groups/g1/owner`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newOwnerId: 'u9' });
    req.flush(null);
  });

  it('deleteGroup hace DELETE /groups/{id}', () => {
    api.deleteGroup('g1').subscribe();
    const req = http.expectOne(`${API}/groups/g1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
