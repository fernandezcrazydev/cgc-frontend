import { buildDays, buildHours } from './grupo-crear-partida';

/**
 * Las dos funciones puras del selector de día y hora. Reciben el instante en vez de leer el
 * reloj, precisamente para poder probar los bordes sin tocar la hora del sistema.
 */
describe('buildDays', () => {
  it('empieza en hoy y ofrece tantos días como se le pidan', () => {
    const days = buildDays(new Date(2026, 7, 3, 18, 0), 14);

    expect(days).toHaveLength(14);
    expect(days[0].value).toBe('2026-08-03');
    expect(days[13].value).toBe('2026-08-16');
  });

  it('los dos primeros días se nombran hoy y mañana, el resto por su día de la semana', () => {
    const days = buildDays(new Date(2026, 7, 3, 18, 0), 4);

    expect(days.map((d) => d.weekday)).toEqual(['HOY', 'MAÑ', 'MIÉ', 'JUE']);
    expect(days.map((d) => d.longLabel)).toEqual(['hoy', 'mañana', 'mié 5', 'jue 6']);
  });

  it('el número es el del día del mes, para el chip', () => {
    const days = buildDays(new Date(2026, 7, 3, 18, 0), 3);

    expect(days.map((d) => d.dayNumber)).toEqual(['3', '4', '5']);
  });

  /** Sin esto, un cambio de mes daría "2026-08-32" y ninguna hora de ese día ligaría. */
  it('cruza bien el fin de mes y el fin de año', () => {
    expect(buildDays(new Date(2026, 7, 31, 12, 0), 2)[1].value).toBe('2026-09-01');
    expect(buildDays(new Date(2026, 11, 31, 12, 0), 2)[1].value).toBe('2027-01-01');
  });
});

describe('buildHours', () => {
  it('ofrece la franja de tarde-noche en tramos de media hora', () => {
    const hours = buildHours('2026-08-10', new Date(2026, 7, 3, 12, 0));

    expect(hours[0].label).toBe('17:00');
    expect(hours[hours.length - 1].label).toBe('23:30');
    expect(hours).toHaveLength(14);
  });

  it('el valor ya viene listo para la lista de propuestas', () => {
    const hours = buildHours('2026-08-10', new Date(2026, 7, 3, 12, 0));

    expect(hours[0].value).toBe('2026-08-10T17:00');
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

  it('un día futuro ofrece la franja entera aunque hoy esté agotado', () => {
    const hours = buildHours('2026-08-04', new Date(2026, 7, 3, 23, 45));

    expect(hours).toHaveLength(14);
  });
});
