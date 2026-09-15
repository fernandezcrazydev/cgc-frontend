import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { MatchTimelineStore } from './match-timeline-store';
import { MatchesApi } from './matches-api';
import { MatchTimelinePositions, MatchTimelineSummary } from './models';

const SUMMARY: MatchTimelineSummary = {
  available: true,
  frameCount: 31,
  kills: [],
  buildings: [],
  monsters: [],
  dragons: [{ teamSlot: 'B', total: 3, bySubType: { AIR_DRAGON: 2, EARTH_DRAGON: 1 } }],
};

const POSITIONS: MatchTimelinePositions = {
  available: true,
  frames: [
    {
      minute: 0,
      positions: [
        { userId: 'u1', teamSlot: 'A', x: 3276, y: 11335, totalGold: 500, level: 1 },
      ],
    },
  ],
};

/** Doble con emisiones resueltas a mano, para poder mirar el estado MIENTRAS la petición viaja. */
class ApiStub {
  summaryCalls = 0;
  positionsCalls = 0;
  failSummary = false;

  private resolveSummary!: (s: MatchTimelineSummary) => void;
  private resolvePositions!: (p: MatchTimelinePositions) => void;

  timelineSummary(): Observable<MatchTimelineSummary> {
    this.summaryCalls++;
    if (this.failSummary) return throwError(() => new Error('boom'));
    return new Observable((sub) => {
      this.resolveSummary = (s) => {
        sub.next(s);
        sub.complete();
      };
    });
  }

  timelinePositions(): Observable<MatchTimelinePositions> {
    this.positionsCalls++;
    return new Observable((sub) => {
      this.resolvePositions = (p) => {
        sub.next(p);
        sub.complete();
      };
    });
  }

  async settleSummary(s: MatchTimelineSummary): Promise<void> {
    this.resolveSummary(s);
    await Promise.resolve();
  }

  async settlePositions(p: MatchTimelinePositions): Promise<void> {
    this.resolvePositions(p);
    await Promise.resolve();
  }
}

describe('MatchTimelineStore', () => {
  let store: MatchTimelineStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [MatchTimelineStore, { provide: MatchesApi, useValue: api }],
    });
    store = TestBed.inject(MatchTimelineStore);
  });

  it('arranca sin timeline y sin afirmar que no la hay', () => {
    expect(store.summaryStatus()).toBe('idle');
    expect(store.available()).toBe(false);
  });

  it('ensureSummary pasa por loading y publica el resumen', async () => {
    const load = store.ensureSummary('m1');
    expect(store.summaryStatus()).toBe('loading');

    await api.settleSummary(SUMMARY);
    await load;

    expect(store.summaryStatus()).toBe('ready');
    expect(store.summary().dragons[0].total).toBe(3);
  });

  /**
   * `available` es «esta partida TIENE timeline», no «ya cargó». Mientras viaja tiene que ser
   * `false`, o la vista pinta el bloque del mapa y lo quita medio segundo después.
   */
  it('available solo es cierto cuando el resumen ha llegado y dice que la hay', async () => {
    const load = store.ensureSummary('m1');
    expect(store.available()).toBe(false);

    await api.settleSummary(SUMMARY);
    await load;
    expect(store.available()).toBe(true);
  });

  /** Una partida que nadie exportó no es un error: responde 200 con `available: false`. */
  it('una partida sin timeline queda ready y no disponible', async () => {
    const load = store.ensureSummary('m1');
    await api.settleSummary({ ...SUMMARY, available: false, dragons: [] });
    await load;

    expect(store.summaryStatus()).toBe('ready');
    expect(store.available()).toBe(false);
  });

  it('no vuelve a pedir el resumen de la misma partida una vez está ready', async () => {
    const load = store.ensureSummary('m1');
    await api.settleSummary(SUMMARY);
    await load;

    await store.ensureSummary('m1');

    expect(api.summaryCalls).toBe(1);
  });

  it('un fallo deja status error y el resumen vacío, no a medias', async () => {
    api.failSummary = true;

    await store.ensureSummary('m1');

    expect(store.summaryStatus()).toBe('error');
    expect(store.summary().dragons).toEqual([]);
  });

  /**
   * Las dos mitades son independientes: el resumen lo pide la pantalla al abrir la partida y las
   * posiciones solo el mapa. Cargar una no puede arrastrar la otra, que es la mitad que pesa.
   */
  it('cargar el resumen no pide las posiciones', async () => {
    const load = store.ensureSummary('m1');
    await api.settleSummary(SUMMARY);
    await load;

    expect(api.positionsCalls).toBe(0);
  });

  it('ensurePositions las carga por su cuenta', async () => {
    const load = store.ensurePositions('m1');
    expect(store.positionsStatus()).toBe('loading');

    await api.settlePositions(POSITIONS);
    await load;

    expect(store.positionsStatus()).toBe('ready');
    expect(store.positions().frames).toHaveLength(1);
  });

  it('clear no deja la timeline de la partida anterior en memoria', async () => {
    const load = store.ensureSummary('m1');
    await api.settleSummary(SUMMARY);
    await load;

    store.clear();

    expect(store.summaryStatus()).toBe('idle');
    expect(store.summary().frameCount).toBe(0);
    expect(store.available()).toBe(false);
  });
});
