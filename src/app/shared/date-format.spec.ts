import { formatDurationUnits, formatRelativeTime } from './date-format';

/**
 * El "último acceso" de la pantalla de sesiones. Se prueba con un `now` fijo porque el valor es
 * exactamente lo que el usuario usa para decidir si una sesión es suya: "hace 3 horas" es
 * reconocible, "hace 43 días" no lo lee nadie, y un futuro por desfase de relojes no puede
 * aparecer como "dentro de 2 minutos" sobre algo que ya ocurrió.
 */
describe('formatRelativeTime', () => {
  const NOW = Date.parse('2026-09-04T12:00:00Z');

  it('lo de hace un instante es "ahora mismo", no "hace 0 minutos"', () => {
    expect(formatRelativeTime('2026-09-04T11:59:40Z', NOW)).toBe('ahora mismo');
  });

  it('cuenta en minutos dentro de la hora', () => {
    expect(formatRelativeTime('2026-09-04T11:35:00Z', NOW)).toBe('hace 25 minutos');
  });

  it('cuenta en horas dentro del día', () => {
    expect(formatRelativeTime('2026-09-04T09:00:00Z', NOW)).toBe('hace 3 horas');
  });

  it('cuenta en días durante la primera semana', () => {
    expect(formatRelativeTime('2026-09-01T12:00:00Z', NOW)).toBe('hace 3 días');
  });

  /** `numeric: 'auto'` es lo que convierte "hace 1 día" en "ayer", que es como se habla. */
  it('el día anterior se dice "ayer"', () => {
    expect(formatRelativeTime('2026-09-03T12:00:00Z', NOW)).toBe('ayer');
  });

  it('pasada la semana deja de ser relativo y da la fecha', () => {
    expect(formatRelativeTime('2026-06-23T21:45:00Z', NOW)).toBe('23 jun 2026');
  });

  /** El reloj del servidor y el del navegador no siempre coinciden; el futuro no se pinta. */
  it('una fecha en el futuro se lee como ahora mismo', () => {
    expect(formatRelativeTime('2026-09-04T12:02:00Z', NOW)).toBe('ahora mismo');
  });

  it('una fecha inválida no rompe la fila: devuelve cadena vacía', () => {
    expect(formatRelativeTime('no-es-una-fecha', NOW)).toBe('');
    expect(formatRelativeTime('', NOW)).toBe('');
  });
});

/**
 * La duración lleva unidades porque comparte fila con la hora de juego: «31:01» al lado de
 * «14 sept · 23:22» se lee como otra hora, y eso ya hizo creer que la duración media del grupo
 * estaba mal calculada cuando no lo estaba.
 */
describe('formatDurationUnits', () => {
  it('escribe minutos y segundos con su unidad', () => {
    expect(formatDurationUnits(1861)).toBe('31m 01s');
  });

  it('rellena el segundo a dos cifras, para que las filas se alineen', () => {
    expect(formatDurationUnits(1805)).toBe('30m 05s');
  });

  it('una partida de menos de un minuto sigue diciendo los minutos', () => {
    expect(formatDurationUnits(42)).toBe('0m 42s');
  });

  it('una duración imposible no rompe la fila', () => {
    expect(formatDurationUnits(-1)).toBe('0m 00s');
    expect(formatDurationUnits(Number.NaN)).toBe('0m 00s');
  });
});
