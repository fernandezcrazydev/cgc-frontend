import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tierlist } from './tierlist';
import { ChampionStatsStore } from '../../../../core/champions';
import {
  ChampionStatsMockSource,
  mockMatchFixture,
  mockParticipantFixture,
} from '../../../../core/champions/champion-stats-mock';
import { EnvironmentInjector } from '@angular/core';
import { GameDataApi } from '../../../../core/game-data/game-data-api';
import { GameDataStore } from '../../../../core/game-data';
import { ChampionSummary } from '../../../../core/game-data/models';

const GROUP_ID = 'test-group-id';

const AHRI_SUMMARY: ChampionSummary = {
  id: 103,
  slug: 'Ahri',
  name: 'Ahri',
  title: 'la zorra de nueve colas',
  tags: ['Mage', 'Assassin'],
  iconUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/Ahri.png',
  loadingUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_0.jpg',
};

const SYLAS_SUMMARY: ChampionSummary = {
  id: 517,
  slug: 'Sylas',
  name: 'Sylas',
  title: 'el desencadenado',
  tags: ['Mage', 'Assassin'],
  iconUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/Sylas.png',
  loadingUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Sylas_0.jpg',
};

const AATROX_SUMMARY: ChampionSummary = {
  id: 266,
  slug: 'Aatrox',
  name: 'Aatrox',
  title: 'la espada de los oscuros',
  tags: ['Fighter', 'Tank'],
  iconUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/Aatrox.png',
  loadingUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg',
};

const JINX_SUMMARY: ChampionSummary = {
  id: 222,
  slug: 'Jinx',
  name: 'Jinx',
  title: 'la bala perdida',
  tags: ['Marksman'],
  iconUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/Jinx.png',
  loadingUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Jinx_0.jpg',
};

describe('Tierlist Component', () => {
  let fixture: ComponentFixture<Tierlist>;
  let component: Tierlist;
  // La tier list se pinta desde el suplente de campeones, que es quien agrega. Se le da el
  // corpus a medida por test, en lugar de sembrar el historial.
  let champSource: ChampionStatsMockSource;
  let champStats: ChampionStatsStore;

  const mockGameDataApi = {
    manifest: () => of({ version: '16.14.1', updatedAt: '2026-07-26T04:17:03Z' }),
    champions: () => of([AHRI_SUMMARY, SYLAS_SUMMARY, AATROX_SUMMARY, JINX_SUMMARY]),
    champion: (id: number) => {
      const champ = [AHRI_SUMMARY, SYLAS_SUMMARY, AATROX_SUMMARY, JINX_SUMMARY].find((c) => c.id === id);
      if (!champ) return of(null as any);
      return of({
        ...champ,
        splashUrl: `.../${champ.slug}_0.jpg`,
        abilities: [],
      });
    },
    summonerSpells: () => of([]),
    perks: () => of([]),
    items: () => of({ content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Tierlist],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GameDataApi, useValue: mockGameDataApi },
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
      ],
    }).compileComponents();

    champStats = TestBed.inject(ChampionStatsStore);
    champSource = new ChampionStatsMockSource();
    champSource.useCorpus([]);
    champStats.useSource(champSource);

    const gameDataStore = TestBed.inject(GameDataStore);
    await gameDataStore.ensureLoaded();


    fixture = TestBed.createComponent(Tierlist);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('se crea correctamente', () => {
    expect(component).toBeTruthy();
    expect(component.groupId()).toBe(GROUP_ID);
  });

  it('muestra estado vacío cuando el grupo no tiene partidas disputadas', async () => {
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.totalMatches()).toBe(0);
    expect(component.allRows().length).toBe(0);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.tierlist-empty')).toBeTruthy();
    expect(compiled.textContent).toContain('Sin partidas registradas todavía');
  });

  it('calcula métricas de metagame, winrate, tiers y especialistas con partidas presentes', async () => {
    // Fabricamos 3 partidas en el grupo de prueba
    const pAhriWin = mockParticipantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
      riotId: 'N1ght#LAN',
      discordUsername: 'N1ght',
      stats: {
        kills: 8,
        deaths: 2,
        assists: 6,
        cs: 180,
        csPerMin: 6,
        gold: 12000,
        totalDamageToChampions: 24000,
        damageSharePercentage: 30,
        damageTaken: 8000,
        visionScore: 20,
        wardsPlaced: 10,
        wardsKilled: 2,
        items: [],
        spells: [4, 14],
      },
    });

    const pSylasLoss = mockParticipantFixture({
      id: 'p2',
      team: 'red',
      role: 'MID',
      championId: 517,
      riotId: 'Rival#LAN',
      discordUsername: 'Rival',
      stats: {
        kills: 2,
        deaths: 6,
        assists: 2,
        cs: 140,
        csPerMin: 4.5,
        gold: 8000,
        totalDamageToChampions: 12000,
        damageSharePercentage: 20,
        damageTaken: 18000,
        visionScore: 10,
        wardsPlaced: 5,
        wardsKilled: 1,
        items: [],
        spells: [4, 12],
      },
    });

    const m1 = mockMatchFixture({
      id: 'm1',
      durationSeconds: 1800,
      winningTeam: 'blue',
      blue: [pAhriWin],
      red: [pSylasLoss],
    });

    const m2 = mockMatchFixture({
      id: 'm2',
      durationSeconds: 1800,
      winningTeam: 'blue',
      blue: [pAhriWin],
      red: [pSylasLoss],
    });

    const m3 = mockMatchFixture({
      id: 'm3',
      durationSeconds: 1800,
      winningTeam: 'blue',
      blue: [pAhriWin],
      red: [pSylasLoss],
    });

    champSource.useCorpus([m1, m2, m3]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.totalMatches()).toBe(3);
    const rows = component.allRows();
    expect(rows.length).toBe(2);

    const ahriRow = rows.find((r) => r.championId === 103);
    expect(ahriRow).toBeDefined();
    expect(ahriRow!.games).toBe(3);
    expect(ahriRow!.wins).toBe(3);
    expect(ahriRow!.winrate).toBe(100);
    expect(ahriRow!.tier).toBe('S+'); // >= 62% WR y >= 3 partidas
    expect(ahriRow!.specialist?.name).toBe('N1ght');

    const sylasRow = rows.find((r) => r.championId === 517);
    expect(sylasRow).toBeDefined();
    expect(sylasRow!.games).toBe(3);
    expect(sylasRow!.wins).toBe(0);
    expect(sylasRow!.winrate).toBe(0);
    expect(sylasRow!.tier).toBe('C'); // < 42% WR
  });

  it('filtra por rol / línea correctamente', async () => {
    const pMid = mockParticipantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
    });
    const pTop = mockParticipantFixture({
      id: 'p2',
      team: 'red',
      role: 'TOP',
      championId: 266,
    });

    const m = mockMatchFixture({
      id: 'm1',
      blue: [pMid],
      red: [pTop],
    });

    champSource.useCorpus([m]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

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
    const p1 = mockParticipantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
    });
    const p2 = mockParticipantFixture({
      id: 'p2',
      team: 'red',
      role: 'ADC',
      championId: 222,
    });

    const m = mockMatchFixture({
      id: 'm1',
      blue: [p1],
      red: [p2],
    });

    champSource.useCorpus([m]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

    // Ahri championId 103 and Jinx 222 in mock GameData or fallback
    component.searchQuery.set('xyz-no-existe');
    fixture.detectChanges();
    expect(component.filteredRows().length).toBe(0);

    component.resetFilters();
    expect(component.searchQuery()).toBe('');
    expect(component.selectedRole()).toBe('ALL');
    expect(component.filteredRows().length).toBe(2);
  });

  it('permite alternar ordenación por columnas (toggleSort)', async () => {
    const p1 = mockParticipantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
    });
    const p2 = mockParticipantFixture({
      id: 'p2',
      team: 'red',
      role: 'ADC',
      championId: 222,
    });

    const m = mockMatchFixture({
      id: 'm1',
      blue: [p1],
      red: [p2],
    });

    champSource.useCorpus([m]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

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

  it('muestra estado de error cuando la carga del tablero falla', async () => {
    const statsStore = TestBed.inject(ChampionStatsStore);
    statsStore.useSource({
      board: () => throwError(() => new Error('Error al cargar datos')),
      stats: () => of(null),
    });

    await Promise.resolve();
    fixture.detectChanges();

    expect(component.isError()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Error al cargar datos');
    expect(compiled.querySelector('button')).toBeTruthy();
  });
});
