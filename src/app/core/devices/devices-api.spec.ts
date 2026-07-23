import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DevicesApi } from './devices-api';
import { LinkedDevice } from './models';

describe('DevicesApi', () => {
  let api: DevicesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DevicesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los dispositivos del usuario logueado', async () => {
    const devices = firstValueFrom(api.list());
    const payload: LinkedDevice[] = [
      { id: 'dev-1', scopes: ['profile:read'], linkedAt: '2026-07-20T18:00:00Z', expiresAt: null },
    ];

    const req = http.expectOne(`${environment.apiUrl}/me/devices`);
    expect(req.request.method).toBe('GET');
    req.flush(payload);

    expect(await devices).toEqual(payload);
  });

  /** El id viaja escapado en la ruta: un id con caracteres raros no rompe la URL. */
  it('revoca un dispositivo con DELETE por id', async () => {
    const done = firstValueFrom(api.revoke('dev 1/x'));

    const req = http.expectOne(`${environment.apiUrl}/me/devices/dev%201%2Fx`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);

    await done;
  });
});
