import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Session } from '../../../../core/auth';
import { GameDataStore } from '../../../../core/game-data';
import { GroupDetailStore, GroupsStore } from '../../../../core/groups';
import { LeaguesStore } from '../../../../core/leagues';
import { MatchHistoryStore } from '../../../../core/matches';
import {
  fakeMatchHistoryStore,
  matchFixture,
  participantFixture as participant,
} from '../../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../../core/matches/models';
import { Viewport } from '../../../../shared/viewport';
import { CrossViewState } from './cross-view-state';
import { MatchHistoryUiState } from '../match-history/match-history-ui';
import { HistorialCruzado } from './historial-cruzado';

const ME = 'me-uuid';
const RIVAL = 'rival-uuid';

const yo = () => participant({ userId: ME, slot: 'A', riotId: 'Yo#LAN' });

/** Una jugada como compañeros y otra como rivales contra el mismo jugador. */
function historialConCruce(): Match[] {
  return [
    matchFixture({
      id: 'm-juntos',
      a: [yo(), participant({ userId: RIVAL, slot: 'A', riotId: 'Rival#LAN' })],
      b: [participant({ userId: 'x', slot: 'B' })],
      userParticipant: yo(),
    }),
    matchFixture({
      id: 'm-contra',
      a: [yo()],
      b: [participant({ userId: RIVAL, slot: 'B', riotId: 'Rival#LAN' })],
      userParticipant: yo(),
    }),
  ];
}

describe('HistorialCruzado', () => {
  async function montar(matches: Match[], total = matches.length): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [HistorialCruzado],
      providers: [
        provideRouter([]),
        CrossViewState,
        MatchHistoryUiState,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => RIVAL }, queryParamMap: { get: () => null } },
            paramMap: of({ get: () => RIVAL }),
          },
        },
        {
          provide: GroupsStore,
          useValue: { groups: signal([]), status: signal('ready'), ensureLoaded: () => {} },
        },
        { provide: GroupDetailStore, useValue: { roster: signal([]) } },
        { provide: LeaguesStore, useValue: { seasons: signal([]), loadSeasons: () => {} } },
        {
          provide: GameDataStore,
          useValue: {
            status: signal('ready'),
            championById: signal(new Map()),
            ensureLoaded: () => {},
            reload: () => {},
          },
        },
        {
          provide: MatchHistoryStore,
          useValue: fakeMatchHistoryStore({
            personal: matches,
            personalTotal: total,
            summaries: { all: { totalMatches: total } },
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
        { provide: Viewport, useValue: { isMobile: signal(false) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HistorialCruzado);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta la lista de partidas cruzadas con sus tarjetas', async () => {
    const el = await montar(historialConCruce());

    expect(el.querySelectorAll('app-cross-match-card')).toHaveLength(2);
    expect(el.textContent).not.toContain('Todavía no habéis coincidido');
  });

  /*
   * Sin partidas en común la lista es vacía, y eso ES la respuesta. La versión anterior
   * devolvía seis partidas cualesquiera del usuario y las presentaba como enfrentamientos.
   */
  it('sin partidas en común enseña el estado vacío, no partidas prestadas', async () => {
    const el = await montar([], 0);

    expect(el.querySelectorAll('app-cross-match-card')).toHaveLength(0);
    expect(el.textContent).toContain('Todavía no habéis coincidido');
  });

  /*
   * El total lo dice el servidor, no la longitud de la página: el paginador tiene que ofrecer
   * las páginas que existen, no las que caben en lo que hay cargado.
   */
  it('el paginador usa el total del servidor, no el tamaño de la página', async () => {
    const el = await montar(historialConCruce(), 37);

    const pager = el.querySelector('nf-pagination');
    expect(pager).not.toBeNull();
    expect(el.textContent).toContain('37');
  });
});
