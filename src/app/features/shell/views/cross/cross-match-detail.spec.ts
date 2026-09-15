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
  fakeMatchHistoryStore,
  matchFixture,
  participantFixture,
} from '../../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../../core/matches/models';
import { CrossMatchDetail } from './cross-match-detail';
import { CrossViewState } from './cross-view-state';
import { MatchHistoryUiState } from '../match-history/match-history-ui';

const ME = 'me-uuid';
const RIVAL = 'rival-uuid';

function yo(): MatchParticipant {
  return participantFixture({ userId: ME, slot: 'A', riotId: 'Yo#LAN' });
}

/** Una partida contra el rival (`enemy`) y otra con él en tu equipo (`ally`). */
const enfrentados = () =>
  matchFixture({
    id: 'enfrentados',
    a: [yo()],
    b: [participantFixture({ userId: RIVAL, slot: 'B', riotId: 'Rival#LAN' })],
    userParticipant: yo(),
  });

const juntos = () =>
  matchFixture({
    id: 'juntos',
    a: [yo(), participantFixture({ userId: RIVAL, slot: 'A', riotId: 'Rival#LAN' })],
    b: [],
    userParticipant: yo(),
  });

/**
 * La decisión más delicada de la vista: la ruta declara de qué lado espera encontraros
 * (`data.relation`) y, si la partida no lo cumple, responde 404 en vez de etiquetarla mal.
 * Abrir una partida de aliados bajo `/contra/` pintaría un «duelo directo» que nunca ocurrió.
 */
describe('CrossMatchDetail · la relación de la ruta manda', () => {
  async function montar(
    matchId: string,
    relation: 'ally' | 'enemy',
    opciones: {
      detail?: Match | null;
      detailStatus?: 'loading' | 'ready' | 'error';
      notFound?: boolean;
    } = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [CrossMatchDetail],
      providers: [
        provideRouter([]),
        CrossViewState,
        MatchHistoryUiState,
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
          provide: GroupsStore,
          useValue: { groups: signal([]), status: signal('ready'), ensureLoaded: () => {} },
        },
        { provide: GroupDetailStore, useValue: { roster: signal([]) } },
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
            personal: opciones.detail ? [opciones.detail] : [],
            detail: opciones.detail ?? null,
            detailStatus: opciones.detailStatus ?? (opciones.detail ? 'ready' : 'error'),
            detailNotFound: opciones.notFound ?? !opciones.detail,
          }),
        },
        {
          provide: Session,
          useValue: { displayName: signal('Yo'), status: signal('ready'), user: signal({ userId: ME }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CrossMatchDetail);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('abre la partida cuando la relación coincide con la que declara la ruta', async () => {
    const el = await montar('enfrentados', 'enemy', { detail: enfrentados() });

    expect(el.textContent).toContain('Comparativa de la partida');
    expect(el.textContent).not.toContain('Ese cruce no existe');
  });

  it('una partida de aliados abierta bajo «contra» responde 404, no la etiqueta mal', async () => {
    const el = await montar('juntos', 'enemy', { detail: juntos() });

    expect(el.textContent).toContain('Ese cruce no existe');
  });

  it('y al revés: una partida de rivales abierta bajo «juntos» también es 404', async () => {
    const el = await montar('enfrentados', 'ally', { detail: enfrentados() });

    expect(el.textContent).toContain('Ese cruce no existe');
  });

  it('una partida que no existe es 404', async () => {
    const el = await montar('no-existe', 'enemy', { detail: null, notFound: true });

    expect(el.textContent).toContain('Ese cruce no existe');
  });

  /** Un fallo de red tiene su propia pantalla, con reintento: no se pinta como un 404. */
  it('un fallo de red se pinta como error con reintentar, no como 404', async () => {
    const el = await montar('enfrentados', 'enemy', {
      detail: null,
      detailStatus: 'error',
      notFound: false,
    });

    expect(el.textContent).toContain('No se ha podido cargar');
    expect(el.textContent).toContain('Reintentar');
    expect(el.textContent).not.toContain('Ese cruce no existe');
  });
});
