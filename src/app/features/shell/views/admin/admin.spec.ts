import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { AdminDirectory } from './admin';

/**
 * El directorio pinta tres pies que llegan por tres lecturas independientes. Lo que estas
 * pruebas vigilan no es el aspecto, sino que ninguna de las tres pueda tumbar la pantalla:
 * con las tres caídas, las tarjetas siguen llevando a sus vistas.
 *
 * Monta el componente de verdad porque el `tsconfig` aún no tiene `strictTemplates`: una
 * plantilla puede compilar y reventar al pintarse.
 */
describe('AdminDirectory', () => {
  const feedbackUrl = `${environment.apiUrl}/admin/feedback`;
  const usageUrl = `${environment.apiUrl}/admin/riot/usage`;
  const summaryUrl = `${environment.apiUrl}/admin/security-audit/summary`;

  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(AdminDirectory);
    fixture.detectChanges();
    return fixture;
  }

  async function settle(fixture: { whenStable(): Promise<unknown>; detectChanges(): void }) {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const boom = { status: 500, statusText: 'Server Error' };

  /** Contesta a las tres lecturas del constructor. `fail` marca cuáles caen. */
  function answer(fail: { pending?: boolean; usage?: boolean; pulse?: boolean } = {}): void {
    const pending = http.expectOne((r) => r.url === feedbackUrl);
    const usage = http.expectOne((r) => r.url === usageUrl);
    const pulse = http.expectOne((r) => r.url === summaryUrl);

    if (fail.pending) pending.flush(null, boom);
    else pending.flush({ content: [], page: 0, size: 1, totalElements: 3, totalPages: 3 });

    if (fail.usage) usage.flush(null, boom);
    else
      usage.flush({
        used: 62,
        limit: 100,
        windowSeconds: 120,
        rateLimited: 0,
        riotCount: null,
        riotCountAt: null,
        nextSlotAt: null,
        windowClearAt: null,
        serverTime: '2026-09-10T10:00:00Z',
      });

    if (fail.pulse) pulse.flush(null, boom);
    else
      pulse.flush({
        byKind: [
          { kind: 'LOGIN_START', events: 130 },
          { kind: 'LOGIN_SUCCESS', events: 6 },
          { kind: 'LOGIN_FAILURE', events: 4 },
          { kind: 'LOGOUT', events: 0 },
          { kind: 'ACCESS_DENIED', events: 8 },
        ],
        totalEvents: 148,
      });
  }

  it('mientras cargan los tres pies pinta esqueleto y ningún número', () => {
    const fixture = render();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelectorAll('nf-skeleton').length).toBe(3);
    expect(html.querySelectorAll('[aria-busy="true"]').length).toBe(3);
    // Nada de ceros ni guiones provisionales: se leerían como dato bueno.
    expect(html.querySelector('.ad-pulse__value')).toBeNull();

    answer();
  });

  it('pinta los tres pulsos cuando llegan', async () => {
    const fixture = render();
    answer();
    await settle(fixture);

    const html = fixture.nativeElement as HTMLElement;
    const texto = html.textContent ?? '';

    expect(texto).toContain('3 sin triar');
    expect(texto).toContain('12 intentos rechazados'); // 4 fallidos + 8 denegados
    expect(texto).toContain('148 eventos en 24 h');
    // 62/100 es el peldaño de aviso, y la ventana se cuenta en minutos, no en los 120 s del DTO.
    expect(texto).toContain('Cuota apretada');
    expect(texto).toContain('62 de 100 en 2 min');
    expect(html.querySelectorAll('nf-skeleton').length).toBe(0);
    expect(html.querySelectorAll('[aria-busy="true"]').length).toBe(0);
  });

  it('el hilo de cuota espera neutro y toma el color del nivel al llegar el dato', async () => {
    const fixture = render();
    const thread = (fixture.nativeElement as HTMLElement).querySelector('.ad-card__thread')!;

    // Se pinta desde el primer frame: si apareciera con el dato, la tarjeta saltaría 3 px.
    expect(thread).not.toBeNull();
    expect(thread.getAttribute('data-level')).toBeNull();

    answer();
    await settle(fixture);

    expect(thread.getAttribute('data-level')).toBe('warn');
  });

  it('con la cuota caída el hilo se queda neutro en vez de mentir con un color', async () => {
    const fixture = render();
    answer({ usage: true });
    await settle(fixture);

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('.ad-card__thread')!.getAttribute('data-level')).toBeNull();
    expect(html.textContent).toContain('No se pudo leer la cuota');
  });

  it('sin nada sin triar y sin rechazos lo dice, en vez de dejar el pie vacío', async () => {
    const fixture = render();
    http
      .expectOne((r) => r.url === feedbackUrl)
      .flush({ content: [], page: 0, size: 1, totalElements: 0, totalPages: 0 });
    http.expectOne((r) => r.url === usageUrl).flush(null, boom);
    http.expectOne((r) => r.url === summaryUrl).flush({
      byKind: [
        { kind: 'LOGIN_START', events: 2 },
        { kind: 'LOGIN_SUCCESS', events: 2 },
        { kind: 'LOGIN_FAILURE', events: 0 },
        { kind: 'LOGOUT', events: 2 },
        { kind: 'ACCESS_DENIED', events: 0 },
      ],
      totalEvents: 6,
    });
    await settle(fixture);

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Al día');
    expect(texto).toContain('Sin rechazos');
  });

  it('con las tres lecturas caídas sigue siendo un directorio: tres enlaces y su operación', async () => {
    const fixture = render();
    answer({ pending: true, usage: true, pulse: true });
    await settle(fixture);

    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelectorAll('a.ad-card').length).toBe(3);
    expect(html.querySelector('.ad-op button')).not.toBeNull();
    expect(html.querySelectorAll('nf-skeleton').length).toBe(0);
    expect(html.textContent).toContain('No se pudo cargar el contador');
    expect(html.textContent).toContain('No se pudo leer la cuota');
    expect(html.textContent).toContain('No se pudo cargar el resumen');
  });
});
