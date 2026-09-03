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

/**
 * Tono (0-360) estable derivado de un identificador, para el avatar de reserva de
 * quien no tiene foto de Discord.
 *
 * Es presentación pura, no dato de dominio: el mismo id da siempre el mismo color,
 * y por eso una persona se reconoce por su tinte entre pantallas. Vive aquí porque
 * lo necesitan la sala del hub, la sala en directo y el banquillo: con una copia por
 * vista, el día que cambie la fórmula la misma persona saldría de dos colores.
 */
export function hueFromId(id: string): number {
  let hue = 0;
  for (let i = 0; i < id.length; i++) hue = (hue * 31 + id.charCodeAt(i)) % 360;
  return hue;
}
