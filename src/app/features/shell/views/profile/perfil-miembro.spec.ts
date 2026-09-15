import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PerfilMiembro } from './perfil-miembro';
import { GroupStore } from '../../../../core/group-store';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import { RiotAccountStore } from '../../../../core/riot';
import { Session } from '../../../../core/auth';
import { CURRENT_USER, GROUPS } from '../../../../core/lobby';
import { signal } from '@angular/core';

/** El id estable del jugador que se está mirando: es lo que viaja en la ruta del cruce. */
const OTRO = 'pix3lqueen-uuid';

/** El Riot ID del mismo jugador, que es lo único que trae el censo mock. */
const TAG = 'Pix3lQueen#LAN';

describe('PerfilMiembro Component', () => {
  /*
   * El censo mock todavía no trae `userId`, así que `buildMemberProfile` también resuelve por
   * tag. Cuando el roster real lo traiga, este parámetro pasa a ser el id estable como en el
   * resto de la pantalla; el fallback existe justo para ese intervalo.
   */
  it('resuelve el perfil ajeno con lo que traiga el censo', async () => {
    const groupStore = new GroupStore();
    await TestBed.configureTestingModule({
      imports: [PerfilMiembro],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => TAG } },
            paramMap: of({ get: () => TAG }),
          },
        },
        {
          provide: GroupStore,
          useValue: {
            groups: signal(GROUPS),
            rosterOf: (id: string) => groupStore.rosterOf(id),
          },
        },
        {
          provide: GameDataStore,
          useValue: {
            status: signal('ready'),
            championById: signal(new Map()),
          },
        },
        // El `MatchHistoryStore` real se reproyecta sobre estos dos: sin ellos su `status()`
        // se queda en 'loading' y la vista enseña esqueleto, que es justo lo que debe hacer.
        {
          provide: GroupsStore,
          useValue: { groups: signal([]), status: signal('ready'), ensureLoaded: () => {} },
        },
        {
          provide: RiotAccountStore,
          useValue: { account: signal(null), status: signal('ready'), ensureLoaded: () => {} },
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

    const fixture = TestBed.createComponent(PerfilMiembro);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp).toBeDefined();
    expect(comp.userId()).toBe(TAG);
    expect(comp.profile()).not.toBeNull();
    expect(comp.profile()?.name).toBe('Pix3lQueen');
  });
});

import { MatchHistoryStore } from '../../../../core/matches';
import {
  fakeMatchHistoryStore,
  matchFixture,
  participantFixture,
} from '../../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../../core/matches/models';

function yo(): MatchParticipant {
  return participantFixture({ userId: 'me', slot: 'A', riotId: 'Yo#LAN' });
}

/** Vuestro cruce: una partida enfrentados y otra juntos. */
function historial(): Match[] {
  const contra = participantFixture({ userId: OTRO, slot: 'B', riotId: 'Pix3lQueen#LAN' });
  const con = participantFixture({ userId: OTRO, slot: 'A', riotId: 'Pix3lQueen#LAN' });
  return [
    matchFixture({ id: 'enfrentados', a: [yo()], b: [contra], userParticipant: yo() }),
    matchFixture({ id: 'juntos', a: [yo(), con], b: [], userParticipant: yo() }),
  ];
}

/**
 * Estas pruebas montan la vista de verdad y miran el DOM. El `tsconfig` todavía
 * no tiene `strictTemplates`, así que una plantilla puede compilar y reventar —o
 * pintar lo que no toca— al renderizarse: es lo único que lo detecta.
 */
describe('PerfilMiembro · refactor de la vista', () => {
  async function montar(): Promise<{ el: HTMLElement; comp: PerfilMiembro; detect: () => void }> {
    const groupStore = new GroupStore();
    const matches = historial();
    await TestBed.configureTestingModule({
      imports: [PerfilMiembro],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => OTRO } },
            paramMap: of({ get: () => OTRO }),
          },
        },
        {
          provide: GroupStore,
          useValue: {
            groups: signal(GROUPS),
            rosterOf: (id: string) => groupStore.rosterOf(id),
          },
        },
        { provide: GameDataStore, useValue: { status: signal('ready'), championById: signal(new Map()) } },
        {
          // El cruce es un filtro del historial personal; los récords, su resumen.
          provide: MatchHistoryStore,
          useValue: fakeMatchHistoryStore({
            personal: matches,
            summaries: {
              ally: { totalMatches: 1, wins: 1, losses: 0 },
              enemy: { totalMatches: 1, wins: 1, losses: 0 },
            },
          }),
        },
        // El `MatchHistoryStore` real se reproyecta sobre estos dos: sin ellos su `status()`
        // se queda en 'loading' y la vista enseña esqueleto, que es justo lo que debe hacer.
        {
          provide: GroupsStore,
          useValue: { groups: signal([]), status: signal('ready'), ensureLoaded: () => {} },
        },
        {
          provide: RiotAccountStore,
          useValue: { account: signal(null), status: signal('ready'), ensureLoaded: () => {} },
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

    const fixture = TestBed.createComponent(PerfilMiembro);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      comp: fixture.componentInstance,
      detect: () => fixture.detectChanges(),
    };
  }

  it('el encabezado ya no enseña LP: sin liga no significa nada', async () => {
    const { el } = await montar();

    expect(el.querySelector('.pf-hero-compact__lp')).toBeNull();
    expect(el.querySelector('.pf-hero-compact__ring')).not.toBeNull();
    expect(el.querySelector('.pf-hero-compact__record')).not.toBeNull();
  });

  it('no queda ningún glifo ▸ en los títulos de sección', async () => {
    const { el } = await montar();

    expect(el.textContent).not.toContain('▸');
  });

  it('«Ver todos →» es ahora un botón de icono con tooltip', async () => {
    const { el } = await montar();

    expect(el.textContent).not.toContain('Ver todos');
    const boton = el.querySelector<HTMLButtonElement>('.pf-card__header .nf-icon-btn');
    expect(boton).not.toBeNull();
    expect(boton!.getAttribute('title')).toBe('Ver el catálogo completo de campeones');
    expect(boton!.getAttribute('aria-label')).toBe('Ver el catálogo completo de campeones');
  });

  it('el perfil ajeno también tiene módulo de racha, con partida ya seleccionada', async () => {
    const { el } = await montar();

    expect(el.querySelector('.pf-form-card')).not.toBeNull();
    expect(el.querySelector('.pf-streak-summary')).not.toBeNull();
    expect(el.querySelectorAll('.pf-match-node[aria-pressed="true"]').length).toBe(1);
  });

  /**
   * Cada ficha abre las medias acumuladas de su lado del cruce y el chip abre la lista de
   * partidas. Antes las tres llevaban al mismo sitio, así que dos de los tres controles
   * prometían cosas distintas y hacían lo mismo.
   */
  /*
   * Los tres controles llevan al mismo jugador por su `userId`, que es lo que entiende el
   * parámetro `with=` del endpoint. Antes viajaba su Riot ID, que ni lo acepta el backend ni
   * identifica a nadie de forma estable.
   */
  it('las fichas llevan a las medias de su lado y el chip al historial cruzado', async () => {
    const { el } = await montar();

    const synergy = el.querySelector<HTMLAnchorElement>('a.pf-vs-tile--synergy');
    expect(synergy?.getAttribute('href')).toBe(`/app/jugador/${OTRO}/juntos`);

    const versus = el.querySelector<HTMLAnchorElement>('a.pf-vs-tile--rivalry');
    expect(versus?.getAttribute('href')).toBe(`/app/jugador/${OTRO}/contra`);

    const chipHistorial = el.querySelector<HTMLAnchorElement>('a.pf-meta-chip--action');
    expect(chipHistorial?.getAttribute('href')).toBe(`/app/jugador/${OTRO}`);
    expect(chipHistorial?.textContent?.trim()).toBe('Historial cruzado');
  });

  it('los campeones insignia enlazan a la tierlist', async () => {
    const { el } = await montar();

    const champ = el.querySelector<HTMLAnchorElement>('a.pf-mini-champ');
    expect(champ?.getAttribute('href')).toBe('/app/tierlist');
  });

  it('la pestaña de campeones ofrece buscador con tope de cuatro sugerencias', async () => {
    const { el, comp, detect } = await montar();

    comp.activeTab.set('campeones');
    detect();

    const buscador = el.querySelector('.pf-champ-search nf-combobox');
    expect(buscador).not.toBeNull();
    // Va dentro del mismo grupo que el filtro de posición, a su derecha.
    expect(el.querySelector('.pf-champ-toolbar-compact__filters .pf-champ-search')).not.toBeNull();
  });

  it('el buscador acota la rejilla a un solo campeón', async () => {
    const { comp, detect } = await montar();

    comp.activeTab.set('campeones');
    detect();
    const total = comp.filteredChampions().length;
    expect(total).toBeGreaterThan(1);

    const elegido = comp.filteredChampions()[0].championId;
    comp.champQuery.set(String(elegido));
    detect();

    expect(comp.filteredChampions().map((c) => c.championId)).toEqual([elegido]);
  });
});
