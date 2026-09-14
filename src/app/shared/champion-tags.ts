/**
 * Traduce el vocabulario de clases de Riot, que llega en inglés en `ChampionSummary.tags`.
 *
 * Vive en `shared/` y no en `core/game-data` porque es presentación: el DTO guarda lo que manda el
 * servidor y la traducción es cosa de quien pinta. Son los seis valores que usa Riot y no hay más.
 */
const ETIQUETAS: Record<string, string> = {
  Assassin: 'Asesino',
  Fighter: 'Luchador',
  Mage: 'Mago',
  Marksman: 'Tirador',
  Support: 'Soporte',
  Tank: 'Tanque',
};

/** El rótulo en español, o el original si Riot añade una clase nueva. */
export function championTagLabel(tag: string): string {
  return ETIQUETAS[tag] ?? tag;
}
