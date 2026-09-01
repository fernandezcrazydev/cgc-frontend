import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { GrupoRanking } from './grupo-ranking';
import { GroupStore } from '../../../core/group-store';
import { LeaderboardResponse, LeagueResponse } from '../../../core/leagues';

const GROUP_ID = 'lan-challenger';

const LEAGUE: LeagueResponse = {
  id: 'league-1',
  groupId: GROUP_ID,
  name: 'Liga de Los Panas',
  startsAt: '2026-08-01T00:00:00Z',
  // Muy por delante de "hoy" para que la cuenta atrás esté viva en el test.
  endsAt: '2099-09-15T23:59:59Z',
  status: 'IN_PROGRESS',
  type: 'COMPETITIVE',
  playerCount: 2,
};

function board(overrides: Partial<LeaderboardResponse> = {}): LeaderboardResponse {
  const entry = {
    rank: 1,
    userId: 'user-1',
    discordUsername: 'Edu',
    avatarUrl: null,
    riotId: 'Edu#EUW',
    riotTier: 'BRONZE',
    riotRank: 'II',
    riotStrength: 'VERIFIED',
    groupRole: 'MEMBER',
    lp: 240,
    wins: 10,
    losses: 5,
    totalGames: 15,
    winrate: 66.7,
    streakCount: 2,
    streakType: 'WIN' as const,
    isBanned: false,
    banReason: null,
    bannedUntil: null,
    lpHistory: [],
    avgLpGain: null,
    avgLpLoss: null,
  };
  return {
    league: LEAGUE,
    podium: [entry],
    entries: { content: [entry], page: 0, size: 15, totalElements: 1, totalPages: 1 },
    totalPlayers: 1,
    canManageLeague: false,
    hasActivity: true,
    ...overrides,
  };
}

describe('GrupoRanking', () => {
  let http: HttpTestingController;

  function createComponent() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        GroupStore,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => GROUP_ID } },
            paramMap: of({ get: () => GROUP_ID }),
          },
        },
      ],
    });

    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(GrupoRanking);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  /** Responde a la petición del leaderboard, ignorando las demás que dispare la vista. */
  function flushBoard(payload: LeaderboardResponse = board()) {
    const reqs = http.match((r) => r.url === `${environment.apiUrl}/groups/${GROUP_ID}/leaderboard`);
    reqs.forEach((r) => r.flush(payload));
    return reqs.length;
  }

  it('pinta el esqueleto mientras la clasificación viaja, sin datos de relleno', () => {
    const { component } = createComponent();

    expect(component.isLoading()).toBe(true);
    expect(component.rows()).toEqual([]);
    expect(component.podium()).toEqual([]);
  });

  it('pide la clasificación al backend en cuanto se monta', () => {
    createComponent();

    expect(flushBoard()).toBeGreaterThan(0);
  });

  it('no tiene cuenta atrás hasta que el servidor dice cuándo acaba la liga', () => {
    const { component } = createComponent();

    // Antes se fabricaba una fecha de fin con `Date.now() + hash(groupId)`, así que el cronómetro
    // corría hacia una fecha inexistente y distinta en cada recarga.
    expect(component.countdown()).toBeNull();
  });

  it('deriva la cuenta atrás de endsAt cuando llega', async () => {
    const { component, fixture } = createComponent();
    flushBoard();
    await fixture.whenStable();

    const cd = component.countdown();
    expect(cd).not.toBeNull();
    expect(cd!.isExpired).toBe(false);
    expect(cd!.days).toBeGreaterThan(0);
    expect(['En curso', 'Fase final']).toContain(cd!.statusLabel);
  });

  it('marca la temporada como finalizada cuando endsAt ya pasó', async () => {
    const { component, fixture } = createComponent();
    flushBoard(board({ league: { ...LEAGUE, endsAt: '2020-01-01T00:00:00Z' } }));
    await fixture.whenStable();

    expect(component.countdown()!.isExpired).toBe(true);
    expect(component.countdown()!.statusLabel).toBe('Finalizada');
  });

  it('toma el nombre de la liga del servidor, no del nombre del grupo', async () => {
    const { component, fixture } = createComponent();
    flushBoard();
    await fixture.whenStable();

    expect(component.leagueName()).toBe('Liga de Los Panas');
  });

  it('mapea las filas conservando el tier real, sin disfrazarlo de Oro', async () => {
    const { component, fixture } = createComponent();
    flushBoard();
    await fixture.whenStable();

    const [row] = component.rows();
    expect(row.playerId).toBe('user-1');
    expect(row.lolRank?.tier).toBe('BRONZE');
    expect(row.lolRank?.label).toContain('Bronce');
  });

  it('deja en «sin datos» las columnas que el backend todavía no sirve', async () => {
    const { component, fixture } = createComponent();
    flushBoard();
    await fixture.whenStable();

    const [row] = component.rows();
    // Rol y Main siguen sin fuente: llegan con la subida de partidas.
    expect(row.lane).toBeNull();
    expect(row.mainChampionId).toBeNull();
  });

  it('dibuja la tendencia y las medias en cuanto el ledger tiene movimientos', async () => {
    const { component, fixture } = createComponent();
    const withHistory = board();
    withHistory.entries.content[0] = {
      ...withHistory.entries.content[0],
      lpHistory: [20, 45, 90],
      avgLpGain: 25,
      avgLpLoss: 12,
    };
    flushBoard(withHistory);
    await fixture.whenStable();

    const [row] = component.rows();
    expect(row.sparkPath).not.toBeNull();
    expect(row.trend).toBe('up');
    expect(row.avgLpGain).toBe(25);
    expect(row.avgLpLoss).toBe(12);
  });

  it('explica en el tooltip el motivo real de una sanción y hasta cuándo dura', async () => {
    const { component, fixture } = createComponent();
    const withBan = board();
    withBan.entries.content[0] = {
      ...withBan.entries.content[0],
      isBanned: true,
      banReason: 'AFK reiterado',
      bannedUntil: '2026-12-31T23:59:59Z',
    };
    flushBoard(withBan);
    await fixture.whenStable();

    const [row] = component.rows();
    expect(component.banTitle(row)).toContain('AFK reiterado');
    expect(component.banTitle(row)).toContain('hasta el');
  });

  it('distingue una sanción indefinida de una con fecha', async () => {
    const { component, fixture } = createComponent();
    const withBan = board();
    withBan.entries.content[0] = {
      ...withBan.entries.content[0],
      isBanned: true,
      banReason: 'Conducta antideportiva',
      bannedUntil: null,
    };
    flushBoard(withBan);
    await fixture.whenStable();

    // "Hasta que alguien la levante" tiene que poder distinguirse de "termina el martes".
    expect(component.banTitle(component.rows()[0])).toContain('indefinida');
  });

  it('distingue liga vacía de error', async () => {
    const { component, fixture } = createComponent();
    flushBoard(
      board({
        podium: [],
        entries: { content: [], page: 0, size: 15, totalElements: 0, totalPages: 0 },
        totalPlayers: 0,
        hasActivity: false,
      }),
    );
    await fixture.whenStable();

    expect(component.leagues.isEmpty()).toBe(true);
    expect(component.leagues.status()).toBe('ready');
    expect(component.leagues.error()).toBeNull();
  });

  it('deja la vista en error con mensaje cuando el backend falla', async () => {
    const { component, fixture } = createComponent();
    const reqs = http.match((r) => r.url === `${environment.apiUrl}/groups/${GROUP_ID}/leaderboard`);
    reqs.forEach((r) => r.flush({}, { status: 500, statusText: 'Server Error' }));
    await fixture.whenStable();

    expect(component.leagues.status()).toBe('error');
    expect(component.leagues.error()).toBeTruthy();
    // Y sobre todo: NO se inventa una clasificación para tapar el fallo.
    expect(component.rows()).toEqual([]);
  });

  it('alterna la dirección al pulsar dos veces la misma columna', async () => {
    const { component, fixture } = createComponent();
    flushBoard();
    await fixture.whenStable();

    component.sortBy('wr');
    expect(component.sortKey()).toBe('wr');
    // El winrate se lee de mayor a menor.
    expect(component.sortDir()).toBe('desc');

    component.sortBy('wr');
    expect(component.sortDir()).toBe('asc');
  });

  it('expone las flechas y el aria-sort de la columna activa', async () => {
    const { component, fixture } = createComponent();
    flushBoard();
    await fixture.whenStable();

    expect(component.ariaSort('rank')).toBe('ascending');
    expect(component.ariaSort('wr')).toBe('none');
    expect(component.arrow('wr')).toBe('↕');
  });

  it('abre y cierra una sola fila del acordeón a la vez', async () => {
    const { component, fixture } = createComponent();
    flushBoard();
    await fixture.whenStable();

    component.toggle('user-1');
    expect(component.openId()).toBe('user-1');

    component.toggle('user-1');
    expect(component.openId()).toBeNull();
  });

  it('formatea el reloj con dos dígitos', () => {
    const { component } = createComponent();
    expect(component.pad(5)).toBe('05');
    expect(component.pad(42)).toBe('42');
  });
});
