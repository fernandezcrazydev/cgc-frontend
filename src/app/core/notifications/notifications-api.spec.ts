import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { NotificationsApi } from './notifications-api';
import { NotificationResponse } from './models';

const API = environment.apiUrl;

describe('NotificationsApi', () => {
  let api: NotificationsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [NotificationsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(NotificationsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list hace GET /me/notifications', () => {
    const expected: NotificationResponse[] = [
      { id: 'n1', type: 'INVITED_TO_GROUP', data: { groupName: 'X' }, read: false, createdAt: '2026-01-01T00:00:00Z' },
    ];
    let received: NotificationResponse[] | undefined;
    api.list().subscribe((l) => (received = l));

    const req = http.expectOne(`${API}/me/notifications`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  it('markRead hace POST /me/notifications/{id}/read', () => {
    api.markRead('n1').subscribe();
    const req = http.expectOne(`${API}/me/notifications/n1/read`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('streamUrl apunta al endpoint SSE versionado', () => {
    expect(api.streamUrl).toBe(`${API}/me/notifications/stream`);
  });
});
