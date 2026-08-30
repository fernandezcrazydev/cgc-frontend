import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { Perfil } from './perfil';
import { Session } from '../../../core/auth';
import { GameDataStore } from '../../../core/game-data';
import { GroupStore } from '../../../core/group-store';
import { NotificationsStore } from '../../../core/notifications';
import { PreferencesStore } from '../../../core/preferences';
import { RiotAccountStore } from '../../../core/riot';
import { GROUPS } from '../../../core/lobby';
import { MatchHistoryStore, buildCrossPartners } from '../../../core/matches';
import {
  matchFixture,
  participantFixture,
} from '../../../core/matches/match-fixtures';

const YO = 'N1ghtfang#LAN';

/**
 * `n` partidas contra o con el mismo jugador, de las cuales `wins` ganadas. El mejor aliado y
 * la némesis del perfil salen de partidas reales, así que la prueba tiene que darle partidas.
 */
function duels(riotId: string, side: 'blue' | 'red', n: number, wins: number) {
  const me = () => participantFixture({ id: 'me', team: 'blue', riotId: YO });
  return Array.from({ length: n }, (_, i) => {
    const other = participantFixture({ id: `${riotId}-${i}`, team: side, riotId });
    return matchFixture({
      id: `${riotId}-${i}`,
      decidedAt: `2026-06-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
      winningTeam: i < wins ? 'blue' : 'red',
      blue: side === 'blue' ? [me(), other] : [me()],
      red: side === 'blue' ? [] : [other],
      userParticipant: me(),
    });
  });
}

/** Un dúo con el que se gana y un rival contra el que se pierde, ambos con muestra suficiente. */
const PARTIDAS = [...duels('Duo#LAN', 'blue', 4, 3), ...duels('Rival#LAN', 'red', 4, 0)];

const CROSS_PARTNERS = buildCrossPartners(PARTIDAS);

/**
 * Monta la vista de perfil entera y mira el DOM. El build no lo cubre: el
 * `tsconfig` todavía no tiene `strictTemplates`, así que una plantilla puede
 * compilar sin quejarse y pintar mal —o reventar— al renderizarse. Cada prueba
 * de aquí protege una decisión concreta del rediseño, no el aspecto.
 */
describe('Perfil · refactor de la vista', () => {
  async function montar(
    // Quién ha iniciado sesión. Parametrizado porque el perfil se siembra con la identidad de
    // la sesión: dos usuarios distintos no pueden salir con las mismas cifras.
    quien = 'N1ghtfang',
    partidas = PARTIDAS,
  ): Promise<{ el: HTMLElement; comp: Perfil; detect: () => void }> {
    const groupStore = new GroupStore();
    await TestBed.configureTestingModule({
      imports: [Perfil],
      providers: [
        provideRouter([]),
        {
          provide: GroupStore,
          useValue: { groups: signal(GROUPS), rosterOf: (id: string) => groupStore.rosterOf(id) },
        },
        {
          provide: Session,
          useValue: {
            displayName: signal(quien),
            initials: signal(quien.slice(0, 2)),
            avatarUrl: signal<string | null>(null),
            createdAt: signal<string | null>('2025-05-14T10:00:00Z'),
            status: signal('ready'),
          },
        },
        {
          provide: GameDataStore,
          useValue: {
            status: signal('ready'),
            championById: signal(new Map()),
            ensureLoaded: () => Promise.resolve(),
          },
        },
        {
          provide: PreferencesStore,
          useValue: {
            status: signal('ready'),
            saving: signal(false),
            prefs: signal({ roles: [], primary: null }),
            roles: signal([]),
            primary: signal(null),
            ensureLoaded: () => Promise.resolve(),
          },
        },
        {
          provide: RiotAccountStore,
          useValue: {
            status: signal('ready'),
            account: signal(null),
            saving: signal(false),
            generatingCode: signal(false),
            relinkAvailableAt: () => null,
            ensureLoaded: () => Promise.resolve(),
            reload: () => {},
          },
        },
        {
          provide: NotificationsStore,
          useValue: { lastArrived: signal(null) },
        },
        {
          // El desglose por posición del perfil se cuenta sobre las partidas del usuario, así
          // que el doble tiene que servirlas: sin ellas la tabla de roles no tendría qué medir.
          provide: MatchHistoryStore,
          useValue: {
            status: signal('ready'),
            crossPartners: signal(CROSS_PARTNERS),
            allPersonalMatches: signal(partidas),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Perfil);
    fixture.detectChanges();
    return {
      el: fixture.nativeElement as HTMLElement,
      comp: fixture.componentInstance,
      detect: () => fixture.detectChanges(),
    };
  }

  it('el encabezado ya no enseña LP, pero conserva winrate y récord', async () => {
    const { el } = await montar();

    expect(el.querySelector('.pf-hero-compact__lp')).toBeNull();
    expect(el.querySelector('.pf-hero-compact__ring-val')?.textContent).toContain('%');
    expect(el.querySelector('.pf-hero-compact__record')).not.toBeNull();
  });

  it('el winrate del encabezado es la suma real de todas las ligas', async () => {
    const { el, comp } = await montar();
    const p = comp.profile();

    const games = p.groups.reduce((s, g) => s + g.games, 0);
    const wins = p.groups.reduce((s, g) => s + g.wins, 0);

    expect(p.games).toBe(games);
    expect(p.wins).toBe(wins);

    const esperado = Math.round((wins / games) * 100) + '%';
    expect(el.querySelector('.pf-hero-compact__ring-val')?.textContent?.trim()).toBe(esperado);
  });

  it('sin cuenta vinculada el encabezado ofrece el botón de Riot con su color de marca', async () => {
    const { el } = await montar();

    const boton = el.querySelector<HTMLButtonElement>('.pf-hero-compact__riot');
    expect(boton).not.toBeNull();
    expect(boton!.classList.contains('nf-btn--riot')).toBe(true);
    expect(boton!.textContent).toContain('Vincular Riot ID');
    // Lleva el logo oficial, no un glifo de texto.
    expect(boton!.querySelector('.nf-btn__riot-mark')).not.toBeNull();
    expect(boton!.textContent).not.toContain('＋');
  });

  it('no queda ningún glifo de flecha en los títulos de sección', async () => {
    const { el } = await montar();

    expect(el.textContent).not.toContain('▸');
  });

  it('el botón de catálogo es de icono y explica lo que hace con un tooltip', async () => {
    const { el } = await montar();

    expect(el.textContent).not.toContain('Ver catálogo completo');
    const boton = el.querySelector<HTMLButtonElement>('.pf-card__header .nf-icon-btn');
    expect(boton?.getAttribute('title')).toBe('Ver el catálogo completo de campeones');
    expect(boton?.getAttribute('aria-label')).toBe('Ver el catálogo completo de campeones');
  });

  it('la tarjeta de racha se llama «Racha» y nace con la última partida abierta', async () => {
    const { el } = await montar();

    const titulos = Array.from(el.querySelectorAll('.pf-card__title')).map((n) => n.textContent!.trim());
    expect(titulos).toContain('Racha');
    expect(titulos.some((t) => t.includes('Forma Reciente'))).toBe(false);

    expect(el.querySelector('.pf-streak-summary')).not.toBeNull();
    expect(el.querySelectorAll('.pf-match-node[aria-pressed="true"]').length).toBe(1);
  });

  it('la racha se escribe en español: nunca «1L»', async () => {
    const { el } = await montar();

    const insignia = el.querySelector('.pf-streak-badge')?.textContent?.replace(/\s+/g, ' ') ?? '';
    expect(insignia).not.toMatch(/\d+L\b/);
    expect(insignia).toMatch(/\d+[VD]/);
  });

  it('«Tus grupos» reserva un hueco fijo y no enseña más de cuatro a la vez', async () => {
    const { el } = await montar();

    expect(el.querySelector('.pf-group-card .pf-group-viewport')).not.toBeNull();
    const visibles = el.querySelectorAll('.pf-group-list:not([aria-hidden="true"]) .pf-group-item');
    expect(visibles.length).toBeGreaterThan(0);
    expect(visibles.length).toBeLessThanOrEqual(4);
  });

  it('el LP se conserva por grupo, que es donde tiene contexto de liga', async () => {
    const { el } = await montar();

    const rangos = Array.from(el.querySelectorAll('.pf-group-item__rank')).map((n) => n.textContent!.trim());
    expect(rangos.length).toBeGreaterThan(0);
    expect(rangos[0]).toMatch(/#\d+ · \d+ LP/);
  });

  it('los campeones insignia y las fichas del catálogo enlazan a la tierlist', async () => {
    const { el, comp, detect } = await montar();

    expect(el.querySelector<HTMLAnchorElement>('a.pf-mini-champ')?.getAttribute('href')).toBe('/app/tierlist');

    comp.activeTab.set('campeones');
    detect();
    expect(el.querySelector<HTMLAnchorElement>('a.pf-champ-tile')?.getAttribute('href')).toBe('/app/tierlist');
  });

  it('el mejor aliado y la némesis salen de las partidas reales, no de una semilla', async () => {
    const { el } = await montar();

    const sinergia = el.querySelector<HTMLAnchorElement>('a.pf-h2h-compact--ally');
    const rivalidad = el.querySelector<HTMLAnchorElement>('a.pf-h2h-compact--nemesis');

    // 3 de 4 juntos y 0 de 4 enfrentados: los mismos números que dirá su página.
    expect(sinergia?.textContent).toContain('75% WR juntos');
    expect(rivalidad?.textContent).toContain('0% WR en duelo');
  });

  it('la sinergia lleva a /app/synergy y la rivalidad a /app/versus', async () => {
    const { el } = await montar();

    const sinergia = el.querySelector<HTMLAnchorElement>('a.pf-h2h-compact--ally, .pf-h2h-compact--ally a, .pf-h2h-compact--ally');
    const rivalidad = el.querySelector<HTMLAnchorElement>('a.pf-h2h-compact--nemesis, .pf-h2h-compact--nemesis a, .pf-h2h-compact--nemesis');

    expect(sinergia?.getAttribute('href')).toContain('/app/synergy/');
    expect(rivalidad?.getAttribute('href')).toContain('/app/versus/');
  });

  it('el buscador de campeones va junto al filtro de posición', async () => {
    const { el, comp, detect } = await montar();

    comp.activeTab.set('campeones');
    detect();

    const grupo = el.querySelector('.pf-champ-toolbar-compact__filters');
    expect(grupo?.querySelector('nf-segmented')).not.toBeNull();
    expect(grupo?.querySelector('.pf-champ-search nf-combobox')).not.toBeNull();
  });

  it('elegir un campeón en el buscador deja solo ese en la rejilla', async () => {
    const { comp, detect } = await montar();

    comp.activeTab.set('campeones');
    detect();
    expect(comp.filteredChampions().length).toBeGreaterThan(1);

    const elegido = comp.filteredChampions()[0].championId;
    comp.champQuery.set(String(elegido));
    detect();

    expect(comp.filteredChampions().map((c) => c.championId)).toEqual([elegido]);
  });

  it('el buscador solo ofrece campeones que el jugador ha jugado', async () => {
    const { comp } = await montar();

    const jugados = new Set(comp.profile().topChampions.map((c) => String(c.championId)));
    expect(comp.championOptions().length).toBe(jugados.size);
    for (const opt of comp.championOptions()) {
      expect(jugados.has(opt.value)).toBe(true);
    }
  });

  /*
   * El perfil se sembraba con `CURRENT_USER`, el mock legacy, cuyo tag es siempre
   * `N1ghtfang#LAN`. Como la semilla sale del tag, todos los usuarios veían el MISMO winrate,
   * los mismos campeones y la misma racha bajo su propio nombre y su propia foto.
   */
  it('dos usuarios distintos no ven el mismo perfil', async () => {
    // Los campeones insignia salen de la semilla del jugador: con otra identidad, otra lista.
    const insignias = (comp: Perfil) => comp.topSignatureChampions().map((c) => c.championId);

    const uno = insignias((await montar('N1ghtfang')).comp);
    TestBed.resetTestingModule();
    const otro = insignias((await montar('Cr1msonByte')).comp);

    expect(uno.length).toBeGreaterThan(0);
    expect(uno).not.toEqual(otro);
  });

  it('una posición sin partidas dice que no tiene datos, no un winrate', async () => {
    // Sin ninguna partida no hay nada que medir en ninguna de las cinco posiciones.
    const { el, comp, detect } = await montar('N1ghtfang', []);
    comp.activeTab.set('dna');
    detect();

    const tabla = el.querySelector('.pf-role-table');
    expect(tabla).not.toBeNull();
    expect(tabla!.querySelectorAll('.pf-nodata').length).toBe(10);
    // Y ni una sola celda de porcentaje inventada en la tabla de roles.
    expect(tabla!.textContent).not.toMatch(/\d+%/);
  });
});
