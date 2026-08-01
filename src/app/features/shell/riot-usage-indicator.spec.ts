import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable } from 'rxjs';
import { RiotApiUsage } from '../../core/admin';
import { RiotMetricsApi } from '../../core/admin/riot-metrics-api';
import { RiotUsageStore } from '../../core/admin/riot-usage-store';
import { RiotUsageIndicator } from './riot-usage-indicator';

const POLL_MS = 10_000;

function usage(used: number): RiotApiUsage {
  return {
    used,
    limit: 100,
    windowSeconds: 120,
    rateLimited: 2,
    riotCount: 87,
    riotCountAt: '2026-08-01T20:00:00Z',
    nextSlotAt: '2026-08-01T20:00:41Z',
    windowClearAt: '2026-08-01T20:01:58Z',
    serverTime: '2026-08-01T20:00:00Z',
  };
}

const flush = () => Promise.resolve().then(() => Promise.resolve());

class ApiDouble {
  calls = 0;
  used = 63;

  usage(): Observable<RiotApiUsage> {
    this.calls++;
    return new Observable<RiotApiUsage>((subscriber) => {
      subscriber.next(usage(this.used));
      subscriber.complete();
    });
  }
}

describe('RiotUsageIndicator', () => {
  let api: ApiDouble;

  beforeEach(() => {
    vi.useFakeTimers();
    api = new ApiDouble();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: RiotMetricsApi, useValue: api }],
    });
  });

  afterEach(() => {
    TestBed.inject(RiotUsageStore).clear();
    vi.useRealTimers();
  });

  it('arranca el polling al montarse', () => {
    TestBed.createComponent(RiotUsageIndicator);

    expect(api.calls).toBe(1);
  });

  /**
   * Lo que impide que el polling sobreviva al componente. Sin esto, navegar fuera del shell
   * dejaría una petición cada 10 s corriendo para siempre.
   */
  it('para el polling al destruirse', () => {
    const fixture = TestBed.createComponent(RiotUsageIndicator);
    fixture.destroy();

    vi.advanceTimersByTime(POLL_MS * 3);

    expect(api.calls).toBe(1);
  });

  /**
   * El tooltip es donde se explica que el número de Riot puede ser mayor que el nuestro, que es
   * el efecto de compartir la API key con la app antigua.
   */
  it('resume nuestro uso, el de Riot y la cuenta atrás en el tooltip', async () => {
    const fixture = TestBed.createComponent(RiotUsageIndicator);
    await flush();
    fixture.detectChanges();

    const tooltip = fixture.componentInstance.tooltip();

    expect(tooltip).toContain('Nosotros: 63/100');
    expect(tooltip).toContain('Riot dice: 87');
    expect(tooltip).toContain('2 rechazadas');
    expect(tooltip).toContain('Hueco libre en 41 s');
  });

  it('sin datos todavía enseña un texto neutro, no un tooltip a medias', () => {
    const fixture = TestBed.createComponent(RiotUsageIndicator);

    TestBed.inject(RiotUsageStore).clear();

    expect(fixture.componentInstance.tooltip()).toBe('Uso de la API de Riot');
  });
});
