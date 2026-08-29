/**
 * Formateo de fechas, duraciones y cifras para presentación, en español.
 *
 * Existe porque el modelo `Match` traía `dateFormatted` y `durationFormatted` ya cocinados
 * dentro del DTO, y eso ata el contrato a un formato: con la cadena ya hecha no se puede
 * pasar a «hace 2 h», ni cambiar el orden de fecha y hora, sin tocar el backend. La regla
 * del proyecto es clara: el backend manda ISO-8601 y segundos, y el formato se decide aquí.
 *
 * DEUDA CONOCIDA: hay ~9 vistas (`ajustes`, `perfil`, `grupo-partidas`, `grupo-sala`,
 * `grupo-crear-partida`, `core/notifications/notification-view`…) que construyen su propio
 * `Intl.DateTimeFormat('es-ES', …)` a mano. Consolidarlas aquí es trabajo de otro pase; este
 * módulo nace ya listo para recibirlas.
 */

/**
 * Los `Intl.DateTimeFormat` se construyen una vez y se reutilizan: instanciarlos por llamada
 * es de lo más caro que hay en una lista que se repinta con cada tecla del buscador.
 */
const DAY_MONTH = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const HOUR_MINUTE = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** `'2026-06-23T21:45:00Z'` → `'23 jun · 21:45'`. Cadena vacía si la fecha no es válida. */
export function formatMatchDate(iso: string): string {
  const date = parse(iso);
  if (!date) return '';
  // El mes corto de `es-ES` llega como "jun." con punto; sobra dentro de una línea con separador.
  const day = DAY_MONTH.format(date).replace('.', '');
  return `${day} · ${HOUR_MINUTE.format(date)}`;
}

/** `'2026-06-23T21:45:00Z'` → `'23 jun 2026'`, para cabeceras donde el año importa. */
export function formatLongDate(iso: string): string {
  const date = parse(iso);
  if (!date) return '';
  return DAY_MONTH_YEAR.format(date).replace('.', '');
}

/**
 * Segundos → `'32:14'`. Las partidas de LoL nunca llegan a la hora, así que no hay caso de
 * `h:mm:ss`; si alguna vez lo hicieran, saldría `'61:07'`, que se sigue leyendo bien.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** Segundos → `'32 min'`, para cuando el segundo exacto no aporta (duración media, resúmenes). */
export function formatDurationMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} min`;
}

/**
 * `12432` → `'12,4k'`. Para oro y daño, donde la cifra exacta es ruido y lo que se compara es
 * el orden de magnitud. Por debajo de mil se devuelve el número tal cual.
 *
 * La coma no es un capricho: en la misma fila del marcador conviven esta función y
 * `formatNumber` (`'19.400'`, separador de millares de es-ES). Con el punto decimal de
 * `toFixed`, el mismo carácter significaba millares en una cifra y decimales en la de al lado.
 */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) < 1000) return String(Math.round(value));
  return `${(value / 1000).toFixed(1).replace('.', ',')}k`;
}

/** `12432` → `'12.432'`. Cifra exacta con separador de millares español. */
export function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('es-ES') : '0';
}

/** `3` → `'3.º'`. Ordinal masculino, que es como se dice una posición de clasificación. */
export function formatOrdinal(position: number): string {
  return `${Math.round(position)}.º`;
}

function parse(iso: string): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}
