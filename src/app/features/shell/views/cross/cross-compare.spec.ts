import { describe, expect, it } from 'vitest';
import { aggregateCross, buildCrossMatches } from '../../../../core/matches';
import { matchFixture, participantFixture } from '../../../../core/matches/match-fixtures';
import { aggregateMetricRows, crossMetricRows } from './cross-compare';

/** El cruce mínimo: una partida enfrentados, con las cifras que se le pasen a cada uno. */
function cruce(mias: Record<string, number> = {}, suyas: Record<string, number> = {}) {
  const me = participantFixture({
    id: 'me',
    team: 'blue',
    riotId: 'Yo#LAN',
    stats: { ...participantFixture({ id: 'x', team: 'blue' }).stats, ...mias },
  });
  const them = participantFixture({
    id: 'ellos',
    team: 'red',
    riotId: 'Rival#LAN',
    stats: { ...participantFixture({ id: 'y', team: 'red' }).stats, ...suyas },
  });
  return buildCrossMatches(
    [matchFixture({ id: 'p1', blue: [me], red: [them], userParticipant: me })],
    'Rival#LAN',
  );
}

describe('aggregateMetricRows', () => {
  /*
   * Con los dos valores a cero la barra se reparte 50/50 para que la fila conserve su altura.
   * Eso se leía como «vais empatados», cuando lo que pasa es que esa métrica no la registra
   * ninguna partida. La fila lo dice ahora explícitamente.
   */
  it('una métrica que ninguna partida registra se marca como sin datos, no como empate', () => {
    const filas = aggregateMetricRows(aggregateCross([]));
    const sinDatos = filas.filter((f) => f.noData);

    expect(sinDatos.length).toBeGreaterThan(0);
    for (const f of sinDatos) {
      expect(f.minePct).toBe(50);
      expect(f.winner).toBe('tie');
    }
  });

  it('un empate de verdad no se marca como sin datos', () => {
    const filas = aggregateMetricRows(aggregateCross(cruce()));
    const cs = filas.find((f) => f.key === 'cs')!;

    expect(cs.winner).toBe('tie');
    expect(cs.noData).toBe(false);
  });

  it('con cifras distintas gana quien más tiene y la barra lo refleja', () => {
    const filas = aggregateMetricRows(aggregateCross(cruce({ csPerMin: 9 }, { csPerMin: 3 })));
    const cs = filas.find((f) => f.key === 'cs')!;

    expect(cs.winner).toBe('me');
    expect(cs.noData).toBe(false);
    expect(cs.minePct).toBe(75);
    expect(cs.theirsPct).toBe(25);
  });

  it('las dos mitades de cada barra suman siempre cien', () => {
    for (const f of aggregateMetricRows(aggregateCross(cruce({ cs: 200 })))) {
      expect(f.minePct + f.theirsPct).toBe(100);
    }
  });
});

describe('crossMetricRows', () => {
  it('la comparativa de una partida usa las mismas reglas de sin datos', () => {
    const filas = crossMetricRows(cruce({ visionScore: 0 }, { visionScore: 0 })[0]);
    const vision = filas.find((f) => f.key === 'vision');

    if (vision) {
      expect(vision.noData).toBe(true);
      expect(vision.winner).toBe('tie');
    }
  });
});
