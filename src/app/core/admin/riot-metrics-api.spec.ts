import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RiotMetricsApi } from './riot-metrics-api';

describe('RiotMetricsApi', () => {
  let api: RiotMetricsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(RiotMetricsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee la ventana de uso actual', async () => {
    const usage = firstValueFrom(api.usage());

    const req = http.expectOne(`${environment.apiUrl}/admin/riot/usage`);
    expect(req.request.method).toBe('GET');
    req.flush({
      used: 63,
      limit: 100,
      windowSeconds: 120,
      rateLimited: 0,
      riotCount: 87,
      riotCountAt: '2026-08-01T20:00:00Z',
      nextSlotAt: '2026-08-01T20:00:41Z',
      windowClearAt: '2026-08-01T20:01:58Z',
      serverTime: '2026-08-01T20:00:00Z',
    });

    expect((await usage).used).toBe(63);
  });

  it('pide las métricas con la ventana en el query param', async () => {
    const metrics = firstValueFrom(api.metrics(72));

    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/admin/riot/metrics` && r.params.get('hours') === '72',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ windowHours: 72, totals: {}, topEndpoints: [], hourly: [], peakHours: [], topUsers: [] });

    expect((await metrics).windowHours).toBe(72);
  });

  /** Sin query params extra: cualquiera que sobre acaba siendo un 400 del backend. */
  it('no manda más parámetros que hours', async () => {
    void firstValueFrom(api.metrics(24));

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/admin/riot/metrics`);
    expect(req.request.params.keys()).toEqual(['hours']);
    req.flush({ windowHours: 24, totals: {}, topEndpoints: [], hourly: [], peakHours: [], topUsers: [] });
  });
});
