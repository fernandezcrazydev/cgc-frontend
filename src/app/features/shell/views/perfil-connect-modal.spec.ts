import { TestBed } from '@angular/core/testing';
import { WritableSignal, signal } from '@angular/core';
import { NotificationResponse, NotificationsStore } from '../../../core/notifications';
import { wireConnectModalOnRiotEvent } from './perfil-connect-modal';

/**
 * El pago real de toda la tarea de "refetch tras vincular desde la app de escritorio": con el
 * modal "conectar_app.exe" abierto y el usuario esperando con el código pegado en `cgc-scraper`,
 * la confirmación del backend (`RIOT_ACCOUNT_PAIRED`/`VERIFIED`) tiene que cerrar el modal solo y
 * avisar con un toast — sin que el usuario recargue la página.
 *
 * Prueba `wireConnectModalOnRiotEvent` aislado (doble de `NotificationsStore` + una signal de
 * `connecting` propia) en vez de montar `Perfil` entero: su plantilla es enorme y, en este
 * runtime de Angular, `effect()` flushea junto con la sincronización de vista del componente que
 * lo declaró — un test que quisiera disparar el efecto real desde dentro de `Perfil` acabaría
 * renderizando toda la plantilla y exigiendo un doble fiel de cada store que toca (roles, sesión,
 * cuenta de Riot...), mucho más de lo que este test necesita proteger. Por eso se extrajo la
 * lógica a `perfil-connect-modal.ts`; ver ese fichero para el porqué completo.
 */
describe('wireConnectModalOnRiotEvent (cableado del modal "conectar_app.exe" en perfil.ts)', () => {
  let lastArrived: WritableSignal<NotificationResponse | null>;
  let connecting: WritableSignal<boolean>;
  let confirmed: { riotId: string; type: string }[];

  function riotNotif(type: string, data: Record<string, string> = { riotId: 'N1ghtfang#LAN' }): NotificationResponse {
    return { id: 'n1', type, data, read: false, createdAt: '2026-07-25T12:00:00Z' };
  }

  beforeEach(() => {
    lastArrived = signal<NotificationResponse | null>(null);
    connecting = signal(false);
    confirmed = [];

    const notifsDouble = { lastArrived: lastArrived.asReadonly() } as unknown as NotificationsStore;

    TestBed.runInInjectionContext(() =>
      wireConnectModalOnRiotEvent(notifsDouble, connecting, (riotId, type) => {
        confirmed.push({ riotId, type });
      }),
    );
  });

  it('con el modal abierto, RIOT_ACCOUNT_PAIRED dispara la confirmación con el riotId', () => {
    connecting.set(true);

    lastArrived.set(riotNotif('RIOT_ACCOUNT_PAIRED'));
    TestBed.tick();

    expect(confirmed).toEqual([{ riotId: 'N1ghtfang#LAN', type: 'RIOT_ACCOUNT_PAIRED' }]);
  });

  it('con el modal abierto, RIOT_ACCOUNT_VERIFIED también dispara la confirmación', () => {
    connecting.set(true);

    lastArrived.set(riotNotif('RIOT_ACCOUNT_VERIFIED'));
    TestBed.tick();

    expect(confirmed).toEqual([{ riotId: 'N1ghtfang#LAN', type: 'RIOT_ACCOUNT_VERIFIED' }]);
  });

  it('con el modal cerrado, el mismo evento no dispara nada (no hay toast que sacar)', () => {
    expect(connecting()).toBe(false);

    lastArrived.set(riotNotif('RIOT_ACCOUNT_PAIRED'));
    TestBed.tick();

    expect(confirmed).toEqual([]);
  });

  it('RIOT_ACCOUNT_TAKEN_OVER no toca el modal (le pasa a quien pierde la cuenta, no a quien la empareja)', () => {
    connecting.set(true);

    lastArrived.set(riotNotif('RIOT_ACCOUNT_TAKEN_OVER'));
    TestBed.tick();

    expect(confirmed).toEqual([]);
  });

  it('una notificación ajena a Riot no toca el modal abierto', () => {
    connecting.set(true);

    lastArrived.set(riotNotif('INVITED_TO_GROUP', {}));
    TestBed.tick();

    expect(confirmed).toEqual([]);
  });

  it('cae al riotId genérico si el backend no lo manda', () => {
    connecting.set(true);

    lastArrived.set(riotNotif('RIOT_ACCOUNT_PAIRED', {}));
    TestBed.tick();

    expect(confirmed).toEqual([{ riotId: 'tu cuenta de Riot', type: 'RIOT_ACCOUNT_PAIRED' }]);
  });
});
