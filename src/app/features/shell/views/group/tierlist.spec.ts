import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tierlist } from './tierlist';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import {
  fakeMatchHistoryStore,
  matchFixture,
  participantFixture,
  statsFixture,
} from '../../../../core/matches/match-fixtures';
import { Match } from '../../../../core/matches/models';
import { signal } from '@angular/core';

const GROUP_ID = 'test-group-id';

/**
 * La tier list se calcula sobre la MUESTRA del grupo —las últimas partidas, hasta el tope del
 * servidor—, no sobre su historial entero: con la paginación en servidor esa vuelta ya no existe
 * en el cliente. Por eso el doble del store rellena `groupSample` y no una lista global.
 */
describe('Tierlist Component', () => {
  let fixture: ComponentFixture<Tierlist>;
  let component: Tierlist;

  async function montar(sample: Match[], totalEnGrupo = sample.length) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [Tierlist],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: GROUP_ID })),
            snapshot: {
              paramMap: convertToParamMap({ id: GROUP_ID }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          // El nombre del campeón sale del catálogo y solo de ahí: el asiento del backend trae
          // el id y nada más. Sin este doble, las filas se llamarían «Campeón 103».
          provide: GameDataStore,
          useValue: {
            status: signal('ready'),
            championById: signal(
              new Map([
                [103, { id: 103, name: 'Ahri', title: '', iconUrl: null, tags: [] }],
                [517, { id: 517, name: 'Sylas', title: '', iconUrl: null, tags: [] }],
                [266, { id: 266, name: 'Aatrox', title: '', iconUrl: null, tags: [] }],
                [222, { id: 222, name: 'Jinx', title: '', iconUrl: null, tags: [] }],
              ]),
            ),
            ensureLoaded: () => {},
          },
        },
        {
          provide: GroupsStore,
          useValue: {
            groups: signal([{ id: GROUP_ID, name: 'Grupo de prueba' }]),
            byId: (id: string) =>
              id === GROUP_ID ? { id: GROUP_ID, name: 'Grupo de prueba' } : null,
            ensureLoaded: () => {},
          },
        },
        {
          provide: MatchHistoryStore,
          useValue: fakeMatchHistoryStore({ groupSample: sample, groupSampleTotal: totalEnGrupo }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Tierlist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await montar([]);
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
    expect(component.groupId()).toBe(GROUP_ID);
  });

  it('muestra estado vacío cuando el grupo no tiene partidas disputadas', () => {
    expect(component.totalMatches()).toBe(0);
    expect(component.allRows().length).toBe(0);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.tierlist-empty')).toBeTruthy();
    expect(compiled.textContent).toContain('Sin partidas registradas todavía');
  });

  it('calcula métricas de metagame, winrate, tiers y especialistas con partidas presentes', async () => {
    // Fabricamos 3 partidas en el grupo de prueba
    const pAhriWin = participantFixture({
      userId: 'u-night',
      slot: 'A',
      role: 'MID',
      championId: 103,
      riotId: 'N1ght#LAN',
      stats: statsFixture({ kills: 8, deaths: 2, assists: 6, cs: 180, gold: 12000 }),
    });

    const pSylasLoss = participantFixture({
      userId: 'u-rival',
      slot: 'B',
      role: 'MID',
      championId: 517,
      riotId: 'Rival#LAN',
      stats: statsFixture({ kills: 2, deaths: 6, assists: 2, cs: 140, gold: 8000 }),
    });

    const m1 = matchFixture({
      id: 'm1',
      groupId: GROUP_ID,
      durationSeconds: 1800,
      winningSlot: 'A',
      a: [pAhriWin],
      b: [pSylasLoss],
    });

    const m2 = matchFixture({
      id: 'm2',
      groupId: GROUP_ID,
      durationSeconds: 1800,
      winningSlot: 'A',
      a: [pAhriWin],
      b: [pSylasLoss],
    });

    const m3 = matchFixture({
      id: 'm3',
      groupId: GROUP_ID,
      durationSeconds: 1800,
      winningSlot: 'A',
      a: [pAhriWin],
      b: [pSylasLoss],
    });

    await montar([m1, m2, m3]);

    expect(component.totalMatches()).toBe(3);
    const rows = component.allRows();
    expect(rows.length).toBe(2);

    const ahriRow = rows.find((r) => r.championId === 103);
    expect(ahriRow).toBeDefined();
    expect(ahriRow!.games).toBe(3);
    expect(ahriRow!.wins).toBe(3);
    expect(ahriRow!.winrate).toBe(100);
    expect(ahriRow!.tier).toBe('S+'); // >= 62% WR y >= 3 partidas
    expect(ahriRow!.specialist?.name).toBe('N1ght#LAN');
    expect(ahriRow!.players.length).toBe(1);
    expect(ahriRow!.players[0].name).toBe('N1ght#LAN');
    expect(ahriRow!.players[0].wins).toBe(3);

    const sylasRow = rows.find((r) => r.championId === 517);
    expect(sylasRow).toBeDefined();
    expect(sylasRow!.games).toBe(3);
    expect(sylasRow!.wins).toBe(0);
    expect(sylasRow!.winrate).toBe(0);
    expect(sylasRow!.tier).toBe('C'); // < 42% WR

    // Verificar apertura y cierre del cajón Deep-Dive
    expect(component.expandedChampId()).toBeNull();
    component.toggleExpand(103);
    expect(component.expandedChampId()).toBe(103);
    component.toggleExpand(103);
    expect(component.expandedChampId()).toBeNull();
  });

  it('filtra por rol / línea correctamente', async () => {
    const pMid = participantFixture({ userId: 'u1', slot: 'A', role: 'MID', championId: 103 });
    const pTop = participantFixture({ userId: 'u2', slot: 'B', role: 'TOP', championId: 266 });

    await montar([matchFixture({ id: 'm1', groupId: GROUP_ID, a: [pMid], b: [pTop] })]);

    expect(component.filteredRows().length).toBe(2);

    component.selectedRole.set('TOP');
    fixture.detectChanges();
    expect(component.filteredRows().length).toBe(1);
    expect(component.filteredRows()[0].championId).toBe(266);

    component.selectedRole.set('ADC');
    fixture.detectChanges();
    expect(component.filteredRows().length).toBe(0);

    component.selectedRole.set('ALL');
    fixture.detectChanges();
    expect(component.filteredRows().length).toBe(2);
  });

  it('filtra por búsqueda de texto de campeón', async () => {
    const p1 = participantFixture({ userId: 'u1', slot: 'A', role: 'MID', championId: 103 });
    const p2 = participantFixture({ userId: 'u2', slot: 'B', role: 'ADC', championId: 222 });

    await montar([matchFixture({ id: 'm1', groupId: GROUP_ID, a: [p1], b: [p2] })]);

    component.searchQuery.set('jin');
    fixture.detectChanges();
    expect(component.filteredRows().length).toBe(1);
    expect(component.filteredRows()[0].name).toBe('Jinx');

    component.searchQuery.set('xyz-no-existe');
    fixture.detectChanges();
    expect(component.filteredRows().length).toBe(0);

    component.resetFilters();
    expect(component.searchQuery()).toBe('');
    expect(component.selectedRole()).toBe('ALL');
    expect(component.filteredRows().length).toBe(2);
  });

  it('permite alternar ordenación por columnas (toggleSort)', async () => {
    const p1 = participantFixture({ userId: 'u1', slot: 'A', role: 'MID', championId: 103 });
    const p2 = participantFixture({ userId: 'u2', slot: 'B', role: 'ADC', championId: 222 });

    await montar([matchFixture({ id: 'm1', groupId: GROUP_ID, a: [p1], b: [p2] })]);

    // Orden inicial por winrate desc
    expect(component.sortColumn()).toBe('winrate');
    expect(component.sortAsc()).toBe(false);

    // Cambiar a ordenar por nombre
    component.toggleSort('name');
    expect(component.sortColumn()).toBe('name');
    expect(component.sortAsc()).toBe(true); // Texto default asc

    // Invertir a desc
    component.toggleSort('name');
    expect(component.sortAsc()).toBe(false);

    // Cambiar a games
    component.toggleSort('games');
    expect(component.sortColumn()).toBe('games');
    expect(component.sortAsc()).toBe(false); // Métricas numéricas default desc
  });
});
