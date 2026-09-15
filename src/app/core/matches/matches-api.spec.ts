import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { MatchesApi } from './matches-api';
import { EMPTY_FILTERS, groupMatchQuery, personalMatchQuery } from './match-filtering';
import { Match, MatchDetail } from './models';

const ME = 'me-uuid';
const GROUP = { id: 'g1', name: 'Chiringuito' };

describe('MatchesApi', () => {
  let api: MatchesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MatchesApi, provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MatchesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el historial del grupo con paginación y lo mapea a dominio', () => {
    let page: { content: Match[]; totalElements: number } | undefined;
    api
      .groupMatches(GROUP.id, groupMatchQuery(EMPTY_FILTERS, 0, 6), { currentUserId: ME })
      .subscribe((res) => (page = res));

    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/groups/${GROUP.id}/matches`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('6');
    expect(req.request.params.get('sort')).toBe('playedAt,desc');

    req.flush({
      content: [
        { id: 'm1', groupId: 'g1', groupName: 'Chiringuito', hasStats: true, teams: [], winnerSlot: 'A' },
      ],
      page: 0,
      size: 6,
      totalElements: 42,
      totalPages: 7,
    });

    expect(page?.totalElements).toBe(42);
    expect(page?.content[0].id).toBe('m1');
    // El grupo viene en la propia fila, también en la lista del grupo donde es redundante.
    expect(page?.content[0].groupId).toBe('g1');
    expect(page?.content[0].group?.name).toBe('Chiringuito');
  });

  /*
   * Un filtro sin poner NO viaja. Mandar `championId=all` sería mandar un filtro que no existe,
   * y el servidor lo rechazaría o —peor— lo ignoraría en silencio.
   */
  it('no manda los filtros que están sin poner', () => {
    api
      .groupMatches(GROUP.id, groupMatchQuery(EMPTY_FILTERS, 0, 6), { currentUserId: ME })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/matches'));
    expect(req.request.params.has('championId')).toBe(false);
    expect(req.request.params.has('winningSide')).toBe(false);
    expect(req.request.params.has('participation')).toBe(false);
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ content: [], page: 0, size: 6, totalElements: 0, totalPages: 0 });
  });

  it('traduce los filtros del grupo a sus parámetros, en el vocabulario del backend', () => {
    api
      .groupMatches(
        GROUP.id,
        groupMatchQuery(
          {
            ...EMPTY_FILTERS,
            championId: 103,
            winningSide: 'blue',
            participation: 'mine',
            preset: 'CHAOS',
            searchQuery: '  ahri  ',
            sortBy: 'kills-desc',
          },
          2,
          6,
        ),
        { currentUserId: ME },
      )
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/matches'));
    expect(req.request.params.get('championId')).toBe('103');
    expect(req.request.params.get('winningSide')).toBe('BLUE');
    expect(req.request.params.get('participation')).toBe('MINE');
    expect(req.request.params.get('preset')).toBe('CHAOS');
    expect(req.request.params.get('q')).toBe('ahri');
    expect(req.request.params.get('sort')).toBe('kills,desc');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ content: [], page: 2, size: 6, totalElements: 0, totalPages: 0 });
  });

  /** El cruce es un filtro del historial personal, no un endpoint aparte. */
  it('el cruce viaja como with/relation sobre /me/matches', () => {
    api
      .myMatches(
        personalMatchQuery({ ...EMPTY_FILTERS, outcome: 'win', lane: 'MID' }, 0, 5, {
          with: 'rival-uuid',
          relation: 'enemy',
        }),
        { currentUserId: ME },
      )
      .subscribe();

    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/me/matches`);
    expect(req.request.params.get('with')).toBe('rival-uuid');
    expect(req.request.params.get('relation')).toBe('ENEMY');
    expect(req.request.params.get('outcome')).toBe('WIN');
    expect(req.request.params.get('lane')).toBe('MID');
    req.flush({ content: [], page: 0, size: 5, totalElements: 0, totalPages: 0 });
  });

  it('el resumen del grupo no acepta filtros: describe el grupo entero', () => {
    api.groupSummary(GROUP.id).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/groups/${GROUP.id}/matches/summary`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush({ totalMatches: 0, matchesWithSide: 0, matchesWithStats: 0 });
  });

  it('pide el detalle y devuelve la partida con sus objetivos', () => {
    let detail: MatchDetail | undefined;
    api.detail('m1', { currentUserId: ME }).subscribe((res) => (detail = res));

    const req = http.expectOne(`${environment.apiUrl}/matches/m1`);
    req.flush({
      gameVersion: '14.24.1',
      summary: { id: 'm1', hasStats: true, winnerSlot: 'A', teams: [] },
      teams: [{ teamSlot: 'A', bans: [], baronKills: 2 }],
      stats: {},
    });

    expect(detail?.match.id).toBe('m1');
    expect(detail?.gameVersion).toBe('14.24.1');
    expect(detail?.match.teams[0].objectives?.barons).toBe(2);
  });
  // ── El hilo de comentarios ──────────────────────────────────────────────

  it('pide el hilo de una partida sin parametros: no puede haber mas de diez', () => {
    let thread: unknown;
    api.comments('m1').subscribe((res) => (thread = res));

    const req = http.expectOne(`${environment.apiUrl}/matches/m1/comments`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([{ id: 'c1', userId: 'u1', text: 'que remontada' }]);

    expect(thread).toHaveLength(1);
  });

  /** El cuerpo lleva solo el texto: autor, fecha e id los pone el servidor. */
  it('deja un comentario con POST y solo el texto en el cuerpo', () => {
    api.leaveComment('m1', 'menuda remontada').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/matches/m1/comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'menuda remontada' });
    req.flush({ id: 'c1', userId: 'u1', text: 'menuda remontada' });
  });

  it('borra un comentario por su id, dentro de su partida', () => {
    api.deleteComment('m1', 'c1').subscribe();

    const req = http.expectOne(`${environment.apiUrl}/matches/m1/comments/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
