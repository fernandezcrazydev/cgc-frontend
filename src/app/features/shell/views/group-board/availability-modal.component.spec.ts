import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AvailabilityChange, AvailabilityModalComponent } from './availability-modal.component';
import {
  LobbyParticipantResponse,
  LobbyResponse,
  LobbySlotResponse,
} from '../../../../core/lobbies';

const ME = 'user-edu';

function participant(id: string): LobbyParticipantResponse {
  return { userId: id, discordUsername: id, avatarUrl: null, joinedAt: '2026-09-08T18:00:00Z' };
}

function slot(id: string, hour: number, starters: string[] = [], bench: string[] = []): LobbySlotResponse {
  return {
    id,
    startsAt: `2026-09-08T${String(hour).padStart(2, '0')}:00:00Z`,
    signedUp: starters.length + bench.length,
    starters: starters.map(participant),
    bench: bench.map(participant),
  };
}

function lobby(slots: LobbySlotResponse[], confirmedSlotId: string | null = null): LobbyResponse {
  return {
    id: 'lb1',
    groupId: 'g1',
    code: 'HORA',
    mode: 'OPEN',
    status: confirmedSlotId ? 'CONFIRMED' : 'POLLING',
    capacity: 10,
    note: null,
    openedBy: participant('u1'),
    confirmedSlotId,
    createdAt: '2026-09-01T18:00:00Z',
    slots,
  };
}

function createComponent(lb: LobbyResponse, myUserId: string | null = ME) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AvailabilityModalComponent);
  fixture.componentRef.setInput('lobby', lb);
  fixture.componentRef.setInput('myUserId', myUserId);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('AvailabilityModalComponent', () => {
  it('ordena las horas y las pinta todas', () => {
    const lb = lobby([slot('s3', 22), slot('s1', 19), slot('s2', 21)]);
    const { fixture, component } = createComponent(lb);

    expect(component['rows']().map((r) => r.slot.id)).toEqual(['s1', 's2', 's3']);
    expect(fixture.nativeElement.querySelectorAll('.av-slot')).toHaveLength(3);
  });

  it('arranca con lo que ya dice el servidor marcado', () => {
    const lb = lobby([slot('s1', 19, [ME]), slot('s2', 21), slot('s3', 22, [], [ME])]);
    const { component } = createComponent(lb);

    // Estar en el banquillo también cuenta: dijiste que podías a esa hora.
    expect([...component['picked']()].sort()).toEqual(['s1', 's3']);
    expect(component['dirty']()).toBe(false);
  });

  it('se pueden marcar varias horas a la vez: dos de tres', () => {
    const lb = lobby([slot('s1', 19), slot('s2', 21), slot('s3', 22)]);
    const { component } = createComponent(lb);

    component['toggle']('s1');
    component['toggle']('s3');

    expect([...component['picked']()].sort()).toEqual(['s1', 's3']);
    expect(component['summary']()).toBe('Puedes a 2 horas');
  });

  it('manda el cambio como diferencia, no como la lista entera', () => {
    const lb = lobby([slot('s1', 19, [ME]), slot('s2', 21), slot('s3', 22)]);
    const { component } = createComponent(lb);

    let cambio: AvailabilityChange | null = null;
    component.apply$.subscribe((c) => (cambio = c));

    component['toggle']('s1'); // me borro de la que estaba
    component['toggle']('s2'); // y me apunto a otra
    component['apply']();

    expect(cambio!.join).toEqual(['s2']);
    expect(cambio!.leave).toEqual(['s1']);
  });

  it('sin cambios no deja guardar', () => {
    const lb = lobby([slot('s1', 19, [ME])]);
    const { fixture, component } = createComponent(lb);

    expect(component['dirty']()).toBe(false);
    const boton: HTMLButtonElement = fixture.nativeElement.querySelector('.av__foot button');
    expect(boton.disabled).toBe(true);
  });

  it('avisa de que una hora ya está confirmada', () => {
    const lb = lobby([slot('s1', 19, [ME]), slot('s2', 21)], 's1');
    const { fixture } = createComponent(lb);

    expect(fixture.nativeElement.querySelector('.av-slot__tag--confirmed').textContent).toContain(
      'confirmada',
    );
  });

  it('avisa de que en una hora llena se entra de suplente', () => {
    const llena = Array.from({ length: 10 }, (_, i) => `u${i}`);
    const lb = lobby([slot('s1', 19, llena), slot('s2', 21)]);
    const { fixture } = createComponent(lb);

    const etiquetas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.av-slot__tag'),
    );
    expect(etiquetas.some((e) => e.textContent?.includes('suplente'))).toBe(true);
  });

  it('sin identidad no marca nada, en vez de adivinar', () => {
    const lb = lobby([slot('s1', 19, [ME])]);
    const { component } = createComponent(lb, null);

    expect(component['picked']()).toEqual([]);
  });

  // ── La barra enseña cómo quedaría, no cómo está ───────────────────

  it('marcar una hora con sitio adelanta la barra una plaza', () => {
    const lb = lobby([slot('s1', 19, ['u1', 'u2'])]);
    const { component } = createComponent(lb);

    const fila = component['rows']()[0];
    expect(component['projected'](fila)).toBe(2);

    component['toggle']('s1');
    expect(component['projected'](fila)).toBe(3);
  });

  it('desmarcar una hora en la que eras titular la retrocede', () => {
    const lb = lobby([slot('s1', 19, ['u1', ME])]);
    const { component } = createComponent(lb);

    const fila = component['rows']()[0];
    expect(component['projected'](fila)).toBe(2);

    component['toggle']('s1');
    expect(component['projected'](fila)).toBe(1);
  });

  it('marcar una hora LLENA no mueve la barra: entrarías de suplente', () => {
    const llena = Array.from({ length: 10 }, (_, i) => `u${i}`);
    const lb = lobby([slot('s1', 19, llena)]);
    const { component } = createComponent(lb);

    const fila = component['rows']()[0];
    component['toggle']('s1');

    // Prometer una plaza número once sería mentir sobre lo que va a pasar.
    expect(component['projected'](fila)).toBe(10);
  });

  it('desmarcar una hora en la que estabas en el banquillo tampoco la mueve', () => {
    const llena = Array.from({ length: 10 }, (_, i) => `u${i}`);
    const lb = lobby([slot('s1', 19, llena, [ME])]);
    const { component } = createComponent(lb);

    const fila = component['rows']()[0];
    component['toggle']('s1');

    // Tu sitio no era ninguna de las diez plazas, así que no se libera ninguna.
    expect(component['projected'](fila)).toBe(10);
  });

  it('la barra se pinta con la proyección, para que cifra y barra no se contradigan', () => {
    const lb = lobby([slot('s1', 19, ['u1', 'u2'])]);
    const { fixture, component } = createComponent(lb);

    component['toggle']('s1');
    fixture.detectChanges();

    const relleno: HTMLElement = fixture.nativeElement.querySelector('.av-slot__bar-fill');
    expect(relleno.style.width).toBe('30%');
    expect(fixture.nativeElement.querySelector('.av-slot__count').textContent).toContain('3/10');
  });
});
