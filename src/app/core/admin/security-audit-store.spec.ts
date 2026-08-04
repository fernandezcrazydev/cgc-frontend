import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { SecurityAuditStore } from './security-audit-store';

describe('SecurityAuditStore', () => {
  const base = `${environment.apiUrl}/admin/security-audit`;

  let store: SecurityAuditStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(SecurityAuditStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Responde a las tres peticiones de una carga. `fail` marca cuáles deben caer. */
  function answer(fail: { list?: boolean; summary?: boolean; clients?: boolean } = {}): void {
    const list = http.expectOne((r) => r.url === base);
    const summary = http.expectOne((r) => r.url === `${base}/summary`);
    const clients = http.expectOne((r) => r.url === `${base}/top-clients`);

    const boom = { status: 500, statusText: 'Server Error' };
    if (fail.list) list.flush(null, boom);
    else list.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 });
    if (fail.summary) summary.flush(null, boom);
    else summary.flush({ byKind: [], totalEvents: 0 });
    if (fail.clients) clients.flush(null, boom);
    else clients.flush([]);
  }

  it('arranca en idle, que cuenta como cargando', () => {
    expect(store.status()).toBe('idle');
    expect(store.loading()).toBe(true);
  });

  it('pide las tres lecturas a la vez y queda listo', async () => {
    const done = store.load(0);
    answer();
    await done;

    expect(store.status()).toBe('ready');
    expect(store.loading()).toBe(false);
    expect(store.page()).not.toBeNull();
    expect(store.summary()).not.toBeNull();
    expect(store.clients()).not.toBeNull();
  });

  /** Con un log, media información sigue siendo información: un fallo parcial no vacía el resto. */
  it('conserva lo que sí llegó cuando solo falla una de las tres', async () => {
    const done = store.load(0);
    answer({ clients: true });
    await done;

    expect(store.status()).toBe('ready');
    expect(store.page()).not.toBeNull();
    expect(store.clients()).toBeNull();
    expect(store.lastError()).toBeTruthy();
  });

  it('queda en error solo si fallan las tres', async () => {
    const done = store.load(0);
    answer({ list: true, summary: true, clients: true });
    await done;

    expect(store.status()).toBe('error');
    expect(store.lastError()).toBeTruthy();
  });

  it('limpia el último error en una carga que va bien', async () => {
    let done = store.load(0);
    answer({ list: true, summary: true, clients: true });
    await done;
    expect(store.lastError()).toBeTruthy();

    done = store.load(0);
    answer();
    await done;
    expect(store.lastError()).toBeNull();
  });

  it('aplicar filtros vuelve a la primera página', async () => {
    const done = store.applyFilters({ kind: 'LOGIN_START' });
    const list = http.expectOne((r) => r.url === base);
    expect(list.request.params.get('page')).toBe('0');
    expect(list.request.params.get('kind')).toBe('LOGIN_START');
    list.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 });
    http.expectOne((r) => r.url === `${base}/summary`).flush({ byKind: [], totalEvents: 0 });
    http.expectOne((r) => r.url === `${base}/top-clients`).flush([]);
    await done;

    expect(store.filters().kind).toBe('LOGIN_START');
  });

  /**
   * El caso feo de dos cargas solapadas: si la primera contesta después de la segunda, escribir
   * su resultado dejaría en pantalla datos del filtro viejo bajo el filtro nuevo.
   */
  it('descarta la respuesta de una carga que ya no es la vigente', async () => {
    const primera = store.load(0);
    const listVieja = http.expectOne((r) => r.url === base);
    const summaryVieja = http.expectOne((r) => r.url === `${base}/summary`);
    const clientsVieja = http.expectOne((r) => r.url === `${base}/top-clients`);

    const segunda = store.load(1);

    // La segunda contesta primero, con contenido reconocible.
    http.match((r) => r.url === base)[0].flush({
      content: [{ id: 99 }],
      page: 1,
      size: 25,
      totalElements: 1,
      totalPages: 1,
    });
    http.match((r) => r.url === `${base}/summary`)[0].flush({ byKind: [], totalEvents: 7 });
    http.match((r) => r.url === `${base}/top-clients`)[0].flush([]);
    await segunda;

    // Y ahora llega, tarde, la primera.
    listVieja.flush({ content: [], page: 0, size: 25, totalElements: 0, totalPages: 0 });
    summaryVieja.flush({ byKind: [], totalEvents: 0 });
    clientsVieja.flush([]);
    await primera;

    expect(store.page()?.page).toBe(1);
    expect(store.summary()?.totalEvents).toBe(7);
  });
});
