import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { InvitationsApi } from './invitations-api';
import { InvitationResponse } from './models';

const API = environment.apiUrl;

describe('InvitationsApi', () => {
  let api: InvitationsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [InvitationsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(InvitationsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('invite hace POST /groups/{id}/invitations con el inviteeUserId', () => {
    const expected: InvitationResponse = {
      id: 'inv1', groupId: 'g1', inviteeUserId: 'u9', status: 'PENDING', createdAt: '2026-01-01T00:00:00Z',
    };
    let received: InvitationResponse | undefined;
    api.invite('g1', 'u9').subscribe((i) => (received = i));

    const req = http.expectOne(`${API}/groups/g1/invitations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ inviteeUserId: 'u9' });
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  it('mine hace GET /me/invitations', () => {
    api.mine().subscribe();
    const req = http.expectOne(`${API}/me/invitations`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('accept hace POST /invitations/{id}/accept', () => {
    api.accept('inv1').subscribe();
    const req = http.expectOne(`${API}/invitations/inv1/accept`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('decline hace POST /invitations/{id}/decline', () => {
    api.decline('inv1').subscribe();
    const req = http.expectOne(`${API}/invitations/inv1/decline`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
