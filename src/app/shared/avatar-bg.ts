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
