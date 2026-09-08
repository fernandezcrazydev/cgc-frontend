import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { AvailabilityChange, ConvocatoriaModalComponent } from './convocatoria-modal.component';
import {
  LobbyParticipantResponse,
  LobbyResponse,
  LobbySlotResponse,
} from '../../../../core/lobbies';

const ME = 'user-edu';

function participant(id: string, isAdded = false): LobbyParticipantResponse {
  return {
    userId: id,
    discordUsername: `jugador-${id}`,
    avatarUrl: null,
    joinedAt: '2026-09-08T18:00:00Z',
    isAdded,
  };
}

function slot(
  id: string,
  hour: number,
  starters: string[] = [],
  bench: string[] = [],
): LobbySlotResponse {
  return {
    id,
    startsAt: `2026-09-08T${String(hour).padStart(2, '0')}:00:00Z`,
    signedUp: starters.length + bench.length,
    starters: starters.map((u) => participant(u)),
    bench: bench.map((u) => participant(u)),
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
    modality: 'BALANCED',
    distribution: 'ROOMS',
    note: null,
    openedBy: participant('u1'),
    confirmedSlotId: 's1',
    createdAt: '2026-09-01T18:00:00Z',
    slots: [slot('s1', 22, ['u1', 'u2', 'u3'])],
    ...overrides,
  };
}

function createComponent(lb: LobbyResponse, myUserId: string | null = ME) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(ConvocatoriaModalComponent);
  fixture.componentRef.setInput('lobby', lb);
  fixture.componentRef.setInput('myUserId', myUserId);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('ConvocatoriaModalComponent', () => {
  it('muestra las insignias de modalidad y formato (Room vs Party)', () => {
    const { fixture } = createComponent(
      lobby({ modality: 'COMPETITIVE', distribution: 'ROOMS' }),
    );
    expect(fixture.nativeElement.querySelector('.cv__badge--modality').textContent).toContain(
      'Competitivo',
    );
    expect(fixture.nativeElement.querySelector('.cv__badge--rooms').textContent.trim()).toBe(
      'Room',
    );
    expect(fixture.nativeElement.querySelector('.cv__badge--rooms svg')).toBeNull();
  });

  it('en formato Party muestra la insignia de Party sin icono', () => {
    const { fixture } = createComponent(
      lobby({ modality: 'CHAOS', distribution: 'PARTY' }),
    );
    expect(fixture.nativeElement.querySelector('.cv__badge--modality').textContent).toContain(
      'Caos',
    );
    expect(fixture.nativeElement.querySelector('.cv__badge--party').textContent.trim()).toBe(
      'Party',
    );
    expect(fixture.nativeElement.querySelector('.cv__badge--party svg')).toBeNull();
  });

  it('en hora confirmada con Rooms enseña quién está apuntado y estado de titular', () => {
    const s1 = slot('s1', 22, ['u1', ME, 'u3']);
    const { fixture, component } = createComponent(
      lobby({ status: 'CONFIRMED', slots: [s1] }),
    );

    expect(fixture.nativeElement.querySelectorAll('.cv-pod-card')).toHaveLength(10); // 3 inscritos + 7 libres
    expect(fixture.nativeElement.querySelector('.cv-status-badge--in').textContent).toContain(
      'titular',
    );

    let withdrawCalled = '';
    component.withdraw.subscribe((id) => (withdrawCalled = id));
    fixture.nativeElement.querySelector('.cv-confirmed__actions button').click();
    expect(withdrawCalled).toBe('s1');
  });

  it('en hora confirmada con Party enseña el número de gente apuntada y estado de confirmación', () => {
    const s1 = slot('s1', 22, Array.from({ length: 12 }, (_, i) => `u${i + 1}`));
    const { fixture } = createComponent(
      lobby({ status: 'CONFIRMED', distribution: 'PARTY', slots: [s1] }),
    );

    expect(fixture.nativeElement.querySelector('.cv-party-count-val').textContent).toContain('12');
    expect(fixture.nativeElement.querySelector('.cv-party-status-tag').textContent).toContain(
      'Party confirmada',
    );
  });

  it('en hora propuesta (POLLING) muestra cada hora por separado con barra de 0 a 10', () => {
    const s1 = slot('s1', 19, ['u1', 'u2', 'u3']);
    const s2 = slot('s2', 21, ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']);
    const { fixture, component } = createComponent(
      lobby({ status: 'POLLING', confirmedSlotId: null, slots: [s1, s2] }),
    );

    const rows = fixture.nativeElement.querySelectorAll('.cv-slot-btn');
    expect(rows).toHaveLength(2);

    expect(fixture.nativeElement.querySelector('.cv-slot-count').textContent).toContain('3/10');

    let applied: AvailabilityChange | null = null;
    component.saveAvailability.subscribe((c) => (applied = c));

    // Toggle para apuntarse a s1
    rows[0].click();
    fixture.detectChanges();

    expect(component['dirty']()).toBe(true);
    fixture.nativeElement.querySelector('.cv-polling__foot button').click();
    expect(applied!.join).toEqual(['s1']);
  });

  /**
   * La descripcion solo se veia en la pantalla completa de Convocatoria. Desde el
   * 2026-09-07 se lee tambien aqui, que es donde llega quien pulsa una tarjeta del Tablon.
   */
  it('pinta entera la descripcion de quien convoco', () => {
    const texto = 'Scrims contra los del curro.\nVenid con ganas y con el micro puesto.';
    const { fixture } = createComponent(lobby({ note: texto }));

    expect(fixture.nativeElement.querySelector('.cv__note').textContent).toContain(
      'con el micro puesto',
    );
  });

  it('sin descripcion no deja un hueco vacio en la cabecera', () => {
    const { fixture } = createComponent(lobby({ note: null }));

    expect(fixture.nativeElement.querySelector('.cv__note')).toBeNull();
  });
});
