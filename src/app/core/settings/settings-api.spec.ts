import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsApi } from './settings-api';

describe('SettingsApi', () => {
  let api: SettingsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SettingsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee los ajustes del usuario logueado', async () => {
    const settings = firstValueFrom(api.get());

    const req = http.expectOne(`${environment.apiUrl}/me/settings`);
    expect(req.request.method).toBe('GET');
    req.flush({ allowGroupInvites: false });

    expect(await settings).toEqual({ allowGroupInvites: false });
  });

  /** PUT y no PATCH: el cuerpo lleva el ajuste completo, que es lo que espera el backend. */
  it('guarda los ajustes con un PUT y el cuerpo completo', async () => {
    const saved = firstValueFrom(api.update({ allowGroupInvites: false }));

    const req = http.expectOne(`${environment.apiUrl}/me/settings`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ allowGroupInvites: false });
    req.flush({ allowGroupInvites: false });

    expect(await saved).toEqual({ allowGroupInvites: false });
  });
});
