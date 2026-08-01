import { areaPath, barHeights, linePoints, scaleMax } from './svg-chart';

describe('svg-chart', () => {
  describe('linePoints', () => {
    it('devuelve vacío sin datos, para no pintar un polyline roto', () => {
      expect(linePoints([], 600, 160)).toBe('');
    });

    /** Con un punto no hay recta: se centra en vez de pegarse al borde izquierdo. */
    it('centra el único punto de una serie de uno', () => {
      expect(linePoints([5], 600, 160)).toBe('300.0,4.0');
    });

    it('reparte los puntos y pone el máximo arriba', () => {
      const points = linePoints([0, 10], 100, 100).split(' ');

      expect(points).toHaveLength(2);
      expect(points[0]).toBe('4.0,96.0');
      expect(points[1]).toBe('96.0,4.0');
    });

    /**
     * Una serie toda a cero se pinta plana abajo. Sin el suelo de 1 en `scaleMax` esto sería una
     * división por cero y el SVG saldría con NaN.
     */
    it('una serie toda a cero sale plana y sin NaN', () => {
      const points = linePoints([0, 0, 0], 100, 100);

      expect(points).not.toContain('NaN');
      expect(points).toBe('4.0,96.0 50.0,96.0 96.0,96.0');
    });

    /** Lo que hace legible la línea de 429 sobre la de llamadas. */
    it('acepta un máximo forzado para compartir escala con otra serie', () => {
      const shared = linePoints([1, 1], 100, 100, 10);
      const own = linePoints([1, 1], 100, 100);

      expect(shared).not.toBe(own);
      // Con máximo 10, un valor de 1 se queda abajo; con su propio máximo estaría arriba del todo.
      expect(shared).toBe('4.0,86.8 96.0,86.8');
      expect(own).toBe('4.0,4.0 96.0,4.0');
    });
  });

  describe('areaPath', () => {
    it('no dibuja área con menos de dos puntos', () => {
      expect(areaPath([], 600, 160)).toBe('');
      // Un área de un punto sería un segmento vertical, que se lee como un pico inventado.
      expect(areaPath([7], 600, 160)).toBe('');
    });

    it('cierra el camino contra la base', () => {
      const d = areaPath([0, 10], 100, 100);

      expect(d.startsWith('M 4.0 96.0')).toBe(true);
      expect(d.endsWith('Z')).toBe(true);
    });
  });

  describe('barHeights', () => {
    it('escala al máximo de la serie', () => {
      expect(barHeights([0, 5, 10])).toEqual([0, 50, 100]);
    });

    /** Un cero es cero; un valor pequeño nunca debe desaparecer y leerse como "no hubo nada". */
    it('da un mínimo visible a lo que no es cero, y nada a lo que sí', () => {
      const heights = barHeights([0, 1, 1000]);

      expect(heights[0]).toBe(0);
      expect(heights[1]).toBe(2);
      expect(heights[2]).toBe(100);
    });

    it('con la serie vacía no devuelve nada ni revienta', () => {
      expect(barHeights([])).toEqual([]);
    });
  });

  describe('scaleMax', () => {
    it('nunca baja de 1', () => {
      expect(scaleMax([])).toBe(1);
      expect(scaleMax([0, 0])).toBe(1);
      expect(scaleMax([3, 9])).toBe(9);
    });
  });
});
