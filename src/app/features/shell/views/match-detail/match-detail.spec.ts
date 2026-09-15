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
  fakeMatchHistoryStore,
  matchFixture,
  participantFixture,
} from '../../../../core/matches/match-fixtures';
import { Match } from '../../../../core/matches/models';
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
