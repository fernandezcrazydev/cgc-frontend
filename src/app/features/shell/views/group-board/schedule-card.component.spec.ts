import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { ScheduleCardComponent, ScheduleStanding } from './schedule-card.component';
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
    slots: [slot(6)],
    ...overrides,
  };
}

function createComponent(
  lb: LobbyResponse,
  s: LobbySlotResponse | null,
  standing: ScheduleStanding = { kind: 'out' },
  acting = false,
) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ScheduleCardComponent);
  fixture.componentRef.setInput('lobby', lb);
  fixture.componentRef.setInput('slot', s);
  fixture.componentRef.setInput('standing', standing);
  fixture.componentRef.setInput('when', 'viernes, 5 de septiembre, 22:00');
  fixture.componentRef.setInput('acting', acting);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('ScheduleCardComponent', () => {
  it('sin ti dentro, el marco se queda neutro y ofrece inscribirse', () => {
    const { fixture } = createComponent(lobby(), slot(6));

    expect(fixture.nativeElement.querySelector('.sc.is-mine')).toBeNull();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Inscribirme');
  });

  it('contigo dentro, el marco se tiñe y ofrece borrarte, sin rotular el puesto', () => {
    const s = slot(6);
    const { fixture } = createComponent(lobby(), s, { kind: 'starter', position: 3, slot: s });

    expect(fixture.nativeElement.querySelector('.sc.is-mine')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Ya no puedo');
    // El puesto no se pinta: el marco y el botón ya dicen que estás dentro.
    expect(fixture.nativeElement.querySelector('.sc__badge')).toBeNull();
  });

  it('al suplente sí se le dice, porque no juega salvo que alguien caiga', () => {
    const s = slot(10, 2);
    const { fixture } = createComponent(lobby(), s, { kind: 'bench', position: 2, slot: s });

    expect(fixture.nativeElement.querySelector('.sc__badge--bench').textContent).toContain(
      'banquillo',
    );
  });

  it('apuntarse sube la franja pulsada, no la convocatoria entera', () => {
    const s = slot(6);
    const { fixture, component } = createComponent(lobby(), s);

    let pedido: string | null = null;
    component.signUp.subscribe((slotId) => (pedido = slotId));
    fixture.nativeElement.querySelector('button').click();

    expect(pedido).toBe('s1');
  });

  it('con la escritura en vuelo el botón se apaga, para que no salgan dos', () => {
    const { fixture } = createComponent(lobby(), slot(6), { kind: 'out' }, true);

    expect(fixture.nativeElement.querySelector('button').disabled).toBe(true);
  });

  it('si aún se recogen horas, abre el modal en vez de fingir un solo botón', () => {
    const lb = lobby({ status: 'POLLING', confirmedSlotId: null });
    const { fixture, component } = createComponent(lb, slot(4));

    let abierto = 0;
    component.openAvailability.subscribe(() => abierto++);

    const boton = fixture.nativeElement.querySelector('button');
    expect(boton.textContent).toContain('Decir cuándo puedo');
    boton.click();
    expect(abierto).toBe(1);
  });

  it('cuenta cuántos suplentes faltan para una segunda custom simultánea', () => {
    const { component } = createComponent(lobby(), slot(10, 4));

    expect(component['benchText']()).toBe('Faltan 6 para una segunda custom');
  });

  it('con suplentes de sobra deja de pedir gente', () => {
    const { component } = createComponent(lobby(), slot(10, 10));

    expect(component['benchText']()).toContain('segunda custom simultánea');
  });
});
