import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Reparto } from './reparto';
import { GroupsStore } from '../../../../core/groups';
import {
  BalanceExplanationResponse,
  BalanceExplanationStatus,
  BalanceExplanationStore,
  LobbyDetailStatus,
  LobbyDetailStore,
  LobbyParticipantResponse,
  LobbyResponse,
  LobbySlotResponse,
} from '../../../../core/lobbies';

const GROUP_ID = 'g1';
const SALA_ID = 'lb1';

function participant(userId: string, name: string): LobbyParticipantResponse {
  return { userId, discordUsername: name, avatarUrl: null, joinedAt: '2026-09-05T20:00:00Z' };
}

const PEOPLE = [
  participant('a1', 'ana'),
  participant('a2', 'bruno'),
  participant('a3', 'carla'),
  participant('a4', 'dario'),
  participant('a5', 'elena'),
  participant('b1', 'fran'),
  participant('b2', 'gema'),
  participant('b3', 'hugo'),
  participant('b4', 'iria'),
  participant('b5', 'jon'),
];

function slot(): LobbySlotResponse {
  return {
    id: 's1',
    startsAt: '2026-09-05T22:00:00Z',
    signedUp: PEOPLE.length,
    starters: PEOPLE,
    bench: [],
  };
}

function lobby(): LobbyResponse {
  return {
    id: SALA_ID,
    groupId: GROUP_ID,
    code: 'WX4K',
    mode: 'OPEN',
    status: 'CONFIRMED',
    capacity: 10,
    note: null,
    openedBy: PEOPLE[0],
    confirmedSlotId: 's1',
    createdAt: '2026-09-01T18:00:00Z',
    slots: [slot()],
  };
}

function explanation(
  overrides: Partial<BalanceExplanationResponse> = {},
): BalanceExplanationResponse {
  return {
    matchups: [
      { lane: 'TOP', playerA: 'a1', playerB: 'b1', effectiveA: 1200, effectiveB: 1190, difference: 10 },
      { lane: 'JUNGLA', playerA: 'a2', playerB: 'b2', effectiveA: 1100, effectiveB: 1130, difference: 30 },
      { lane: 'MID', playerA: 'a3', playerB: 'b3', effectiveA: 1250, effectiveB: 1240, difference: 10 },
      { lane: 'ADC', playerA: 'a4', playerB: 'b4', effectiveA: 1000, effectiveB: 1010, difference: 10 },
      { lane: 'SUPPORT', playerA: 'a5', playerB: 'b5', effectiveA: 980, effectiveB: 990, difference: 10 },
    ],
    autofills: [{ userId: 'b2', lane: 'JUNGLA' }],
    globalDifference: 7,
    laneDifferenceSum: 70,
    worstLaneDifference: 30,
    staleness: 1.5,
    weightedCost: 340,
    laneCeilingExceeded: false,
    uncertainty: 400,
    provisional: false,
    ratedPlayers: 8,
    poolSize: 10,
    nearTies: 12,
    searchTruncated: false,
    repetition: 0.2,
    familiarity: 0.44,
    blueTeam: 'A',
    ...overrides,
  };
}

class BalanceStub {
  readonly _status = signal<BalanceExplanationStatus>('ready');
  readonly _explanation = signal<BalanceExplanationResponse | null>(explanation());
  readonly status = this._status.asReadonly();
  readonly explanation = this._explanation.asReadonly();
  load = vi.fn().mockResolvedValue(undefined);
  clear = vi.fn();
}

class DetailStub {
  readonly _status = signal<LobbyDetailStatus>('ready');
  readonly _lobby = signal<LobbyResponse | null>(lobby());
  readonly status = this._status.asReadonly();
  readonly lobby = this._lobby.asReadonly();
  readonly confirmedSlot = signal<LobbySlotResponse | null>(slot()).asReadonly();
  load = vi.fn().mockResolvedValue(undefined);
  clear = vi.fn();
}

class GroupsStub {
  select = vi.fn();
}

function createComponent() {
  const balance = new BalanceStub();
  const detail = new DetailStub();
  const params = new BehaviorSubject(convertToParamMap({ id: GROUP_ID, salaId: SALA_ID }));

  TestBed.configureTestingModule({
    imports: [Reparto],
    providers: [
      provideRouter([]),
      { provide: BalanceExplanationStore, useValue: balance },
      { provide: LobbyDetailStore, useValue: detail },
      { provide: GroupsStore, useValue: new GroupsStub() },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: params.asObservable(),
          snapshot: { paramMap: convertToParamMap({ id: GROUP_ID, salaId: SALA_ID }) },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(Reparto);
  fixture.detectChanges();
  return { fixture, balance, detail, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
}

describe('Reparto', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('pide la explicación y la convocatoria de la sala de la ruta', () => {
    const { balance, detail } = createComponent();

    expect(balance.load).toHaveBeenCalledWith(SALA_ID);
    expect(detail.load).toHaveBeenCalledWith(SALA_ID);
  });

  /** Regla (a) del contrato: la cifra sola, con una suposición dentro, miente. */
  it('nunca pinta la diferencia global sin su margen de error', () => {
    const { text } = createComponent();

    expect(text()).toContain('7');
    expect(text()).toContain('± 400');
  });

  it('avisa de que fue una moneda al aire cuando el margen se come la diferencia', () => {
    const { fixture, balance, text } = createComponent();

    balance._explanation.set(explanation({ globalDifference: 700, uncertainty: 40 }));
    fixture.detectChanges();
    expect(text()).not.toContain('moneda al aire');

    // `ratedPlayers = 0` deja la barra de error en ~1107 a propósito: eso es justo lo que hay
    // que enseñar, no lo que hay que esconder.
    balance._explanation.set(explanation({ globalDifference: 7, uncertainty: 1107 }));
    fixture.detectChanges();

    expect(text()).toContain('moneda al aire');
  });

  /** Regla (b): `provisional` va arriba y bien visible, con «N de 10». */
  it('el aviso de provisional dice a cuántos conocía de verdad', () => {
    const { fixture, balance, text } = createComponent();

    expect(text()).not.toContain('Reparto provisional');

    balance._explanation.set(explanation({ provisional: true, ratedPlayers: 2 }));
    fixture.detectChanges();

    expect(text()).toContain('Reparto provisional');
    expect(text()).toContain('2 de 10');
  });

  /** Regla (c): sin los desempates la explicación se queda en «uno de los N más baratos». */
  it('pinta los dos desempates y cuántos repartos empataban', () => {
    const { text } = createComponent();

    expect(text()).toContain('Repetición · desempate 1');
    expect(text()).toContain('Familiaridad · desempate 2');
    expect(text()).toContain('El azar puro ronda 0,56');
    expect(text()).toContain('12');
  });

  it('lee la familiaridad contra el suelo del azar, no en crudo', () => {
    const { fixture, balance, text } = createComponent();

    expect(text()).toContain('Duelos más frescos de lo normal');

    balance._explanation.set(explanation({ familiarity: 0.7 }));
    fixture.detectChanges();

    expect(text()).toContain('Duelos más repetidos de lo normal');
  });

  it('resuelve los ids a nombres de la convocatoria y marca el autofill', () => {
    const { fixture, text } = createComponent();
    const component = fixture.componentInstance;

    expect(text()).toContain('ana');
    expect(text()).toContain('gema');
    expect(text()).toContain('autofill');
    expect(component.duels()[1].red.autofill).toBe(true);
    expect(component.duels()[1].blue.autofill).toBe(false);
  });

  /** Sin aplicar `blueTeam`, la pantalla que explica el reparto enseñaría los bandos al revés. */
  it('blueTeam decide qué equipo va en el lado azul', () => {
    const { fixture, balance } = createComponent();
    const component = fixture.componentInstance;

    expect(component.duels()[0].blue.userId).toBe('a1');

    balance._explanation.set(explanation({ blueTeam: 'B' }));
    fixture.detectChanges();

    expect(component.duels()[0].blue.userId).toBe('b1');
    expect(component.duels()[0].red.userId).toBe('a1');
  });

  it('sin explicación guardada enseña el texto del catálogo, no un error', () => {
    const { fixture, balance, text } = createComponent();

    balance._status.set('not-recorded');
    balance._explanation.set(null);
    fixture.detectChanges();

    expect(text()).toContain('Sin explicación guardada');
    expect(text()).toContain('no tiene guardado el porqué del reparto');
    expect(text()).not.toContain('Reintentar');
  });

  it('un 403 explica que el monitoreo es de administradores', () => {
    const { fixture, balance, text } = createComponent();

    balance._status.set('forbidden');
    balance._explanation.set(null);
    fixture.detectChanges();

    expect(text()).toContain('Solo para administradores');
  });

  it('mientras carga cualquiera de las dos peticiones no se pinta ninguna cifra', () => {
    const { fixture, detail, text } = createComponent();

    detail._status.set('loading');
    fixture.detectChanges();

    expect(text()).not.toContain('± 400');
  });

  it('un error de red deja reintentar las dos peticiones', () => {
    const { fixture, balance, detail, text } = createComponent();

    balance._status.set('error');
    balance._explanation.set(null);
    fixture.detectChanges();
    expect(text()).toContain('Reintentar');

    balance.load.mockClear();
    detail.load.mockClear();
    fixture.componentInstance.retry();

    expect(balance.load).toHaveBeenCalledWith(SALA_ID);
    expect(detail.load).toHaveBeenCalledWith(SALA_ID);
  });
});
