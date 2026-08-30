import { describe, expect, it } from 'vitest';
import {
  CROSS_MIN_SAMPLE,
  aggregateCross,
  bestAllyOf,
  buildCrossMatches,
  buildCrossPartners,
  nemesisOf,
  participantKey,
} from './cross-history';
import { matchFixture as match, participantFixture as participant } from './match-fixtures';
import { Match, MatchParticipant } from './models';

const me = () => participant({ id: 'me', team: 'blue', riotId: 'N1ghtfang#LAN' });

describe('participantKey', () => {
  it('prefiere el userId y cae al Riot ID en minúsculas', () => {
    expect(participantKey(participant({ id: 'a', team: 'blue', userId: 'u-1' }))).toBe('u-1');
    expect(participantKey(participant({ id: 'b', team: 'blue', riotId: 'Pix3lQueen#LAN' }))).toBe(
      'pix3lqueen#lan',
    );
  });
});

describe('buildCrossMatches', () => {
  it('reparte por bando: mismo equipo es aliado y bando opuesto es rival', () => {
    const together = match({
      id: 'm1',
      blue: [me(), participant({ id: 'p1', team: 'blue', riotId: 'Pix3lQueen#LAN' })],
      red: [participant({ id: 'x', team: 'red' })],
      userParticipant: me(),
    });
    const against = match({
      id: 'm2',
      blue: [me()],
      red: [participant({ id: 'p2', team: 'red', riotId: 'Pix3lQueen#LAN' })],
      userParticipant: me(),
    });

    const cross = buildCrossMatches([together, against], 'Pix3lQueen#LAN');

    expect(cross.map((c) => c.relation).sort()).toEqual(['ally', 'enemy']);
  });

  it('devuelve una lista vacía si no habéis coincidido, sin prestar partidas ajenas', () => {
    const solo = match({
      id: 'm1',
      blue: [me()],
      red: [participant({ id: 'x', team: 'red', riotId: 'Otro#LAN' })],
      userParticipant: me(),
    });

    // Esto es la regresión que motivó el fichero: la versión anterior devolvía aquí las seis
    // primeras partidas del usuario y las pintaba como enfrentamientos contra este jugador.
    expect(buildCrossMatches([solo], 'Pix3lQueen#LAN')).toEqual([]);
  });

  it('compara la identidad completa, no por subcadena del nombre', () => {
    const m = match({
      id: 'm1',
      blue: [me()],
      red: [participant({ id: 'x', team: 'red', riotId: 'Nefarian#LAN' })],
      userParticipant: me(),
    });

    expect(buildCrossMatches([m], 'Nef#LAN')).toEqual([]);
    expect(buildCrossMatches([m], 'Nefarian#LAN')).toHaveLength(1);
  });

  it('marca el duelo de línea solo cuando compartís posición', () => {
    const sameLane = match({
      id: 'm1',
      blue: [me()],
      red: [participant({ id: 'x', team: 'red', riotId: 'Pix3lQueen#LAN', role: 'MID' })],
      userParticipant: me(),
    });
    const otherLane = match({
      id: 'm2',
      blue: [me()],
      red: [participant({ id: 'y', team: 'red', riotId: 'Pix3lQueen#LAN', role: 'TOP' })],
      userParticipant: me(),
    });

    const cross = buildCrossMatches([sameLane, otherLane], 'Pix3lQueen#LAN');
    expect(cross.find((c) => c.id === 'm1')!.sameLane).toBe(true);
    expect(cross.find((c) => c.id === 'm2')!.sameLane).toBe(false);
  });

  it('ordena de más reciente a más antigua', () => {
    const rival = (id: string) =>
      participant({ id, team: 'red', riotId: 'Pix3lQueen#LAN' });
    const older = match({
      id: 'viejo',
      decidedAt: '2026-01-01T10:00:00Z',
      blue: [me()],
      red: [rival('r1')],
      userParticipant: me(),
    });
    const newer = match({
      id: 'nuevo',
      decidedAt: '2026-06-01T10:00:00Z',
      blue: [me()],
      red: [rival('r2')],
      userParticipant: me(),
    });

    expect(buildCrossMatches([older, newer], 'Pix3lQueen#LAN').map((c) => c.id)).toEqual([
      'nuevo',
      'viejo',
    ]);
  });

  it('ignora las partidas que el usuario no jugó', () => {
    const ajena = match({
      id: 'm1',
      blue: [participant({ id: 'a', team: 'blue', riotId: 'Pix3lQueen#LAN' })],
      red: [participant({ id: 'b', team: 'red' })],
    });

    expect(buildCrossMatches([ajena], 'Pix3lQueen#LAN')).toEqual([]);
  });
});

describe('aggregateCross', () => {
  const rival = (over: Partial<MatchParticipant> = {}) =>
    participant({ id: 'r', team: 'red', riotId: 'Pix3lQueen#LAN', ...over });

  it('una lista vacía da ceros, nunca NaN', () => {
    const a = aggregateCross([]);
    expect(a.games).toBe(0);
    expect(a.winrate).toBe(0);
    expect(a.kdaMe).toBe(0);
    expect(a.streak).toBeNull();
  });

  it('el winrate se mide solo sobre partidas decididas', () => {
    const win = match({ id: 'w', blue: [me()], red: [rival()], userParticipant: me() });
    const cancelled = match({ id: 'c', blue: [me()], red: [rival()], userParticipant: me() });
    cancelled.userOutcome = 'cancelled';

    const a = aggregateCross(buildCrossMatches([win, cancelled], 'Pix3lQueen#LAN'));

    expect(a.games).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(0);
    expect(a.winrate).toBe(100);
  });

  it('la diferencia de oro solo cuenta las partidas en las que los dos traen el dato', () => {
    const conDato = match({
      id: 'a',
      blue: [participant({ id: 'me', team: 'blue', riotId: 'N1ghtfang#LAN', stats: { ...me().stats, goldAt14: 5500 } })],
      red: [rival({ stats: { ...me().stats, goldAt14: 5000 } })],
      userParticipant: participant({
        id: 'me',
        team: 'blue',
        riotId: 'N1ghtfang#LAN',
        stats: { ...me().stats, goldAt14: 5500 },
      }),
    });
    const sinDato = match({ id: 'b', blue: [me()], red: [rival()], userParticipant: me() });

    const a = aggregateCross(buildCrossMatches([conDato, sinDato], 'Pix3lQueen#LAN'));

    expect(a.goldAt14Games).toBe(1);
    expect(a.goldAt14Diff).toBe(500);
  });

  it('una partida anulada corta la racha sin abrir otra', () => {
    const reciente = match({
      id: 'a',
      decidedAt: '2026-06-03T10:00:00Z',
      blue: [me()],
      red: [rival()],
      userParticipant: me(),
    });
    reciente.userOutcome = 'cancelled';
    const anterior = match({
      id: 'b',
      decidedAt: '2026-06-02T10:00:00Z',
      blue: [me()],
      red: [rival()],
      userParticipant: me(),
    });

    expect(aggregateCross(buildCrossMatches([reciente, anterior], 'Pix3lQueen#LAN')).streak).toBeNull();
  });
});

describe('bestAllyOf / nemesisOf', () => {
  /** `n` partidas contra el mismo rival, de las cuales `wins` ganadas. */
  function duels(riotId: string, n: number, wins: number): Match[] {
    return Array.from({ length: n }, (_, i) =>
      match({
        id: `${riotId}-${i}`,
        decidedAt: `2026-06-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
        winningTeam: i < wins ? 'blue' : 'red',
        blue: [me()],
        red: [participant({ id: `${riotId}-p${i}`, team: 'red', riotId })],
        userParticipant: me(),
      }),
    );
  }

  it('la némesis es contra quien peor te va, no contra quien más juegas', () => {
    const partners = buildCrossPartners([
      ...duels('Facil#LAN', 8, 7),
      ...duels('Dificil#LAN', CROSS_MIN_SAMPLE, 0),
    ]);

    expect(nemesisOf(partners)?.riotId).toBe('Dificil#LAN');
  });

  it('no nombra a nadie sin muestra suficiente', () => {
    const partners = buildCrossPartners(duels('Casual#LAN', CROSS_MIN_SAMPLE - 1, 0));

    expect(nemesisOf(partners)).toBeNull();
    expect(bestAllyOf(partners)).toBeNull();
  });
});
