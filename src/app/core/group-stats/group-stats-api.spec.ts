import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { GroupStatsApi } from './group-stats-api';

describe('GroupStatsApi', () => {
  let api: GroupStatsApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GroupStatsApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GroupStatsApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide los alcances a GET /groups/{id}/stats/scopes', () => {
    api.getScopes('grp-1').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/groups/grp-1/stats/scopes`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('manda la modalidad como parámetro', () => {
    api.getStats('grp-1', { preset: 'CHAOS', leagueId: null }).subscribe();

    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/groups/grp-1/stats`,
    );
    expect(req.request.params.get('preset')).toBe('CHAOS');
    req.flush({});
  });

  /**
   * Sin temporada el parámetro **no viaja**, y no viaja vacío: el backend sin él contesta todas las
   * temporadas de la modalidad, mientras que `leagueId=` sería pedir una temporada con id en blanco.
   */
  it('sin temporada no manda el parámetro, en vez de mandarlo vacío', () => {
    api.getStats('grp-1', { preset: 'BALANCED', leagueId: null }).subscribe();

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/groups/grp-1/stats`);
    expect(req.request.params.has('leagueId')).toBe(false);
    req.flush({});
  });

  it('con temporada la manda', () => {
    api.getStats('grp-1', { preset: 'BALANCED', leagueId: 'liga-2' }).subscribe();

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/groups/grp-1/stats`);
    expect(req.request.params.get('leagueId')).toBe('liga-2');
    req.flush({});
  });
});
