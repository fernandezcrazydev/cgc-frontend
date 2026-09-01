import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Session } from '../../../../core/auth';
import { GameDataStore } from '../../../../core/game-data';
import { GroupStore } from '../../../../core/group-store';
import { GroupsStore } from '../../../../core/groups';
import { GROUPS } from '../../../../core/lobby';
import { MatchHistoryStore, buildCrossMatches } from '../../../../core/matches';
import { matchFixture, participantFixture } from '../../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../../core/matches/models';
import { CrossMatchDetail } from './cross-match-detail';
import { CrossViewState } from './cross-view-state';

const RIVAL = 'Pix3lQueen#LAN';

function yo(): MatchParticipant {
  return participantFixture({ id: 'me', team: 'blue', riotId: 'Yo#LAN' });
}

/** Una partida contra el rival (`enemy`) y otra con él en tu equipo (`ally`). */
function historial(): Match[] {
  const contra = participantFixture({ id: 'ellos-1', team: 'red', riotId: RIVAL });
  const con = participantFixture({ id: 'ellos-2', team: 'blue', riotId: RIVAL });
  return [
    matchFixture({ id: 'enfrentados', blue: [yo()], red: [contra], userParticipant: yo() }),
    matchFixture({ id: 'juntos', blue: [yo(), con], red: [], userParticipant: yo() }),
  ];
}

/**
 * La decisión más delicada de la vista: la ruta declara de qué lado espera encontraros
 * (`data.relation`) y, si la partida no lo cumple, responde 404 en vez de etiquetarla mal.
 * Abrir una partida de aliados bajo `/versus/` pintaría un «duelo directo» que nunca ocurrió.
 */
describe('CrossMatchDetail · la relación de la ruta manda', () => {
  async function montar(
    matchId: string,
    relation: 'ally' | 'enemy',
    gameDataStatus: 'ready' | 'error' = 'ready',
  ) {
    const groupStore = new GroupStore();
    const matches = historial();

    await TestBed.configureTestingModule({
      imports: [CrossMatchDetail],
      providers: [
        provideRouter([]),
        CrossViewState,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: (k: string) => (k === 'matchId' ? matchId : RIVAL) },
              data: { relation },
            },
            paramMap: of({ get: (k: string) => (k === 'matchId' ? matchId : RIVAL) }),
            data: of({ relation }),
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
            status: signal('ready'),
            allPersonalMatches: signal(matches),
            crossWith: (key: string) => {
              const all = buildCrossMatches(matches, key);
              return {
                all,
                allies: all.filter((c) => c.relation === 'ally'),
                enemies: all.filter((c) => c.relation === 'enemy'),
              };
            },
            neighboursOf: () => ({ prev: null, next: null }),
          },
        },
        {
          provide: Session,
          useValue: { displayName: signal('Yo'), status: signal('ready'), user: signal(null) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CrossMatchDetail);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('abre la partida cuando la relación coincide con la que declara la ruta', async () => {
    const el = await montar('enfrentados', 'enemy');

    expect(el.textContent).not.toContain('Ese cruce no existe');
    expect(el.querySelector('.cx-detail__eyebrow')).not.toBeNull();
  });

  it('una partida de aliados abierta bajo versus responde 404, no la etiqueta mal', async () => {
    const el = await montar('juntos', 'enemy');

    expect(el.textContent).toContain('Ese cruce no existe');
    expect(el.textContent).toContain('no es un enfrentamiento entre vosotros dos');
  });

  it('y al revés: una partida de rivales abierta bajo synergy también es 404', async () => {
    const el = await montar('enfrentados', 'ally');

    expect(el.textContent).toContain('Ese cruce no existe');
    expect(el.textContent).toContain('no la jugasteis en el mismo equipo');
  });

  it('una partida que no existe es 404', async () => {
    expect((await montar('no-existe', 'enemy')).textContent).toContain('Ese cruce no existe');
  });

  it('un fallo de red se pinta como error con reintentar, no como 404', async () => {
    const el = await montar('enfrentados', 'enemy', 'error');

    expect(el.textContent).toContain('No se ha podido cargar');
    expect(el.textContent).not.toContain('Ese cruce no existe');
  });
});
