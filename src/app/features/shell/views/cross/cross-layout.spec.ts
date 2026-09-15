import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import { MatchHistoryStore } from '../../../../core/matches';
import { fakeMatchHistoryStore } from '../../../../core/matches/match-fixtures';
import { CrossLayout } from './cross-layout';

/**
 * La pantalla del candado: `403 PROFILE_PRIVATE` (cgc-backend#98).
 *
 * Lo que protege este spec es que ese 403 **no se pinte como un error**. Llega por el mismo
 * `catch` que un fallo de red, así que lo fácil es que acabe en la rama de «No se ha podido
 * cargar» con su botón de «Reintentar» — un botón que no puede funcionar nunca, porque la
 * respuesta era correcta.
 */
describe('CrossLayout con un perfil privado', () => {
  async function montar(personalProfilePrivate: boolean): Promise<HTMLElement> {
    await TestBed.configureTestingModule({
      imports: [CrossLayout],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'rival-uuid' }),
            snapshot: { paramMap: { get: () => 'rival-uuid' } },
          },
        },
        {
          provide: GameDataStore,
          useValue: {
            status: signal('ready'),
            ensureLoaded: () => {},
            reload: () => {},
            championById: signal(new Map()),
          },
        },
        {
          provide: GroupsStore,
          useValue: { groups: signal([]), ensureLoaded: () => {} },
        },
        {
          provide: MatchHistoryStore,
          useValue: fakeMatchHistoryStore({
            personalStatus: personalProfilePrivate ? 'error' : 'ready',
            personalProfilePrivate,
          }),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CrossLayout);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta el candado y explica que las partidas siguen en el historial', async () => {
    const el = await montar(true);

    expect(el.textContent).toContain('Este perfil es privado');
    expect(el.textContent).toContain('siguen estando en el historial');
  });

  /** No es un fallo, así que no se ofrece reintentar: la respuesta ya era la correcta. */
  it('no ofrece reintentar, que es lo que la separa de un error de red', async () => {
    const el = await montar(true);

    expect(el.textContent).not.toContain('Reintentar');
    expect(el.textContent).not.toContain('No se ha podido cargar');
  });

  it('sin privacidad de por medio, esa pantalla no aparece', async () => {
    const el = await montar(false);

    expect(el.textContent).not.toContain('Este perfil es privado');
  });
});
