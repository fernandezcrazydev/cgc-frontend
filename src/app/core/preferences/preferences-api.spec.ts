import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PreferencesApi } from './preferences-api';

describe('PreferencesApi', () => {
  let api: PreferencesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PreferencesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee los roles preferidos del usuario logueado', async () => {
    const prefs = firstValueFrom(api.get());

    const req = http.expectOne(`${environment.apiUrl}/me/preferences`);
    expect(req.request.method).toBe('GET');
    req.flush({ roles: ['JUNGLA', 'MID'], primary: 'MID' });

    expect(await prefs).toEqual({ roles: ['JUNGLA', 'MID'], primary: 'MID' });
  });

  /** Quien nunca ha elegido no es un 404: el servidor devuelve la selección vacía. */
  it('acepta la selección vacía de quien nunca ha elegido', async () => {
    const prefs = firstValueFrom(api.get());

    http.expectOne(`${environment.apiUrl}/me/preferences`).flush({ roles: [], primary: null });

    expect(await prefs).toEqual({ roles: [], primary: null });
  });

  /** PUT y no PATCH: el cuerpo lleva la selección completa, que es lo que espera el backend. */
  it('guarda los roles con un PUT y el cuerpo completo', async () => {
    const saved = firstValueFrom(api.update({ roles: ['TOP'], primary: 'TOP' }));

    const req = http.expectOne(`${environment.apiUrl}/me/preferences`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ roles: ['TOP'], primary: 'TOP' });
    req.flush({ roles: ['TOP'], primary: 'TOP' });

    expect(await saved).toEqual({ roles: ['TOP'], primary: 'TOP' });
  });

  /** Elegir roles sin marcar favorito es una respuesta válida; el `null` viaja tal cual. */
  it('manda primary null cuando no hay rol principal', async () => {
    const saved = firstValueFrom(api.update({ roles: ['TOP', 'ADC'], primary: null }));

    const req = http.expectOne(`${environment.apiUrl}/me/preferences`);
    expect(req.request.body).toEqual({ roles: ['TOP', 'ADC'], primary: null });
    req.flush({ roles: ['TOP', 'ADC'], primary: null });

    expect(await saved).toEqual({ roles: ['TOP', 'ADC'], primary: null });
  });
});
