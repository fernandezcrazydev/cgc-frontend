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
    req.flush({
      allowGroupInvites: false,
      discordNotifications: true,
      profileVisibility: 'GROUP_ADMINS',
    });

    expect(await settings).toEqual({
      allowGroupInvites: false,
      discordNotifications: true,
      profileVisibility: 'GROUP_ADMINS',
    });
  });

  /**
   * PUT y no PATCH: el cuerpo lleva los TRES ajustes, que es lo que espera el backend. Omitir uno
   * es un 422 `NOT_NULL`, nunca un silencioso «apágalo», así que este test vigila que el cuerpo
   * viaje completo y no solo el campo que se acaba de tocar.
   */
  it('guarda los ajustes con un PUT y el cuerpo completo', async () => {
    const body = {
      allowGroupInvites: false,
      discordNotifications: true,
      profileVisibility: 'GROUP_ADMINS',
    } as const;
    const saved = firstValueFrom(api.update(body));

    const req = http.expectOne(`${environment.apiUrl}/me/settings`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush(body);

    expect(await saved).toEqual(body);
  });
});
