import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Session } from '../auth';
import { MatchHistoryStore } from './match-history-store';
import { EMPTY_FILTERS, groupMatchQuery, personalMatchQuery, personalSummaryQuery } from './match-filtering';

const ME = 'me-uuid';
const GROUP = { id: 'g1', name: 'Chiringuito' };

function page(ids: string[], totalElements = ids.length) {
  return {
    content: ids.map((id) => ({ id, hasStats: true, winnerSlot: 'A', teams: [] })),
    page: 0,
    size: 6,
    totalElements,
    totalPages: 1,
  };
}

describe('MatchHistoryStore', () => {
  let store: MatchHistoryStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Session, useValue: { user: signal({ userId: ME }) } },
      ],
    });
    store = TestBed.inject(MatchHistoryStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const query = () => personalMatchQuery(EMPTY_FILTERS, 0, 6);

  it('arranca en idle y sin nada cargado', () => {
    expect(store.personalStatus()).toBe('idle');
    expect(store.personalMatches()).toEqual([]);
    expect(store.personalTotal()).toBe(0);
  });

  it('pasa por loading y deja la página en ready', async () => {
    const done = store.ensurePersonal(query());
    expect(store.personalStatus()).toBe('loading');

    http.expectOne((r) => r.url === `${environment.apiUrl}/me/matches`).flush(page(['a', 'b'], 20));
    await done;

    expect(store.personalStatus()).toBe('ready');
    expect(store.personalMatches().map((m) => m.id)).toEqual(['a', 'b']);
    // El contador sale del total del servidor, no de la longitud de la página.
    expect(store.personalTotal()).toBe(20);
  });

  it('un fallo deja el estado en error y la lista vacía, no a medias', async () => {
    const done = store.ensurePersonal(query());
    http
      .expectOne((r) => r.url === `${environment.apiUrl}/me/matches`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    await done;

    expect(store.personalStatus()).toBe('error');
    expect(store.personalMatches()).toEqual([]);
  });

  /** `ensure` es idempotente por consulta: repetir la misma no vuelve a pedir. */
  it('repetir la misma consulta no dispara una segunda petición', async () => {
    const first = store.ensurePersonal(query());
    http.expectOne((r) => r.url === `${environment.apiUrl}/me/matches`).flush(page(['a']));
    await first;

    await store.ensurePersonal(query());
    http.expectNone((r) => r.url === `${environment.apiUrl}/me/matches`);
  });

  it('cambiar de consulta sí vuelve a pedir, y reload fuerza aunque no cambie', async () => {
    const first = store.ensurePersonal(query());
    http.expectOne((r) => r.url === `${environment.apiUrl}/me/matches`).flush(page(['a']));
    await first;

    const second = store.ensurePersonal(personalMatchQuery(EMPTY_FILTERS, 1, 6));
    http.expectOne((r) => r.params.get('page') === '1').flush(page(['b']));
    await second;
    expect(store.personalMatches().map((m) => m.id)).toEqual(['b']);

    const forced = store.reloadPersonal(personalMatchQuery(EMPTY_FILTERS, 1, 6));
    http.expectOne((r) => r.params.get('page') === '1').flush(page(['c']));
    await forced;
    expect(store.personalMatches().map((m) => m.id)).toEqual(['c']);
  });

  /*
   * Sin esto, teclear en el buscador deja la lista en el resultado de la penúltima letra: la
   * petición vieja tarda más y escribe encima de la nueva.
   */
  it('una respuesta que llega tarde ya no escribe en la lista', async () => {
    const first = store.ensurePersonal(query());
    const second = store.ensurePersonal(personalMatchQuery({ ...EMPTY_FILTERS, searchQuery: 'ahri' }, 0, 6));

    const requests = http.match((r) => r.url === `${environment.apiUrl}/me/matches`);
    // `match` devuelve TestRequest, cuya petición está en `.request`.
    expect(requests).toHaveLength(2);

    // La SEGUNDA responde primero, y la primera llega después: la tardía se descarta.
    requests[1].flush(page(['nueva']));
    requests[0].flush(page(['vieja']));
    await Promise.all([first, second]);

    expect(store.personalMatches().map((m) => m.id)).toEqual(['nueva']);
  });

  /*
   * La pantalla del cruce enseña tres recuentos a la vez (todas, juntos, enfrentados). Con un
   * único hueco, las tres pestañas acababan con el número de la última consulta que volvió.
   */
  it('guarda un resumen personal por consulta, no uno solo', async () => {
    const juntos = personalSummaryQuery(EMPTY_FILTERS, { with: 'x', relation: 'ally' });
    const contra = personalSummaryQuery(EMPTY_FILTERS, { with: 'x', relation: 'enemy' });

    const a = store.ensurePersonalSummary(juntos);
    const b = store.ensurePersonalSummary(contra);
    const reqs = http.match((r) => r.url === `${environment.apiUrl}/me/matches/summary`);
    reqs.find((r) => r.request.params.get('relation') === 'ALLY')!.flush({ totalMatches: 7 });
    reqs.find((r) => r.request.params.get('relation') === 'ENEMY')!.flush({ totalMatches: 3 });
    await Promise.all([a, b]);

    expect(store.personalSummaryFor(juntos)?.totalMatches).toBe(7);
    expect(store.personalSummaryFor(contra)?.totalMatches).toBe(3);
  });

  it('el 404 del detalle se distingue de un fallo de red', async () => {
    const notFound = store.ensureDetail('nope');
    http.expectOne(`${environment.apiUrl}/matches/nope`).flush(
      { code: 'MATCH_NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );
    await notFound;

    expect(store.detailStatus()).toBe('error');
    expect(store.detailNotFound()).toBe(true);

    const broken = store.ensureDetail('otra');
    http.expectOne(`${environment.apiUrl}/matches/otra`).flush({}, { status: 0, statusText: '' });
    await broken;

    expect(store.detailStatus()).toBe('error');
    expect(store.detailNotFound()).toBe(false);
  });

  /** La muestra del grupo va en su propio hueco: abrir la tier list no le pisa la página al historial. */
  it('la muestra del grupo no pisa la lista del historial de grupo', async () => {
    const lista = store.ensureGroup(GROUP, groupMatchQuery(EMPTY_FILTERS, 0, 6));
    http.expectOne((r) => r.params.get('size') === '6').flush(page(['lista']));
    await lista;

    const muestra = store.ensureGroupSample(GROUP);
    http.expectOne((r) => r.params.get('size') === '60').flush(page(['muestra'], 200));
    await muestra;

    expect(store.groupMatches().map((m) => m.id)).toEqual(['lista']);
    expect(store.groupSample().map((m) => m.id)).toEqual(['muestra']);
    expect(store.groupSampleTotal()).toBe(200);
  });

  it('clear no deja rastro del usuario anterior', async () => {
    const done = store.ensurePersonal(query());
    http.expectOne((r) => r.url === `${environment.apiUrl}/me/matches`).flush(page(['a']));
    await done;

    store.clear();

    expect(store.personalStatus()).toBe('idle');
    expect(store.personalMatches()).toEqual([]);
    expect(store.personalTotal()).toBe(0);
    expect(store.detail()).toBeNull();
    expect(store.groupSummary()).toBeNull();
  });
});
