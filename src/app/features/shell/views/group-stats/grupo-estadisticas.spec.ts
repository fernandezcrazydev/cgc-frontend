import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GrupoEstadisticas } from './grupo-estadisticas';
import { Session } from '../../../../core/auth';
import { GameDataStore } from '../../../../core/game-data';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge, GroupsStore } from '../../../../core/groups';
import { hubSeasonsFor } from '../../../../core/group-hub';
import { Member } from '../../../../core/lobby';

const ME = 'user-edu';

function member(name: string, overrides: Partial<Member> = {}): Member {
  return {
    name,
    tag: `${name}#EUW`,
    initials: name.slice(0, 2),
    role: 'MID',
    owner: false,
    hue: 200,
    ...overrides,
  };
}

const ROSTER = [member('EduUC', { userId: ME }), member('Adri'), member('Victor'), member('DaniG')];

/** Ruta falsa con parámetros vivos, para poder mover `?medalla=` durante la prueba. */
function routeStub(groupId: string, query: Record<string, string> = {}) {
  const queryParams = new BehaviorSubject(convertToParamMap(query));
  return {
    route: {
      paramMap: new BehaviorSubject(convertToParamMap({ id: groupId })),
      queryParamMap: queryParams,
      snapshot: {
        paramMap: convertToParamMap({ id: groupId }),
        queryParamMap: convertToParamMap(query),
      },
    },
    setQuery: (next: Record<string, string>) => queryParams.next(convertToParamMap(next)),
  };
}

function createComponent(groupId: string, query: Record<string, string> = {}) {
  const { route, setQuery } = routeStub(groupId, query);
  const navigate = vi.fn().mockResolvedValue(true);

  TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: { navigate } },
      { provide: Session, useValue: { user: () => ({ userId: ME, displayName: 'EduUC#EUW' }) } },
      {
        provide: GroupBridge,
        useValue: { status: () => 'ready', ensure: () => Promise.resolve() },
      },
      {
        provide: GroupStore,
        useValue: {
          byId: (id: string) => ({ id, name: 'Customs Tryhard' }),
          rosterOf: () => ROSTER,
        },
      },
      { provide: GroupsStore, useValue: { byId: () => null, ensureLoaded: () => undefined } },
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

  const fixture = TestBed.createComponent(GrupoEstadisticas);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, navigate, setQuery };
}

describe('GrupoEstadisticas', () => {
  /** Ids elegidos por lo que produce la semilla, no por su nombre. */
  let unaTemporada: string;
  let variasTemporadas: string;

  beforeEach(() => {
    unaTemporada = 'grp-3';
    variasTemporadas = 'grp-1';
    expect(hubSeasonsFor(unaTemporada)).toHaveLength(1);
    expect(hubSeasonsFor(variasTemporadas).length).toBeGreaterThan(1);
  });

  it('con una sola temporada no ofrece el histórico, que repetiría las mismas cifras', () => {
    const { component, fixture } = createComponent(unaTemporada);

    const alcances = component.scopeOptions().map((o) => o.value);
    expect(alcances).toEqual(['sesion', 'temporada']);
    expect(fixture.nativeElement.querySelector('.gs-controls__season')).toBeNull();
  });

  it('con varias temporadas aparecen el histórico y el selector', () => {
    const { component, fixture } = createComponent(variasTemporadas);

    expect(component.scopeOptions().map((o) => o.value)).toContain('historico');
    expect(fixture.nativeElement.querySelector('.gs-controls__season')).not.toBeNull();
  });

  it('arranca en rendimiento competitivo', () => {
    const { component } = createComponent(unaTemporada);

    expect(component.tab()).toBe('rendimiento');
    expect(component.openBoard()).toBeNull();
  });

  it('llegar con una medalla en la URL abre el Hall of Fame con esa medalla', () => {
    const { component } = createComponent(unaTemporada, { medalla: 'demolisher' });

    expect(component.tab()).toBe('medallas');
    expect(component.openBoard()?.medal.id).toBe('demolisher');
  });

  it('una medalla que no existe no rompe la pantalla', () => {
    const { component } = createComponent(unaTemporada, { medalla: 'no-existe' });

    expect(component.openBoard()).toBeNull();
  });

  it('cerrar el modal borra el parámetro sin apilar historial', () => {
    const { component, navigate } = createComponent(unaTemporada, { medalla: 'demolisher' });

    component.closeMedal();

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { medalla: null }, replaceUrl: true }),
    );
  });

  it('salir a mano de la pestaña de medallas suelta la medalla abierta', () => {
    const { component, navigate } = createComponent(unaTemporada, { medalla: 'demolisher' });

    component.setTab('rendimiento');

    expect(component.tab()).toBe('rendimiento');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { medalla: null } }),
    );
  });

  it('reconoce al usuario dentro del roster para poder decirle su puesto', () => {
    const { component } = createComponent(unaTemporada);

    const conPuesto = component.medals().filter((b) => b.me !== null);
    expect(conPuesto).toHaveLength(component.medals().length);
    expect(component.medals()[0].me?.member.tag).toBe('EduUC#EUW');
  });

  it('los tres bloques de rendimiento salen de la misma pasada de estadísticas', () => {
    const { component } = createComponent(unaTemporada);

    expect(component.players()).toHaveLength(ROSTER.length);
    expect(component.telemetry()?.objectives).toHaveLength(4);
    expect(component.metagame()).toHaveLength(3);
    expect(component.records()).toHaveLength(3);
  });

  it('cada récord enlaza a una partida que existe en el historial', () => {
    const { component } = createComponent(unaTemporada);

    for (const record of component.records()) {
      expect(record.matchId).toMatch(/^seed-\d{3}$/);
    }
  });

  it('desplegar un jugador viaja en la URL, para poder enlazar a alguien', () => {
    const { component, navigate } = createComponent(unaTemporada);

    component.togglePlayer('Adri#EUW');

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { jugador: 'Adri#EUW' } }),
    );
  });

  it('volver a pulsar al mismo jugador lo cierra', () => {
    const { component, navigate } = createComponent(unaTemporada, { jugador: 'Adri#EUW' });

    expect(component.expandedTag()).toBe('Adri#EUW');
    component.togglePlayer('Adri#EUW');

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { jugador: null } }),
    );
  });
});
