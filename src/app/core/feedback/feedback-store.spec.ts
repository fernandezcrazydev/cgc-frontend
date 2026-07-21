import { TestBed } from '@angular/core/testing';
import { Observable, throwError } from 'rxjs';
import { FeedbackApi } from './feedback-api';
import { FeedbackStore } from './feedback-store';
import { FeedbackReport } from './models';

/**
 * Doble del API resuelto a mano: así se puede observar el estado del store
 * MIENTRAS el envío está en vuelo (`submitting`), que es lo que pinta el diálogo.
 */
class ApiStub {
  calls = 0;
  last: FeedbackReport | null = null;
  fail = false;

  private resolve!: () => void;

  submit(report: FeedbackReport): Observable<void> {
    this.calls++;
    this.last = report;
    if (this.fail) return throwError(() => new Error('boom'));
    return new Observable<void>((sub) => {
      this.resolve = () => {
        sub.next();
        sub.complete();
      };
    });
  }

  /** Deja que el microtask de `firstValueFrom` corra tras emitir. */
  async settle(): Promise<void> {
    this.resolve();
    await Promise.resolve();
  }
}

const REPORT: FeedbackReport = {
  kind: 'bug',
  title: 'La sala no abre',
  area: 'partidas',
  whatHappened: 'Se queda cargando',
  steps: '1. Crear partida 2. Generar equipos',
  expected: 'Debería abrirse la sala',
  frequency: 'always',
  context: { route: '/app/grupos/1', userAgent: 'vitest', viewport: '1440×900' },
};

describe('FeedbackStore', () => {
  let store: FeedbackStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [FeedbackStore, { provide: FeedbackApi, useValue: api }],
    });
    store = TestBed.inject(FeedbackStore);
  });

  it('arranca sin envíos en vuelo', () => {
    expect(store.submitting()).toBe(false);
  });

  it('marca submitting mientras el envío está en vuelo y lo libera al confirmar', async () => {
    const sending = store.submit(REPORT);
    expect(store.submitting()).toBe(true);

    await api.settle();

    expect(await sending).toBe(true);
    expect(store.submitting()).toBe(false);
    expect(api.last).toEqual(REPORT);
  });

  it('no es reentrante: un segundo submit en vuelo se ignora', async () => {
    const first = store.submit(REPORT);
    const second = await store.submit(REPORT);

    expect(second).toBe(false);
    expect(api.calls).toBe(1);

    await api.settle();
    expect(await first).toBe(true);
  });

  it('si el envío falla propaga el error, libera submitting y deja reintentar', async () => {
    api.fail = true;
    // El error viaja a la vista para que traduzca su `code`; el store no lo traga.
    await expect(store.submit(REPORT)).rejects.toThrow('boom');
    expect(store.submitting()).toBe(false);

    api.fail = false;
    const retry = store.submit(REPORT);
    await api.settle();

    expect(await retry).toBe(true);
    expect(api.calls).toBe(2);
  });
});
