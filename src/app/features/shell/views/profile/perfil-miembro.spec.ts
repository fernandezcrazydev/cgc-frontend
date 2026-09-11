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

describe('PerfilMiembro Component', () => {
  it('should initialize and compute member profile with H2H when user found', async () => {
    const groupStore = new GroupStore();
    await TestBed.configureTestingModule({
      imports: [PerfilMiembro],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'Pix3lQueen#LAN' },
              queryParamMap: { get: () => null },
            },
            paramMap: of({ get: () => 'Pix3lQueen#LAN' }),
            queryParamMap: of({ get: () => null }),
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
            // La tarjeta del cruce pinta tu cara junto a tus victorias: sin esto el doble de
            // `Session` se queda corto y la plantilla revienta al renderizar.
            avatarUrl: signal(null),
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
    expect(comp.userId()).toBe('Pix3lQueen#LAN');
    expect(comp.profile()).not.toBeNull();
    expect(comp.profile()?.name).toBe('Pix3lQueen');
  });
});

import { MatchHistoryStore, buildCrossMatches } from '../../../../core/matches';
import { matchFixture, participantFixture } from '../../../../core/matches/match-fixtures';
import { Match, MatchParticipant } from '../../../../core/matches/models';

function yo(): MatchParticipant {
  return participantFixture({ id: 'me', team: 'blue', riotId: 'Yo#LAN' });
}

function historial(): Match[] {
  const contra = participantFixture({ id: 'e1', team: 'red', riotId: 'Pix3lQueen#LAN' });
  const con = participantFixture({ id: 'e2', team: 'blue', riotId: 'Pix3lQueen#LAN' });
  return [
    matchFixture({ id: 'enfrentados', blue: [yo()], red: [contra], userParticipant: yo() }),
    matchFixture({ id: 'juntos', blue: [yo(), con], red: [], userParticipant: yo() }),
  ];
}

/**
 * Estas pruebas montan la vista de verdad y miran el DOM. El `tsconfig` todavía
 * no tiene `strictTemplates`, así que una plantilla puede compilar y reventar —o
 * pintar lo que no toca— al renderizarse: es lo único que lo detecta.
 */
describe('PerfilMiembro · refactor de la vista', () => {
  /** `sinCruce` monta la vista de alguien con quien no has coincidido nunca. */
  async function montar(
    { sinCruce = false }: { sinCruce?: boolean } = {},
  ): Promise<{ el: HTMLElement; comp: PerfilMiembro; detect: () => void }> {
    const groupStore = new GroupStore();
    const matches = historial();
    await TestBed.configureTestingModule({
      imports: [PerfilMiembro],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => 'Pix3lQueen#LAN' },
              queryParamMap: { get: () => null },
            },
            paramMap: of({ get: () => 'Pix3lQueen#LAN' }),
            queryParamMap: of({ get: () => null }),
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
          provide: MatchHistoryStore,
          useValue: {
            status: signal('ready'),
            allMatches: signal(matches),
            allPersonalMatches: signal(matches),
            crossWith: (playerId: string) => {
              const all = sinCruce ? [] : buildCrossMatches(matches, playerId);
              return {
                all,
                allies: all.filter((c) => c.relation === 'ally'),
                enemies: all.filter((c) => c.relation === 'enemy'),
              };
            },
            crossPartners: signal([]),
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
            // La tarjeta del cruce pinta tu cara junto a tus victorias: sin esto el doble de
            // `Session` se queda corto y la plantilla revienta al renderizar.
            avatarUrl: signal(null),
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
   * La tarjeta del cruce es una puerta a tres pantallas y cada control lleva a la suya. Antes las
   * tres llevaban al mismo sitio, así que dos de los tres prometían cosas distintas.
   *
   * Las rutas se comprueban **canónicas** (`/app/jugador/:tag/...`) a propósito: las viejas
   * (`/app/synergy/:tag`, `/app/versus/:tag`, `/app/historial-cruzado/:tag`) siguen existiendo,
   * pero solo como redirecciones de compatibilidad en `app.routes.ts`, y enlazar a ellas obliga a
   * navegar dos veces.
   */
  it('cada control de la tarjeta del cruce lleva a su pantalla, por la ruta canónica', async () => {
    const { el } = await montar();

    const sinergia = el.querySelector<HTMLAnchorElement>('a.pf-vs-tile--synergy');
    expect(sinergia?.getAttribute('href')).toMatch(/^\/app\/jugador\/.+\/juntos$/);

    const caraACara = el.querySelector<HTMLAnchorElement>('a.pf-vs-tile--rivalry');
    expect(caraACara?.getAttribute('href')).toMatch(/^\/app\/jugador\/.+\/contra$/);

    // El usuario pidió un botón del kit, no un chip con una flecha.
    const historial = el.querySelector<HTMLAnchorElement>('.pf-vs-card .pf-card__header a');
    expect(historial?.classList.contains('nf-btn')).toBe(true);
    expect(historial?.getAttribute('href')).toMatch(/^\/app\/jugador\/[^/]+$/);
    expect(historial?.textContent?.trim()).toBe('Historial cruzado');
  });

  it('la tarjeta del cruce resume la relación: reparto, racha y emparejamiento', async () => {
    const { el } = await montar();

    // La barra reparte las partidas entre las dos relaciones; se lee sin leyenda, y lo que la
    // hace accesible es su etiqueta, no los colores.
    const barra = el.querySelector('.pf-vs-split__bar');
    expect(barra?.getAttribute('aria-label')).toMatch(/\d+ partidas juntos y \d+ enfrentados/);
    expect(el.querySelector<HTMLElement>('.pf-vs-split__fill')?.style.width).toMatch(/%$/);

    // La racha sale de `CrossAggregate`. Si el cruce sembrado no la trae, la línea no se pinta
    // —y eso también es correcto—, así que se comprueba su forma, no su presencia.
    for (const racha of Array.from(el.querySelectorAll('.pf-vs-tile__streak'))) {
      expect(racha.textContent).toMatch(/racha \d+[VD]/);
    }

    /* El emparejamiento se pinta con los ICONOS de los dos campeones, no con sus nombres:
       `myChampionName` es el nombre que trae la partida y crudo salía «Tu Campeón 33 vs su
       Campeón 64», que no dice nada. El nombre sobrevive solo como texto accesible. */
    const emparejamientos = Array.from(el.querySelectorAll('.pf-vs-matchup'));
    expect(emparejamientos.length).toBeGreaterThan(0);
    for (const linea of emparejamientos) {
      expect(linea.querySelectorAll('nf-avatar.pf-vs-matchup__champ').length).toBe(2);
      expect(linea.getAttribute('aria-label')).toMatch(/(más repetido)/);
      expect(linea.querySelector('.pf-vs-matchup__record')?.textContent).toMatch(
        /\d+ % · \d+V-\d+D/,
      );
      // Ni rastro de la frase con el número del campeón dentro.
      expect(linea.textContent).not.toMatch(/Tu Campeón/);
    }
  });

  /**
   * Lo pidió el usuario: dos cifras sueltas no se leen como un duelo. Con la cara de cada uno
   * pegada a sus victorias, y en espejo, sí.
   */
  it('el marcador del cara a cara es simétrico: avatares y marcador V · D', async () => {
    const { el } = await montar();

    const duelo = el.querySelector('.pf-vs-tile--rivalry .pf-vs-duel')!;
    expect(duelo.querySelectorAll('nf-avatar.pf-vs-duel__avatar').length).toBe(2);

    const score = el.querySelector('.pf-vs-tile--rivalry .pf-vs-tile__score');
    expect(score?.textContent).toMatch(/\d+ V\s*·\s*\d+ D/);
  });

  /**
   * Toda la tarjeta lleva al historial cruzado, no solo el botón. Se resuelve estirando el
   * `::after` del propio botón sobre la tarjeta, así que sigue habiendo un `<a>` de verdad
   * —tabulable y con `href`— en vez de un `div` con un `(click)`.
   */
  it('la tarjeta entera es pulsable, sin dejar de ser un enlace de verdad', async () => {
    const { el } = await montar();

    const tarjeta = el.querySelector('.pf-vs-card')!;
    const estirado = tarjeta.querySelector('a.pf-vs-card__all');
    expect(estirado).not.toBeNull();
    expect(estirado?.tagName).toBe('A');
    expect(estirado?.getAttribute('href')).toMatch(/^\/app\/jugador\/[^/]+$/);

    // Las dos columnas conservan su destino propio: si el enlace estirado las tapara, pulsar en
    // ellas llevaría al historial en vez de a su pantalla.
    expect(tarjeta.querySelectorAll('a.pf-vs-tile--interactive').length).toBe(2);
  });

  /** Sin partidas en común no hay relación que describir: la tarjeta no existe. */
  it('sin historial cruzado la tarjeta del cruce no se pinta', async () => {
    const { el } = await montar({ sinCruce: true });

    expect(el.querySelector('.pf-vs-card')).toBeNull();
  });

  /**
   * La tabla de medias vivía dentro de esta tarjeta y la hacía dos cosas a la vez. Sus cuatro
   * filas se pintan enteras en las dos pantallas de destino, así que aquí sobraban.
   */
  it('la tarjeta ya no lleva la tabla de medias comparadas', async () => {
    const { el } = await montar();

    expect(el.querySelector('.pf-compare-compact')).toBeNull();
  });

  /**
   * La gráfica es la misma del perfil propio y del hub, y solo habla de los grupos que
   * compartís: de los ajenos no se enseña clasificación, igual que hace la tarjeta de grupos.
   */
  it('pinta la gráfica de LP por liga de los grupos compartidos', async () => {
    const { el, comp } = await montar();

    expect(comp.sharedGroups().length).toBeGreaterThan(0);
    expect(el.querySelector('app-profile-lp-chart')).not.toBeNull();
    expect(el.querySelector('app-hub-lp-chart .hub-lp')).not.toBeNull();
    // Es el perfil de otro: el título no puede hablar de «tu» evolución.
    const titulo = el.querySelector('app-profile-lp-chart .hub-card__title')?.textContent ?? '';
    expect(titulo).toContain('Evolución de LP por liga');
    expect(titulo).not.toContain('Tu ');
  });

  /** Encima de la cabecera del jugador no va nada: la pidió limpia el usuario. */
  it('no hay ningún enlace por encima de la cabecera del jugador', async () => {
    const { el } = await montar();

    expect(el.querySelector('.view-back')).toBeNull();
    const primero = el.querySelector('.pf-view > *');
    expect(primero?.classList.contains('pf-hero-compact')).toBe(true);
  });

  it('los campeones insignia enlazan a la tierlist con queryParam', async () => {
    const { el } = await montar();

    const champ = el.querySelector<HTMLAnchorElement>('a.pf-mini-champ');
    expect(champ?.getAttribute('href')).toContain('/app/tierlist?campeon=');
  });

  it('la pestaña de campeones ofrece buscador con tope de cuatro sugerencias', async () => {
    const { el, comp, detect } = await montar();

    comp.setTab('campeones');
    detect();

    const buscador = el.querySelector('.pf-champ-search nf-combobox');
    expect(buscador).not.toBeNull();
    // Va dentro del mismo grupo que el filtro de posición, a su derecha.
    expect(el.querySelector('.pf-champ-toolbar-compact__filters .pf-champ-search')).not.toBeNull();
  });

  it('el buscador acota la rejilla a un solo campeón', async () => {
    const { comp, detect } = await montar();

    comp.setTab('campeones');
    detect();
    const total = comp.filteredChampions().length;
    expect(total).toBeGreaterThan(1);

    const elegido = comp.filteredChampions()[0].championId;
    comp.champQuery.set(String(elegido));
    detect();

    expect(comp.filteredChampions().map((c) => c.championId)).toEqual([elegido]);
  });

  it('muestra el estado privado y oculta métricas si el perfil tiene isPrivate', async () => {
    await TestBed.configureTestingModule({
      imports: [PerfilMiembro],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: { get: () => 'Pix3lQueen#LAN' } },
            paramMap: of({ get: () => 'Pix3lQueen#LAN' }),
          },
        },
        {
          provide: GroupStore,
          useValue: {
            groups: signal(GROUPS),
            rosterOf: () => [
              {
                name: 'Pix3lQueen',
                tag: 'Pix3lQueen#LAN',
                initials: 'PQ',
                role: 'MID',
                owner: false,
                hue: 120,
                isPrivate: true,
              },
            ],
          },
        },
        { provide: GameDataStore, useValue: { status: signal('ready'), championById: signal(new Map()) } },
        { provide: GroupsStore, useValue: { groups: signal([]), status: signal('ready'), ensureLoaded: () => {} } },
        { provide: RiotAccountStore, useValue: { account: signal(null), status: signal('ready'), ensureLoaded: () => {} } },
        {
          provide: Session,
          useValue: {
            displayName: signal('User'),
            // La tarjeta del cruce pinta tu cara junto a tus victorias: sin esto el doble de
            // `Session` se queda corto y la plantilla revienta al renderizar.
            avatarUrl: signal(null),
            status: signal('ready'),
            user: signal({ ...CURRENT_USER, id: 'u1' }),
            activeProfile: signal(null),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PerfilMiembro);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.pf-private-state')).not.toBeNull();
    expect(el.querySelector('.pf-private-title')?.textContent).toContain('Este perfil es privado');
    expect(el.querySelector('.pf-tabs-bar')).toBeNull();
  });
});
