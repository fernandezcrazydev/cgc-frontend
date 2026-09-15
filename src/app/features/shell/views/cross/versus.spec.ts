import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Session } from '../../../../core/auth';
import { GameDataStore } from '../../../../core/game-data';
import { GroupDetailStore, GroupsStore } from '../../../../core/groups';
import { MatchHistoryStore } from '../../../../core/matches';
import {
  FakeMatchHistoryOptions,
  fakeMatchHistoryStore,
  matchFixture,
  participantFixture,
} from '../../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../../core/matches/models';
import { RiotAccountStore } from '../../../../core/riot';
import { CrossLayout } from './cross-layout';
import { CrossViewState } from './cross-view-state';
import { MatchHistoryUiState } from '../match-history/match-history-ui';
import { Synergy } from './synergy';
import { Versus } from './versus';

const ME = 'me-uuid';
const RIVAL = 'rival-uuid';

function yo(): MatchParticipant {
  return participantFixture({ userId: ME, slot: 'A', riotId: 'Yo#LAN' });
}

/** Una partida enfrentados y otra juntos, para poder afirmar que cada vista mira su lado. */
function historial(): Match[] {
  const contra = participantFixture({ userId: RIVAL, slot: 'B', riotId: 'Pix3lQueen#LAN' });
  const con = participantFixture({ userId: RIVAL, slot: 'A', riotId: 'Pix3lQueen#LAN' });
  return [
    matchFixture({ id: 'enfrentados', a: [yo()], b: [contra], userParticipant: yo() }),
    matchFixture({ id: 'juntos', a: [yo(), con], b: [], userParticipant: yo() }),
  ];
}

interface Opciones {
  matches?: Match[];
  playerId?: string;
  gameData?: 'ready' | 'loading' | 'error';
  history?: FakeMatchHistoryOptions['personalStatus'];
  summaries?: FakeMatchHistoryOptions['summaries'];
}

function providers(o: Required<Pick<Opciones, 'matches' | 'playerId' | 'gameData'>> & Opciones) {
  return [
    provideRouter([]),
    CrossViewState,
    MatchHistoryUiState,
    {
      provide: ActivatedRoute,
      useValue: {
        snapshot: { paramMap: { get: () => o.playerId } },
        paramMap: of({ get: () => o.playerId }),
      },
    },
    {
      provide: GroupsStore,
      useValue: { groups: signal([]), status: signal('ready'), ensureLoaded: () => {} },
    },
    { provide: GroupDetailStore, useValue: { roster: signal([]) } },
    {
      provide: GameDataStore,
      useValue: {
        status: signal(o.gameData),
        championById: signal(new Map()),
        ensureLoaded: () => {},
        reload: () => {},
      },
    },
    {
      provide: MatchHistoryStore,
      useValue: fakeMatchHistoryStore({
        personal: o.matches,
        personalStatus: o.history ?? 'ready',
        summaries: o.summaries ?? {
          all: { totalMatches: 2 },
          ally: { totalMatches: 1, wins: 1, losses: 0 },
          enemy: { totalMatches: 1, wins: 1, losses: 0 },
        },
      }),
    },
    {
      provide: Session,
      useValue: {
        displayName: signal('Yo'),
        avatarUrl: signal(''),
        status: signal('ready'),
        user: signal({ userId: ME }),
      },
    },
    { provide: RiotAccountStore, useValue: { account: signal(null), status: signal('idle') } },
  ];
}

async function montar<T>(cmp: new (...args: never[]) => T, o: Opciones = {}): Promise<HTMLElement> {
  await TestBed.configureTestingModule({
    imports: [cmp as never],
    providers: providers({
      matches: o.matches ?? historial(),
      playerId: o.playerId ?? RIVAL,
      gameData: o.gameData ?? 'ready',
      history: o.history,
      summaries: o.summaries,
    }),
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
    const el = await montar(CrossLayout, { playerId: 'no-existe', matches: [] });

    expect(el.textContent).toContain('Jugador no encontrado');
    expect(el.querySelector('app-cross-header')).toBeNull();
  });

  /*
   * Con el catálogo en error, `loading()` valía false y la cascada caía en su última rama, que
   * es el 404: un fallo de red se pintaba como «jugador no encontrado», sin reintentar.
   */
  it('un fallo de red es un error con reintentar, no un 404', async () => {
    const el = await montar(CrossLayout, { gameData: 'error' });

    expect(el.textContent).toContain('No se ha podido cargar');
    expect(el.textContent).toContain('Reintentar');
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });

  it('mientras el cruce viaja enseña esqueleto, no un 404', async () => {
    const el = await montar(CrossLayout, { history: 'loading' });

    expect(el.querySelector('.cx-boot')).not.toBeNull();
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });
});

describe('Versus', () => {
  it('enseña el balance de duelos con su anillo de winrate y la lista', async () => {
    const el = await montar(Versus, {
      summaries: { enemy: { totalMatches: 4, wins: 3, losses: 1 } },
    });

    expect(el.querySelector('.vs-ring')).not.toBeNull();
    expect(el.textContent).toContain('75%');
    expect(el.textContent).toContain('3V');
    expect(el.querySelector('app-cross-match-card')).not.toBeNull();
  });

  /** Existir sin haberos enfrentado no es un error ni un 404: es un estado vacío con su texto. */
  it('existir sin haberos enfrentado es un estado vacío', async () => {
    const el = await montar(Versus, { summaries: { enemy: { totalMatches: 0 } }, matches: [] });

    expect(el.textContent).toContain('Sin enfrentamientos directos');
    expect(el.querySelector('.vs-ring')).toBeNull();
  });
});

describe('Synergy', () => {
  it('enseña el balance de dúo y las partidas juntos', async () => {
    const el = await montar(Synergy, {
      summaries: { ally: { totalMatches: 5, wins: 2, losses: 3 } },
    });

    expect(el.querySelector('.syn-ring')).not.toBeNull();
    expect(el.textContent).toContain('40%');
    expect(el.querySelector('app-cross-match-card')).not.toBeNull();
  });

  it('existir sin haber jugado juntos es un estado vacío', async () => {
    const el = await montar(Synergy, { summaries: { ally: { totalMatches: 0 } }, matches: [] });

    expect(el.textContent).toContain('Sin partidas juntos');
    expect(el.querySelector('.syn-ring')).toBeNull();
  });
});
