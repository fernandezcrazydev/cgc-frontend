import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminActionsApi } from './admin-actions-api';

/**
 * Este `*-api.ts` no tenía spec (deuda; el resto de `core/admin` sí los tiene). Se añade al
 * cambiarlo de ruta, porque lo que se rompe si esta URL se desvía es invisible desde la UI: el
 * botón simplemente devolvería un 404 que el toast pinta como un error genérico.
 */
describe('AdminActionsApi', () => {
  const url = `${environment.apiUrl}/admin/riot/accounts/refresh`;

  let api: AdminActionsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AdminActionsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * La ruta cambió con la issue #46 del backend (era `/admin/riot/profile-icons/sync`). El
   * barrido detrás refresca icono Y rango, y la vieja ya no existe.
   */
  it('pide el refresco a la ruta de cuentas, no a la vieja de iconos', async () => {
    const report = firstValueFrom(api.refreshRiotAccounts());

    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    req.flush({ total: 5, iconsUpdated: 4, seedsUpdated: 4, anchored: 3, failed: 1, skipped: 0 });

    expect((await report).anchored).toBe(3);
  });

  /** El backend no lee cuerpo ninguno, pero un POST sin cuerpo viaja mal en algunos proxies. */
  it('manda un cuerpo vacío, no null', async () => {
    void firstValueFrom(api.refreshRiotAccounts());

    const req = http.expectOne(url);
    expect(req.request.body).toEqual({});
    req.flush({ total: 0, iconsUpdated: 0, seedsUpdated: 0, anchored: 0, failed: 0, skipped: 0 });
  });

  /**
   * Los seis campos llegan tal cual: es un DTO espejo y la vista los pinta sin derivar nada del
   * backend. Si el backend añadiera o quitara uno, esto es lo que lo dice.
   */
  it('devuelve el informe con sus seis contadores', async () => {
    const report = firstValueFrom(api.refreshRiotAccounts());

    http
      .expectOne(url)
      .flush({ total: 9, iconsUpdated: 7, seedsUpdated: 6, anchored: 2, failed: 1, skipped: 2 });

    expect(await report).toEqual({
      total: 9,
      iconsUpdated: 7,
      seedsUpdated: 6,
      anchored: 2,
      failed: 1,
      skipped: 2,
    });
  });
});
