import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AdminSeguridad } from './admin-seguridad';

/**
 * Monta la vista de verdad, que es lo que el build no comprueba: el `tsconfig` aún no tiene
 * `strictTemplates`, así que una plantilla puede compilar y reventar al pintarse. Estas pruebas
 * no van del aspecto, van de que renderiza con datos, sin datos y a medias.
 */
describe('AdminSeguridad', () => {
  const base = `${environment.apiUrl}/admin/security-audit`;

  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Espera a que el store termine. `whenStable` no basta: la carga encadena tres promesas
   * dentro de un `Promise.allSettled`, y el `flush` de HttpTestingController solo resuelve la
   * primera vuelta de microtasks. Sin el salto al siguiente tick la vista se repinta todavía
   * en estado de carga y la prueba mide el esqueleto, no el contenido.
   */
  async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  /** Contesta a las tres peticiones que dispara el constructor de la vista. */
  function answer(options: { events?: unknown[]; clients?: unknown[]; starts?: number } = {}): void {
    http.expectOne((r) => r.url === base).flush({
      content: options.events ?? [],
      page: 0,
      size: 25,
      totalElements: options.events?.length ?? 0,
      totalPages: options.events?.length ? 1 : 0,
    });
    http.expectOne((r) => r.url === `${base}/summary`).flush({
      byKind: [
        { kind: 'LOGIN_START', events: options.starts ?? 0 },
        { kind: 'LOGIN_SUCCESS', events: 0 },
        { kind: 'LOGIN_FAILURE', events: 0 },
        { kind: 'LOGOUT', events: 0 },
        { kind: 'ACCESS_DENIED', events: 0 },
      ],
      totalEvents: options.starts ?? 0,
    });
    http.expectOne((r) => r.url === `${base}/top-clients`).flush(options.clients ?? []);
  }

  const CLIENTE = {
    clientIp: '88.98.97.149',
    country: 'ES',
    lastUserAgent: 'UptimeRobot/2.0',
    events: 4954,
    firstSeen: '2026-07-17T22:40:00Z',
    lastSeen: '2026-08-04T07:42:00Z',
    eventsPerHour: 11.8,
  };

  const EVENTO = {
    id: 1,
    occurredAt: '2026-08-04T07:42:00Z',
    kind: 'LOGIN_START',
    clientIp: '88.98.97.149',
    userAgent: 'UptimeRobot/2.0',
    country: 'ES',
    requestPath: '/oauth2/authorization/discord',
    cfRay: 'a25bb8465f75dd98-MAD',
    userId: null,
    detail: null,
  };

  it('pinta las tres secciones con datos', async () => {
    const fixture = TestBed.createComponent(AdminSeguridad);
    fixture.detectChanges();
    answer({ events: [EVENTO], clients: [CLIENTE], starts: 4954 });
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Resumen del periodo');
    expect(text).toContain('Quién genera estos eventos');
    expect(text).toContain('88.98.97.149');
    expect(text).toContain('UptimeRobot/2.0');
    expect(text).toContain('Inicio de login');
  });

  /** Un evento sin IP, sin agente y sin ruta no puede tumbar la tabla: son campos nullable. */
  it('aguanta un evento con todo a null', async () => {
    const fixture = TestBed.createComponent(AdminSeguridad);
    fixture.detectChanges();
    answer({
      events: [{ ...EVENTO, clientIp: null, userAgent: null, requestPath: null, country: null }],
    });
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Eventos');
  });

  /**
   * Siempre hay un periodo aplicado, asi que el vacio no puede decir "no hay nada": tiene que
   * decir donde ha buscado. Este test existe porque la primera version si decia "todavia no hay
   * eventos registrados", un mensaje que nunca se podia dar.
   */
  it('el vacio sin filtrar habla del periodo, no de la ausencia total', async () => {
    const fixture = TestBed.createComponent(AdminSeguridad);
    fixture.detectChanges();
    answer();
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Ningún evento en este periodo');
    // Y sin haber tocado nada, no se ofrece quitar unos filtros que el usuario no puso.
    expect(text).not.toContain('Quitar filtros');
  });

  it('enseña el estado de error con su botón de reintentar cuando fallan las tres', async () => {
    const fixture = TestBed.createComponent(AdminSeguridad);
    fixture.detectChanges();
    const boom = { status: 500, statusText: 'Server Error' };
    http.expectOne((r) => r.url === base).flush(null, boom);
    http.expectOne((r) => r.url === `${base}/summary`).flush(null, boom);
    http.expectOne((r) => r.url === `${base}/top-clients`).flush(null, boom);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No se ha podido cargar');
    expect(text).toContain('Reintentar');
  });

  /**
   * El aviso de abandono solo aparece cuando el desajuste es grande de verdad. Si saltara con
   * cuatro intentos, dejaria de significar algo justo el dia que importa.
   */
  it('no avisa de abandono con volumen bajo', async () => {
    const fixture = TestBed.createComponent(AdminSeguridad);
    fixture.detectChanges();
    answer({ starts: 10 });
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('no lo hacen personas');
  });

  it('avisa de abandono cuando casi ningun login se completa', async () => {
    const fixture = TestBed.createComponent(AdminSeguridad);
    fixture.detectChanges();
    answer({ starts: 4954 });
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('no lo hacen personas');
  });
});
