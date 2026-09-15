import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { GameDataStore } from '../../../../core/game-data';
import { GroupDetailStore } from '../../../../core/groups';
import { MatchHistoryStore } from '../../../../core/matches';
import { ToastService } from '../../../../core/toast';
import { ReactionsStore } from '../../../../core/reactions';
import { Viewport } from '../../../../shared/viewport';
import {
  bareParticipantFixture,
  fakeMatchHistoryStore,
  matchFixture,
  participantFixture,
  statsFixture,
} from '../../../../core/matches/match-fixtures';
import { Match, TeamObjectives } from '../../../../core/matches/models';
import { MatchDetail, ObjectiveRow, tacticalRadarOf } from './match-detail';

const ME = 'me-uuid';

function partida(over: Partial<Parameters<typeof matchFixture>[0]> = {}): Match {
  const yo = participantFixture({ userId: ME, slot: 'A', riotId: 'Yo#LAN' });
  return matchFixture({
    id: 'm1',
    a: [yo],
    b: [participantFixture({ userId: 'rival', slot: 'B' })],
    userParticipant: yo,
    ...over,
  });
}

async function montar(opciones: {
  detail?: Match | null;
  detailStatus?: 'loading' | 'ready' | 'error';
  notFound?: boolean;
} = {}) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [MatchDetail],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ id: 'm1' })),
          queryParamMap: of(convertToParamMap({})),
          snapshot: {
            paramMap: convertToParamMap({ id: 'm1' }),
            queryParamMap: convertToParamMap({}),
          },
        },
      },
      {
        provide: GameDataStore,
        useValue: {
          status: signal('ready'),
          championById: signal(new Map()),
          ensureLoaded: () => {},
        },
      },
      { provide: GroupDetailStore, useValue: { roster: signal([]) } },
      {
        provide: MatchHistoryStore,
        useValue: fakeMatchHistoryStore({
          detail: opciones.detail ?? null,
          detailStatus: opciones.detailStatus ?? (opciones.detail ? 'ready' : 'loading'),
          detailNotFound: opciones.notFound ?? false,
        }),
      },
      { provide: ToastService, useValue: { info: () => {}, error: () => {} } },
      {
        provide: ReactionsStore,
        useValue: { mostUsed: () => [], tally: () => [], mine: () => null, toggle: () => {}, seed: () => {} },
      },
      { provide: Viewport, useValue: { isMobile: signal(false) } },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(MatchDetail);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
}

/**
 * Los cuatro estados que el proyecto exige distinguir. El 404 tiene pantalla propia porque un
 * fallo de conexión no puede pintarse como una partida inexistente, que era el bug clásico del
 * `@if (dato) … @else { 404 }`.
 */
describe('MatchDetail · los cuatro estados', () => {
  it('mientras viaja el detalle enseña esqueleto, no un 404', async () => {
    const { el } = await montar({ detail: null, detailStatus: 'loading' });

    expect(el.querySelector('nf-skeleton')).not.toBeNull();
    expect(el.textContent).not.toContain('Partida no encontrada');
  });

  it('un 404 del backend dice que la partida no existe', async () => {
    const { el } = await montar({ detail: null, detailStatus: 'error', notFound: true });

    expect(el.textContent).toContain('Partida no encontrada');
    expect(el.textContent).not.toContain('Reintentar');
  });

  it('un fallo de red ofrece reintentar y no habla de partidas inexistentes', async () => {
    const { el } = await montar({ detail: null, detailStatus: 'error', notFound: false });

    expect(el.textContent).toContain('No se pudo cargar la partida');
    expect(el.textContent).toContain('Reintentar');
    expect(el.textContent).not.toContain('Partida no encontrada');
  });

  it('con la partida cargada pinta el marcador', async () => {
    const { el } = await montar({ detail: partida() });

    expect(el.querySelector('app-match-scoreboard')).not.toBeNull();
    expect(el.textContent).not.toContain('Partida no encontrada');
  });
});

describe('MatchDetail · lo que el contrato obliga a no pintar', () => {
  /*
   * Los objetivos son del equipo 100/200: sin saber cuál era azul, colgarlos de A o de B sería
   * inventar. El backend manda `teams` vacío y aquí el bloque entero desaparece.
   */
  it('sin lados decididos no pinta la grieta ni el radar', async () => {
    const { component, el } = await montar({ detail: partida({ sided: false }) });

    expect(component.objectives()).toEqual([]);
    expect(el.querySelector('.c-radar-svg')).toBeNull();
  });

  it('una partida sin subir lo dice, en vez de pintar ceros', async () => {
    const { el } = await montar({ detail: partida({ hasStats: false }) });

    expect(el.textContent).toContain('Nadie subió esta partida');
  });

  /** Una anulada no se pinta como derrota: se apaga entera y se explica. */
  it('una partida anulada se marca como tal', async () => {
    const { el } = await montar({ detail: partida({ voided: true }) });

    expect(el.textContent).toContain('Partida anulada');
  });
});

/**
 * La geometría de la huella táctica. El radio de cada vértice es el REPARTO de ese objetivo
 * entre los dos equipos, no su cifra bruta: las torres se cuentan por ocho y el barón por uno,
 * así que sin normalizar el polígono solo dibujaría cuál es el objetivo más numeroso.
 */
describe('tacticalRadarOf', () => {
  const objetivos: ObjectiveRow[] = [
    { id: 'dragons', name: 'Dragones', icon: '', blueScore: 4, redScore: 1 },
    { id: 'grubs', name: 'Larvas', icon: '', blueScore: 6, redScore: 0 },
    { id: 'herald', name: 'Heraldo', icon: '', blueScore: 1, redScore: 0 },
    { id: 'baron', name: 'Barón', icon: '', blueScore: 1, redScore: 0 },
    { id: 'inhibitors', name: 'Inhibidores', icon: '', blueScore: 2, redScore: 0 },
    { id: 'towers', name: 'Torres', icon: '', blueScore: 8, redScore: 2 },
  ];

  it('tiene un vértice por objetivo y una malla por anillo', () => {
    const radar = tacticalRadarOf(objetivos);

    expect(radar.axes).toHaveLength(6);
    expect(radar.rings).toHaveLength(3);
    expect(radar.bluePoints.split(' ')).toHaveLength(6);
    expect(radar.redPoints.split(' ')).toHaveLength(6);
  });

  it('el radio es el reparto del objetivo, no su cifra bruta', () => {
    const radar = tacticalRadarOf(objetivos);
    // Torres 8-2 y barones 1-0: el barón es un reparto MÁS favorable pese a ser una cifra menor.
    const barones = radar.axes.find((a) => a.id === 'baron')!;
    const torres = radar.axes.find((a) => a.id === 'towers')!;

    const distancia = (x: number, y: number) => Math.hypot(x - 120, y - 118);
    expect(distancia(barones.blueX, barones.blueY)).toBeGreaterThan(
      distancia(torres.blueX, torres.blueY),
    );
  });

  /** Un bando que no se llevó nada no puede caer en el centro: el polígono sería un punto. */
  it('un bando sin nada conserva un radio mínimo', () => {
    const radar = tacticalRadarOf([
      { id: 'x', name: 'X', icon: '', blueScore: 5, redScore: 0 },
      { id: 'y', name: 'Y', icon: '', blueScore: 5, redScore: 0 },
      { id: 'z', name: 'Z', icon: '', blueScore: 5, redScore: 0 },
    ]);

    for (const a of radar.axes) {
      expect(Math.hypot(a.redX - 120, a.redY - 118)).toBeGreaterThan(0);
    }
  });

  it('el número de lados sigue al número de objetivos', () => {
    expect(tacticalRadarOf(objetivos.slice(0, 3)).axes).toHaveLength(3);
    expect(tacticalRadarOf(objetivos.slice(0, 5)).axes).toHaveLength(5);
  });
});

/** Un bloque de objetivos completo, para las pruebas que necesitan lados decididos. */
function objetivosDe(over: Partial<TeamObjectives> = {}): TeamObjectives {
  return {
    bans: [],
    barons: 1,
    dragons: 2,
    heralds: 1,
    voidgrubs: 3,
    towers: 8,
    inhibitors: 1,
    firstBlood: false,
    firstTower: false,
    firstBaron: false,
    firstDragon: false,
    firstInhibitor: false,
    ...over,
  };
}

/** Pega objetivos a los dos equipos de una partida ya construida. */
function conObjetivos(match: Match, a: TeamObjectives, b: TeamObjectives): Match {
  return {
    ...match,
    teams: [
      { ...match.teams[0], objectives: a },
      { ...match.teams[1], objectives: b },
    ] as Match['teams'],
  };
}

/**
 * Las menciones de honor volvieron calculadas sobre los diez asientos reales. Antes eran cuatro
 * nombres escritos a mano que salían idénticos en todas las partidas, así que lo que hay que
 * probar es justo lo contrario: que cada una sale del dato, y que sin dato no sale.
 */
describe('MatchDetail · menciones de honor', () => {
  function conCifras(): Match {
    const crack = participantFixture({
      userId: 'crack',
      slot: 'A',
      riotId: 'Crack#LAN',
      stats: statsFixture({
        damageToChampions: 40000,
        damageTaken: 5000,
        visionScore: 10,
        cs: 300,
        timeCcingOthers: 3,
      }),
    });
    const tanque = participantFixture({
      userId: 'tanque',
      slot: 'B',
      riotId: 'Tanque#LAN',
      stats: statsFixture({
        damageToChampions: 9000,
        damageTaken: 60000,
        visionScore: 80,
        cs: 50,
        timeCcingOthers: 90,
      }),
    });
    return matchFixture({ id: 'm1', a: [crack], b: [tanque], durationSeconds: 1800 });
  }

  it('cada mención nombra a quien de verdad tiene el máximo', async () => {
    const { component } = await montar({ detail: conCifras() });
    const byId = new Map(component.honors().map((h) => [h.id, h]));

    expect(byId.get('damage')?.playerName).toBe('Crack#LAN');
    expect(byId.get('tank')?.playerName).toBe('Tanque#LAN');
    expect(byId.get('vision')?.playerName).toBe('Tanque#LAN');
    expect(byId.get('cc')?.playerName).toBe('Tanque#LAN');
  });

  /** El farm se mide por minuto: en bruto lo gana siempre quien jugó la partida más larga. */
  it('el farm va por minuto, no en bruto', async () => {
    const { component } = await montar({ detail: conCifras() });
    const farm = component.honors().find((h) => h.id === 'farm');

    expect(farm?.playerName).toBe('Crack#LAN');
    expect(farm?.value).toBe('10,0 CS/min');
  });

  /** Sin duración no hay CS/min que calcular: la mención se cae sola en vez de dividir por cero. */
  it('sin duración no hay mención de farm, pero las demás siguen', async () => {
    const detail = matchFixture({
      id: 'm1',
      a: [participantFixture({ userId: 'a', slot: 'A' })],
      b: [participantFixture({ userId: 'b', slot: 'B' })],
      durationSeconds: null,
    });
    const { component } = await montar({ detail });

    expect(component.honors().some((h) => h.id === 'farm')).toBe(false);
    expect(component.honors().some((h) => h.id === 'damage')).toBe(true);
  });

  /** Sin subida no hay ninguna cifra: la franja entera desaparece en vez de enseñar guiones. */
  it('una partida sin estadísticas no tiene menciones', async () => {
    const detail = matchFixture({
      id: 'm1',
      hasStats: false,
      a: [bareParticipantFixture({ userId: 'a', slot: 'A' })],
      b: [bareParticipantFixture({ userId: 'b', slot: 'B' })],
    });
    const { component, el } = await montar({ detail });

    expect(component.honors()).toEqual([]);
    expect(el.querySelector('.md-honors')).toBeNull();
  });
});

describe('MatchDetail · ritmo y economía', () => {
  it('suma las bajas de los dos equipos y da su ritmo por minuto', async () => {
    const { component } = await montar({ detail: partida({ durationSeconds: 1800 }) });
    const kills = component.pace().find((s) => s.id === 'kills');

    // El fixture da 20 bajas por equipo: 40 en media hora son 1,3 por minuto.
    expect(kills?.value).toBe('40');
    expect(kills?.hint).toBe('1,3 por minuto');
  });

  /**
   * La ventaja del minuto 14 se suma de los cinco asientos, y es estricta a propósito: con
   * cuatro `goldAt14` de un lado y cinco del otro la diferencia estaría inventada, y se leería
   * igual que si estuviera medida.
   */
  it('no calcula la ventaja del minuto 14 si a algún asiento le falta el dato', async () => {
    const detail = matchFixture({
      id: 'm1',
      a: [
        participantFixture({ userId: 'a1', slot: 'A', stats: statsFixture({ goldAt14: 5000 }) }),
        participantFixture({ userId: 'a2', slot: 'A', stats: statsFixture({ goldAt14: 5000 }) }),
      ],
      b: [
        participantFixture({ userId: 'b1', slot: 'B', stats: statsFixture({ goldAt14: 4000 }) }),
        participantFixture({ userId: 'b2', slot: 'B', stats: statsFixture() }),
      ],
    });
    const { component } = await montar({ detail });

    expect(component.pace().some((s) => s.id === 'gold14')).toBe(false);
  });

  it('con el dato completo dice cuánta ventaja y de quién', async () => {
    const detail = matchFixture({
      id: 'm1',
      a: [participantFixture({ userId: 'a1', slot: 'A', stats: statsFixture({ goldAt14: 6000 }) })],
      b: [participantFixture({ userId: 'b1', slot: 'B', stats: statsFixture({ goldAt14: 4500 }) })],
    });
    const { component } = await montar({ detail });
    const row = component.pace().find((s) => s.id === 'gold14');

    expect(row?.value).toBe('+1,5k');
    expect(row?.hint).toBe('Para Equipo azul');
  });

  it('sin estadísticas no hay franja de ritmo', async () => {
    const detail = matchFixture({
      id: 'm1',
      hasStats: false,
      durationSeconds: null,
      a: [bareParticipantFixture({ userId: 'a', slot: 'A' })],
      b: [bareParticipantFixture({ userId: 'b', slot: 'B' })],
    });
    const { component } = await montar({ detail });

    expect(component.pace()).toEqual([]);
  });
});

describe('MatchDetail · los primeros objetivos', () => {
  it('cuelga cada primero del equipo que lo reclama', async () => {
    const detail = conObjetivos(
      partida(),
      objetivosDe({ firstBlood: true, firstTower: true }),
      objetivosDe({ firstBaron: true }),
    );
    const { component } = await montar({ detail });
    const byId = new Map(component.firsts().map((f) => [f.id, f]));

    expect(byId.get('blood')?.teamLabel).toBe('Equipo azul');
    expect(byId.get('tower')?.teamLabel).toBe('Equipo azul');
    expect(byId.get('baron')?.teamLabel).toBe('Equipo rojo');
  });

  /** `false` en los dos es «no ocurrió», no «lo hizo el otro»: una custom sin barones existe. */
  it('lo que ninguno reclama no sale', async () => {
    const detail = conObjetivos(partida(), objetivosDe({ firstBlood: true }), objetivosDe());
    const { component } = await montar({ detail });

    expect(component.firsts().map((f) => f.id)).toEqual(['blood']);
  });

  /** Los `first*` viajan dentro de `objectives`, y sin lados el backend no manda objetivos. */
  it('sin lados decididos no hay primeros', async () => {
    const { component } = await montar({ detail: partida({ sided: false }) });

    expect(component.firsts()).toEqual([]);
  });
});
