import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SecurityAuditApi } from './security-audit-api';

describe('SecurityAuditApi', () => {
  const base = `${environment.apiUrl}/admin/security-audit`;

  let api: SecurityAuditApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SecurityAuditApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la página con paginación por offset', async () => {
    const page = firstValueFrom(api.list({}, 2, 25));

    const req = http.expectOne((r) => r.url === base);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('25');
    req.flush({ content: [], page: 2, size: 25, totalElements: 0, totalPages: 0 });

    expect((await page).page).toBe(2);
  });

  it('manda cada filtro presente como query param', async () => {
    void firstValueFrom(
      api.list(
        {
          kind: 'LOGIN_START',
          clientIp: '88.98.97.0/24',
          userId: 'u-1',
          from: '2026-08-01T00:00:00Z',
          to: '2026-08-05T00:00:00Z',
        },
        0,
        25,
      ),
    );

    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.get('kind')).toBe('LOGIN_START');
    expect(req.request.params.get('clientIp')).toBe('88.98.97.0/24');
    expect(req.request.params.get('userId')).toBe('u-1');
    expect(req.request.params.get('from')).toBe('2026-08-01T00:00:00Z');
    expect(req.request.params.get('to')).toBe('2026-08-05T00:00:00Z');
    req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 });
  });

  /** Un filtro ausente no debe viajar: el backend entonces sencillamente no filtra por él. */
  it('no manda los filtros que no se han puesto', async () => {
    void firstValueFrom(api.list({ kind: 'LOGIN_START' }, 0, 25));

    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.has('clientIp')).toBe(false);
    expect(req.request.params.has('userId')).toBe(false);
    expect(req.request.params.has('from')).toBe(false);
    req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 });
  });

  /**
   * El caso que de verdad muerde: la caja de la vista manda '' cuando está vacía. Si viajara,
   * el backend lo leería como un filtro literal por cadena vacía y respondería 400 por
   * dirección inválida — es decir, un error donde el usuario no había filtrado por nada.
   */
  it('trata una IP vacía como ausencia de filtro, no como filtro vacío', async () => {
    void firstValueFrom(api.list({ clientIp: '' }, 0, 25));

    const req = http.expectOne((r) => r.url === base);
    expect(req.request.params.has('clientIp')).toBe(false);
    req.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 });
  });

  it('pide el resumen con los mismos filtros', async () => {
    void firstValueFrom(api.summary({ kind: 'LOGIN_START' }));

    const req = http.expectOne((r) => r.url === `${base}/summary`);
    expect(req.request.params.get('kind')).toBe('LOGIN_START');
    req.flush({ byKind: [], totalEvents: 0 });
  });

  it('pide el ranking con su límite', async () => {
    void firstValueFrom(api.topClients({}, 15));

    const req = http.expectOne((r) => r.url === `${base}/top-clients`);
    expect(req.request.params.get('limit')).toBe('15');
    req.flush([]);
  });

  it('pide el detalle por id', async () => {
    void firstValueFrom(api.detail(7));

    const req = http.expectOne(`${base}/7`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 7 });
  });
});
