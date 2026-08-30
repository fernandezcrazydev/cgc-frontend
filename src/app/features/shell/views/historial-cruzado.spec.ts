import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Session } from '../../../core/auth';
import { GameDataStore } from '../../../core/game-data';
import { GroupStore } from '../../../core/group-store';
import { GroupsStore } from '../../../core/groups';
import { CURRENT_USER, GROUPS } from '../../../core/lobby';
import { MatchHistoryStore, buildCrossMatches } from '../../../core/matches';
import { matchFixture, participantFixture as participant } from '../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../core/matches/models';
import { Viewport } from '../../../shared/viewport';
import { HistorialCruzado } from './historial-cruzado';

const RIVAL = 'Pix3lQueen#LAN';

/**
 * El historial que ve la vista se inyecta a mano.
 *
 * El spec anterior usaba el `MatchHistoryStore` real, y por eso no detectó que la vista, al no
 * encontrar partidas compartidas, devolvía seis partidas cualesquiera del usuario: con la
 * semilla siempre había algo que pintar. Con partidas controladas, el caso «no habéis
 * coincidido» se puede afirmar.
 */
function match(id: string, blue: MatchParticipant[], red: MatchParticipant[], user: MatchParticipant): Match {
  return matchFixture({
    id,
    groupId: GROUPS[0].id,
    groupName: GROUPS[0].name,
    blue,
    red,
    userParticipant: user,
  });
}

const yo = () => participant({ id: 'me', team: 'blue', riotId: CURRENT_USER.tag });

/** Una jugada como compañeros y otra como rivales contra el mismo jugador. */
function historialConCruce(): Match[] {
  const juntos = match(
    'm-juntos',
    [yo(), participant({ id: 'ally', team: 'blue', riotId: RIVAL })],
    [participant({ id: 'x', team: 'red' })],
    yo(),
  );
  const enfrentados = match(
    'm-contra',
    [yo()],
    [participant({ id: 'foe', team: 'red', riotId: RIVAL })],
    yo(),
  );
  return [juntos, enfrentados];
}

/** Una partida del usuario en la que el otro jugador no estaba. */
function historialSinCruce(): Match[] {
  return [
    match('m-sola', [yo()], [participant({ id: 'x', team: 'red', riotId: 'Otro#LAN' })], yo()),
  ];
}

describe('HistorialCruzado', () => {
  async function montar(
    matches: Match[],
    queryModo: string | null = null,
    // Estado del catálogo de campeones: es lo único de esta pantalla que puede fallar de red.
    gameDataStatus: 'ready' | 'loading' | 'error' = 'ready',
  ) {
    const groupStore = new GroupStore();

    await TestBed.configureTestingModule({
      imports: [HistorialCruzado],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => RIVAL },
              queryParamMap: { get: (k: string) => (k === 'modo' ? queryModo : null) },
            },
            paramMap: of({ get: () => RIVAL }),
            queryParamMap: of({ get: (k: string) => (k === 'modo' ? queryModo : null) }),
          },
        },
        {
          provide: GroupStore,
          useValue: { groups: signal(GROUPS), rosterOf: (id: string) => groupStore.rosterOf(id) },
        },
        // Explícito y no el real: el umbral de móvil decide si la fila del acordeón es el
        // control o lo es su botón, y dejarlo al valor por defecto haría que estas pruebas
        // cambiasen de rama sin avisar el día que ese umbral se mueva.
        { provide: Viewport, useValue: { isMobile: signal(false), isNarrow: signal(false) } },
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
          },
        },
        {
          provide: MatchHistoryStore,
          useValue: {
            status: signal('ready'),
            allPersonalMatches: signal(matches),
            playedChampionIdsInPersonal: () => [1],
            playedChampionIdsInGroup: () => [1],
            matchesByGroup: () => matches,
            // La derivación es la real: lo que el doble sustituye son las partidas, no la
            // lógica que las cruza. Probar la vista contra un cruce inventado no probaría nada.
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
          useValue: {
            displayName: signal('User'),
            status: signal('ready'),
            user: signal({ ...CURRENT_USER, id: 'u1' }),
            activeProfile: signal(null),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HistorialCruzado);
    fixture.detectChanges();
    return {
      fixture,
      el: fixture.nativeElement as HTMLElement,
      detect: () => fixture.detectChanges(),
    };
  }

  it('pinta la cabecera del cruce con el jugador de la ruta', async () => {
    const { el } = await montar(historialConCruce());

    expect(el.querySelector('.cx-hero__title')?.textContent).toContain('Pix3lQueen');
    expect(el.querySelectorAll('app-cross-match-card').length).toBe(2);
  });

  it('sin partidas en común enseña el estado vacío, no partidas prestadas', async () => {
    const { el } = await montar(historialSinCruce());

    expect(el.querySelectorAll('app-cross-match-card').length).toBe(0);
    expect(el.querySelector('.empty-state__text')?.textContent).toContain(
      'Todavía no habéis coincidido',
    );
  });

  it('el enlace profundo ?modo=versus deja solo los enfrentamientos', async () => {
    const { el } = await montar(historialConCruce(), 'versus');

    const cards = el.querySelectorAll('app-cross-match-card');
    expect(cards.length).toBe(1);
    expect(el.textContent).toContain('En contra');
  });

  it('el enlace profundo ?modo=synergy deja solo las partidas juntos', async () => {
    const { el } = await montar(historialConCruce(), 'synergy');

    expect(el.querySelectorAll('app-cross-match-card').length).toBe(1);
    expect(el.textContent).toContain('Juntos');
  });

  /*
   * Con el catálogo de campeones en error, `loading()` valía false y la cascada de la plantilla
   * caía en su última rama: el 404. Un fallo de red se leía como «jugador no encontrado», sin
   * forma de reintentar y sin distinguirlo de un enlace roto.
   */
  it('un fallo de red se pinta como error con reintentar, no como un 404', async () => {
    const { el } = await montar(historialConCruce(), null, 'error');

    expect(el.textContent).toContain('No se ha podido cargar');
    expect(el.textContent).not.toContain('Jugador no encontrado');
    expect(el.querySelector('button')?.textContent).toContain('Reintentar');
  });

  it('mientras el catálogo viaja se enseña esqueleto, no un 404 ni un vacío', async () => {
    const { el } = await montar(historialConCruce(), null, 'loading');

    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Jugador no encontrado');
    expect(el.textContent).not.toContain('Todavía no habéis coincidido');
  });
});
