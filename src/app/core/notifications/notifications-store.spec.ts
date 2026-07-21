import { TestBed } from '@angular/core/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, Subject, of, throwError } from 'rxjs';
import { SessionRecovery } from '../http';
import { NotificationsApi } from './notifications-api';
import { NotificationsStore } from './notifications-store';
import { NotificationResponse } from './models';

function notif(id: string, read = false): NotificationResponse {
  return { id, type: 'INVITED_TO_GROUP', data: { invitationId: `inv-${id}` }, read, createdAt: '2026-07-18T12:00:00Z' };
}

/** Doble de `NotificationsApi` con métodos swappables para controlar tiempo y fallos. */
class ApiStub {
  listCalls = 0;
  listArgs: { page: number; size: number }[] = [];
  markReadCalls: string[] = [];
  markReadFail = false;
  markAllReadCalls = 0;
  markAllReadFail = false;
  deleteCalls: string[] = [];
  streamUrl = 'http://localhost/stream';

  listImpl: (page: number, size: number) => Observable<NotificationResponse[]> = () =>
    of([notif('a'), notif('b', true)]);

  list(page = 0, size = 30): Observable<NotificationResponse[]> {
    this.listCalls++;
    this.listArgs.push({ page, size });
    return this.listImpl(page, size);
  }

  markRead(id: string): Observable<void> {
    this.markReadCalls.push(id);
    return this.markReadFail ? throwError(() => new Error('boom')) : of(undefined);
  }

  markAllRead(): Observable<void> {
    this.markAllReadCalls++;
    return this.markAllReadFail ? throwError(() => new Error('boom')) : of(undefined);
  }

  delete(id: string): Observable<void> {
    this.deleteCalls.push(id);
    return of(undefined);
  }
}

describe('NotificationsStore', () => {
  let store: NotificationsStore;
  let api: ApiStub;

  beforeEach(() => {
    api = new ApiStub();
    TestBed.configureTestingModule({
      providers: [
        NotificationsStore,
        { provide: NotificationsApi, useValue: api },
        // El stream nunca se abre en tests; el token solo hace falta para conectar.
        { provide: OidcSecurityService, useValue: { getAccessToken: () => of('') } },
        // La recuperación de sesión arrastraría Router/Session reales: doble inerte.
        { provide: SessionRecovery, useValue: { refresh: () => Promise.resolve(false) } },
      ],
    });
    store = TestBed.inject(NotificationsStore);
  });

  it('ensureLoaded carga la bandeja y deriva el contador de no leídas', async () => {
    await store.ensureLoaded();
    expect(store.status()).toBe('ready');
    expect(store.notifications()).toHaveLength(2);
    expect(store.unreadCount()).toBe(1);
    expect(store.hasUnread()).toBe(true);
  });

  it('ensureLoaded es idempotente tras ready; reload fuerza refetch', async () => {
    await store.ensureLoaded();
    await store.ensureLoaded();
    expect(api.listCalls).toBe(1);
    await store.reload();
    expect(api.listCalls).toBe(2);
  });

  it('deduplica peticiones concurrentes en vuelo', async () => {
    const subject = new Subject<NotificationResponse[]>();
    api.listImpl = () => subject.asObservable();
    const p1 = store.ensureLoaded();
    const p2 = store.ensureLoaded();
    subject.next([notif('a')]);
    subject.complete();
    await Promise.all([p1, p2]);
    expect(api.listCalls).toBe(1);
  });

  it('un fallo deja status error y lista vacía; reload reintenta con éxito', async () => {
    api.listImpl = () => throwError(() => new Error('down'));
    await store.ensureLoaded();
    expect(store.status()).toBe('error');
    expect(store.notifications()).toEqual([]);

    api.listImpl = () => of([notif('a')]);
    await store.reload();
    expect(store.status()).toBe('ready');
    expect(store.notifications()).toHaveLength(1);
  });

  it('markRead es optimista y hace POST; no reintenta una ya leída', async () => {
    await store.ensureLoaded();
    await store.markRead('a');
    expect(api.markReadCalls).toEqual(['a']);
    expect(store.unreadCount()).toBe(0);
    // 'b' ya estaba leída: no dispara POST.
    await store.markRead('b');
    expect(api.markReadCalls).toEqual(['a']);
  });

  it('markRead revierte el estado local si el POST falla', async () => {
    await store.ensureLoaded();
    api.markReadFail = true;
    await store.markRead('a');
    expect(store.notifications().find((n) => n.id === 'a')?.read).toBe(false);
    expect(store.unreadCount()).toBe(1);
  });

  it('markAllRead usa el endpoint único y pinta todo leído', async () => {
    api.listImpl = () => of([notif('a'), notif('b'), notif('c', true)]);
    await store.ensureLoaded();
    await store.markAllRead();
    expect(api.markAllReadCalls).toBe(1);
    expect(api.markReadCalls).toEqual([]);
    expect(store.unreadCount()).toBe(0);
  });

  it('remove borra la notificación de la bandeja y hace DELETE', async () => {
    await store.ensureLoaded();
    await store.remove('a');
    expect(api.deleteCalls).toEqual(['a']);
    expect(store.notifications().some((n) => n.id === 'a')).toBe(false);
  });

  it('loadMore trae la siguiente página, la añade y deduplica por id', async () => {
    const fullPage = Array.from({ length: 30 }, (_, i) => notif(`p0-${i}`));
    api.listImpl = (page) => of(page === 0 ? fullPage : [notif('p1-a'), notif('p0-0')]);
    await store.ensureLoaded();
    expect(store.hasMore()).toBe(true);

    await store.loadMore();
    expect(api.listArgs).toContainEqual({ page: 1, size: 30 });
    expect(store.notifications().filter((n) => n.id === 'p0-0')).toHaveLength(1);
    expect(store.notifications().some((n) => n.id === 'p1-a')).toBe(true);
    // La segunda página vino incompleta (< 30): no queda más.
    expect(store.hasMore()).toBe(false);
  });

  it('clear resetea la bandeja y el estado', async () => {
    await store.ensureLoaded();
    store.clear();
    expect(store.notifications()).toEqual([]);
    expect(store.status()).toBe('idle');
    expect(store.unreadCount()).toBe(0);
  });
});

/**
 * El stream SSE va por `fetch` a pelo, así que NO pasa por los interceptores de `HttpClient`:
 * su 401 tiene que recuperarlo el store a mano. Es además el detector de sesión caducada de la
 * app —renovar aquí deja token fresco para el resto de peticiones—, de ahí estos tests.
 */
describe('NotificationsStore · recuperación del stream ante un 401', () => {
  const realFetch = globalThis.fetch;
  let store: NotificationsStore;
  let api: ApiStub;
  let refresh: ReturnType<typeof vi.fn>;
  let tokens: string[];
  let bearers: (string | null)[];

  /** Deja correr las promesas encadenadas del fetch + refresh + reconexión. */
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  /** `statuses` = respuesta de cada `fetch` sucesivo: 401 o un stream vivo que no emite nada. */
  function stubFetch(statuses: number[]): void {
    let call = 0;
    globalThis.fetch = ((_url: string, init: RequestInit) => {
      bearers.push(new Headers(init.headers).get('Authorization'));
      const status = statuses[Math.min(call++, statuses.length - 1)];
      if (status !== 200) return Promise.resolve(new Response(null, { status }));
      // Stream abierto que nunca cierra: obliga a que la reconexión sea deliberada.
      return Promise.resolve(new Response(new ReadableStream(), { status: 200 }));
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    api = new ApiStub();
    tokens = ['caducado', 'fresco'];
    bearers = [];
    refresh = vi.fn(() => Promise.resolve(true));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NotificationsStore,
        { provide: NotificationsApi, useValue: api },
        { provide: OidcSecurityService, useValue: { getAccessToken: () => of(tokens.shift() ?? 'fresco') } },
        { provide: SessionRecovery, useValue: { refresh } },
      ],
    });
    store = TestBed.inject(NotificationsStore);
  });

  afterEach(() => {
    store.clear();
    globalThis.fetch = realFetch;
  });

  it('renueva el token y reconecta al instante, sin esperar al backoff', async () => {
    stubFetch([401, 200]);
    store.connect();
    await tick();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(bearers).toEqual(['Bearer caducado', 'Bearer fresco']);
  });

  it('si la renovación falla no reconecta: SessionRecovery ya ha cerrado la sesión', async () => {
    refresh.mockResolvedValue(false);
    stubFetch([401]);
    store.connect();
    await tick();

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(bearers).toHaveLength(1);
  });

  it('un 401 tras haber renovado cae al backoff, no a un bucle de reconexiones', async () => {
    stubFetch([401, 401]);
    store.connect();
    await tick();
    await tick();

    // Solo una renovación y solo un reintento inmediato; el tercer intento queda en el timer.
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(bearers).toHaveLength(2);
  });
});
