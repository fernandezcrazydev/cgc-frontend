import { describe, expect, it } from 'vitest';
import { buildRepeatOptions } from './repeat-options';
import { LobbyResponse, LobbyStatus } from './models';

/**
 * Las plantillas de «repetir». Función pura sobre la lista, así que se prueba sin store.
 *
 * Las horas se construyen con `new Date(...).toISOString()` a propósito: así el fixture
 * dice «las nueve de la noche en la zona de quien mira» y la prueba no se rompe según en
 * qué huso corra el CI.
 */
function lobby(
  id: string,
  hours: [number, number][],
  extra: Partial<LobbyResponse> = {},
): LobbyResponse {
  return {
    id,
    groupId: 'g1',
    code: 'WX4K',
    mode: 'OPEN',
    status: 'FINISHED' as LobbyStatus,
    capacity: 10,
    note: null,
    openedBy: { userId: 'u1', discordUsername: 'edu', avatarUrl: null, joinedAt: '' },
    confirmedSlotId: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    slots: hours.map(([h, m], index) => ({
      id: `${id}-s${index}`,
      startsAt: new Date(2026, 8, 5, h, m).toISOString(),
      signedUp: 0,
      starters: [],
      bench: [],
    })),
    ...extra,
  } as LobbyResponse;
}

describe('buildRepeatOptions', () => {
  it('devuelve las horas locales, ascendentes y escritas', () => {
    const options = buildRepeatOptions([lobby('a', [[22, 0], [21, 0]])], 6);

    expect(options).toHaveLength(1);
    expect(options[0].times).toEqual(['21:00', '22:00']);
    expect(options[0].label).toBe('21:00 · 22:00');
  });

  it('ordena por la más reciente', () => {
    const options = buildRepeatOptions(
      [
        lobby('vieja', [[19, 0]], { createdAt: '2026-08-01T10:00:00.000Z' }),
        lobby('nueva', [[23, 0]], { createdAt: '2026-09-02T10:00:00.000Z' }),
      ],
      6,
    );

    expect(options.map((o) => o.id)).toEqual(['nueva', 'vieja']);
  });

  /** El backend admite ocho franjas y el cliente aprieta a seis: se dice, no se miente. */
  it('recorta al tope actual y avisa de cuántas había', () => {
    const ocho: [number, number][] = [
      [16, 0], [17, 0], [18, 0], [19, 0], [20, 0], [21, 0], [22, 0], [23, 0],
    ];
    const options = buildRepeatOptions([lobby('a', ocho)], 6);

    expect(options[0].times).toHaveLength(6);
    expect(options[0].originalCount).toBe(8);
    expect(options[0].truncated).toBe(true);
  });

  it('cuatro copias del mismo juego de horas no son cuatro atajos', () => {
    const options = buildRepeatOptions(
      [
        lobby('a', [[21, 0], [22, 0]], { createdAt: '2026-09-02T10:00:00.000Z' }),
        lobby('b', [[21, 0], [22, 0]], { createdAt: '2026-09-01T10:00:00.000Z' }),
        lobby('c', [[23, 0]], { createdAt: '2026-08-30T10:00:00.000Z' }),
      ],
      6,
    );

    expect(options.map((o) => o.id)).toEqual(['a', 'c']);
  });

  /**
   * Una convocatoria cancelada es justo la mejor candidata a repetirse —«no vino nadie,
   * lo intento otra vez»—, así que no se filtra por estado.
   */
  it('ofrece también las canceladas y las terminadas', () => {
    const options = buildRepeatOptions(
      [
        lobby('cancelada', [[21, 0]], { status: 'CANCELLED', createdAt: '2026-09-02T10:00:00.000Z' }),
        lobby('terminada', [[22, 0]], { status: 'FINISHED', createdAt: '2026-09-01T10:00:00.000Z' }),
      ],
      6,
    );

    expect(options.map((o) => o.id)).toEqual(['cancelada', 'terminada']);
  });

  it('descarta las convocatorias sin franjas y respeta el límite', () => {
    const options = buildRepeatOptions(
      [
        lobby('sin-franjas', []),
        lobby('a', [[20, 0]], { createdAt: '2026-09-04T10:00:00.000Z' }),
        lobby('b', [[21, 0]], { createdAt: '2026-09-03T10:00:00.000Z' }),
        lobby('c', [[22, 0]], { createdAt: '2026-09-02T10:00:00.000Z' }),
        lobby('d', [[23, 0]], { createdAt: '2026-09-01T10:00:00.000Z' }),
      ],
      6,
      3,
    );

    expect(options.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('una convocatoria sin nota trae la descripción vacía, no nula', () => {
    expect(buildRepeatOptions([lobby('a', [[21, 0]])], 6)[0].note).toBe('');
  });
});
