/**
 * Degradado radial para el fallback de un avatar sin foto, a partir de un
 * `hue` (0-360). Hoy está duplicado tal cual en `grupo-crear-partida.ts` y
 * `grupo-sala.ts`; se centraliza aquí para que el resto de vistas lo
 * compartan. Migrar esos duplicados a este helper es trabajo de otro pase
 * (no se borran aquí, para no pisar al agente que toca esas vistas).
 */
export function avatarBg(hue: number): string {
  return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
}
