import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { LeaguesStore } from './leagues-store';
import { LeaderboardEntryResponse, LeaderboardResponse, LeagueResponse } from './models';

const LEAGUE: LeagueResponse = {
  id: 'league-1',
  groupId: 'group-a',
  name: 'Liga de Los Panas',
  startsAt: '2026-08-01T00:00:00Z',
  endsAt: '2026-09-15T23:59:59Z',
  status: 'IN_PROGRESS',
  type: 'COMPETITIVE',
  playerCount: 4,
};

function row(rank: number, userId: string): LeaderboardEntryResponse {
  return {
    rank,
    userId,
    discordUsername: `player-${userId}`,
    avatarUrl: null,
    riotId: null,
    riotTier: null,
    riotRank: null,
    riotStrength: null,
    groupRole: 'MEMBER',
    lp: 100 - rank,
    wins: 5,
    losses: 5,
    totalGames: 10,
    winrate: 50,
    streakCount: 1,
    streakType: 'WIN',
    isBanned: false,
    banReason: null,
    bannedUntil: null,
    lpHistory: [],
    avgLpGain: null,
    avgLpLoss: null,
  };
}

function board(overrides: Partial<LeaderboardResponse> = {}): LeaderboardResponse {
  return {
    league: LEAGUE,
    podium: [row(1, 'a'), row(2, 'b'), row(3, 'c')],
    entries: { content: [row(1, 'a'), row(2, 'b')], page: 0, size: 15, totalElements: 4, totalPages: 1 },
    totalPlayers: 4,
    canManageLeague: false,
    hasActivity: true,
    ...overrides,
  };
}

describe('LeaguesStore', () => {
  let store: LeaguesStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LeaguesStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(LeaguesStore);
    http = TestBed.inject(HttpTestingController);
  });

  function expectBoardRequest(groupId = 'group-a') {
    return http.expectOne((r) => r.url === `${environment.apiUrl}/groups/${groupId}/leaderboard`);
  }

  /** Deja correr los microtasks pendientes, para ver la petición que una promesa encola después. */
  function flushMicrotasks(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('arranca en idle, sin datos y sin error', () => {
    expect(store.status()).toBe('idle');
    expect(store.rows()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('pasa por loading y termina en ready con la página servida', async () => {
    const done = store.ensureLoaded('group-a');
    expect(store.status()).toBe('loading');

    expectBoardRequest().flush(board());
    await done;

    expect(store.status()).toBe('ready');
    expect(store.rows()).toHaveLength(2);
    expect(store.podium()).toHaveLength(3);
    // El contador es el de la liga entera, no el de la página.
    expect(store.totalPlayers()).toBe(4);
    expect(store.league()?.name).toBe('Liga de Los Panas');
  });

  it('pide la primera página en orden de clasificación por defecto', async () => {
    const done = store.ensureLoaded('group-a');
    const req = expectBoardRequest();

    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('sort')).toBe('RANK');
    expect(req.request.params.get('dir')).toBe('ASC');

    req.flush(board());
    await done;
  });

  it('no repite la petición si ya tiene esa misma consulta cargada', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board());
    await first;

    await store.ensureLoaded('group-a');
    http.verify(); // no hay una segunda petición pendiente
  });

  it('deduplica las llamadas simultáneas en una sola petición', async () => {
    const a = store.ensureLoaded('group-a');
    const b = store.ensureLoaded('group-a');

    expectBoardRequest().flush(board());
    await Promise.all([a, b]);

    expect(store.status()).toBe('ready');
  });

  it('traduce un fallo a estado de error con mensaje, no a lista vacía', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush({ code: 'INTERNAL_ERROR' }, { status: 500, statusText: 'Server Error' });
    await done;

    expect(store.status()).toBe('error');
    expect(store.error()).toBeTruthy();
    expect(store.rows()).toEqual([]);
    // Un error NO es un estado vacío: la vista tiene que poder ofrecer reintentar.
    expect(store.isEmpty()).toBe(false);
  });

  it('reintenta tras un error y se recupera', async () => {
    const failed = store.ensureLoaded('group-a');
    expectBoardRequest().flush({}, { status: 500, statusText: 'Server Error' });
    await failed;

    const retried = store.reload();
    expectBoardRequest().flush(board());
    await retried;

    expect(store.status()).toBe('ready');
    expect(store.error()).toBeNull();
  });

  it('distingue liga vacía de error', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush(
      board({
        podium: [],
        entries: { content: [], page: 0, size: 15, totalElements: 0, totalPages: 0 },
        totalPlayers: 0,
        hasActivity: false,
      }),
    );
    await done;

    expect(store.status()).toBe('ready');
    expect(store.isEmpty()).toBe(true);
    expect(store.error()).toBeNull();
  });

  /**
   * El caso real que motivó esta bandera: el creador de un grupo cuenta siempre como miembro, así
   * que `totalPlayers` nunca es cero. Una liga recién creada con un solo miembro y sin partidas
   * jugadas tiene que verse como vacía igualmente — no como "un competidor con LP 0 en el podio".
   */
  it('una liga con miembros pero sin partidas jugadas también cuenta como vacía', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush(
      board({
        podium: [row(1, 'a')],
        entries: { content: [row(1, 'a')], page: 0, size: 15, totalElements: 1, totalPages: 1 },
        totalPlayers: 1,
        hasActivity: false,
      }),
    );
    await done;

    expect(store.totalPlayers()).toBe(1);
    expect(store.isEmpty()).toBe(true);
  });

  /** En cuanto una sola persona tiene una partida, la liga deja de estar vacía, aunque sea 1 de 20. */
  it('un solo jugador con actividad basta para que la liga no esté vacía', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board({ hasActivity: true, totalPlayers: 1 }));
    await done;

    expect(store.isEmpty()).toBe(false);
  });

  /**
   * La carrera que tenía la vista antes de existir este store: se suscribía sin comprobar el id, así
   * que al pasar del grupo A al B, si A respondía después, se pintaba la clasificación de A sobre B.
   */
  it('descarta la respuesta de una carga que ya no es la vigente', async () => {
    const stale = store.ensureLoaded('group-a');
    const staleReq = expectBoardRequest('group-a');

    store.clear();
    const fresh = store.ensureLoaded('group-b');
    const freshReq = expectBoardRequest('group-b');

    // La primera responde DESPUÉS de la segunda.
    freshReq.flush(board({ league: { ...LEAGUE, groupId: 'group-b', name: 'Liga B' } }));
    staleReq.flush(board({ league: { ...LEAGUE, name: 'Liga A' } }));

    await Promise.all([stale, fresh]);

    expect(store.league()?.name).toBe('Liga B');
  });

  it('cambia de página conservando el orden', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board());
    await first;

    const second = store.goToPage(1);
    const req = expectBoardRequest();
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('sort')).toBe('RANK');

    req.flush(board({ entries: { content: [row(3, 'c')], page: 1, size: 15, totalElements: 4, totalPages: 2 } }));
    await second;

    expect(store.page()).toBe(1);
  });

  it('vuelve a la primera página al cambiar de orden', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board());
    await first;

    const paged = store.goToPage(2);
    expectBoardRequest().flush(board({ entries: { content: [], page: 2, size: 15, totalElements: 4, totalPages: 3 } }));
    await paged;

    const sorted = store.sortBy('WINRATE', 'DESC');
    const req = expectBoardRequest();
    // Quedarse en la página 3 de un orden nuevo enseña un tramo arbitrario de la tabla.
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('sort')).toBe('WINRATE');
    expect(req.request.params.get('dir')).toBe('DESC');

    req.flush(board());
    await sorted;
  });

  it('busca contra el servidor pasando el orden que está mostrando', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board());
    await first;

    const sorted = store.sortBy('WINRATE', 'DESC');
    expectBoardRequest().flush(board());
    await sorted;

    const search = store.search('group-a', 'edu');
    const req = http.expectOne((r) => r.url === `${environment.apiUrl}/groups/group-a/leaderboard/search`);
    expect(req.request.params.get('q')).toBe('edu');
    expect(req.request.params.get('sort')).toBe('WINRATE');
    req.flush([{ rank: 3, page: 1, userId: 'c', discordUsername: 'Edu', riotId: null, lp: 90 }]);

    expect(await search).toHaveLength(1);
  });

  it('no llama a la red con una búsqueda en blanco', async () => {
    expect(await store.search('group-a', '   ')).toEqual([]);
    http.verify();
  });

  it('devuelve lista vacía si la búsqueda falla, sin romper el estado de la tabla', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board());
    await first;

    const search = store.search('group-a', 'edu');
    http
      .expectOne((r) => r.url === `${environment.apiUrl}/groups/group-a/leaderboard/search`)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(await search).toEqual([]);
    expect(store.status()).toBe('ready');
  });

  /**
   * El fin de temporada lo dice el SERVIDOR con `status`, no el cronómetro del cliente. Una liga
   * vencida deja de ser la activa allí, así que aquí solo hay que leerlo.
   */
  it('reconoce la temporada cerrada y su campeón', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board({ league: { ...LEAGUE, status: 'FINISHED' } }));
    await done;

    expect(store.isSeasonClosed()).toBe(true);
    // El campeón sale del podio, que ya excluye a los sancionados.
    expect(store.champion()?.userId).toBe('a');
    // Y la clasificación final se sigue viendo: cerrada no es lo mismo que vacía.
    expect(store.rows()).not.toEqual([]);
    expect(store.isEmpty()).toBe(false);
  });

  it('una liga en curso no está cerrada', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board());
    await done;

    expect(store.isSeasonClosed()).toBe(false);
  });

  it('expone si quien mira puede abrir la siguiente temporada', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board({ canManageLeague: true }));
    await done;

    expect(store.canManageLeague()).toBe(true);
  });

  it('abrir la siguiente temporada la crea y recarga la clasificación desde cero', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board({ league: { ...LEAGUE, status: 'FINISHED' }, canManageLeague: true }));
    await first;

    const starting = store.startNextSeason('group-a', 'Los Panas · Temporada 2', '2099-01-01T00:00:00Z');
    // Pesimista: mientras viaja, el botón que la dispara va deshabilitado.
    expect(store.starting()).toBe(true);

    const post = http.expectOne((r) => r.url === `${environment.apiUrl}/groups/group-a/leagues`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      name: 'Los Panas · Temporada 2',
      endsAt: '2099-01-01T00:00:00Z',
    });
    post.flush({ ...LEAGUE, id: 'league-2', name: 'Los Panas · Temporada 2' });

    // El refetch se encola detrás del POST, así que hay que ceder el turno antes de esperarlo.
    await flushMicrotasks();

    // Y solo entonces se vuelve a pedir la tabla, en vez de parchear la liga nueva en local.
    expectBoardRequest().flush(board({ league: { ...LEAGUE, id: 'league-2' } }));
    await starting;

    expect(store.starting()).toBe(false);
    expect(store.isSeasonClosed()).toBe(false);
  });

  it('un doble clic no abre dos temporadas', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board({ canManageLeague: true }));
    await first;

    const a = store.startNextSeason('group-a', 'T2', '2099-01-01T00:00:00Z');
    const b = store.startNextSeason('group-a', 'T2', '2099-01-01T00:00:00Z');

    // Una sola petición, no dos.
    const posts = http.match((r) => r.url === `${environment.apiUrl}/groups/group-a/leagues`);
    expect(posts).toHaveLength(1);
    posts[0].flush({ ...LEAGUE, id: 'league-2' });
    await flushMicrotasks();
    expectBoardRequest().flush(board());
    await Promise.all([a, b]);
  });

  it('si abrir la temporada falla, el botón se rehabilita y el error sube a la vista', async () => {
    const first = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board({ canManageLeague: true }));
    await first;

    const starting = store.startNextSeason('group-a', 'T2', '2099-01-01T00:00:00Z');
    http
      .expectOne((r) => r.url === `${environment.apiUrl}/groups/group-a/leagues`)
      .flush({ code: 'LEAGUE_ALREADY_OPEN' }, { status: 409, statusText: 'Conflict' });

    await expect(starting).rejects.toBeDefined();
    expect(store.starting()).toBe(false);
  });

  it('clear no deja rastro de la clasificación anterior', async () => {
    const done = store.ensureLoaded('group-a');
    expectBoardRequest().flush(board());
    await done;

    store.clear();

    expect(store.status()).toBe('idle');
    expect(store.rows()).toEqual([]);
    expect(store.podium()).toEqual([]);
    expect(store.league()).toBeNull();
    expect(store.totalPlayers()).toBe(0);
  });
});
