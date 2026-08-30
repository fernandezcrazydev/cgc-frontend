import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LeaguesApi } from './leagues-api';
import { CreateLeagueRequest, LeagueResponse } from './models';

describe('LeaguesApi', () => {
  let api: LeaguesApi;
  let http: HttpTestingController;

  const mockLeague: LeagueResponse = {
    id: 'league-123',
    groupId: 'group-456',
    name: 'Liga Challenger Clausura',
    startsAt: '2026-08-01T00:00:00Z',
    endsAt: '2026-09-15T23:59:59Z',
    status: 'IN_PROGRESS',
    type: 'COMPETITIVE',
    playerCount: 24,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LeaguesApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(LeaguesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('obtiene la liga activa de un grupo mediante GET /groups/{groupId}/league', () => {
    let result: LeagueResponse | undefined;
    api.getActiveLeague('group-456').subscribe((res) => (result = res));

    const req = http.expectOne(`${environment.apiUrl}/groups/group-456/league`);
    expect(req.request.method).toBe('GET');
    req.flush(mockLeague);

    expect(result).toEqual(mockLeague);
  });

  it('lista todas las ligas del grupo mediante GET /groups/{groupId}/leagues', () => {
    let result: LeagueResponse[] | undefined;
    api.listLeagues('group-456').subscribe((res) => (result = res));

    const req = http.expectOne(`${environment.apiUrl}/groups/group-456/leagues`);
    expect(req.request.method).toBe('GET');
    req.flush([mockLeague]);

    expect(result).toEqual([mockLeague]);
  });

  it('crea una nueva liga mediante POST /groups/{groupId}/leagues', () => {
    const payload: CreateLeagueRequest = {
      name: 'Nueva Liga',
      endsAt: '2026-10-01T00:00:00Z',
      status: 'IN_PROGRESS',
      type: 'COMPETITIVE',
    };

    let result: LeagueResponse | undefined;
    api.createLeague('group-456', payload).subscribe((res) => (result = res));

    const req = http.expectOne(`${environment.apiUrl}/groups/group-456/leagues`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockLeague);

    expect(result).toEqual(mockLeague);
  });

  it('pide UNA PÁGINA del leaderboard, con su orden, a GET /groups/{groupId}/leaderboard', () => {
    const mockLeaderboard = {
      league: mockLeague,
      podium: [],
      entries: { content: [], page: 0, size: 15, totalElements: 0, totalPages: 0 },
      totalPlayers: 0,
    };

    let result: unknown;
    api
      .getLeaderboard('group-456', { page: 2, size: 15, sort: 'WINRATE', dir: 'DESC' })
      .subscribe((res) => (result = res));

    // Se busca por ruta y se comprueban los parámetros aparte: `expectOne(string)` compara la URL
    // CON su query string, así que casarla a mano ataría el test al orden de los parámetros.
    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/groups/group-456/leaderboard`,
    );
    expect(req.request.method).toBe('GET');
    // `page` es 0-based, el contrato de paginación acordado para toda la app.
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('15');
    expect(req.request.params.get('sort')).toBe('WINRATE');
    expect(req.request.params.get('dir')).toBe('DESC');
    req.flush(mockLeaderboard);

    expect(result).toEqual(mockLeaderboard);
  });

  it('manda el orden al buscar, porque la página de un jugador depende de él', () => {
    const mockSuggestions = [
      { rank: 3, page: 2, userId: 'user-1', discordUsername: 'Faker', riotId: 'Hide on bush#KR1', lp: 1250 },
    ];

    let result: unknown;
    api
      .searchLeaderboard('group-456', 'faker', 15, 'WINRATE', 'DESC')
      .subscribe((res) => (result = res));

    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/groups/group-456/leaderboard/search`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('faker');
    expect(req.request.params.get('sort')).toBe('WINRATE');
    expect(req.request.params.get('dir')).toBe('DESC');
    req.flush(mockSuggestions);

    expect(result).toEqual(mockSuggestions);
  });
});
