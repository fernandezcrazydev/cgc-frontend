import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';
import { describe, expect, it, beforeEach } from 'vitest';
import { EnvironmentInjector } from '@angular/core';
import { Campeon } from './campeon';
import { ChampionStatsStore } from '../../../../core/champions/champion-stats-store';
import { GameDataApi } from '../../../../core/game-data/game-data-api';
import { GameDataStore } from '../../../../core/game-data';
import {
  ChampionStatsMockSource,
  mockMatchFixture,
  mockParticipantFixture,
} from '../../../../core/champions/champion-stats-mock';
import { ChampionDetail, ChampionSummary } from '../../../../core/game-data/models';

const AHRI_SUMMARY: ChampionSummary = {
  id: 103,
  slug: 'Ahri',
  name: 'Ahri',
  title: 'la zorra de nueve colas',
  tags: ['Mage', 'Assassin'],
  iconUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/Ahri.png',
  loadingUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_0.jpg',
};

const AHRI_DETAIL: ChampionDetail = {
  ...AHRI_SUMMARY,
  splashUrl: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg',
  abilities: [
    { slot: 'PASSIVE', name: 'Esencia robada', iconUrl: '.../passive.png' },
    { slot: 'Q', name: 'Orbe del engaño', iconUrl: '.../q.png' },
    { slot: 'W', name: 'Fuego zorruno', iconUrl: '.../w.png' },
    { slot: 'E', name: 'Hechizar', iconUrl: '.../e.png' },
    { slot: 'R', name: 'Impulso espiritual', iconUrl: '.../r.png' },
  ],
};

describe('Campeon Component', () => {
  let fixture: ComponentFixture<Campeon>;
  let component: Campeon;
  // La pagina de campeon se pinta desde el suplente, no desde el historial: es el suplente
  // quien agrega. Se le da un corpus a medida por test, que es el equivalente exacto de lo que
  // antes se hacia sembrando el store de partidas.
  let champSource: ChampionStatsMockSource;
  let champStats: ChampionStatsStore;
  let gameDataStore: GameDataStore;
  let paramMapSubject: BehaviorSubject<any>;

  const mockGameDataApi = {
    manifest: () => of({ version: '16.14.1', updatedAt: '2026-07-26T04:17:03Z' }),
    champions: () => of([AHRI_SUMMARY]),
    champion: (id: number) => {
      if (id === 103) return of(AHRI_DETAIL);
      return of(null as any);
    },
    summonerSpells: () => of([]),
    perks: () => of([]),
    items: () => of({ content: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }),
  };

  async function createTestComponent(params: Record<string, string | null>) {
    paramMapSubject = new BehaviorSubject(convertToParamMap(params));

    await TestBed.configureTestingModule({
      imports: [Campeon],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GameDataApi, useValue: mockGameDataApi },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: paramMapSubject.asObservable(),
            snapshot: {
              paramMap: convertToParamMap(params),
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

    gameDataStore = TestBed.inject(GameDataStore);
    await gameDataStore.ensureLoaded();


    fixture = TestBed.createComponent(Campeon);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  }

  it('con datos, pinta las seis tarjetas', async () => {
    await createTestComponent({ id: 'g1', championId: '103' });

    const pAhri = mockParticipantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
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
        items: [{ id: 3089, name: 'Sombrero mortal de Rabadon' }],
        spells: [4, 14],
        primaryTreeId: 8100,
        secondaryRuneTreeId: 8000,
        primaryRuneId: 8112,
        primaryRuneIds: [8126, 8138, 8105],
        secondaryRuneIds: [8009, 8014],
        statShardIds: [5008, 5008, 5002],
      },
    });

    const m1 = mockMatchFixture({
      id: 'm1',
      winningTeam: 'blue',
      blue: [pAhri],
      red: [],
    });

    champSource.useCorpus([m1]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.stats()).not.toBeNull();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-card--cabecera')).toBeTruthy();
    expect(el.querySelector('.cf-card--macro')).toBeTruthy();
    expect(el.querySelector('.cf-card--espec')).toBeTruthy();
    expect(el.querySelector('.cf-card--skills')).toBeTruthy();
    expect(el.querySelector('.cf-card--sinergias')).toBeTruthy();
    expect(el.querySelector('.cf-card--counters')).toBeTruthy();
    expect(el.querySelector('.cf-card--builds')).toBeTruthy();
  });

  it('con un championId que no está en el catálogo, enseña Campeón no encontrado', async () => {
    await createTestComponent({ id: 'g1', championId: '999999' });

    expect(component.isNotFound()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Campeón no encontrado');
    expect(el.textContent).toContain('No hay ningún campeón con ese identificador.');
  });

  it('con un campeón del catálogo que no aparece en ninguna partida, pinta la cabecera y el bloque Todavía no se ha jugado con …, y no pinta las cinco tarjetas de estadísticas', async () => {
    await createTestComponent({ id: 'g1', championId: '103' });

    champSource.useCorpus([]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.stats()).toBeNull();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-card--cabecera')).toBeTruthy();
    expect(el.querySelector('.cf-card--unplayed')).toBeTruthy();
    expect(el.textContent).toContain('Todavía no se ha jugado con Ahri');

    expect(el.querySelector('.cf-card--macro')).toBeNull();
    expect(el.querySelector('.cf-card--espec')).toBeNull();
    expect(el.querySelector('.cf-card--skills')).toBeNull();
    expect(el.querySelector('.cf-card--sinergias')).toBeNull();
    expect(el.querySelector('.cf-card--counters')).toBeNull();
    expect(el.querySelector('.cf-card--builds')).toBeNull();
  });

  it('en la ruta sin grupo, el rótulo de ámbito dice Todos tus grupos', async () => {
    await createTestComponent({ championId: '103' });

    champSource.useCorpus([]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.scopeLabel()).toBe('Todos tus grupos');

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Todos tus grupos');
  });

  it('con championId alfanumérico como "abc", enseña Campeón no encontrado directamente', async () => {
    await createTestComponent({ id: 'g1', championId: 'abc' });

    expect(component.isNotFound()).toBe(true);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Campeón no encontrado');
  });

  it('un campeón sin partidas enseña — en el rol de la cabecera en vez de MID', async () => {
    await createTestComponent({ id: 'g1', championId: '103' });

    champSource.useCorpus([]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const roleChip = el.querySelector('.c-alt1__role');
    expect(roleChip?.textContent?.trim()).toBe('—');
  });

  it('en la ruta sin grupo con partidas, los títulos de especialistas y objetos no dicen "del grupo"', async () => {
    await createTestComponent({ championId: '103' });

    const pAhri = mockParticipantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
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
        items: [{ id: 3089, name: 'Sombrero mortal de Rabadon' }],
        spells: [4, 14],
        primaryTreeId: 8100,
        secondaryRuneTreeId: 8000,
        primaryRuneId: 8112,
        primaryRuneIds: [8126, 8138, 8105],
        secondaryRuneIds: [8009, 8014],
        statShardIds: [5008, 5008, 5002],
      },
    });

    const m1 = mockMatchFixture({
      id: 'm1',
      winningTeam: 'blue',
      blue: [pAhri],
      red: [],
    });

    champSource.useCorpus([m1]);
    champStats.invalidate();
    await Promise.resolve();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const especTitle = el.querySelector('.cf-espec-card .cf-card__title');
    expect(especTitle?.textContent?.trim()).toBe('Especialistas');

    const buildsSubtitle = el.querySelector('.b-alt4__subtitle');
    expect(buildsSubtitle?.textContent).toContain('en todos tus grupos.');
    expect(buildsSubtitle?.textContent).not.toContain('registradas en el grupo.');
  });
});
