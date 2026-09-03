import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrupoPartidas } from './grupo-partidas';
import { Session } from '../../../../core/auth';
import { GameDataStore } from '../../../../core/game-data';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge } from '../../../../core/groups';
import {
  LobbiesStore,
  LobbyParticipantResponse,
  LobbyResponse,
  LobbySlotResponse,
} from '../../../../core/lobbies';
import { NotificationsStore } from '../../../../core/notifications';
import { ToastService } from '../../../../core/toast';

const ME = 'user-edu';
const GROUP_ID = 'g1';
/** Ancla temporal fija: nada de «ahora», o la prueba cambiaría de resultado sola. */
const NOW = Date.UTC(2026, 8, 5, 21, 45, 0);

function participant(n: number, userId = `u${n}`): LobbyParticipantResponse {
  return {
    userId,
    discordUsername: `jugador${n}`,
    avatarUrl: null,
    joinedAt: '2026-09-05T20:00:00Z',
  };
}

function slot(id: string, startsAt: string, starters = 6, bench = 0): LobbySlotResponse {
  return {
    id,
    startsAt,
    signedUp: starters + bench,
    starters: Array.from({ length: starters }, (_, i) => participant(i + 1)),
    bench: Array.from({ length: bench }, (_, i) => participant(starters + i + 1)),
  };
}

function lobby(id: string, overrides: Partial<LobbyResponse> = {}): LobbyResponse {
  return {
    id,
    groupId: GROUP_ID,
    code: id.toUpperCase(),
    mode: 'OPEN',
    status: 'CONFIRMED',
    capacity: 10,
    note: null,
    openedBy: participant(1),
    confirmedSlotId: 's-' + id,
    createdAt: '2026-09-01T18:00:00Z',
    slots: [slot('s-' + id, '2026-09-05T22:00:00Z')],
    ...overrides,
  };
}

class LobbiesStub {
  readonly all = signal<LobbyResponse[]>([]);
  readonly open = this.all.asReadonly();
  status = () => 'ready' as const;
  isLoading = () => false;
  isActing = () => false;
  ensureLoaded = () => Promise.resolve();
  reload = vi.fn().mockResolvedValue(undefined);
  refreshQuietly = vi.fn().mockResolvedValue(undefined);
  signUp = vi.fn().mockResolvedValue(undefined);
  withdraw = vi.fn().mockResolvedValue(undefined);
}

/** Aviso en vivo por SSE, empujable desde el test. */
type Nudge = { event: string; data: Record<string, string> } | null;

function createComponent(lobbies: LobbyResponse[]) {
  const store = new LobbiesStub();
  store.all.set(lobbies);
  const toasts = { success: vi.fn(), error: vi.fn() };
  const nudge = signal<Nudge>(null);
  const notifs = { lastNudge: () => nudge() };

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: new BehaviorSubject(convertToParamMap({ id: GROUP_ID })),
          snapshot: { paramMap: convertToParamMap({ id: GROUP_ID }) },
        },
      },
      { provide: Session, useValue: { user: () => ({ userId: ME, displayName: 'EduUC#EUW' }) } },
      { provide: LobbiesStore, useValue: store },
      { provide: ToastService, useValue: toasts },
      { provide: NotificationsStore, useValue: notifs },
      { provide: GroupBridge, useValue: { status: () => 'ready', ensure: () => Promise.resolve() } },
      {
        provide: GroupStore,
        useValue: {
          byId: (id: string) => ({ id, name: 'Customs Tryhard' }),
          rosterOf: () => [],
          select: () => undefined,
        },
      },
      {
        provide: GameDataStore,
        useValue: {
          status: () => 'ready',
          ensureLoaded: () => Promise.resolve(),
          championById: () => new Map(),
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(GrupoPartidas);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, store, toasts, nudge };
}

describe('GrupoPartidas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('una convocatoria a menos de media hora se convierte en la sala en directo', () => {
    // Faltan 15 minutos.
    const { component } = createComponent([lobby('a')]);

    expect(component.liveLobby()?.id).toBe('a');
    expect(component.scheduled()).toHaveLength(0);
  });

  it('una convocatoria más lejana se queda en la columna de lo que viene', () => {
    const lejana = lobby('b', {
      confirmedSlotId: 's-b',
      slots: [slot('s-b', '2026-09-06T22:00:00Z')],
    });
    const { component } = createComponent([lejana]);

    expect(component.liveLobby()).toBeNull();
    expect(component.scheduled().map((e) => e.lobby.id)).toEqual(['b']);
  });

  it('una partida ya empezada sigue siendo lo más en directo que hay', () => {
    const empezada = lobby('c', {
      confirmedSlotId: 's-c',
      slots: [slot('s-c', '2026-09-05T21:00:00Z')],
    });
    const { component } = createComponent([empezada]);

    expect(component.liveLobby()?.id).toBe('c');
  });

  it('sin hora confirmada no hay sala en directo, por muy cerca que caiga', () => {
    const proponiendo = lobby('d', {
      status: 'POLLING',
      confirmedSlotId: null,
      slots: [slot('s-d', '2026-09-05T22:00:00Z')],
    });
    const { component } = createComponent([proponiendo]);

    expect(component.liveLobby()).toBeNull();
    expect(component.scheduled()).toHaveLength(1);
  });

  it('la frontera de los treinta minutos se cruza sola, sin recargar', () => {
    const enUnaHora = lobby('e', {
      confirmedSlotId: 's-e',
      slots: [slot('s-e', '2026-09-05T22:30:00Z')],
    });
    const { component, fixture } = createComponent([enUnaHora]);

    expect(component.liveLobby()).toBeNull();

    // Pasan 20 minutos con la pestaña abierta.
    vi.advanceTimersByTime(20 * 60 * 1000);
    fixture.detectChanges();

    expect(component.liveLobby()?.id).toBe('e');
  });

  it('lo que viene se ordena de lo más cercano a lo más lejano', () => {
    const sabado = lobby('sabado', {
      confirmedSlotId: 's-sabado',
      slots: [slot('s-sabado', '2026-09-07T18:30:00Z')],
    });
    const manana = lobby('manana', {
      confirmedSlotId: 's-manana',
      slots: [slot('s-manana', '2026-09-06T22:00:00Z')],
    });
    const { component } = createComponent([sabado, manana]);

    expect(component.scheduled().map((e) => e.lobby.id)).toEqual(['manana', 'sabado']);
  });

  it('sabe si estás dentro y en qué puesto', () => {
    const conmigo = lobby('f', {
      confirmedSlotId: 's-f',
      slots: [
        {
          id: 's-f',
          startsAt: '2026-09-06T22:00:00Z',
          signedUp: 3,
          starters: [participant(1), participant(2, ME), participant(3)],
          bench: [],
        },
      ],
    });
    const { component } = createComponent([conmigo]);

    const standing = component.scheduled()[0].standing;
    expect(standing.kind).toBe('starter');
    expect(standing.kind === 'starter' && standing.position).toBe(2);
  });

  it('distingue al suplente del titular', () => {
    const enBanquillo = lobby('g', {
      confirmedSlotId: 's-g',
      slots: [
        {
          id: 's-g',
          startsAt: '2026-09-06T22:00:00Z',
          signedUp: 2,
          starters: [participant(1)],
          bench: [participant(2, ME)],
        },
      ],
    });
    const { component } = createComponent([enBanquillo]);

    expect(component.scheduled()[0].standing.kind).toBe('bench');
  });

  it('apuntarse avisa al usuario cuando el servidor confirma', async () => {
    const proxima = lobby('h', {
      confirmedSlotId: 's-h',
      slots: [slot('s-h', '2026-09-06T22:00:00Z')],
    });
    const { component, store, toasts } = createComponent([proxima]);

    await component.signUp({ lobbyId: 'h', slotId: 's-h' });

    expect(store.signUp).toHaveBeenCalledWith('h', 's-h');
    expect(toasts.success).toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it('si el servidor rechaza, el error se cuenta y no se canta victoria', async () => {
    const proxima = lobby('i', {
      confirmedSlotId: 's-i',
      slots: [slot('s-i', '2026-09-06T22:00:00Z')],
    });
    const { component, store, toasts } = createComponent([proxima]);
    store.signUp.mockRejectedValueOnce(new Error('nope'));

    await component.signUp({ lobbyId: 'i', slotId: 's-i' });

    expect(toasts.error).toHaveBeenCalled();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('el aviso en vivo refresca en silencio, no con la recarga que vacía la pantalla', () => {
    const proxima = lobby('j', {
      confirmedSlotId: 's-j',
      slots: [slot('s-j', '2026-09-06T22:00:00Z')],
    });
    const { fixture, store, nudge } = createComponent([proxima]);

    nudge.set({ event: 'lobby', data: { groupId: GROUP_ID } });
    fixture.detectChanges();

    // `reload()` pone el store en `loading`, y con ello la vista se cae a esqueletos:
    // el documento se encoge y el navegador tira el scroll al principio. Por un cambio
    // ajeno que solo mueve una cifra, eso se lee como si la página se recargara.
    expect(store.refreshQuietly).toHaveBeenCalled();
    expect(store.reload).not.toHaveBeenCalled();
  });

  it('un aviso de otro grupo no toca esta lista', () => {
    const { fixture, store, nudge } = createComponent([]);

    nudge.set({ event: 'lobby', data: { groupId: 'otro-grupo' } });
    fixture.detectChanges();

    expect(store.refreshQuietly).not.toHaveBeenCalled();
  });

  it('el reintento explícito sí recarga a la vista: el usuario lo ha pedido', () => {
    const { component, store } = createComponent([]);

    component.reloadLobbies();

    expect(store.reload).toHaveBeenCalled();
  });
});
