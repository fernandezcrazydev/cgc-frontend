import { describe, expect, it } from 'vitest';
import { ParticipantStats, toCrossMatches } from '../../../../core/matches';
import {
  bareParticipantFixture,
  matchFixture,
  participantFixture,
  statsFixture,
} from '../../../../core/matches/match-fixtures';
import { crossMetricRows } from './cross-compare';

const ME = 'me-uuid';
const RIVAL = 'rival-uuid';

/** El cruce mínimo: una partida enfrentados, con las cifras que se le pasen a cada uno. */
function cruce(mias: Partial<ParticipantStats> = {}, suyas: Partial<ParticipantStats> = {}) {
  const me = participantFixture({ userId: ME, slot: 'A', stats: statsFixture(mias) });
  const them = participantFixture({ userId: RIVAL, slot: 'B', stats: statsFixture(suyas) });
  return toCrossMatches(
    [matchFixture({ id: 'p1', a: [me], b: [them], userParticipant: me })],
    RIVAL,
  )[0];
}

describe('crossMetricRows', () => {
  it('reparte la barra según la proporción de cada uno sobre la suma', () => {
    const fila = crossMetricRows(cruce({ visionScore: 30 }, { visionScore: 10 })).find(
      (r) => r.key === 'vision',
    )!;

    expect(fila.minePct).toBe(75);
    expect(fila.theirsPct).toBe(25);
    expect(fila.winner).toBe('me');
  });

  /*
   * El oro del minuto 14 solo se compara cuando lo traen los DOS. Media barra con un lado vacío
   * se lee como «hizo cero», que no es lo que dice un dato ausente.
   */
  it('el oro del minuto 14 solo aparece si lo traen los dos', () => {
    const soloYo = crossMetricRows(cruce({ goldAt14: 5200 }, {}));
    expect(soloYo.some((r) => r.key === 'gold14')).toBe(false);

    const ambos = crossMetricRows(cruce({ goldAt14: 5200 }, { goldAt14: 4800 }));
    expect(ambos.find((r) => r.key === 'gold14')?.winner).toBe('me');
  });

  /*
   * La regla del contrato: sin subida no hay cifras, y una fila «—» contra «—» ocupa sitio sin
   * decir nada. Se descarta en vez de pintarse como un empate al 50 %.
   */
  it('una partida sin subir no produce filas de comparación', () => {
    const me = bareParticipantFixture({ userId: ME, slot: 'A' });
    const them = bareParticipantFixture({ userId: RIVAL, slot: 'B' });
    const sinSubida = toCrossMatches(
      [matchFixture({ id: 'p1', a: [me], b: [them], hasStats: false, userParticipant: me })],
      RIVAL,
    )[0];

    expect(crossMetricRows(sinSubida, true)).toEqual([]);
  });

  /** Un cero SÍ es un dato: cero puntos de visión describe una partida real. */
  it('un cero se compara; un dato ausente no', () => {
    const fila = crossMetricRows(cruce({ visionScore: 0 }, { visionScore: 12 })).find(
      (r) => r.key === 'vision',
    )!;

    expect(fila.noData).toBe(false);
    expect(fila.winner).toBe('them');
    expect(fila.mineText).toBe('0');
  });

  /** `extended` es lo que separa el desplegable, que se ojea, de la página, que se estudia. */
  it('la versión extendida añade las métricas que solo tienen sitio en la página', () => {
    const c = cruce();
    const cortas = crossMetricRows(c).map((r) => r.key);
    const largas = crossMetricRows(c, true).map((r) => r.key);

    expect(cortas).not.toContain('tanked');
    expect(largas).toContain('tanked');
    expect(largas.length).toBeGreaterThan(cortas.length);
  });
});
