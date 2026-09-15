import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { GrupoHistorial } from './grupo-historial';
import { MatchHistoryUiState } from '../match-history/match-history-ui';

/**
 * El enlace profundo al historial ya filtrado: `?liga=caos`, `?temporada=<id>`.
 *
 * Es lo que permite llegar aquí desde donde se habla de una liga —el ranking, las estadísticas
 * del grupo, una sanción— sin obligar al usuario a repetir a mano el filtro que acaba de elegir
 * en la pantalla anterior. Se perdió una vez al reescribir esta vista contra el API, con su
 * test, y no lo notó nadie: la URL seguía funcionando, simplemente ya no filtraba.
 */
describe('GrupoHistorial · enlace profundo de filtros', () => {
  function crear(liga: string | null, temporada: string | null = null) {
    sessionStorage.clear();
    TestBed.resetTestingModule();

    const paramMap = { get: (k: string) => (k === 'id' ? 'g1' : null) };
    const queryParamMap = {
      get: (k: string) => (k === 'liga' ? liga : k === 'temporada' ? temporada : null),
    };

    TestBed.configureTestingModule({
      imports: [GrupoHistorial],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap, queryParamMap },
            paramMap: of(paramMap),
            queryParamMap: of(queryParamMap),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(GrupoHistorial);
    fixture.detectChanges();
    return fixture.debugElement.injector.get(MatchHistoryUiState);
  }

  beforeEach(() => sessionStorage.clear());

  it('?liga=caos deja puesto el filtro de modalidad', () => {
    expect(crear('caos').filters().preset).toBe('CHAOS');
  });

  /** El slug y el enum no se llaman igual, y es donde se rompería sin darse cuenta. */
  it('?liga=competitivo se traduce a PRECISION', () => {
    expect(crear('competitivo').filters().preset).toBe('PRECISION');
  });

  it('?temporada acota a esa liga', () => {
    const ui = crear('competitivo', 'season-3');
    expect(ui.filters().preset).toBe('PRECISION');
    expect(ui.filters().leagueId).toBe('season-3');
  });

  /** Una URL escrita a mano no puede dejar la lista vacía por un filtro que nadie pidió. */
  it('un ?liga desconocido no toca los filtros', () => {
    expect(crear('pepe').filters().preset).toBe('all');
  });

  it('sin parámetros, la vista entra sin filtrar', () => {
    const ui = crear(null);
    expect(ui.filters().preset).toBe('all');
    expect(ui.filters().leagueId).toBe('all');
  });
});
