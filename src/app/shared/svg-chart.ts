/**
 * Helpers para dibujar gráficas con SVG a pelo, sin librería.
 *
 * El presupuesto de build son 500 kB (aviso) / 1 MB (error), y una librería de charts se come
 * buena parte de eso para pintar una línea y unas barras. `core/group-ranking.sparkPoints` ya
 * hace esto mismo para las sparklines del ranking; cuando ese placeholder de datos mock muera,
 * su función se pliega aquí.
 *
 * Todas las funciones son puras y trabajan en el espacio del `viewBox`: el SVG se estira con
 * `preserveAspectRatio="none"`, así que el tamaño real lo pone el CSS.
 */

/** Margen interior para que un punto en el máximo no quede pegado al borde. */
const PAD = 4;

/** El máximo con el que escalar. Nunca 0: una serie toda a cero se pinta plana, no divide por cero. */
export function scaleMax(values: number[]): number {
  return Math.max(...values, 1);
}

function pointsOf(values: number[], w: number, h: number, max: number): Array<[number, number]> {
  // Con un solo punto no hay recta que trazar: se coloca en el centro.
  const stepX = values.length > 1 ? (w - PAD * 2) / (values.length - 1) : 0;
  const offsetX = values.length > 1 ? PAD : w / 2;
  return values.map((v, i) => [offsetX + i * stepX, PAD + (h - PAD * 2) * (1 - v / max)]);
}

/**
 * Puntos para un `<polyline points="...">`. Cadena vacía si no hay datos.
 *
 * `max` se puede forzar para dibujar dos series en la misma escala. Es lo que hace legible la
 * línea de 429 sobre la de llamadas: con su propio máximo, dos rechazos ocuparían todo el alto
 * y parecerían una catástrofe.
 */
export function linePoints(values: number[], w: number, h: number, max = scaleMax(values)): string {
  if (values.length === 0) return '';
  return pointsOf(values, w, h, max)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
}

/**
 * `d` de un `<path>` cerrado contra la base, para el relleno bajo la línea. Necesita al menos
 * dos puntos: un área de un solo punto sería un segmento vertical, que se lee como un pico
 * inventado.
 */
export function areaPath(values: number[], w: number, h: number, max = scaleMax(values)): string {
  if (values.length < 2) return '';
  const points = pointsOf(values, w, h, max);
  const [firstX] = points[0];
  const [lastX] = points[points.length - 1];
  const line = points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  return `M ${firstX.toFixed(1)} ${(h - PAD).toFixed(1)} L ${line} L ${lastX.toFixed(1)} ${(h - PAD).toFixed(1)} Z`;
}

/**
 * Alturas en porcentaje para barras en CSS (`height: x%`).
 *
 * Un valor mayor que cero nunca baja de 2%: una barra de 0,3 px es invisible y se lee como
 * "no hubo nada", que es justo lo contrario de lo que dice el dato.
 */
export function barHeights(values: number[]): number[] {
  const max = scaleMax(values);
  return values.map((v) => (v === 0 ? 0 : Math.max(2, (v / max) * 100)));
}
