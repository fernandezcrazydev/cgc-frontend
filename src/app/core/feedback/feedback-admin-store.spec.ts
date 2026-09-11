import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { FeedbackAdminApi } from './feedback-admin-api';
import { FeedbackAdminStore } from './feedback-admin-store';
import { FeedbackListFilters, FeedbackSummary, PageResponse } from './admin-models';

function page(totalElements: number): PageResponse<FeedbackSummary> {
  return { content: [], page: 0, size: 1, totalElements, totalPages: 1 };
}

/**
 * Doble con la respuesta resuelta a mano: sin eso no se puede observar el estado con una
 * petición todavía en vuelo, que es justo donde vive la deduplicación.
 */
class ApiDouble {
  calls: Array<{ filters: FeedbackListFilters; page: number; size: number }> = [];
  failWith: HttpErrorResponse | null = null;
  private resolvers: Array<(p: PageResponse<FeedbackSummary>) => void> = [];

  list(
    filters: FeedbackListFilters,
    pageIndex: number,
    size: number,
  ): Observable<PageResponse<FeedbackSummary>> {
    this.calls.push({ filters, page: pageIndex, size });
    if (this.failWith) return throwError(() => this.failWith);
    return new Observable((subscriber) => {
      this.resolvers.push((p) => {
        subscriber.next(p);
        subscriber.complete();
      });
    });
  }

  resolveAll(total: number): void {
    const pending = this.resolvers;
    this.resolvers = [];
    pending.forEach((resolve) => resolve(page(total)));
  }
}

/** Deja correr los microtasks: el store publica su estado tras un `await`. */
const flush = () => Promise.resolve().then(() => Promise.resolve());

describe('FeedbackAdminStore · contador de sin triar', () => {
  let api: ApiDouble;
  let store: FeedbackAdminStore;

  beforeEach(() => {
    api = new ApiDouble();
    TestBed.configureTestingModule({
      providers: [{ provide: FeedbackAdminApi, useValue: api }],
    });
    store = TestBed.inject(FeedbackAdminStore);
  });

  it('empieza sin número: nunca un 0 provisional que se lea como dato real', () => {
    expect(store.pendingCount()).toBeNull();
    expect(store.pendingStatus()).toBe('idle');
  });

  it('pide el total del filtro NEW sin traerse la colección', async () => {
    void store.refreshPendingCount();
    expect(api.calls).toEqual([{ filters: { status: 'NEW' }, page: 0, size: 1 }]);

    expect(store.pendingStatus()).toBe('loading');
    api.resolveAll(12);
    await flush();

    expect(store.pendingCount()).toBe(12);
    expect(store.pendingStatus()).toBe('ready');
  });

  it('deduplica la petición en vuelo: dos vistas a la vez no piden dos veces', async () => {
    const first = store.refreshPendingCount();
    const second = store.refreshPendingCount();

    expect(api.calls.length).toBe(1);

    api.resolveAll(3);
    await Promise.all([first, second]);
    expect(store.pendingCount()).toBe(3);
  });

  it('vuelve a pedirlo al entrar de nuevo en la ruta: otro admin ha podido triar', async () => {
    void store.refreshPendingCount();
    api.resolveAll(12);
    await flush();

    void store.refreshPendingCount();
    api.resolveAll(11);
    await flush();

    expect(api.calls.length).toBe(2);
    expect(store.pendingCount()).toBe(11);
  });

  it('conserva el número anterior mientras llega el nuevo, para que el badge no parpadee', async () => {
    void store.refreshPendingCount();
    api.resolveAll(12);
    await flush();

    void store.refreshPendingCount();
    expect(store.pendingCount()).toBe(12);
  });

  it('un fallo no se propaga ni borra lo que ya se sabía: es un extra de la pantalla', async () => {
    void store.refreshPendingCount();
    api.resolveAll(12);
    await flush();

    api.failWith = new HttpErrorResponse({ status: 500 });
    await expect(store.refreshPendingCount()).resolves.toBeUndefined();

    expect(store.pendingStatus()).toBe('error');
    expect(store.pendingCount()).toBe(12);
  });

  it('tras un fallo en la primera carga no hay número que pintar', async () => {
    api.failWith = new HttpErrorResponse({ status: 500 });
    await store.refreshPendingCount();

    expect(store.pendingStatus()).toBe('error');
    expect(store.pendingCount()).toBeNull();
  });
});
