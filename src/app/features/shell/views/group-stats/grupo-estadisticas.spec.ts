import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { GrupoEstadisticas } from './grupo-estadisticas';
import { Session } from '../../../../core/auth';
import { GameDataStore } from '../../../../core/game-data';
import { GroupStore } from '../../../../core/group-store';
import { GroupBridge, GroupsStore } from '../../../../core/groups';
import { GroupStats, GroupStatsStore, StatsScope } from '../../../../core/group-stats';
import { groupStats } from './stats-fixture';

const ME = 'u-1';
const GROUP = 'grp-3';

const SCOPES: StatsScope[] = [
  {
    preset: 'BALANCED',
    matches: 10,
    seasons: [
      { id: 'liga-1', name: 'Temporada 1', status: 'FINISHED', matches: 6 },
      { id: 'liga-2', name: 'Temporada 2', status: 'IN_PROGRESS', matches: 4 },
      // Existe, está abierta y nadie la ha jugado: llega igual y el combo no la ofrece.
      { id: 'liga-3', name: 'Temporada 3', status: 'NOT_STARTED', matches: 0 },
    ],
  },
  { preset: 'PRECISION', matches: 4, seasons: [] },
  { preset: 'CHAOS', matches: 0, seasons: [] },
];

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

interface Options {
  query?: Record<string, string>;
  scopes?: StatsScope[];
  stats?: GroupStats | null;
  status?: string;
  scopesStatus?: string;
}

function createComponent(options: Options = {}) {
  const { route, setQuery } = routeStub(GROUP, options.query ?? {});
  const navigate = vi.fn().mockResolvedValue(true);
  const ensure = vi.fn().mockResolvedValue(undefined);

  const store = {
    scopes: () => options.scopes ?? SCOPES,
    scopesStatus: () => options.scopesStatus ?? 'ready',
    status: () => options.status ?? 'ready',
    stats: () => (options.stats === undefined ? groupStats() : options.stats),
    ensureScopes: vi.fn().mockResolvedValue(undefined),
    ensure,
    reload: vi.fn().mockResolvedValue(undefined),
    reloadScopes: vi.fn().mockResolvedValue(undefined),
  };

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
        useValue: { byId: (id: string) => ({ id, name: 'Customs Tryhard' }), rosterOf: () => [] },
      },
      { provide: GroupsStore, useValue: { byId: () => null, ensureLoaded: () => undefined } },
      { provide: GroupStatsStore, useValue: store },
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
  return { fixture, component: fixture.componentInstance, navigate, setQuery, store };
}

describe('GrupoEstadisticas', () => {
  /**
   * Las tres salen siempre. Un control que apareciera y desapareciera según lo que el grupo fuera
   * jugando cambiaría de forma bajo el cursor; deshabilitada dice además algo — «esto no lo habéis
   * jugado nunca».
   */
  it('ofrece las tres modalidades y desactiva las no jugadas', () => {
    const { component, fixture } = createComponent();

    const mods = component.presetOptions();
    expect(mods.map((m) => m.value)).toEqual(['BALANCED', 'PRECISION', 'CHAOS']);
    expect(mods.find((m) => m.value === 'CHAOS')?.disabled).toBe(true);
    expect(mods.find((m) => m.value === 'BALANCED')?.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('.gs-controls__modality')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.gs-controls__season')).not.toBeNull();
  });

  /** La que más ha jugado el grupo, no la primera de la lista: es la que tendrá algo que enseñar. */
  it('abre en la modalidad que más ha jugado el grupo', () => {
    const { component } = createComponent();

    expect(component.scope()?.preset).toBe('BALANCED');
    expect(component.scope()?.leagueId).toBeNull();
  });

  it('el selector de temporadas incluye "Todas" y solo las que tienen partidas', () => {
    const { component } = createComponent();

    expect(component.seasonValue()).toBe('all');
    const seasons = component.seasonOptions();
    expect(seasons[0]).toEqual({ value: 'all', label: 'Todas' });
    expect(seasons.map((s) => s.label)).toEqual(['Todas', 'Temporada 1', 'Temporada 2']);
  });

  /**
   * El alcance vive en la URL porque es lo que decide TODAS las cifras de la pantalla: mandar el
   * enlace de «mira el caos de esta temporada» y que el otro abra otro alcance es la clase de cosa
   * que nadie nota hasta que discute con dos capturas distintas.
   */
  it('la modalidad de la URL manda sobre la de por defecto', () => {
    const { component } = createComponent({ query: { liga: 'competitivo' } });

    expect(component.scope()?.preset).toBe('PRECISION');
  });

  it('una temporada de la URL se respeta si existe en esa modalidad', () => {
    const { component } = createComponent({ query: { temporada: 'liga-2' } });

    expect(component.scope()?.leagueId).toBe('liga-2');
  });

  /**
   * Y una que NO es de esa modalidad no se arrastra: desde la V48 son temporadas independientes, y
   * un id que no existe en la modalidad activa dejaría el panel vacío sin que nada dijera por qué.
   */
  it('una temporada que no es de esa modalidad se ignora en vez de vaciar el panel', () => {
    const { component } = createComponent({ query: { liga: 'competitivo', temporada: 'liga-2' } });

    expect(component.scope()?.preset).toBe('PRECISION');
    expect(component.scope()?.leagueId).toBeNull();
  });

  it('cambiar de modalidad suelta la temporada, que es de la otra', () => {
    const { component, navigate } = createComponent({ query: { temporada: 'liga-2' } });

    component.setPreset('CHAOS');

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { liga: 'caos', temporada: null } }),
    );
  });

  /** Sin alcances todavía no se pide nada: adivinar una modalidad es enseñar un panel que no es. */
  it('no pide estadísticas hasta saber qué ha jugado el grupo', () => {
    const { store } = createComponent({ scopes: [], scopesStatus: 'loading' });

    expect(store.ensure).not.toHaveBeenCalled();
  });

  it('con los alcances cargados pide el activo', () => {
    const { store } = createComponent();

    expect(store.ensure).toHaveBeenCalledWith(GROUP, { preset: 'BALANCED', leagueId: null });
  });

  it('arranca en rendimiento competitivo', () => {
    const { component } = createComponent();

    expect(component.tab()).toBe('rendimiento');
    expect(component.openBoard()).toBeNull();
  });

  it('llegar con una medalla en la URL abre el Hall of Fame con esa medalla', () => {
    const { component } = createComponent({ query: { medalla: 'demolisher' } });

    expect(component.tab()).toBe('medallas');
    expect(component.openBoard()?.medal.id).toBe('demolisher');
  });

  /**
   * Incluida `thief`, que existió y se retiró del catálogo al no publicar el cliente de LoL los
   * objetivos robados. Un enlace viejo con ese id no abre nada, que es lo que tiene que pasar.
   */
  it('una medalla que no existe no rompe la pantalla', () => {
    const { component } = createComponent({ query: { medalla: 'thief' } });

    expect(component.openBoard()).toBeNull();
  });

  it('cerrar el modal borra el parámetro sin apilar historial', () => {
    const { component, navigate } = createComponent({ query: { medalla: 'demolisher' } });

    component.closeMedal();

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { medalla: null }, replaceUrl: true }),
    );
  });

  it('salir a mano de la pestaña de medallas suelta la medalla abierta', () => {
    const { component, navigate } = createComponent({ query: { medalla: 'demolisher' } });

    component.setTab('rendimiento');

    expect(component.tab()).toBe('rendimiento');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { medalla: null } }),
    );
  });

  /**
   * El usuario se reconoce por `userId` y **no cruzando el censo del grupo**: las filas ya vienen
   * identificadas, y quien se fue del grupo sigue teniendo su récord en la temporada.
   */
  it('reconoce al usuario por su id para poder decirle su puesto', () => {
    const { component } = createComponent();

    const conPuesto = component.medals().filter((b) => b.me !== null);
    expect(conPuesto.length).toBeGreaterThan(0);
    expect(conPuesto[0].me?.person.userId).toBe(ME);
  });

  it('todos los bloques salen del mismo agregado', () => {
    const { component } = createComponent();

    expect(component.players()).toHaveLength(5);
    expect(component.telemetry()?.objectives).toHaveLength(5);
    expect(component.metagame()).toHaveLength(4);
    expect(component.records()).toHaveLength(2);
    expect(component.laneImpact()).toHaveLength(5);
  });

  /** El récord vuelve a enlazar a una partida, porque ahora apunta a una que existe. */
  it('cada récord trae la partida en la que ocurrió', () => {
    const { component } = createComponent();

    for (const record of component.records()) {
      expect(record.matchId).toBeTruthy();
    }
  });

  it('desplegar un jugador viaja en la URL por su id, no por su tag', () => {
    const { component, navigate } = createComponent();

    component.togglePlayer('u-2');

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { jugador: 'u-2' } }),
    );
  });

  it('volver a pulsar al mismo jugador lo cierra', () => {
    const { component, navigate } = createComponent({ query: { jugador: 'u-2' } });

    expect(component.expandedUserId()).toBe('u-2');
    component.togglePlayer('u-2');

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { jugador: null } }),
    );
  });

  it('el metagame incluye los cuatro tableros', () => {
    const { component } = createComponent();

    expect(component.metagame().map((b) => b.id)).toEqual([
      'picks',
      'bans',
      'winrate',
      'worst-winrate',
    ]);
  });

  it('las líneas salen ordenadas por impacto, sin huecos en la numeración', () => {
    const { component } = createComponent();

    const lanes = component.laneImpact();
    for (let i = 0; i < lanes.length - 1; i++) {
      expect(lanes[i].winrate).toBeGreaterThanOrEqual(lanes[i + 1].winrate);
      expect(lanes[i].impactOrder).toBe(i + 1);
    }
  });

  /**
   * Vacío con explicación, no error y no 404: el grupo existe y todavía no ha jugado. Son tres
   * estados distintos y tienen que verse distintos.
   */
  it('un grupo sin una sola partida lo dice, en vez de enseñar once bloques vacíos', () => {
    const { component, fixture } = createComponent({
      scopes: [
        { preset: 'BALANCED', matches: 0, seasons: [] },
        { preset: 'PRECISION', matches: 0, seasons: [] },
        { preset: 'CHAOS', matches: 0, seasons: [] },
      ],
      stats: null,
    });

    expect(component.nothingPlayed()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay partidas que analizar');
    expect(fixture.nativeElement.querySelector('app-stats-leaders')).toBeNull();
  });

  it('un fallo de red se pinta como error con reintento, no como grupo vacío', () => {
    const { fixture } = createComponent({ status: 'error', stats: null });

    expect(fixture.nativeElement.textContent).toContain('No hemos podido cargar las estadísticas');
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });

  it('reintentar vuelve a pedir los alcances y el alcance activo', () => {
    const { component, store } = createComponent({ status: 'error', stats: null });

    component.retry();

    expect(store.reloadScopes).toHaveBeenCalledWith(GROUP);
    expect(store.reload).toHaveBeenCalledWith(GROUP, { preset: 'BALANCED', leagueId: null });
  });
});
