import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { LiveRoomDeckComponent } from './live-room-deck.component';
import {
  LobbyParticipantResponse,
  LobbyResponse,
  LobbySlotResponse,
} from '../../../../core/lobbies';

function participant(n: number): LobbyParticipantResponse {
  return {
    userId: `u${n}`,
    discordUsername: `jugador${n}`,
    avatarUrl: null,
    joinedAt: `2026-09-05T20:0${n}:00Z`,
  };
}

function slot(starters: number, bench = 0): LobbySlotResponse {
  return {
    id: 's1',
    startsAt: '2026-09-05T22:00:00Z',
    signedUp: starters + bench,
    starters: Array.from({ length: starters }, (_, i) => participant(i + 1)),
    bench: Array.from({ length: bench }, (_, i) => participant(starters + i + 1)),
  };
}

function lobby(overrides: Partial<LobbyResponse> = {}): LobbyResponse {
  return {
    id: 'lb1',
    groupId: 'g1',
    code: 'WX4K',
    mode: 'OPEN',
    status: 'CONFIRMED',
    capacity: 10,
    note: null,
    openedBy: participant(1),
    confirmedSlotId: 's1',
    createdAt: '2026-09-01T18:00:00Z',
    slots: [slot(10)],
    ...overrides,
  };
}

function createComponent(
  lb: LobbyResponse | null,
  s: LobbySlotResponse | null,
  loading = false,
  canJoin = false,
) {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(LiveRoomDeckComponent);
  fixture.componentRef.setInput('lobby', lb);
  fixture.componentRef.setInput('slot', s);
  fixture.componentRef.setInput('groupId', 'g1');
  fixture.componentRef.setInput('loading', loading);
  fixture.componentRef.setInput('canJoin', canJoin);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('LiveRoomDeckComponent', () => {
  it('reparte las diez plazas en dos filas de cinco, impares arriba y pares abajo', () => {
    const s = slot(10);
    const { component } = createComponent(lobby(), s);

    const posiciones = component['pods']().map((p) => p.position);
    expect(posiciones).toEqual([1, 3, 5, 7, 9, 2, 4, 6, 8, 10]);
  });

  it('cada plaza recibe al jugador que el servidor puso en ella', () => {
    const s = slot(10);
    const { component } = createComponent(lobby(), s);

    const pod = component['pods']().find((p) => p.position === 3);
    expect(pod?.player?.userId).toBe('u3');
    expect(pod?.state).toBe('starter');
  });

  it('las plazas sin cubrir se pintan como huecos libres', () => {
    const s = slot(6);
    const { fixture, component } = createComponent(lobby(), s);

    const libres = component['pods']().filter((p) => p.state === 'free');
    expect(libres).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('app-room-pod')).toHaveLength(10);
  });

  it('respeta la capacidad que manda el servidor, sin dar por hechos los diez', () => {
    const s = slot(4);
    const { component } = createComponent(lobby({ capacity: 6 }), s);

    expect(component['pods']()).toHaveLength(6);
    expect(component['pods']().map((p) => p.position)).toEqual([1, 3, 5, 2, 4, 6]);
  });

  it('sin sala ofrece crearla en vez de enseñar una parrilla vacía', () => {
    const { fixture } = createComponent(null, null);

    expect(fixture.nativeElement.querySelector('.rm-hero')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.rm-grid')).toBeNull();
  });

  it('mientras carga reserva el hueco y no promete todavía ninguna sala', () => {
    const { fixture } = createComponent(lobby(), slot(10), true);

    expect(fixture.nativeElement.querySelector('.rm-hero')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-room-pod')).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('.rm').getAttribute('aria-busy')).toBe('true');
  });

  it('sin suplentes no reserva sitio para un banquillo vacío', () => {
    const { fixture } = createComponent(lobby(), slot(10));

    expect(fixture.nativeElement.querySelector('.bench')).toBeNull();
  });

  it('con suplentes los saca en el banquillo', () => {
    const { fixture } = createComponent(lobby(), slot(10, 3));

    expect(fixture.nativeElement.querySelector('.bench')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.bench__card')).toHaveLength(3);
  });

  it('reparte puestos de ranking distintos: dos «12.º» en la misma sala no existen', () => {
    const s = slot(10, 3);
    const { component } = createComponent(lobby(), s);

    const puestos = [...component['ranks']().values()];
    expect(puestos).toHaveLength(13);
    expect(new Set(puestos).size).toBe(13);
  });

  it('el contador cuenta plazas ocupadas, no inscritos: con banquillo no dice 13 de 10', () => {
    const s = slot(10, 3);
    const { fixture } = createComponent(lobby(), s);

    const texto = fixture.nativeElement.querySelector('.rm__count').textContent;
    expect(texto).toContain('10 de 10');
    expect(texto).not.toContain('13 de 10');
  });

  it('todo hueco libre lleva su «+», se pueda pulsar o no', () => {
    const { fixture } = createComponent(lobby(), slot(6));

    expect(fixture.nativeElement.querySelectorAll('.pod__plus')).toHaveLength(4);
    // Sin poder apuntarse, el hueco no es un botón.
    expect(fixture.nativeElement.querySelectorAll('.pod--join')).toHaveLength(0);
  });

  it('a quien no está dentro, los huecos le dejan apuntarse', () => {
    const { fixture } = createComponent(lobby(), slot(6), false, true);

    expect(fixture.nativeElement.querySelectorAll('.pod--join')).toHaveLength(4);
  });

  it('apuntarse desde un hueco sube a la vista, que es quien habla con el store', () => {
    const { fixture, component } = createComponent(lobby(), slot(6), false, true);

    let pedido = 0;
    component.join.subscribe(() => pedido++);
    fixture.nativeElement.querySelector('.pod--join').click();

    expect(pedido).toBe(1);
  });
});
