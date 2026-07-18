import { TestBed } from '@angular/core/testing';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { Observable, Subject, of, throwError } from 'rxjs';
import { NotificationsApi } from './notifications-api';
import { NotificationsStore } from './notifications-store';
import { NotificationResponse } from './models';

function notif(id: string, read = false): NotificationResponse {
  return { id, type: 'INVITED_TO_GROUP', data: { invitationId: `inv-${id}` }, read, createdAt: '2026-07-18T12:00:00Z' };
}

/** Doble de `NotificationsApi` con `list`/`markRead` swappables para controlar tiempo y fallos. */
class ApiStub {
  listCalls = 0;
  markReadCalls: string[] = [];
  markReadFail = false;
  streamUrl = 'http://localhost/stream';

  listImpl: () => Observable<NotificationResponse[]> = () => of([notif('a'), notif('b', true)]);

  list(): Observable<NotificationResponse[]> {
    this.listCalls++;
    return this.listImpl();
  }

  markRead(id: string): Observable<void> {
    this.markReadCalls.push(id);
    return this.markReadFail ? throwError(() => new Error('boom')) : of(undefined);
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

  it('markAllRead marca cada no leída (un POST por cada una)', async () => {
    api.listImpl = () => of([notif('a'), notif('b'), notif('c', true)]);
    await store.ensureLoaded();
    await store.markAllRead();
    expect(api.markReadCalls.sort()).toEqual(['a', 'b']);
    expect(store.unreadCount()).toBe(0);
  });

  it('clear resetea la bandeja y el estado', async () => {
    await store.ensureLoaded();
    store.clear();
    expect(store.notifications()).toEqual([]);
    expect(store.status()).toBe('idle');
    expect(store.unreadCount()).toBe(0);
  });
});
