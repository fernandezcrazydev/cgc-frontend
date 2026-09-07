import { LobbyResponse } from './models';

/**
 * «Repetir una convocatoria anterior»: convertir lo que el grupo ya convocó en una
 * plantilla de horas reutilizable.
 *
 * Existe porque una custom de grupo es semanal y casi siempre igual, y hasta el
 * 2026-09-07 proponer «las mismas horas que el viernes» obligaba a volver a pulsarlas
 * una a una.
 *
 * Vive en `core/lobbies` y no en `shared/` porque mapea `LobbyResponse`: `shared/` es
 * una hoja del grafo de dependencias y no puede importar de `core/` (lo vigila la regla
 * `layers` de `npm run arch`).
 */

/** Una convocatoria anterior ofrecida como plantilla. */
export interface RepeatOption {
  id: string;
  /** Horas del día, "HH:MM", ascendentes y sin repetir. */
  times: string[];
  /** "21:00 · 22:00". Lo que se va a copiar, escrito. */
  label: string;
  /** La nota de aquella convocatoria, para copiarla también. Cadena vacía si no tenía. */
  note: string;
  /** Cuántas horas tenía de verdad, cuando eran más de las que hoy caben. */
  originalCount: number;
  /** Se ha recortado al tope actual: el chip lo dice en vez de mentir. */
  truncated: boolean;
}

/**
 * Las convocatorias recientes del grupo, convertidas en plantillas.
 *
 * Pura sobre la lista: ni store ni reloj propio, para poder probarla sin montar nada.
 *
 * **No filtra por estado a propósito.** Una convocatoria cancelada es justo la mejor
 * candidata a repetirse —«no vino nadie, lo intento otra vez»— y una terminada es la
 * segunda. Quedarse solo con las vivas tiraría el historial que esta función existe
 * para reaprovechar.
 */
export function buildRepeatOptions(
  lobbies: readonly LobbyResponse[],
  maxSlots: number,
  limit = 3,
): RepeatOption[] {
  const seen = new Set<string>();
  const options: RepeatOption[] = [];

  for (const lobby of [...lobbies].sort(byNewest)) {
    if (!lobby.slots.length) continue;

    // El servidor guarda instantes UTC; quien convocó eligió una hora LOCAL, y es esa la
    // que hay que devolverle. Formatear en UTC le movería la propuesta una o dos horas.
    const all = [...new Set(lobby.slots.map((slot) => localTime(slot.startsAt)))].sort();
    if (!all.length) continue;

    const times = all.slice(0, maxSlots);
    const key = times.join('|');
    if (seen.has(key)) continue; // Cuatro copias de «21:00 · 22:00» no son cuatro atajos.
    seen.add(key);

    options.push({
      id: lobby.id,
      times,
      label: times.join(' · '),
      note: lobby.note ?? '',
      originalCount: all.length,
      truncated: all.length > times.length,
    });

    if (options.length >= limit) break;
  }

  return options;
}

/** "2026-09-05T19:00:00Z" → "21:00" en la zona de quien mira. */
function localTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

function byNewest(a: LobbyResponse, b: LobbyResponse): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}
