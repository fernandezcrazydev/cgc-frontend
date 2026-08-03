import { buildQuickDays } from './grupo-crear-partida';

/**
 * Las horas sugeridas del formulario de convocar. Función pura sobre el instante que se le pasa,
 * precisamente para poder probar los bordes sin tocar el reloj del sistema.
 */
describe('buildQuickDays', () => {
  it('por la tarde ofrece las horas de hoy que quedan, y mañana', () => {
    // Un lunes a las 18:00: todas las horas de la noche están por venir.
    const days = buildQuickDays(new Date(2026, 7, 3, 18, 0));

    expect(days).toHaveLength(2);
    expect(days[0].label).toBe('Hoy');
    expect(days[0].slots.map((s) => s.label)).toEqual([
      '21:00', '21:30', '22:00', '22:30', '23:00', '23:30',
    ]);
    expect(days[1].label).toBe('Mañana');
  });

  /** Ofrecer las 21:00 a las 22:15 sería ofrecer un 400 `SLOT_IN_THE_PAST`. */
  it('las horas de hoy que ya han pasado no se ofrecen', () => {
    const days = buildQuickDays(new Date(2026, 7, 3, 22, 15));

    expect(days[0].label).toBe('Hoy');
    expect(days[0].slots.map((s) => s.label)).toEqual(['22:30', '23:00', '23:30']);
  });

  /** De madrugada "hoy" ya no tiene nada que ofrecer: el día entero se cae de la lista. */
  it('pasadas todas las horas, hoy desaparece y entra el día siguiente', () => {
    const days = buildQuickDays(new Date(2026, 7, 3, 23, 45));

    expect(days).toHaveLength(2);
    expect(days.map((d) => d.label)).toEqual(['Mañana', 'miércoles']);
  });

  it('el valor es el que entiende un datetime-local, en hora local', () => {
    const days = buildQuickDays(new Date(2026, 7, 3, 18, 0));

    expect(days[0].slots[0].value).toBe('2026-08-03T21:00');
    // Mañana es el día siguiente, no la misma fecha con otra hora.
    expect(days[1].slots[0].value).toBe('2026-08-04T21:00');
  });

  /** Sin esto, un cambio de mes o de año daría "2026-08-32" y el input lo rechazaría en silencio. */
  it('cruza bien el fin de mes', () => {
    const days = buildQuickDays(new Date(2026, 7, 31, 23, 45));

    expect(days[0].slots[0].value).toBe('2026-09-01T21:00');
  });

  it('siempre devuelve dos días con horas disponibles', () => {
    for (const hour of [0, 6, 12, 20, 21, 22, 23]) {
      const days = buildQuickDays(new Date(2026, 7, 3, hour, 0));
      expect(days).toHaveLength(2);
      expect(days.every((d) => d.slots.length > 0)).toBe(true);
    }
  });
});
