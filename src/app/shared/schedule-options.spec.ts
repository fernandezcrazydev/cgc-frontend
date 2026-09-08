import { buildHours, buildMonth, describeDay, shiftMonth } from './schedule-options';

/**
 * Las funciones puras del selector de día y hora. Reciben el instante en vez de leer el
 * reloj, precisamente para poder probar los bordes sin tocar la hora del sistema.
 */
describe('buildMonth', () => {
  it('siempre son seis semanas de siete días, para que la rejilla no cambie de alto', () => {
    const grid = buildMonth('2026-09', new Date(2026, 8, 7, 12, 0));

    expect(grid.weeks).toHaveLength(6);
    for (const week of grid.weeks) expect(week).toHaveLength(7);
  });

  /** Septiembre de 2026 empieza en martes, así que la primera casilla es un filler previo al 1 de sept. */
  it('la semana empieza en lunes y se rellena con huecos filler', () => {
    const grid = buildMonth('2026-09', new Date(2026, 8, 7, 12, 0));

    expect(grid.weeks[0][0].isFiller).toBe(true);
    expect(grid.weeks[0][1].value).toBe('2026-09-01');
    expect(grid.weeks[0][1].isFiller).toBe(false);
  });

  it('marca los fines de semana, que es cuando se juegan las customs', () => {
    const grid = buildMonth('2026-09', new Date(2026, 8, 7, 12, 0));

    expect(grid.weeks[0].map((d) => d.isWeekend)).toEqual([
      false, false, false, false, false, true, true,
    ]);
  });

  /** No se puede convocar para ayer: esos días van deshabilitados. */
  it('los días anteriores a hoy quedan marcados como pasados, y hoy no', () => {
    const grid = buildMonth('2026-09', new Date(2026, 8, 7, 23, 30));
    const days = grid.weeks.flat();

    expect(days.find((d) => d.value === '2026-09-06')?.isPast).toBe(true);
    expect(days.find((d) => d.value === '2026-09-07')?.isPast).toBe(false);
    expect(days.find((d) => d.value === '2026-09-08')?.isPast).toBe(false);
  });

  it('hacia atrás no se puede pasar del mes actual, hacia delante no hay tope', () => {
    const now = new Date(2026, 8, 7, 12, 0);

    expect(buildMonth('2026-09', now).canGoBack).toBe(false);
    expect(buildMonth('2026-10', now).canGoBack).toBe(true);
    expect(buildMonth('2027-03', now).canGoBack).toBe(true);
  });

  it('rotula el mes con su año, que a seis meses vista deja de ser obvio', () => {
    expect(buildMonth('2027-01', new Date(2026, 8, 7)).label).toContain('2027');
  });
});

describe('shiftMonth', () => {
  it('cruza bien el fin de año en los dos sentidos', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2027-01', -1)).toBe('2026-12');
  });
});

describe('describeDay', () => {
  it('escribe el día entero, porque un número suelto no confirma nada', () => {
    expect(describeDay('2026-09-14')).toBe('lunes, 14 de septiembre');
  });
});

describe('buildHours', () => {
  /** Antes empezaba a las 17:00 y una custom de sábado por la mañana no se podía convocar. */
  it('ofrece las veinticuatro horas en tramos de media hora', () => {
    const hours = buildHours('2026-08-10', new Date(2026, 7, 3, 12, 0));

    expect(hours[0].label).toBe('00:00');
    expect(hours[hours.length - 1].label).toBe('23:30');
    expect(hours).toHaveLength(48);
  });

  it('el valor ya viene listo para la lista de propuestas', () => {
    const hours = buildHours('2026-08-10', new Date(2026, 7, 3, 12, 0));

    expect(hours[0].value).toBe('2026-08-10T00:00');
  });

  /** Ofrecer las 17:00 a las 22:15 sería ofrecer un 400 `SLOT_IN_THE_PAST`. */
  it('en el día de hoy, las horas que ya pasaron no se ofrecen', () => {
    const hours = buildHours('2026-08-03', new Date(2026, 7, 3, 22, 15));

    expect(hours.map((h) => h.label)).toEqual(['22:30', '23:00', '23:30']);
  });

  /**
   * De madrugada no queda ninguna, y devolver la lista vacía es lo que permite a la vista decir
   * "hoy ya no quedan horas" en vez de enseñar una rejilla muerta.
   */
  it('devuelve vacío cuando el día de hoy ya se ha agotado', () => {
    expect(buildHours('2026-08-03', new Date(2026, 7, 3, 23, 45))).toEqual([]);
  });

  it('un día futuro ofrece el día entero aunque hoy esté agotado', () => {
    const hours = buildHours('2026-08-04', new Date(2026, 7, 3, 23, 45));

    expect(hours).toHaveLength(48);
  });
});
