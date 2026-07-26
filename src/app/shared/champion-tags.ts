/**
 * Traducción de las etiquetas de campeón (`ChampionSummary.tags`). El backend
 * las manda en el vocabulario de Riot, en inglés a propósito (es el mismo que
 * usa ddragon internamente); el front es dueño del texto en español, igual
 * que con los `code` de error de `core/http/api-error.ts`.
 */
export const TAG_LABELS: Record<string, string> = {
  Mage: 'Maga',
  Assassin: 'Asesina',
  Fighter: 'Luchadora',
  Tank: 'Tanque',
  Marksman: 'Tiradora',
  Support: 'Soporte',
};

/** Traduce un tag de Riot; si llega uno sin catalogar, se muestra tal cual. */
export function championTagLabel(tag: string): string {
  return TAG_LABELS[tag] ?? tag;
}
