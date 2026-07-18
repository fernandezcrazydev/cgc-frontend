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

  it('create hace POST /groups con el nombre y la región', () => {
    const expected: GroupResponse = { groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: null };
    let received: GroupResponse | undefined;
    api.create({ name: 'Los Cracks', region: 'EUW' }).subscribe((g) => (received = g));

    const req = http.expectOne(`${API}/groups`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Los Cracks', region: 'EUW' });
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  it('uploadAvatar hace PUT multipart con el campo file al id del grupo', () => {
    const expected: GroupResponse = {
      groupId: 'g1', name: 'Los Cracks', region: 'EUW', avatarUrl: 'http://cdn/x.jpg',
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
