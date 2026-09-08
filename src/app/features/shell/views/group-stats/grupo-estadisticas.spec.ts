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

  it('ofrece las tres modalidades y desactiva las no jugadas', () => {
    const { component, fixture } = createComponent(unaTemporada);

    const mods = component.modalityOptions();
    expect(mods.map((m) => m.value)).toEqual(['COMPETITIVE', 'BALANCED', 'CHAOS']);
    expect(fixture.nativeElement.querySelector('.gs-controls__modality')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.gs-controls__season')).not.toBeNull();

    const controls = fixture.nativeElement.querySelector('.gs-controls');
    expect(controls.firstElementChild.classList.contains('gs-controls__season')).toBe(true);
    expect(controls.lastElementChild.classList.contains('gs-controls__modality')).toBe(true);
  });

  it('el selector de temporadas incluye "all" por defecto y solo temporadas jugadas', () => {
    const { component } = createComponent(unaTemporada);

    expect(component.seasonId()).toBe('all');
    expect(component.scope()).toBe('historico');

    const seasons = component.seasonOptions();
    expect(seasons[0]).toEqual({ value: 'all', label: 'Todas' });
    expect(seasons.length).toBeGreaterThan(1);
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
    expect(component.telemetry()?.objectives).toHaveLength(5);
    expect(component.metagame()).toHaveLength(4);
    expect(component.records()).toHaveLength(9);
  });

  it('renderiza la fila de telemetría con la tarjeta de mapa y el radar de objetivos', () => {
    const { fixture } = createComponent(unaTemporada);

    const row = fixture.nativeElement.querySelector('.gs-telemetry-row');
    expect(row).not.toBeNull();
    expect(row.querySelector('app-stats-map-telemetry')).not.toBeNull();
    expect(row.querySelector('app-stats-radar')).not.toBeNull();
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

  it('el metagame incluye los cuatro tableros (picks, bans, mayor winrate y menor winrate)', () => {
    const { component } = createComponent(unaTemporada);
    const boards = component.metagame();
    expect(boards.map((b) => b.id)).toEqual(['picks', 'bans', 'winrate', 'worst-winrate']);
  });

  it('muestra las secciones de impacto de líneas, masacres y guerra de visión del grupo', () => {
    const { fixture, component } = createComponent(unaTemporada);

    const insightsRow = fixture.nativeElement.querySelector('.gs-insights-row');
    expect(insightsRow).not.toBeNull();
    expect(insightsRow.querySelector('app-stats-lane-impact')).not.toBeNull();
    expect(insightsRow.querySelector('app-stats-multikills')).not.toBeNull();
    expect(insightsRow.querySelector('app-stats-vision')).not.toBeNull();

    const lanes = component.laneImpact();
    expect(lanes).toHaveLength(5);
    // Orden estricto descendente por impacto/winrate
    for (let i = 0; i < lanes.length - 1; i++) {
      expect(lanes[i].winrate).toBeGreaterThanOrEqual(lanes[i + 1].winrate);
      expect(lanes[i].impactOrder).toBe(i + 1);
    }

    const mk = component.multikills();
    expect(mk).not.toBeNull();
    expect(mk?.pentas).toBeGreaterThanOrEqual(0);
    expect(mk?.quadras).toBeGreaterThanOrEqual(0);
    expect(mk?.triples).toBeGreaterThanOrEqual(0);

    const vision = component.vision();
    expect(vision).not.toBeNull();
    expect(vision?.wardsPlaced).toBeGreaterThan(0);
    expect(vision?.wardsCleared).toBeGreaterThan(0);
    expect(vision?.visionPerMin).toBeGreaterThan(0);
  });
});
