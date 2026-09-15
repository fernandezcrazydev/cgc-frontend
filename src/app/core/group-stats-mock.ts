/**
 * Lo que queda de la maqueta de estadisticas del grupo (`Roadmap.md` §5.5.5).
 *
 * **La pantalla de estadisticas ya no pasa por aqui.** Migro a `core/group-stats/`, que habla con
 * `GET /groups/{id}/stats`; de aquel fichero de 900 lineas solo sobreviven los nueve exports de
 * abajo, y solo porque los siguen usando pantallas que aun son maqueta:
 *
 *   - `StatModality` y compania — el ranking del grupo, el hub y la grafica de LP. Es el vocabulario
 *     VIEJO de las modalidades, y el de verdad ya existe: `MatchPreset` en `core/matches`, donde el
 *     preset que aqui se llama `COMPETITIVE` se llama `PRECISION`. Al migrar esas pantallas, esto se
 *     borra y se usa aquel.
 *   - `groupModalitiesConfig` — **adivina** que temporadas ha jugado un grupo a partir de un hash de
 *     su id, y por eso llega a ofrecer una "Temporada 2024" que nadie jugo. Su sustituto real es
 *     `GET /groups/{id}/stats/scopes`, que ya existe y ya lo usa la pantalla de estadisticas.
 *   - `banRateFor` — la tier list de campeones (`core/champions/champion-stats-mock.ts`), que tiene
 *     su propia migracion pendiente. El banrate de verdad viaja ya en `StatChampionTally.bans`.
 *
 * BACKEND NOTE: fichero PLACEHOLDER, y cada uno de esos tres tiene su endpoint ya escrito. Esto
 * muere entero cuando la ultima de esas pantallas deje de importarlo; no se le anade nada.
 */
import { seeded, hash } from './group-ranking';

export type StatModality = 'COMPETITIVE' | 'BALANCED' | 'CHAOS';

/** Los tres rótulos, en el orden en que se pintan. Es el único sitio donde se escriben. */
export const MODALITY_LABELS: Record<StatModality, 'Competitivo' | 'Equilibrado' | 'Caos'> = {
  COMPETITIVE: 'Competitivo',
  BALANCED: 'Equilibrado',
  CHAOS: 'Caos',
};

/** El trozo de URL de cada modalidad: `?liga=caos`. Minúsculas y sin acentos. */
export const MODALITY_SLUGS: Record<StatModality, string> = {
  COMPETITIVE: 'competitivo',
  BALANCED: 'equilibrado',
  CHAOS: 'caos',
};

export function modalitySlug(m: StatModality): string {
  return MODALITY_SLUGS[m];
}

/** `null` si el slug no es ninguno de los tres: un parámetro inventado no elige nada. */
export function modalityFromSlug(slug: string | null | undefined): StatModality | null {
  if (!slug) return null;
  const normalized = slug.toLowerCase();
  for (const [key, value] of Object.entries(MODALITY_SLUGS) as [StatModality, string][]) {
    if (value === normalized) {
      return key;
    }
  }
  return null;
}

export interface GroupModalitySeason {
  id: string;
  label: string;
  played: boolean;
}

export interface GroupModalityConfig {
  modality: StatModality;
  label: string;
  played: boolean;
  seasons: GroupModalitySeason[];
}

/** Configuración determinista de modalidades y temporadas disputadas para un grupo. */
export function groupModalitiesConfig(groupId: string): GroupModalityConfig[] {
  const rnd = seeded(hash(groupId + ':modalities:v2'));
  const compHas2024 = rnd() > 0.4;
  const balHas2025 = rnd() > 0.3;
  const chaosPlayed = rnd() > 0.25;

  return [
    {
      modality: 'COMPETITIVE',
      label: MODALITY_LABELS.COMPETITIVE,
      played: true,
      seasons: [
        { id: 'current', label: 'Temporada 2026', played: true },
        { id: 'past-2025', label: 'Temporada 2025', played: true },
        { id: 'past-2024', label: 'Temporada 2024', played: compHas2024 },
      ],
    },
    {
      modality: 'BALANCED',
      label: MODALITY_LABELS.BALANCED,
      played: true,
      seasons: [
        { id: 'current', label: 'Temporada 2026', played: true },
        { id: 'past-2025', label: 'Temporada 2025', played: balHas2025 },
        { id: 'past-2024', label: 'Temporada 2024', played: false },
      ],
    },
    {
      modality: 'CHAOS',
      label: MODALITY_LABELS.CHAOS,
      played: chaosPlayed,
      seasons: [
        { id: 'current', label: 'Temporada 2026', played: chaosPlayed },
        { id: 'past-2025', label: 'Temporada 2025', played: false },
        { id: 'past-2024', label: 'Temporada 2024', played: false },
      ],
    },
  ];
}

/** Calcula deterministamente el banrate (0-45%) de un campeón para un grupo. */
export function banRateFor(groupId: string, championId: number): number {
  const rnd = seeded(hash(groupId + ':metagame:' + championId));
  return Math.round(rnd() * 45);
}
