import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Session } from '../../../core/auth';
import { GameDataStore } from '../../../core/game-data';
import { GroupStore } from '../../../core/group-store';
import { GroupsStore } from '../../../core/groups';
import { GROUPS } from '../../../core/lobby';
import { MatchHistoryStore, buildCrossMatches } from '../../../core/matches';
import { matchFixture, participantFixture } from '../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../core/matches/models';
import { RiotAccountStore } from '../../../core/riot';
import { CrossLayout } from './cross/cross-layout';
import { CrossViewState } from './cross/cross-view-state';
import { MatchHistoryUiState } from './match-history/match-history-ui';
import { Synergy } from './synergy';
import { Versus } from './versus';

const RIVAL = 'Pix3lQueen#LAN';

function yo(): MatchParticipant {
  return participantFixture({ id: 'me', team: 'blue', riotId: 'Yo#LAN' });
}

/** Una partida enfrentados y otra juntos, para poder afirmar que cada vista mira su lado. */
function historial(): Match[] {
  const contra = participantFixture({ id: 'e1', team: 'red', riotId: RIVAL });
  const con = participantFixture({ id: 'e2', team: 'blue', riotId: RIVAL });
  return [
    matchFixture({ id: 'enfrentados', blue: [yo()], red: [contra], userParticipant: yo() }),
    matchFixture({ id: 'juntos', blue: [yo(), con], red: [], userParticipant: yo() }),
  ];
}

function providers(
  matches: Match[],
  playerId: string,
  gameDataStatus: 'ready' | 'loading' | 'error',
  historyStatus: 'ready' | 'loading' = 'ready',
) {
  const groupStore = new GroupStore();
  return [
    provideRouter([]),
    CrossViewState,
    MatchHistoryUiState,
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: { paramMap: { get: () => playerId } },
        paramMap: of({ get: () => playerId }),
      },
    },
    {
      provide: GroupStore,
      useValue: { groups: signal(GROUPS), rosterOf: (id: string) => groupStore.rosterOf(id) },
    },
    {
      provide: GroupsStore,
      useValue: { groups: signal([]), status: signal('ready'), ensureLoaded: () => {} },
    },
    {
      provide: GameDataStore,
      useValue: {
        status: signal(gameDataStatus),
        championById: signal(new Map()),
        ensureLoaded: () => {},
        reload: () => {},
      },
    },
    {
      provide: MatchHistoryStore,
      useValue: {
        status: signal(historyStatus),
        allPersonalMatches: signal(matches),
        crossWith: (key: string) => {
          const all = buildCrossMatches(matches, key);
          return {
            all,
            allies: all.filter((c) => c.relation === 'ally'),
            enemies: all.filter((c) => c.relation === 'enemy'),
          };
        },
      },
    },
    {
      provide: Session,
      useValue: { displayName: signal('Yo'), avatarUrl: signal(''), status: signal('ready'), user: signal(null) },
    },
    {
      provide: RiotAccountStore,
      useValue: { account: signal(null), status: signal('idle') },
    },
  ];
}

async function montar<T>(
  cmp: new (...args: never[]) => T,
  opciones: {
    matches?: Match[];
    playerId?: string;
    gameData?: 'ready' | 'loading' | 'error';
    history?: 'ready' | 'loading';
  } = {},
): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [cmp as never],
    providers: providers(
      opciones.matches ?? historial(),
      opciones.playerId ?? RIVAL,
      opciones.gameData ?? 'ready',
      opciones.history ?? 'ready',
    ),
  }).compileComponents();

  const fixture = TestBed.createComponent(cmp as never);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CrossLayout', () => {
  it('renderiza la cabecera compartida cuando el jugador existe', async () => {
    const el = await montar(CrossLayout);

    expect(el.querySelector('app-cross-header')).not.toBeNull();
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });

  it('un jugador que no existe es 404, con salida a grupos', async () => {
    const el = await montar(CrossLayout, { playerId: 'NoExiste#EUW', matches: [] });

    expect(el.textContent).toContain('Jugador no encontrado');
    expect(el.querySelector('app-cross-header')).toBeNull();
  });

  it('un fallo de red es un error con reintentar, no un 404', async () => {
    const el = await montar(CrossLayout, { gameData: 'error' });

    expect(el.textContent).toContain('No se ha podido cargar');
    expect(el.textContent).not.toContain('Jugador no encontrado');
    expect(el.querySelector('button')?.textContent).toContain('Reintentar');
  });

  it('mientras el historial se reproyecta enseña esqueleto, no un 404', async () => {
    const el = await montar(CrossLayout, { history: 'loading' });

    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });
});

describe('Versus', () => {
  it('enseña el panel de métricas Head-to-Head y el balance de duelos con anillo de winrate', async () => {
    const el = await montar(Versus);

    expect(el.textContent).toContain('Balance 1v1');
    expect(el.querySelector('.vs-ring')).not.toBeNull();
    expect(el.querySelector('.vs-panel')).not.toBeNull();
  });

  it('existir sin haberos enfrentado es un estado vacío', async () => {
    const el = await montar(Versus, { matches: [historial()[1]] });

    expect(el.textContent).toContain('Sin enfrentamientos directos');
  });
});

describe('Synergy', () => {
  it('enseña la insignia de Tier de química y las partidas juntos', async () => {
    const el = await montar(Synergy);

    expect(el.textContent).toContain('Tier');
    expect(el.querySelector('.syn-ring')).not.toBeNull();
    expect(el.querySelector('.syn-panel')).not.toBeNull();
  });

  it('existir sin haber jugado juntos es un estado vacío', async () => {
    const el = await montar(Synergy, { matches: [historial()[0]] });

    expect(el.textContent).toContain('Sin partidas juntos');
  });
});
