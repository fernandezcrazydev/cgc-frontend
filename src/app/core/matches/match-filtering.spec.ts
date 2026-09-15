import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  MAX_PAGE_SIZE,
  PRESET_SLUGS,
  activeFilterCount,
  groupMatchQuery,
  normalizeForSearch,
  personalMatchQuery,
  personalSummaryQuery,
  presetFromSlug,
  sortParam,
} from './match-filtering';

describe('sortParam', () => {
  /*
   * El servidor solo admite `playedAt`, `duration` y `kills`, y cualquier otra cosa es un
   * `400 UNSORTABLE_MATCH_FIELD` — no un silencio que devuelva otro orden. Por eso la
   * traducción vive en un solo sitio y es total sobre `MatchSortBy`.
   */
  it('traduce cada opción del desplegable a un campo de la lista blanca', () => {
    expect(sortParam('date-desc')).toBe('playedAt,desc');
    expect(sortParam('date-asc')).toBe('playedAt,asc');
    expect(sortParam('duration-desc')).toBe('duration,desc');
    expect(sortParam('kills-desc')).toBe('kills,desc');
  });
});

describe('groupMatchQuery', () => {
  it('no manda lo que está sin poner', () => {
    expect(groupMatchQuery(EMPTY_FILTERS, 0, 6)).toEqual({
      page: 0,
      size: 6,
      sort: 'playedAt,desc',
    });
  });

  /*
   * La distinción que motiva que haya dos tipos de consulta: `outcome` dice cómo TE fue y
   * `winningSide` qué bando ganó. No son la misma pregunta, y confundirlas costó un bug real
   * —«Victorias» enseñaba tus victorias MÁS todas las partidas ajenas—.
   */
  it('no lleva outcome ni lane, que son de la lista personal', () => {
    const q = groupMatchQuery(
      { ...EMPTY_FILTERS, outcome: 'win', lane: 'MID', winningSide: 'red' },
      0,
      6,
    );

    expect(q).not.toHaveProperty('outcome');
    expect(q).not.toHaveProperty('lane');
    expect(q.winningSide).toBe('RED');
  });

  /** Pedir más del tope no devuelve más: se recorta, y la vista se creería con página completa. */
  it('recorta el tamaño de página al tope del servidor', () => {
    expect(groupMatchQuery(EMPTY_FILTERS, 0, 500).size).toBe(MAX_PAGE_SIZE);
  });

  it('la búsqueda libre viaja recortada, y en blanco no viaja', () => {
    expect(groupMatchQuery({ ...EMPTY_FILTERS, searchQuery: '  ahri ' }, 0, 6).q).toBe('ahri');
    expect(groupMatchQuery({ ...EMPTY_FILTERS, searchQuery: '   ' }, 0, 6)).not.toHaveProperty('q');
  });
});

describe('personalMatchQuery', () => {
  it('no lleva winningSide ni participation, que son de la lista de grupo', () => {
    const q = personalMatchQuery(
      { ...EMPTY_FILTERS, winningSide: 'blue', participation: 'others', outcome: 'loss' },
      0,
      6,
    );

    expect(q).not.toHaveProperty('winningSide');
    expect(q).not.toHaveProperty('participation');
    expect(q.outcome).toBe('LOSS');
  });

  it('el cruce añade with y, si la hay, la relación', () => {
    const conRelacion = personalMatchQuery(EMPTY_FILTERS, 0, 5, {
      with: 'rival',
      relation: 'ally',
    });
    expect(conRelacion.with).toBe('rival');
    expect(conRelacion.relation).toBe('ALLY');

    const sinRelacion = personalMatchQuery(EMPTY_FILTERS, 0, 5, { with: 'rival', relation: 'all' });
    expect(sinRelacion.with).toBe('rival');
    expect(sinRelacion).not.toHaveProperty('relation');
  });

  /** El resumen acepta los mismos filtros que el listado: es lo que da el recuento del cruce. */
  it('el resumen lleva los mismos filtros, sin paginación', () => {
    const q = personalSummaryQuery({ ...EMPTY_FILTERS, lane: 'ADC' }, { with: 'x' });
    expect(q.lane).toBe('ADC');
    expect(q.with).toBe('x');
    expect(q).not.toHaveProperty('page');
    expect(q).not.toHaveProperty('sort');
  });
});

describe('activeFilterCount', () => {
  it('cuenta solo los controles que existen en ese modo', () => {
    const f = {
      ...EMPTY_FILTERS,
      championId: 103,
      winningSide: 'blue' as const,
      outcome: 'win' as const,
      lane: 'MID' as const,
    };

    // En grupo no hay resultado ni posición: campeón + bando ganador.
    expect(activeFilterCount(f, 'group')).toBe(2);
    // En personal no hay bando ganador: campeón + resultado + posición.
    expect(activeFilterCount(f, 'personal')).toBe(3);
    // El cruzado añade la relación cuando está puesta.
    expect(activeFilterCount({ ...f, relation: 'ally' }, 'cross')).toBe(4);
  });

  it('sin filtros puestos cuenta cero', () => {
    expect(activeFilterCount(EMPTY_FILTERS, 'group')).toBe(0);
    expect(activeFilterCount(EMPTY_FILTERS, 'personal')).toBe(0);
  });
});

describe('normalizeForSearch', () => {
  it('reduce el texto a su esqueleto comparable', () => {
    expect(normalizeForSearch("Kai'Sa")).toBe('kaisa');
    expect(normalizeForSearch('N1ghtfang#LAN')).toBe('n1ghtfanglan');
  });
});

/**
 * El slug es la clave del enlace porque la URL la lee y la comparte gente: `?liga=caos` se
 * entiende, `?liga=CHAOS` no. La tabla existe porque los dos vocabularios no coinciden —el
 * preset de «competitivo» se llama `PRECISION`—, así que esto no se puede resolver con un
 * `toUpperCase()` por mucho que dos de los tres lo parezcan.
 */
describe('presetFromSlug', () => {
  it('traduce los tres slugs de la URL a su preset', () => {
    expect(presetFromSlug('equilibrado')).toBe('BALANCED');
    expect(presetFromSlug('caos')).toBe('CHAOS');
  });

  it('«competitivo» es PRECISION: el slug y el enum no se llaman igual', () => {
    expect(presetFromSlug('competitivo')).toBe('PRECISION');
  });

  it('no distingue mayúsculas: la URL la escribe gente', () => {
    expect(presetFromSlug('Caos')).toBe('CHAOS');
  });

  /** Un parámetro inventado no puede dejar la lista vacía por un filtro que nadie pidió. */
  it('un slug desconocido, vacío o ausente no filtra nada', () => {
    expect(presetFromSlug('pepe')).toBeNull();
    expect(presetFromSlug('')).toBeNull();
    expect(presetFromSlug(null)).toBeNull();
    expect(presetFromSlug(undefined)).toBeNull();
  });

  it('PRESET_SLUGS cubre los tres presets, sin huecos', () => {
    expect(Object.values(PRESET_SLUGS).sort()).toEqual(['caos', 'competitivo', 'equilibrado']);
  });
});
