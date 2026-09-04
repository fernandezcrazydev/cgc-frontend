import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../../../environments/environment';
import { GrupoDetalle } from './grupo-detalle';
import { Session } from '../../../core/auth';
import { GroupMembershipResponse, GroupMemberResponse } from '../../../core/groups';
import { LeaderboardResponse } from '../../../core/leagues';
import { LobbyResponse } from '../../../core/lobbies';

const GROUP_ID = 'grp-1';
const ME = 'usr-me';

const MEMBERSHIP: GroupMembershipResponse = {
  group: {
    groupId: GROUP_ID,
    name: 'Customs Tryhard',
    tag: 'CTRY',
    region: 'EUW',
    matchmakingPreset: 'BALANCED',
    avatarUrl: null,
  },
  role: 'OWNER',
  joinedAt: '2026-02-01T10:00:00Z',
};

function member(overrides: Partial<GroupMemberResponse> = {}): GroupMemberResponse {
  return {
    userId: ME,
    discordUsername: 'EduUC',
    avatarUrl: null,
    riotId: 'EduUC#EUW',
    riotStrength: 'VERIFIED',
    role: 'OWNER',
    joinedAt: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

function entry(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    userId: ME,
    discordUsername: 'EduUC',
    avatarUrl: null,
    riotId: 'EduUC#EUW',
    riotTier: 'GOLD',
    riotRank: 'II',
    riotStrength: 'VERIFIED',
    groupRole: 'OWNER',
    lp: 780,
    wins: 20,
    losses: 10,
    totalGames: 30,
    winrate: 66.6,
    streakCount: 2,
    streakType: 'WIN' as const,
    isBanned: false,
    banReason: null,
    bannedUntil: null,
    lpHistory: [400, 500, 780],
    avgLpGain: 20,
    avgLpLoss: -15,
    ...overrides,
  };
}

function lobby(signedUp: number): LobbyResponse {
  return {
    id: 'lb-1',
    groupId: GROUP_ID,
    code: 'WX4K',
    mode: 'CUSTOM_5V5' as LobbyResponse['mode'],
    status: 'POLLING',
    capacity: 10,
    note: null,
    openedBy: { userId: ME, discordUsername: 'EduUC', avatarUrl: null, joinedAt: '2026-02-01T10:00:00Z' },
    confirmedSlotId: null,
    createdAt: '2026-02-01T10:00:00Z',
    slots: [
      {
        id: 'sl-1',
        startsAt: '2099-02-01T20:00:00Z',
        signedUp,
        starters: Array.from({ length: signedUp }, (_, i) => ({
          userId: 'usr-' + i,
          discordUsername: 'Jugador ' + i,
          avatarUrl: null,
          joinedAt: '2026-02-01T10:00:00Z',
        })),
        bench: [],
      },
    ],
  };
}

describe('GrupoDetalle (hub del grupo)', () => {
  let http: HttpTestingController;

  /**
   * La carga del hub encadena dos peticiones en un `Promise.all`, así que hace falta más de un
   * turno de estabilización antes de que el store pase a `ready`.
   */
  async function settle(fixture: { whenStable: () => Promise<unknown>; detectChanges: () => void }) {
    await fixture.whenStable();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function createComponent(role: GroupMembershipResponse['role'] = 'OWNER') {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: Session,
          useValue: { user: () => ({ userId: ME, displayName: 'EduUC#EUW' }) },
        },
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
    const fixture = TestBed.createComponent(GrupoDetalle);
    fixture.detectChanges();

    // Identidad del grupo y roster. El puente pide el roster entero además de la página del
    // detalle, así que se responde a todas las peticiones que casen.
    http
      .match((r) => r.url === `${environment.apiUrl}/groups/${GROUP_ID}`)
      .forEach((r) => r.flush({ ...MEMBERSHIP, role }));
    http
      .match((r) => r.url === `${environment.apiUrl}/groups/${GROUP_ID}/members`)
      .forEach((r) => r.flush({ content: [member()], page: 0, size: 10, totalElements: 1, totalPages: 1 }));

    return { fixture, component: fixture.componentInstance };
  }

  function flushLeaderboard(rows = [entry()]) {
    const board: LeaderboardResponse = {
      league: {
        id: 'lg-1',
        groupId: GROUP_ID,
        name: 'Liga interna',
        startsAt: '2026-01-01T00:00:00Z',
        endsAt: '2099-12-31T00:00:00Z',
        status: 'IN_PROGRESS',
        type: 'COMPETITIVE',
        playerCount: rows.length,
      },
      podium: rows.slice(0, 3),
      entries: { content: rows, page: 0, size: 15, totalElements: rows.length, totalPages: 1 },
      totalPlayers: rows.length,
      canManageLeague: true,
      hasActivity: true,
    } as LeaderboardResponse;
    http
      .match((r) => r.url === `${environment.apiUrl}/groups/${GROUP_ID}/leaderboard`)
      .forEach((r) => r.flush(board));
  }

  function flushLobbies(lobbies: LobbyResponse[]) {
    http
      .match((r) => r.url === `${environment.apiUrl}/groups/${GROUP_ID}/lobbies`)
      .forEach((r) =>
        r.flush({ content: lobbies, page: 0, size: 20, totalElements: lobbies.length, totalPages: 1 }),
      );
  }

  it('no repite la identidad del grupo: la cabecera vive en la barra superior', async () => {
    const { fixture } = createComponent();
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('.group-hero')).toBeNull();
    expect(fixture.nativeElement.querySelector('.gd-hero-actions')).toBeNull();
  });

  it('ofrece el perfil del grupo entre historial y discord', async () => {
    const { component, fixture } = createComponent();
    await settle(fixture);

    const paths = component.visibleSections().map((s) => s.path);
    expect(paths).toEqual(['ranking', 'tierlist', 'estadisticas', 'historial', 'perfil', 'discord']);
  });

  it('ofrece crear partida cuando no hay ninguna sala abierta', async () => {
    const { component, fixture } = createComponent();
    flushLobbies([]);
    await settle(fixture);

    expect(component.liveLobby()).toBeNull();
  });

  it('reconoce la sala más llena de las abiertas para la tarjeta de directo', async () => {
    const { component, fixture } = createComponent();
    flushLobbies([lobby(8)]);
    await settle(fixture);

    expect(component.liveLobby()).not.toBeNull();
    expect(component.signedUp(component.liveLobby()!)).toBe(8);
  });

  it('enseña Discord solo a quien gestiona el grupo', async () => {
    const { component, fixture } = createComponent('MEMBER');
    await settle(fixture);

    expect(component.visibleSections().map((s) => s.path)).not.toContain('discord');
  });

  it('incluye Discord en las secciones del owner', async () => {
    const { component, fixture } = createComponent('OWNER');
    await settle(fixture);

    expect(component.visibleSections().map((s) => s.path)).toContain('discord');
  });

  it('arma el top 10 de la clasificación sin repetir a quien está en el podio', async () => {
    const { component, fixture } = createComponent();
    flushLeaderboard([entry(), entry({ rank: 2, userId: 'usr-2', discordUsername: 'Adri', lp: 690 })]);
    await settle(fixture);

    const top = component.topTen();
    expect(top).toHaveLength(2);
    expect(top.map((r) => r.rank)).toEqual([1, 2]);
    expect(new Set(top.map((r) => r.playerId)).size).toBe(2);
  });

  it('no inventa tu puesto mientras la clasificación no te incluye', async () => {
    const { component, fixture } = createComponent();
    flushLeaderboard([entry({ rank: 1, userId: 'usr-otro', discordUsername: 'Adri' })]);
    await settle(fixture);

    expect(component.myStanding()).toBeNull();
  });

  it('deriva tu puesto de la clasificación cuando sí apareces', async () => {
    const { component, fixture } = createComponent();
    flushLeaderboard([entry({ rank: 3, lp: 420 })]);
    await settle(fixture);

    expect(component.myStanding()?.rank).toBe(3);
    expect(component.myStanding()?.lpValue).toBe(420);
  });
});
