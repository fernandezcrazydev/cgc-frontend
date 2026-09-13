/**
 * Ligas de un grupo y sus temporadas — PLACEHOLDER DESECHABLE.
 *
 * Todo lo de aquí es maqueta determinista sembrada por el id del grupo, igual que
 * `group-hub.ts`: un mismo grupo pinta siempre los mismos números hasta que exista el
 * endpoint. No es lógica de negocio que haya que cuidar; es el hueco con la forma exacta
 * de la respuesta futura, para que la interfaz se pueda diseñar y probar.
 *
 * BACKEND NOTE: al migrar, `GET /groups/{id}/leagues` traerá las tres ligas con su
 * ordinal, su nombre actual y sus fechas reales, y este fichero se borra entero
 * (`CLAUDE.md` § estrategia mock → backend: nunca conviven mock y real para el mismo dato).
 */
import { leagueSeriesFor } from './group-hub';
import { hash, seeded } from './group-ranking';
import { StatModality } from './group-stats';

export type LeagueSeasonState = 'NOT_STARTED' | 'IN_PROGRESS';

export interface GroupLeague {
  modality: StatModality;      // 'COMPETITIVE' | 'BALANCED' | 'CHAOS'
  label: string;               // 'Competitivo' | 'Equilibrado' | 'Caos'
  state: LeagueSeasonState;
  /** 'Temp. 3', o null si la liga no ha empezado nunca. De `leagueSeriesFor()`. */
  ordinal: string | null;
  /** 'Copa del Nexo', o null si no ha empezado. De `leagueSeriesFor()`. */
  seasonName: string | null;
  /** false = arrancó sin owner ni admin y conserva el nombre por defecto. */
  named: boolean;
  /** Meses configurados. Por defecto 6 / 3 / 2 según la modalidad. */
  durationMonths: number;
  /** '4 dic 2026', o null si no ha empezado. */
  endsAtLabel: string | null;
  /** 0–100, o null si no ha empezado. */
  progress: number | null;
  /** Id de la skin de trofeo. Hoy solo existe 'clasica'. */
  skinId: string;
}

const DEFAULT_DURATIONS: Record<StatModality, number> = {
  COMPETITIVE: 6,
  BALANCED: 3,
  CHAOS: 2,
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function groupLeaguesFor(groupId: string): GroupLeague[] {
  const seriesList = leagueSeriesFor(groupId);

  return seriesList.map((series) => {
    const durationMonths = DEFAULT_DURATIONS[series.modality];

    if (!series.started) {
      return {
        modality: series.modality,
        label: series.label,
        state: 'NOT_STARTED',
        ordinal: null,
        seasonName: null,
        named: false,
        durationMonths,
        endsAtLabel: null,
        progress: null,
        skinId: 'clasica',
      };
    }

    const currentSeason = series.seasons[0];
    const ordinal = currentSeason?.ordinal ?? null;
    const seasonName = currentSeason?.name ?? null;

    const rndNamed = seeded(hash(groupId + '::' + series.modality + '::named'));
    // Sale false en 1 de cada 4 ligas empezadas (~25%)
    const named = rndNamed() >= 0.25;

    const rndConfig = seeded(hash(groupId + '::' + series.modality + '::config'));
    // Progreso entre 12 % y 85 %
    const progress = Math.round(12 + rndConfig() * (85 - 12));

    const remainingFraction = Math.max(0, 1 - progress / 100);
    const remainingDays = Math.round(durationMonths * 30.4375 * remainingFraction);
    const now = new Date();
    const targetDate = new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000);
    const endsAtLabel = `${targetDate.getDate()} ${MONTHS[targetDate.getMonth()]} ${targetDate.getFullYear()}`;

    return {
      modality: series.modality,
      label: series.label,
      state: 'IN_PROGRESS',
      ordinal,
      seasonName,
      named,
      durationMonths,
      endsAtLabel,
      progress,
      skinId: 'clasica',
    };
  });
}
