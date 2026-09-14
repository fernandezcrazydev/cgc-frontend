import { describe, expect, it } from 'vitest';
import { banda, facetScores, formatFacetScore, facetScoreAriaLabel } from './player-score';
import { PlayerDna } from './player-profile';

describe('PlayerScore · banda()', () => {
  it('un valor en el extremo bajo da 1 y uno por debajo también da 1 (recorte)', () => {
    expect(banda(40, 40, 55, 70)).toBe(1);
    expect(banda(30, 40, 55, 70)).toBe(1);
    expect(banda(0, 40, 55, 70)).toBe(1);
  });

  it('un valor en el extremo alto da 10 y uno por encima también da 10 (recorte)', () => {
    expect(banda(70, 40, 55, 70)).toBe(10);
    expect(banda(85, 40, 55, 70)).toBe(10);
    expect(banda(100, 40, 55, 70)).toBe(10);
  });

  it('el valor medio de la banda da 5.5', () => {
    expect(banda(55, 40, 55, 70)).toBe(5.5);
    expect(banda(0, -400, 0, 400)).toBe(5.5);
    expect(banda(28, 15, 28, 45)).toBe(5.5);
  });

  it('la métrica invertida funciona: 8 muertes puntúa peor que 2.5', () => {
    // bajo: 8 (nota 1), medio: 5 (nota 5.5), alto: 2.5 (nota 10)
    const nota8 = banda(8, 8, 5, 2.5);
    const nota5 = banda(5, 8, 5, 2.5);
    const nota2_5 = banda(2.5, 8, 5, 2.5);
    const nota10 = banda(10, 8, 5, 2.5);
    const nota1 = banda(1, 8, 5, 2.5);

    expect(nota8).toBe(1);
    expect(nota5).toBe(5.5);
    expect(nota2_5).toBe(10);
    expect(nota10).toBe(1); // Peor que 8 muertes sigue siendo 1
    expect(nota1).toBe(10);  // Mejor que 2.5 muertes sigue siendo 10
    expect(nota8).toBeLessThan(nota2_5);
  });
});

describe('PlayerScore · facetScores()', () => {
  const dummyDna: PlayerDna = {
    lane: {
      wonLanePercentage: 55,
      avgGoldDiffAt14: 0,
      avgCsDiffAt14: 0,
    },
    combat: {
      damageSharePercentage: 27,
      damagePerMin: 600,
      killParticipation: 62,
    },
    vision: {
      visionScoreAvg: 28,
      wardsPlacedAvg: 1.3,
      wardsKilledAvg: 4,
    },
    survival: {
      avgDeaths: 5,
      damageTakenAvg: 1200,
    },
    economy: {
      csPerMinAvg: 7.2,
      goldPerMinAvg: 440,
    },
    clutch: {
      mvpRate: 18,
      firstBloodRate: 25,
    },
  };

  const dummyExtra = {
    kda: 3.0,
    pentas: 2,
  };

  it('todos los valores medios dan nota 5.5 en las 6 facetas con rol neutro', () => {
    const scores = facetScores(dummyDna, dummyExtra, null);
    expect(scores.lane).toBe(5.5);
    expect(scores.combat).toBe(5.5);
    expect(scores.vision).toBe(5.5);
    expect(scores.survival).toBe(5.5);
    expect(scores.economy).toBe(5.5);
    expect(scores.clutch).toBe(5.5);
  });

  it('el ajuste por rol cambia el resultado: el mismo csPerMinAvg da notas distintas para SUPPORT y MID', () => {
    const midScores = facetScores(dummyDna, dummyExtra, 'MID');
    const supScores = facetScores(dummyDna, dummyExtra, 'SUPPORT');

    // Para MID: 7.2 es el valor medio (5.5).
    // Para SUPPORT: 7.2 está muy por encima del alto (3.5), por lo que da 10.
    expect(midScores.economy).toBe(5.5);
    expect(supScores.economy).toBe(8.2); // (10 * 0.6) + (5.5 * 0.4) = 6 + 2.2 = 8.2
    expect(midScores.economy).not.toBe(supScores.economy);
  });

  it('el ajuste por rol en visión da notas distintas para SUPPORT y MID', () => {
    const midScores = facetScores(dummyDna, dummyExtra, 'MID');
    const supScores = facetScores(dummyDna, dummyExtra, 'SUPPORT');

    // Con visionScoreAvg: 28
    // MID: banda 15-28-45 -> nota 5.5 en s1
    // SUPPORT: banda 30-50-75 -> 28 está por debajo de 30 -> nota 1 en s1
    expect(midScores.vision).toBe(5.5);
    expect(supScores.vision).toBe(3.3); // (1 * 0.5) + (5.5 * 0.25) + (5.5 * 0.25) = 0.5 + 2.75 = 3.25 -> 3.3
  });

  it('role: null usa la banda neutra y no lanza', () => {
    expect(() => facetScores(dummyDna, dummyExtra, null)).not.toThrow();
    const scores = facetScores(dummyDna, dummyExtra, null);
    expect(scores.combat).toBe(5.5);
    expect(scores.economy).toBe(5.5);
    expect(scores.vision).toBe(5.5);
  });

  it('una métrica ausente devuelve null para esa faceta, no 0', () => {
    const incompleteDna: Partial<PlayerDna> = {
      lane: {
        wonLanePercentage: 60,
        avgGoldDiffAt14: 100,
        avgCsDiffAt14: NaN, // Invalida lane
      },
    };

    const scores = facetScores(incompleteDna as PlayerDna, null, null);
    expect(scores.lane).toBeNull();
    expect(scores.combat).toBeNull();
    expect(scores.vision).toBeNull();
    expect(scores.survival).toBeNull();
    expect(scores.economy).toBeNull();
    expect(scores.clutch).toBeNull();
  });

  it('un jugador con muchas muertes saca peor nota en Supervivencia que uno con pocas', () => {
    const dnaMuertesAltas: PlayerDna = {
      ...dummyDna,
      survival: { avgDeaths: 8, damageTakenAvg: 1000 },
    };
    const dnaMuertesBajas: PlayerDna = {
      ...dummyDna,
      survival: { avgDeaths: 2.5, damageTakenAvg: 1000 },
    };

    const scoreMalo = facetScores(dnaMuertesAltas, { kda: 1.5, pentas: 0 }, null);
    const scoreBueno = facetScores(dnaMuertesBajas, { kda: 5.0, pentas: 0 }, null);

    expect(scoreMalo.survival).toBe(1.0);
    expect(scoreBueno.survival).toBe(10.0);
    expect(scoreMalo.survival!).toBeLessThan(scoreBueno.survival!);
  });

  it('las notas se redondean a una sola décima', () => {
    const dnaRealista: PlayerDna = {
      lane: { wonLanePercentage: 58, avgGoldDiffAt14: 120, avgCsDiffAt14: 3.2 },
      combat: { damageSharePercentage: 24, damagePerMin: 550, killParticipation: 60 },
      vision: { visionScoreAvg: 22, wardsPlacedAvg: 1.1, wardsKilledAvg: 3 },
      survival: { avgDeaths: 4.2, damageTakenAvg: 800 },
      economy: { csPerMinAvg: 6.8, goldPerMinAvg: 410 },
      clutch: { mvpRate: 15, firstBloodRate: 20 },
    };

    const scores = facetScores(dnaRealista, { kda: 3.4, pentas: 1 }, 'MID');
    for (const key of Object.keys(scores) as (keyof typeof scores)[]) {
      const val = scores[key];
      if (val !== null) {
        const decimals = String(val).split('.')[1];
        expect(decimals ? decimals.length : 0).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('PlayerScore · Formato y accesibilidad', () => {
  it('formatFacetScore formatea con coma decimal y — para null/inválido', () => {
    expect(formatFacetScore(7.4)).toBe('7,4');
    expect(formatFacetScore(5)).toBe('5,0');
    expect(formatFacetScore(10)).toBe('10,0');
    expect(formatFacetScore(null)).toBe('—');
    expect(formatFacetScore(undefined)).toBe('—');
    expect(formatFacetScore(NaN)).toBe('—');
  });

  it('facetScoreAriaLabel genera texto descriptivo', () => {
    expect(facetScoreAriaLabel(7.4)).toBe('Nota de esta faceta: 7,4 sobre 10');
    expect(facetScoreAriaLabel(null)).toBeNull();
  });
});
