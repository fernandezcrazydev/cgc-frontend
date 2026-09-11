/**
 * BACKEND NOTE:
 * Las notas de ADN calculadas aquí son un placeholder desechable del agregado que
 * devolverá el backend junto a las estadísticas del jugador. Cuando el endpoint
 * exista, este fichero se borrará entero y las notas vendrán directamente del DTO.
 */

import { PlayerDna } from './player-profile';
import { LaneRole } from './preferences';

/** Las seis notas de un jugador, en el mismo orden en que se pintan las tarjetas. */
export interface PlayerFacetScores {
  lane: number | null;
  combat: number | null;
  vision: number | null;
  survival: number | null;
  economy: number | null;
  clutch: number | null;
}

export interface PlayerScoreExtra {
  kda?: number | null;
  pentas?: number | null;
}

/**
 * Interpola un valor `v` en una banda de tres puntos (bajo → 1, medio → 5.5, alto → 10)
 * y recorta el resultado a [1, 10].
 * Admite bandas invertidas cuando `alto < bajo` (menos muertes es mejor).
 */
export function banda(v: number, bajo: number, medio: number, alto: number): number {
  if (typeof v !== 'number' || Number.isNaN(v)) return NaN;
  const t = (bajo < alto ? v <= medio : v >= medio)
    ? 1 + 4.5 * ((v - bajo) / (medio - bajo))
    : 5.5 + 4.5 * ((v - medio) / (alto - medio));
  return Math.min(10, Math.max(1, t));
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function isValid(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v);
}

export function facetScores(
  dna: PlayerDna | null | undefined,
  extra: PlayerScoreExtra | null | undefined,
  role: LaneRole | null = null,
): PlayerFacetScores {
  if (!dna) {
    return {
      lane: null,
      combat: null,
      vision: null,
      survival: null,
      economy: null,
      clutch: null,
    };
  }

  // 1. Fase de líneas (@14)
  let lane: number | null = null;
  if (
    dna.lane &&
    isValid(dna.lane.wonLanePercentage) &&
    isValid(dna.lane.avgGoldDiffAt14) &&
    isValid(dna.lane.avgCsDiffAt14)
  ) {
    const s1 = banda(dna.lane.wonLanePercentage, 40, 55, 70);
    const s2 = banda(dna.lane.avgGoldDiffAt14, -400, 0, 400);
    const s3 = banda(dna.lane.avgCsDiffAt14, -10, 0, 10);
    lane = round1(s1 * 0.5 + s2 * 0.25 + s3 * 0.25);
  }

  // 2. Combate y daño
  let combat: number | null = null;
  if (
    dna.combat &&
    isValid(dna.combat.damageSharePercentage) &&
    isValid(dna.combat.damagePerMin) &&
    isValid(dna.combat.killParticipation)
  ) {
    let s1: number;
    if (role === 'SUPPORT') {
      s1 = banda(dna.combat.damageSharePercentage, 8, 13, 18);
    } else if (role === 'TOP' || role === 'JUNGLA') {
      s1 = banda(dna.combat.damageSharePercentage, 15, 22, 29);
    } else {
      // mid, adc y sin rol
      s1 = banda(dna.combat.damageSharePercentage, 20, 27, 34);
    }
    const s2 = banda(dna.combat.damagePerMin, 400, 600, 820);
    const s3 = banda(dna.combat.killParticipation, 45, 62, 82);
    combat = round1(s1 * 0.5 + s2 * 0.25 + s3 * 0.25);
  }

  // 3. Visión y mapa
  let vision: number | null = null;
  if (
    dna.vision &&
    isValid(dna.vision.visionScoreAvg) &&
    isValid(dna.vision.wardsPlacedAvg) &&
    isValid(dna.vision.wardsKilledAvg)
  ) {
    const s1 =
      role === 'SUPPORT'
        ? banda(dna.vision.visionScoreAvg, 30, 50, 75)
        : banda(dna.vision.visionScoreAvg, 15, 28, 45);
    const s2 = banda(dna.vision.wardsPlacedAvg, 0.6, 1.3, 2.0);
    const s3 = banda(dna.vision.wardsKilledAvg, 1, 4, 8);
    vision = round1(s1 * 0.5 + s2 * 0.25 + s3 * 0.25);
  }

  // 4. Supervivencia
  let survival: number | null = null;
  if (
    dna.survival &&
    isValid(dna.survival.avgDeaths) &&
    extra &&
    isValid(extra.kda)
  ) {
    const s1 = banda(dna.survival.avgDeaths, 8, 5, 2.5);
    const s2 = banda(extra.kda, 1.5, 3.0, 5.0);
    survival = round1(s1 * 0.6 + s2 * 0.4);
  }

  // 5. Economía y farm
  let economy: number | null = null;
  if (
    dna.economy &&
    isValid(dna.economy.csPerMinAvg) &&
    isValid(dna.economy.goldPerMinAvg)
  ) {
    let s1: number;
    if (role === 'SUPPORT') {
      s1 = banda(dna.economy.csPerMinAvg, 1.0, 2.0, 3.5);
    } else if (role === 'JUNGLA') {
      s1 = banda(dna.economy.csPerMinAvg, 4.5, 6.0, 7.5);
    } else {
      // líneas y sin rol
      s1 = banda(dna.economy.csPerMinAvg, 5.5, 7.2, 9.0);
    }
    const s2 = banda(dna.economy.goldPerMinAvg, 340, 440, 540);
    economy = round1(s1 * 0.6 + s2 * 0.4);
  }

  // 6. Factor decisivo
  let clutch: number | null = null;
  if (
    dna.clutch &&
    isValid(dna.clutch.mvpRate) &&
    isValid(dna.clutch.firstBloodRate) &&
    extra &&
    isValid(extra.pentas)
  ) {
    const s1 = banda(dna.clutch.mvpRate, 5, 18, 32);
    const s2 = banda(dna.clutch.firstBloodRate, 10, 25, 42);
    const s3 = banda(extra.pentas, 0, 2, 5);
    clutch = round1(s1 * 0.6 + s2 * 0.25 + s3 * 0.15);
  }

  return { lane, combat, vision, survival, economy, clutch };
}

export function formatFacetScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) return '—';
  return score.toFixed(1).replace('.', ',');
}

export function facetScoreAriaLabel(score: number | null | undefined): string | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  return `Nota de esta faceta: ${formatFacetScore(score)} sobre 10`;
}
