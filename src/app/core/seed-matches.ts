/**
 * Identidad de las partidas de la semilla de desarrollo, en un solo sitio.
 *
 * Varias maquetas (el muro del hub, los récords de estadísticas) tienen que
 * enlazar a una partida que exista de verdad en `core/matches/match-seed.ts`, y
 * hasta ahora cada una llevaba su propia copia del número 40 y su propio
 * `padStart`. Con dos copias basta para que un día una diga «Partida 41» y
 * mande a una pantalla vacía.
 *
 * No se importa `match-seed.ts` a propósito: ese fichero solo se carga fuera de
 * producción (`app.config.ts`), y traerlo aquí lo metería en el paquete inicial.
 *
 * BACKEND NOTE: muere con `GET /api/v1/matches`, igual que la semilla. A partir
 * de ahí el id de la partida lo manda quien la referencia.
 */

/** Cuántas partidas tiene la semilla (`MATCH_COUNT` de `core/matches/match-seed.ts`). */
export const SEEDED_MATCH_COUNT = 40;

/** El id de la partida número `n` de la semilla: `seed-001` … `seed-040`. */
export function seedMatchId(n: number): string {
  return 'seed-' + String(n).padStart(3, '0');
}
