import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FeedbackAdminApi } from './feedback-admin-api';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('FeedbackAdminApi', () => {
  let api: FeedbackAdminApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(FeedbackAdminApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el detalle por id', async () => {
    const detail = firstValueFrom(api.detail(ID));

    const req = http.expectOne(`${environment.apiUrl}/admin/feedback/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: ID });

    expect(await detail).toEqual({ id: ID });
  });

  /**
   * El `:id` llega del router ya URL-decodificado. Sin escapar, un valor como `../../algo`
   * deja de identificar un reporte y reescribe la ruta de la petición.
   */
  it('escapa el id en la ruta del detalle', async () => {
    const detail = firstValueFrom(api.detail('../../algo'));

    const req = http.expectOne(`${environment.apiUrl}/admin/feedback/..%2F..%2Falgo`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'x' });

    await detail;
  });

  it('escapa el id en la ruta del PATCH', async () => {
    const updated = firstValueFrom(api.update('../../algo', { status: 'RESOLVED', adminNote: null }));

    const req = http.expectOne(`${environment.apiUrl}/admin/feedback/..%2F..%2Falgo`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 'x' });

    await updated;
  });

  it('manda los filtros presentes y omite los ausentes', async () => {
    const page = firstValueFrom(api.list({ status: 'NEW' }, 2, 20));

    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/admin/feedback` && r.params.get('status') === 'NEW',
    );
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.has('kind')).toBe(false);
    expect(req.request.params.has('area')).toBe(false);
    req.flush({ content: [], page: 2, size: 20, totalElements: 0, totalPages: 0 });

    await page;
  });
});
