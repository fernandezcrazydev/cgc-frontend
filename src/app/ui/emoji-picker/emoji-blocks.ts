/**
 * El juego de emojis COMPLETO, sin descargar ni un byte de datos.
 *
 * En vez de empaquetar un catálogo de ~1.900 emojis con sus nombres —que habría que descargar,
 * versionar y traducir—, se recorren los bloques Unicode donde viven y se filtra cada carácter
 * con las propiedades que el propio motor de JavaScript ya conoce (`\p{Extended_Pictographic}` y
 * `\p{Emoji_Presentation}`). El resultado es la misma rejilla que enseña el teclado del sistema.
 *
 * Los rangos tienen huecos reservados que la fuente instalada no sabe dibujar y pinta como un
 * cuadrito: se descartan midiendo cada candidato una sola vez (ver `renderable`). Todo el trabajo
 * ocurre la primera vez que alguien abre el buscador y se queda cacheado en el módulo.
 *
 * Lo que NO da esto son los nombres, así que la búsqueda por palabra se queda en el catálogo
 * curado de `emoji-catalog.ts`; para el resto está el propio campo, que acepta cualquier emoji
 * escrito o pegado (Windows + `.` incluido).
 */

export interface EmojiBlock {
  id: string;
  label: string;
  /** Rangos de código, en pares [inicio, fin] inclusive. */
  ranges: readonly (readonly [number, number])[];
}

/**
 * Bloques Unicode agrupados como los agrupa el teclado del sistema. El orden es el de siempre:
 * primero las caras, que son el 90 % de lo que se usa.
 */
export const EMOJI_BLOCKS: readonly EmojiBlock[] = [
  {
    id: 'caras',
    label: 'Caras y personas',
    ranges: [
      [0x1f600, 0x1f64f],
      [0x1f900, 0x1f9ff],
      [0x1fac0, 0x1face],
    ],
  },
  {
    id: 'naturaleza',
    label: 'Animales y naturaleza',
    ranges: [
      [0x1f400, 0x1f4ac],
      [0x1f330, 0x1f37f],
      [0x1fab0, 0x1fabf],
    ],
  },
  {
    id: 'comida',
    label: 'Comida y bebida',
    ranges: [
      [0x1f345, 0x1f37f],
      [0x1f950, 0x1f96f],
      [0x1fad0, 0x1fadf],
    ],
  },
  {
    id: 'actividades',
    label: 'Actividades',
    ranges: [
      [0x1f380, 0x1f3ff],
      [0x1f930, 0x1f94f],
    ],
  },
  {
    id: 'viajes',
    label: 'Viajes y lugares',
    ranges: [
      [0x1f680, 0x1f6ff],
      [0x1f300, 0x1f32f],
    ],
  },
  {
    id: 'objetos',
    label: 'Objetos',
    ranges: [
      [0x1f4bb, 0x1f4ff],
      [0x1f500, 0x1f5ff],
      [0x1fa70, 0x1faaf],
    ],
  },
  {
    id: 'simbolos',
    label: 'Símbolos',
    ranges: [
      [0x2600, 0x27bf],
      [0x2b00, 0x2bff],
      [0x1f191, 0x1f19a],
    ],
  },
];

/** Cache del proceso: los bloques se resuelven una vez por sesión. */
const cache = new Map<string, string[]>();

/**
 * Los emojis de un bloque, ya filtrados y listos para pintar.
 *
 * `renderable` decide si la fuente del sistema sabe dibujar el carácter. Se pasa desde fuera
 * porque medir texto necesita un `canvas`, y `ui/` no debe asumir que hay DOM: en pruebas o en
 * un render de servidor se pasa `() => true` y la rejilla sale entera.
 */
export function emojisOf(block: EmojiBlock, renderable: (emoji: string) => boolean): string[] {
  const cached = cache.get(block.id);
  if (cached) return cached;

  const out: string[] = [];
  const seen = new Set<string>();
  for (const [from, to] of block.ranges) {
    for (let code = from; code <= to; code++) {
      const emoji = String.fromCodePoint(code);
      if (seen.has(emoji)) continue;
      if (!EMOJI_PRESENTATION.test(emoji)) continue;
      if (!renderable(emoji)) continue;
      seen.add(emoji);
      out.push(emoji);
    }
  }
  cache.set(block.id, out);
  return out;
}

/**
 * Solo los que se dibujan como emoji por defecto. Sin esto entran flechas, asteriscos y demás
 * símbolos de texto que el teclado del sistema tampoco enseña como emoji.
 */
const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;

/** ¿Es este texto un emoji? Lo usa el campo de búsqueda para aceptar lo que pegue el usuario. */
export function isEmoji(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return /^\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*$/u.test(
    text,
  );
}

/**
 * Fábrica del comprobador de dibujo: mide el carácter contra un hueco reservado que ninguna
 * fuente puede tener. Si miden lo mismo, lo que se vería es el cuadrito de «no sé pintar esto».
 */
export function createRenderableCheck(): (emoji: string) => boolean {
  if (typeof document === 'undefined') return () => true;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => true;

  ctx.font = '24px sans-serif';
  // U+1FFFD es un punto de código no asignado: nadie tiene glifo para él.
  const tofu = ctx.measureText(String.fromCodePoint(0x1fffd)).width;
  return (emoji: string) => {
    const width = ctx.measureText(emoji).width;
    return width > 0 && Math.abs(width - tofu) > 0.01;
  };
}
