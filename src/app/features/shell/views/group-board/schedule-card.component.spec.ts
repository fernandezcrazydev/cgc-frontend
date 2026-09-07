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
  myUserId: string | null = null,
) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(ScheduleCardComponent);
  fixture.componentRef.setInput('lobby', lb);
  fixture.componentRef.setInput('slot', s);
  fixture.componentRef.setInput('standing', standing);
  fixture.componentRef.setInput('when', 'viernes, 5 de septiembre, 22:00');
  fixture.componentRef.setInput('acting', acting);
  fixture.componentRef.setInput('myUserId', myUserId);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('ScheduleCardComponent', () => {
  it('sin ti dentro, data-state es confirmed-out, badge No inscrito y ofrece inscribirse', () => {
    const { fixture } = createComponent(lobby(), slot(6));

    const card = fixture.nativeElement.querySelector('.sc');
    expect(card.getAttribute('data-state')).toBe('confirmed-out');
    expect(fixture.nativeElement.querySelector('.sc-status-pill--out').textContent).toContain('No inscrito');
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Inscribirme');
  });

  it('como titular, data-state es confirmed-starter, badge Titular y ofrece borrarte', () => {
    const s = slot(6);
    const { fixture } = createComponent(lobby(), s, { kind: 'starter', position: 3, slot: s });

    const card = fixture.nativeElement.querySelector('.sc');
    expect(card.getAttribute('data-state')).toBe('confirmed-starter');
    expect(fixture.nativeElement.querySelector('.sc-status-pill--starter').textContent).toContain('Inscrito (Titular)');
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Ya no puedo');
  });

  it('al suplente se le asigna confirmed-bench y badge En banquillo', () => {
    const s = slot(10, 2);
    const { fixture } = createComponent(lobby(), s, { kind: 'bench', position: 2, slot: s });

    const card = fixture.nativeElement.querySelector('.sc');
    expect(card.getAttribute('data-state')).toBe('confirmed-bench');
    expect(fixture.nativeElement.querySelector('.sc-status-pill--bench').textContent).toContain('En banquillo');
  });

  it('en horas propuestas sin haber votado, asigna polling-unvoted y botón Votar horas', () => {
    const lb = lobby({ status: 'POLLING', confirmedSlotId: null });
    const { fixture, component } = createComponent(lb, slot(4), { kind: 'out' }, false, 'user-edu');

    const card = fixture.nativeElement.querySelector('.sc');
    expect(card.getAttribute('data-state')).toBe('polling-unvoted');
    expect(fixture.nativeElement.querySelector('.sc-status-pill--unvoted').textContent).toContain('Sin votar');

    let abierto = 0;
    component.openAvailability.subscribe(() => abierto++);
    const boton = fixture.nativeElement.querySelector('button');
    expect(boton.textContent).toContain('Votar horas');
    boton.click();
    expect(abierto).toBe(1);
  });

  it('en horas propuestas habiendo votado, asigna polling-voted y botón Modificar', () => {
    const s = slot(4);
    s.starters.push({
      userId: 'user-edu',
      discordUsername: 'Edu',
      avatarUrl: null,
      joinedAt: '2026-09-05T20:00:00Z',
    });
    const lb = lobby({ status: 'POLLING', confirmedSlotId: null, slots: [s] });
    const { fixture } = createComponent(lb, s, { kind: 'out' }, false, 'user-edu');

    const card = fixture.nativeElement.querySelector('.sc');
    expect(card.getAttribute('data-state')).toBe('polling-voted');
    expect(fixture.nativeElement.querySelector('.sc-status-pill--voted').textContent).toContain('Votado (1)');
    expect(fixture.nativeElement.querySelector('button').textContent).toContain('Modificar');
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

  it('en salas contiguas indica badge 2 Salas', () => {
    const s: LobbySlotResponse = {
      id: 's1',
      startsAt: '2026-09-05T22:00:00Z',
      signedUp: 22,
      starters: Array.from({ length: 10 }, (_, i) => participant(i + 1)),
      secondaryStarters: Array.from({ length: 10 }, (_, i) => participant(i + 11)),
      bench: [participant(21), participant(22)],
      roomName: 'Sala 1',
      secondaryRoomName: 'Sala 2',
    };
    const { fixture } = createComponent(lobby({ subType: 'CONTIGUOUS_ROOMS' }), s);

    expect(fixture.nativeElement.querySelector('.sc__badge-rooms-count').textContent).toContain(
      '2 Salas',
    );
  });

  it('en horas propuestas indica la modalidad (icono) y si es Room o Party', () => {
    const lb = lobby({
      status: 'POLLING',
      confirmedSlotId: null,
      modality: 'COMPETITIVE',
      distribution: 'PARTY',
    });
    const { fixture } = createComponent(lb, slot(4), { kind: 'out' }, false, 'user-edu');

    const modBadge: HTMLElement = fixture.nativeElement.querySelector('.sc__badge-modality');
    expect(modBadge.getAttribute('data-mod')).toBe('COMPETITIVE');
    expect(modBadge.getAttribute('title')).toContain('Competitivo');
    expect(modBadge.querySelector('svg')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.sc__badge-party').textContent.trim()).toBe('Party');
    expect(fixture.nativeElement.querySelector('.sc__badge-party svg')).toBeNull();
  });

  it('en horas propuestas modo Room indica Room y la modalidad correspondiente (icono)', () => {
    const lb = lobby({
      status: 'POLLING',
      confirmedSlotId: null,
      modality: 'BALANCED',
      distribution: 'ROOMS',
    });
    const { fixture } = createComponent(lb, slot(4), { kind: 'out' }, false, 'user-edu');

    const modBadge: HTMLElement = fixture.nativeElement.querySelector('.sc__badge-modality');
    expect(modBadge.getAttribute('data-mod')).toBe('BALANCED');
    expect(modBadge.getAttribute('title')).toContain('Equilibrado');
    expect(modBadge.querySelector('svg')).toBeTruthy();
    expect(modBadge.textContent?.trim()).toBe('');
    expect(fixture.nativeElement.querySelector('.sc__badge-room').textContent.trim()).toBe('Room');
    expect(fixture.nativeElement.querySelector('.sc__badge-room svg')).toBeNull();
  });

  it('al hacer clic sobre la tarjeta emite openDetail con el lobby', () => {
    const lb = lobby();
    const { fixture, component } = createComponent(lb, slot(6));

    let detailEmitted: LobbyResponse | null = null;
    component.openDetail.subscribe((l) => (detailEmitted = l));

    fixture.nativeElement.querySelector('.sc').click();
    expect(detailEmitted).toBe(lb);
  });
});
