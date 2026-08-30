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

/**
 * `versus.ts` y `synergy.ts` no tenían ninguna prueba, y son las dos que responden 404 cuando
 * el jugador de la URL no existe. Lo que se afirma aquí son sus cuatro estados, no su aspecto.
 */
function providers(
  matches: Match[],
  playerId: string,
  gameDataStatus: 'ready' | 'loading' | 'error',
  historyStatus: 'ready' | 'loading' = 'ready',
) {
  const groupStore = new GroupStore();
  return [
    provideRouter([]),
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
      useValue: { displayName: signal('Yo'), status: signal('ready'), user: signal(null) },
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

describe('Versus', () => {
  it('enseña las medias contra ese jugador', async () => {
    const el = await montar(Versus);

    expect(el.querySelector('app-cross-header')).not.toBeNull();
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });

  it('un jugador que no existe es 404, con salida al perfil', async () => {
    const el = await montar(Versus, { playerId: 'NoExiste#EUW', matches: [] });

    expect(el.textContent).toContain('Jugador no encontrado');
    expect(el.querySelector('app-cross-stats')).toBeNull();
  });

  /*
   * Con el catálogo en error, `loading()` valía false y la cascada caía en el 404: un fallo de
   * red se leía como «jugador no encontrado», sin forma de reintentar.
   */
  it('un fallo de red es un error con reintentar, no un 404', async () => {
    const el = await montar(Versus, { gameData: 'error' });

    expect(el.textContent).toContain('No se ha podido cargar');
    expect(el.textContent).not.toContain('Jugador no encontrado');
    expect(el.querySelector('button')?.textContent).toContain('Reintentar');
  });

  it('mientras el historial se reproyecta enseña esqueleto, no un 404 ni un vacío', async () => {
    const el = await montar(Versus, { history: 'loading' });

    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Jugador no encontrado');
    expect(el.textContent).not.toContain('Nunca os habéis enfrentado');
  });

  it('existir sin haberos enfrentado es un estado vacío, no un 404', async () => {
    // Solo comparten la partida en la que jugaron juntos: en contra no hay ninguna.
    const el = await montar(Versus, { matches: [historial()[1]] });

    expect(el.textContent).toContain('Nunca os habéis enfrentado');
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });
});

describe('Synergy', () => {
  it('mira el otro lado del cruce que Versus', async () => {
    const el = await montar(Synergy);

    expect(el.querySelector('app-cross-header')).not.toBeNull();
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });

  it('un jugador que no existe también es 404 aquí', async () => {
    const el = await montar(Synergy, { playerId: 'NoExiste#EUW', matches: [] });

    expect(el.textContent).toContain('Jugador no encontrado');
  });

  it('existir sin haber jugado juntos es un estado vacío, no un 404', async () => {
    // Solo comparten la partida en la que se enfrentaron: juntos no hay ninguna.
    const el = await montar(Synergy, { matches: [historial()[0]] });

    expect(el.textContent).toContain('Nunca habéis jugado juntos');
    expect(el.textContent).not.toContain('Jugador no encontrado');
  });
});
