import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { NotificationResponse, NotificationsStore } from '../../core/notifications';
import { RiotAccountStore } from '../../core/riot';
import { wireRiotAccountRefresh } from './riot-account-refresh';

/**
 * Test de integración del cableado global de `shell.ts`: cuando llega por el stream una
 * notificación de vinculación de Riot, `RiotAccountStore.refresh()` debe pedirse — es lo que
 * hace que el perfil se ponga al día solo, sin que el usuario recargue la página.
 *
 * Monta `NotificationsStore` y `RiotAccountStore` como dobles en vez de `Shell` entero: `Shell`
 * arrastra Router, `GroupsStore`, `MatchStore`, `InvitationsStore`, `GroupDetailStore`,
 * `DevicesStore` y una plantilla grande solo para llegar a un `effect` de una línea, así que se
 * extrajo `wireRiotAccountRefresh` (ver ese fichero) para poder probarlo aislado. `lastArrived`
 * es exactamente el punto donde el store real deja la notificación tras leerla del stream SSE
 * (cubierto en `core/notifications/notifications-store.spec.ts`), así que fijarlo a mano aquí
 * simula fielmente "llegó por el stream" sin tener que levantar un `fetch` + SSE falso otra vez.
 */
describe('wireRiotAccountRefresh (cableado de shell.ts)', () => {
  let lastArrived: WritableSignal<NotificationResponse | null>;
  let refreshCalls: number;

  function notif(type: string): NotificationResponse {
    return { id: 'n1', type, data: { riotId: 'N1ghtfang#LAN' }, read: false, createdAt: '2026-07-25T12:00:00Z' };
  }

  beforeEach(() => {
    lastArrived = signal<NotificationResponse | null>(null);
    refreshCalls = 0;

    const notifsDouble = { lastArrived: lastArrived.asReadonly() } as unknown as NotificationsStore;
    const riotDouble = {
      refresh: () => {
        refreshCalls++;
        return Promise.resolve();
      },
    } as unknown as RiotAccountStore;

    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationsStore, useValue: notifsDouble },
        { provide: RiotAccountStore, useValue: riotDouble },
      ],
    });

    TestBed.runInInjectionContext(() =>
      wireRiotAccountRefresh(TestBed.inject(NotificationsStore), TestBed.inject(RiotAccountStore)),
    );
  });

  it('pide el refetch cuando llega RIOT_ACCOUNT_PAIRED', () => {
    lastArrived.set(notif('RIOT_ACCOUNT_PAIRED'));
    TestBed.tick();

    expect(refreshCalls).toBe(1);
  });

  it('pide el refetch cuando llega RIOT_ACCOUNT_VERIFIED', () => {
    lastArrived.set(notif('RIOT_ACCOUNT_VERIFIED'));
    TestBed.tick();

    expect(refreshCalls).toBe(1);
  });

  it('pide el refetch también cuando al usuario le quitan la cuenta (RIOT_ACCOUNT_TAKEN_OVER)', () => {
    lastArrived.set(notif('RIOT_ACCOUNT_TAKEN_OVER'));
    TestBed.tick();

    expect(refreshCalls).toBe(1);
  });

  it('ignora notificaciones que no son de Riot (p. ej. INVITED_TO_GROUP)', () => {
    lastArrived.set(notif('INVITED_TO_GROUP'));
    TestBed.tick();

    expect(refreshCalls).toBe(0);
  });

  it('dos eventos seguidos piden dos refrescos (uno por evento; la no-reentrada vive en el store)', () => {
    lastArrived.set(notif('RIOT_ACCOUNT_PAIRED'));
    TestBed.tick();
    lastArrived.set(notif('RIOT_ACCOUNT_VERIFIED'));
    TestBed.tick();

    expect(refreshCalls).toBe(2);
  });
});
