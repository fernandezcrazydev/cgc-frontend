import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { Tierlist } from './tierlist';
import { MatchHistoryStore } from '../../../core/matches/match-history-store';
import { GameDataStore } from '../../../core/game-data';
import { GroupsStore } from '../../../core/groups';
import { matchFixture, participantFixture } from '../../../core/matches/match-fixtures';

const GROUP_ID = 'test-group-id';

describe('Tierlist Component', () => {
  let fixture: ComponentFixture<Tierlist>;
  let component: Tierlist;
  let matchStore: MatchHistoryStore;

  beforeEach(async () => {
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
          },
        },
      ],
    }).compileComponents();

    matchStore = TestBed.inject(MatchHistoryStore);
    matchStore.allMatches.set([]); // Inicia vacío por defecto

    fixture = TestBed.createComponent(Tierlist);
    component = fixture.componentInstance;
    fixture.detectChanges();
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

  it('calcula métricas de metagame, winrate, tiers y especialistas con partidas presentes', () => {
    // Fabricamos 3 partidas en el grupo de prueba
    const pAhriWin = participantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
      championName: 'Ahri',
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

    const pSylasLoss = participantFixture({
      id: 'p2',
      team: 'red',
      role: 'MID',
      championId: 517,
      championName: 'Sylas',
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

    const m1 = matchFixture({
      id: 'm1',
      groupId: GROUP_ID,
      durationSeconds: 1800,
      winningTeam: 'blue',
      blue: [pAhriWin],
      red: [pSylasLoss],
    });

    const m2 = matchFixture({
      id: 'm2',
      groupId: GROUP_ID,
      durationSeconds: 1800,
      winningTeam: 'blue',
      blue: [pAhriWin],
      red: [pSylasLoss],
    });

    const m3 = matchFixture({
      id: 'm3',
      groupId: GROUP_ID,
      durationSeconds: 1800,
      winningTeam: 'blue',
      blue: [pAhriWin],
      red: [pSylasLoss],
    });

    matchStore.allMatches.set([m1, m2, m3]);
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
    expect(ahriRow!.players.length).toBe(1);
    expect(ahriRow!.players[0].name).toBe('N1ght');
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

  it('filtra por rol / línea correctamente', () => {
    const pMid = participantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
      championName: 'Ahri',
    });
    const pTop = participantFixture({
      id: 'p2',
      team: 'red',
      role: 'TOP',
      championId: 266,
      championName: 'Aatrox',
    });

    const m = matchFixture({
      id: 'm1',
      groupId: GROUP_ID,
      blue: [pMid],
      red: [pTop],
    });

    matchStore.allMatches.set([m]);
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

  it('filtra por búsqueda de texto de campeón', () => {
    const p1 = participantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
      championName: 'Ahri',
    });
    const p2 = participantFixture({
      id: 'p2',
      team: 'red',
      role: 'ADC',
      championId: 222,
      championName: 'Jinx',
    });

    const m = matchFixture({
      id: 'm1',
      groupId: GROUP_ID,
      blue: [p1],
      red: [p2],
    });

    matchStore.allMatches.set([m]);
    fixture.detectChanges();

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

  it('permite alternar ordenación por columnas (toggleSort)', () => {
    const p1 = participantFixture({
      id: 'p1',
      team: 'blue',
      role: 'MID',
      championId: 103,
      championName: 'Ahri',
    });
    const p2 = participantFixture({
      id: 'p2',
      team: 'red',
      role: 'ADC',
      championId: 222,
      championName: 'Jinx',
    });

    const m = matchFixture({
      id: 'm1',
      groupId: GROUP_ID,
      blue: [p1],
      red: [p2],
    });

    matchStore.allMatches.set([m]);
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
});
