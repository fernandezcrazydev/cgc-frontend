import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionsApi } from './sessions-api';
import { ActiveSession } from './models';

describe('SessionsApi', () => {
  let api: SessionsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SessionsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las sesiones del usuario logueado', async () => {
    const sessions = firstValueFrom(api.list());
    const payload: ActiveSession[] = [
      {
        id: 'sess-1',
        kind: 'WEB',
        browser: 'Chrome',
        operatingSystem: 'Windows',
        scopes: [],
        startedAt: '2026-09-01T10:00:00Z',
        lastSeenAt: '2026-09-04T09:00:00Z',
        expiresAt: '2026-10-01T10:00:00Z',
        current: true,
      },
    ];

    const req = http.expectOne(`${environment.apiUrl}/me/sessions`);
    expect(req.request.method).toBe('GET');
    req.flush(payload);

    expect(await sessions).toEqual(payload);
  });

  /** El id viaja escapado en la ruta: un id con caracteres raros no rompe la URL. */
  it('cierra una sesión con DELETE por id', async () => {
    const done = firstValueFrom(api.close('sess 1/x'));

    const req = http.expectOne(`${environment.apiUrl}/me/sessions/sess%201%2Fx`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await done;
  });
});
