import { describe, expect, it } from 'vitest';
import { hash, mapLeaderboardEntries, sparkPoints } from './group-ranking';
import { LeaderboardEntryResponse } from './leagues';

function entry(overrides: Partial<LeaderboardEntryResponse> = {}): LeaderboardEntryResponse {
  return {
    rank: 1,
    userId: 'user-1',
    discordUsername: 'Edu',
    avatarUrl: null,
    riotId: 'Edu#EUW',
    riotTier: 'DIAMOND',
    riotRank: 'II',
    riotStrength: 'VERIFIED',
    groupRole: 'MEMBER',
    lp: 1250,
    wins: 15,
    losses: 5,
    totalGames: 20,
    winrate: 75,
    streakCount: 3,
    streakType: 'WIN',
    isBanned: false,
    banReason: null,
    bannedUntil: null,
    lpHistory: [],
    avgLpGain: null,
    avgLpLoss: null,
    ...overrides,
  };
}

describe('mapLeaderboardEntries', () => {
  it('traduce una fila del backend conservando el puesto y el récord', () => {
    const [row] = mapLeaderboardEntries([entry()]);

    expect(row.playerId).toBe('user-1');
    expect(row.rank).toBe(1);
    expect(row.wins).toBe(15);
    expect(row.losses).toBe(5);
    expect(row.wr).toBe(75);
    expect(row.formattedLp).toContain('LP');
  });

  it.each([
    ['CHALLENGER', 'Challenger'],
    ['GRANDMASTER', 'Grandmaster'],
    ['MASTER', 'Master'],
    ['DIAMOND', 'Diamante'],
    ['EMERALD', 'Esmeralda'],
    ['PLATINUM', 'Platino'],
    ['GOLD', 'Oro'],
    ['SILVER', 'Plata'],
    ['BRONZE', 'Bronce'],
    ['IRON', 'Hierro'],
  ])('reconoce el tier %s y lo etiqueta en español', (tier, label) => {
    const [row] = mapLeaderboardEntries([entry({ riotTier: tier, riotRank: 'II' })]);

    expect(row.lolRank?.tier).toBe(tier);
    expect(row.lolRank?.label).toBe(`SoloQ: ${label} II`);
  });

  /**
   * La regresión que motivó ampliar la tabla de tiers: `validTiers` solo listaba siete, así que
   * `BRONZE`, `SILVER` e `IRON` caían al `GOLD` por defecto y un jugador de Hierro lucía escudo de
   * Oro. No era una degradación elegante, era un dato falso.
   */
  it('no disfraza de Oro a los tres tiers bajos', () => {
    for (const tier of ['SILVER', 'BRONZE', 'IRON']) {
      const [row] = mapLeaderboardEntries([entry({ riotTier: tier })]);
      expect(row.lolRank?.tier).toBe(tier);
      expect(row.lolRank?.label).not.toContain('Oro');
    }
  });

  it('deja el rango sin escudo cuando no hay cuenta de Riot, en vez de inventar uno', () => {
    const [row] = mapLeaderboardEntries([entry({ riotTier: null, riotRank: null, riotId: null })]);

    expect(row.lolRank).toBeNull();
    expect(row.tag).toBeNull();
    expect(row.opggUrl).toBeNull();
    // Sin Riot ID el nombre visible es el de Discord.
    expect(row.name).toBe('Edu');
  });

  it('omite la división en los tiers que no la tienen', () => {
    const [row] = mapLeaderboardEntries([entry({ riotTier: 'MASTER', riotRank: null })]);

    expect(row.lolRank?.label).toBe('SoloQ: Master');
  });

  it('descarta un tier que no reconoce en vez de asignarle uno cualquiera', () => {
    const [row] = mapLeaderboardEntries([entry({ riotTier: 'UNRANKED' })]);

    expect(row.lolRank).toBeNull();
  });

  it('parte el Riot ID en nombre y tagline', () => {
    const [row] = mapLeaderboardEntries([entry({ riotId: 'Hide on bush#KR1' })]);

    expect(row.name).toBe('Hide on bush');
    expect(row.tag).toBe('KR1');
  });

  /**
   * El corazón de D7: lo que el backend no sirve viaja como `null`, nunca como un valor plausible.
   * Antes eran constantes (`avgLpGain: 22`) y sorteos con semilla, que el usuario leía como reales.
   */
  it('marca como ausente todo lo que el backend todavía no sirve', () => {
    const [row] = mapLeaderboardEntries([entry()]);

    expect(row.lane).toBeNull();
    expect(row.mainChampionId).toBeNull();
  });

  it('dibuja la tendencia con la serie real del servidor', () => {
    const [row] = mapLeaderboardEntries([entry({ lpHistory: [10, 30, 50] })]);

    expect(row.sparkPath).not.toBeNull();
    expect(row.trend).toBe('up');
  });

  it('marca la tendencia a la baja cuando la serie termina por debajo de donde empezó', () => {
    const [row] = mapLeaderboardEntries([entry({ lpHistory: [80, 60, 20] })]);

    expect(row.trend).toBe('down');
  });

  /**
   * La tendencia sale de la SERIE, no de la racha.
   *
   * Antes se derivaba de `streakType`, así que alguien que había subido doscientos LP en la
   * temporada y acababa de perder una partida salía con la tendencia hacia abajo: la racha describe
   * la última partida, la tendencia describe el recorrido.
   */
  it('no confunde una derrota reciente con una tendencia a la baja', () => {
    const [row] = mapLeaderboardEntries([
      entry({ lpHistory: [10, 40, 90, 80], streakType: 'LOSS', streakCount: 1 }),
    ]);

    expect(row.trend).toBe('up');
  });

  it('sin serie no hay línea que dibujar, y un solo punto tampoco es una línea', () => {
    expect(mapLeaderboardEntries([entry({ lpHistory: [] })])[0].sparkPath).toBeNull();
    expect(mapLeaderboardEntries([entry({ lpHistory: [] })])[0].trend).toBeNull();
    expect(mapLeaderboardEntries([entry({ lpHistory: [42] })])[0].sparkPath).toBeNull();
  });

  it('pasa las medias reales tal cual, y deja null lo que aún no existe', () => {
    const [withBoth] = mapLeaderboardEntries([entry({ avgLpGain: 22, avgLpLoss: 18 })]);
    expect(withBoth.avgLpGain).toBe(22);
    expect(withBoth.avgLpLoss).toBe(18);

    // Quien solo ha ganado no tiene media de pérdida: null, no 0.
    const [onlyWon] = mapLeaderboardEntries([entry({ avgLpGain: 22, avgLpLoss: null })]);
    expect(onlyWon.avgLpLoss).toBeNull();
  });

  it('da trofeo al podio pero nunca a un sancionado', () => {
    const rows = mapLeaderboardEntries([
      entry({ rank: 1, userId: 'a' }),
      entry({ rank: 2, userId: 'b', isBanned: true }),
      entry({ rank: 4, userId: 'c' }),
    ]);

    expect(rows[0].trophyImg).toContain('Trofeo1');
    expect(rows[1].trophyImg).toBeNull();
    expect(rows[2].trophyImg).toBeNull();
  });

  /**
   * El motivo de la sanción viene del servidor. Antes la interfaz pintaba una constante escrita en
   * el cliente, la misma para todo el mundo, porque no había ningún motivo guardado en ninguna parte.
   */
  it('lleva el motivo y la vigencia reales de la sanción', () => {
    const [row] = mapLeaderboardEntries([
      entry({ isBanned: true, banReason: 'AFK reiterado', bannedUntil: '2026-12-31T23:59:59Z' }),
    ]);

    expect(row.banned).toBe(true);
    expect(row.banReason).toBe('AFK reiterado');
    expect(row.bannedUntil).toBe('2026-12-31T23:59:59Z');
  });

  it('deja el motivo a null cuando no hay sanción, sin inventarlo', () => {
    const [row] = mapLeaderboardEntries([entry()]);

    expect(row.banned).toBe(false);
    expect(row.banReason).toBeNull();
    expect(row.bannedUntil).toBeNull();
  });

  /**
   * Quién está sancionado lo dice el servidor en `isBanned`, ya derivado de SU reloj. Una sanción
   * vencida llega con `isBanned: false` aunque `bannedUntil` siga en la fila, y el cliente no
   * vuelve a comparar esa fecha con la suya: la sanción se levantó, y el podio también lo sabe.
   */
  it('no repinta como sancionada una sanción que el servidor ya dio por vencida', () => {
    const [row] = mapLeaderboardEntries([
      entry({ isBanned: false, banReason: 'AFK reiterado', bannedUntil: '2020-01-01T00:00:00Z' }),
    ]);

    expect(row.banned).toBe(false);
    expect(row.trophyImg).toContain('Trofeo1');
  });

  it('una sanción sin fecha es indefinida, no una sanción sin motivo', () => {
    const [row] = mapLeaderboardEntries([
      entry({ isBanned: true, banReason: 'Conducta antideportiva', bannedUntil: null }),
    ]);

    expect(row.banReason).toBe('Conducta antideportiva');
    expect(row.bannedUntil).toBeNull();
  });

  it('no pierde ni reordena filas: el orden lo decide el servidor', () => {
    const rows = mapLeaderboardEntries([
      entry({ rank: 3, userId: 'c' }),
      entry({ rank: 1, userId: 'a' }),
      entry({ rank: 2, userId: 'b' }),
    ]);

    expect(rows.map((r) => r.playerId)).toEqual(['c', 'a', 'b']);
  });

  it('devuelve lista vacía sin filas', () => {
    expect(mapLeaderboardEntries([])).toEqual([]);
  });
});

describe('hash', () => {
  it('es determinista y estable para la misma entrada', () => {
    expect(hash('abc')).toBe(hash('abc'));
    expect(hash('abc')).not.toBe(hash('abd'));
  });
});

describe('sparkPoints', () => {
  it('necesita al menos dos puntos para dibujar una línea', () => {
    expect(sparkPoints([5])).toBe('');
    expect(sparkPoints([])).toBe('');
  });

  it('reparte los puntos a lo ancho del lienzo', () => {
    const points = sparkPoints([0, 10], 100, 20).split(' ');

    expect(points).toHaveLength(2);
    expect(points[0]).toMatch(/^3\.0,/);
  });

  it('no divide por cero cuando la serie es plana', () => {
    expect(() => sparkPoints([7, 7, 7])).not.toThrow();
  });
});
