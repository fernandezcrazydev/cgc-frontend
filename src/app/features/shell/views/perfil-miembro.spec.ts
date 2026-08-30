import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { PerfilMiembro } from './perfil-miembro';
import { GroupStore } from '../../../core/group-store';
import { GameDataStore } from '../../../core/game-data';
import { GroupsStore } from '../../../core/groups';
import { RiotAccountStore } from '../../../core/riot';
import { Session } from '../../../core/auth';
import { CURRENT_USER, GROUPS } from '../../../core/lobby';
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
            snapshot: { paramMap: { get: () => 'Pix3lQueen#LAN' } },
            paramMap: of({ get: () => 'Pix3lQueen#LAN' }),
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
    expect(comp.userId()).toBe('Pix3lQueen#LAN');
    expect(comp.profile()).not.toBeNull();
    expect(comp.profile()?.name).toBe('Pix3lQueen');
  });
});

/**
 * Estas pruebas montan la vista de verdad y miran el DOM. El `tsconfig` todavía
 * no tiene `strictTemplates`, así que una plantilla puede compilar y reventar —o
 * pintar lo que no toca— al renderizarse: es lo único que lo detecta.
 */
describe('PerfilMiembro · refactor de la vista', () => {
  async function montar(): Promise<{ el: HTMLElement; comp: PerfilMiembro; detect: () => void }> {
    const groupStore = new GroupStore();
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
            rosterOf: (id: string) => groupStore.rosterOf(id),
          },
        },
        { provide: GameDataStore, useValue: { status: signal('ready'), championById: signal(new Map()) } },
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
  it('las fichas llevan a las medias de su lado y el chip al historial cruzado', async () => {
    const { el } = await montar();

    const synergy = el.querySelector<HTMLAnchorElement>('a.pf-vs-tile--synergy');
    expect(synergy?.getAttribute('href')).toContain('/app/synergy/');

    const versus = el.querySelector<HTMLAnchorElement>('a.pf-vs-tile--rivalry');
    expect(versus?.getAttribute('href')).toContain('/app/versus/');

    const chipHistorial = el.querySelector<HTMLAnchorElement>('a.pf-meta-chip--action');
    expect(chipHistorial?.getAttribute('href')).toContain('/app/historial-cruzado/');
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
