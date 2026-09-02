import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { ServerClock, serverClockInterceptor } from './server-clock';

const ONE_HOUR = 3_600_000;

describe('ServerClock', () => {
  let clock: ServerClock;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ServerClock] });
    clock = TestBed.inject(ServerClock);
  });

  it('arranca suponiendo que el reloj local es bueno', () => {
    expect(clock.offsetMs()).toBe(0);
    expect(clock.synced()).toBe(false);
    expect(clock.hasMeaningfulSkew()).toBe(false);
  });

  /**
   * El caso que motiva todo esto: un reloj local adelantado daría la temporada por terminada antes
   * de tiempo **solo para esa persona**, que vería "Finalizada" mientras el resto sigue jugando.
   */
  it('detecta un reloj local adelantado y lo corrige', () => {
    const local = Date.now();
    // El servidor va una hora por detrás: el reloj del equipo está adelantado.
    clock.record(local - ONE_HOUR, local, local);

    expect(clock.offsetMs()).toBeCloseTo(-ONE_HOUR, -3);
    expect(clock.synced()).toBe(true);
    expect(clock.hasMeaningfulSkew()).toBe(true);
  });

  it('detecta un reloj local atrasado', () => {
    const local = Date.now();
    clock.record(local + ONE_HOUR, local, local);

    expect(clock.offsetMs()).toBeCloseTo(ONE_HOUR, -3);
  });

  /**
   * La latencia no es desfase de reloj.
   *
   * <p>Se compara contra el punto medio del viaje: la respuesta se generó en algún momento entre la
   * ida y la vuelta, así que achacarle el instante de llegada contaría el viaje entero como error.
   */
  it('descuenta la latencia usando el punto medio del viaje', () => {
    const sent = 1_000_000;
    const received = sent + 4_000;
    // El servidor responde exactamente a mitad de camino: no hay desfase real.
    clock.record(sent + 2_000, sent, received);

    expect(clock.offsetMs()).toBe(0);
  });

  /**
   * Un desfase pequeño se ignora: la cabecera `Date` tiene precisión de segundo y la red mete su
   * propio ruido, así que corregirlo sería perseguir el error de medida, no el del reloj.
   */
  it('ignora un desfase por debajo del umbral', () => {
    const local = Date.now();
    clock.record(local + 2_000, local, local);

    expect(clock.offsetMs()).toBe(0);
    // Aun así queda constancia de que se ha medido.
    expect(clock.synced()).toBe(true);
  });

  it('now() aplica el desfase medido', () => {
    const local = Date.now();
    clock.record(local + ONE_HOUR, local, local);

    expect(clock.now()).toBeGreaterThan(Date.now() + ONE_HOUR - 5_000);
  });
});

describe('serverClockInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let clock: ServerClock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ServerClock,
        provideHttpClient(withInterceptors([serverClockInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    clock = TestBed.inject(ServerClock);
  });

  it('aprende la hora del servidor de la cabecera Date de nuestra API', () => {
    http.get(`${environment.apiUrl}/me`).subscribe();

    const future = new Date(Date.now() + ONE_HOUR).toUTCString();
    backend.expectOne(`${environment.apiUrl}/me`).flush({}, { headers: { Date: future } });

    expect(clock.synced()).toBe(true);
    expect(clock.hasMeaningfulSkew()).toBe(true);
  });

  /**
   * La hora de un CDN o de Discord no dice nada sobre la del servidor que emite los `endsAt`, así
   * que ajustarse a ella sería tomar por buena la de una máquina que no manda aquí.
   */
  it('ignora la hora de servidores que no son nuestra API', () => {
    http.get('https://cdn.example.com/asset.png').subscribe();

    const future = new Date(Date.now() + ONE_HOUR).toUTCString();
    backend.expectOne('https://cdn.example.com/asset.png').flush({}, { headers: { Date: future } });

    expect(clock.synced()).toBe(false);
    expect(clock.offsetMs()).toBe(0);
  });

  it('sigue adelante si la respuesta no trae cabecera Date', () => {
    let ok = false;
    http.get(`${environment.apiUrl}/me`).subscribe(() => (ok = true));

    backend.expectOne(`${environment.apiUrl}/me`).flush({});

    expect(ok).toBe(true);
    expect(clock.synced()).toBe(false);
  });

  /** Una cabecera ilegible se descarta en vez de envenenar el reloj con un NaN. */
  it('descarta una cabecera Date que no se puede leer', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    http.get(`${environment.apiUrl}/me`).subscribe();

    backend.expectOne(`${environment.apiUrl}/me`).flush({}, { headers: { Date: 'no es una fecha' } });

    expect(clock.offsetMs()).toBe(0);
    expect(Number.isNaN(clock.now())).toBe(false);
    warn.mockRestore();
  });

  it('no rompe la petición cuando esta falla', () => {
    let status = 0;
    http.get(`${environment.apiUrl}/me`).subscribe({ error: (e) => (status = e.status) });

    backend.expectOne(`${environment.apiUrl}/me`).flush({}, { status: 500, statusText: 'Server Error' });

    expect(status).toBe(500);
  });
});
