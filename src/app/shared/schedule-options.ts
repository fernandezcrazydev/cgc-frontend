/**
 * Los días y las horas que se pueden proponer al agendar una custom.
 *
 * Funciones puras sobre el `now` que se les pasa, para poder probarlas sin tocar el
 * reloj. Vivían dentro de `grupo-crear-partida.ts`; se mudaron aquí al pasar el
 * agendado a un modal (`Roadmap.md` §5.5.6), porque ahora las consume esa ventana y
 * no una pantalla entera.
 */

/** Un día de la tira horizontal del selector. */
export interface DayOption {
  /** "2026-08-03". Es el prefijo con el que se agrupan las horas elegidas de ese día. */
  value: string;
  /** "HOY", "MAR"… lo que va arriba del chip. */
  weekday: string;
  /** "3". El número grande. */
  dayNumber: string;
  /** "hoy", "mañana", "jue 6": para frases dentro de un botón. */
  longLabel: string;
  /**
   * "sábado, 6 de septiembre". Se pinta bajo la tira: un "6" suelto no confirma que
   * hayas pulsado lo que creías.
   */
  fullLabel: string;
  /** "septiembre". Encabeza la tira, que puede cruzar el cambio de mes sin avisar. */
  monthLabel: string;
  /** Sábado o domingo: es cuando se juegan las customs, y conviene distinguirlo. */
  isWeekend: boolean;
}

/** Una hora ofrecida en la rejilla del día elegido. */
export interface HourOption {
  /** "2026-08-03T22:00", ya listo para la lista de propuestas. */
  value: string;
  /** "22:00". */
  label: string;
}

/**
 * Cuántos días se pueden proponer. Dos semanas: cubre "este finde" y "el que viene", que es lo
 * más lejos que un grupo de amigos se organiza de verdad, y cabe en un par de gestos de pulgar.
 */
export const DAYS_AHEAD = 14;

/**
 * La franja horaria que se ofrece en la rejilla. De la tarde a medianoche, en tramos de media
 * hora: es cuando se juegan las customs.
 */
const HOUR_FROM = 17;
const HOUR_TO = 23;

/** Construye los días seleccionables desde `now`. Puro sobre `now`, para poder probarlo. */
export function buildDays(now: Date, howMany: number): DayOption[] {
  const days: DayOption[] = [];
  for (let offset = 0; offset < howMany; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
      .format(date)
      .replace('.', '')
      .toUpperCase();
    const dow = date.getDay();
    days.push({
      value: toLocalInputValue(date).slice(0, 10),
      weekday: offset === 0 ? 'HOY' : offset === 1 ? 'MAÑ' : weekday,
      dayNumber: String(date.getDate()),
      longLabel:
        offset === 0
          ? 'hoy'
          : offset === 1
            ? 'mañana'
            : `${weekday.toLowerCase()} ${date.getDate()}`,
      fullLabel: new Intl.DateTimeFormat('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(date),
      monthLabel: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(date),
      isWeekend: dow === 0 || dow === 6,
    });
  }
  return days;
}

/**
 * Las horas ofrecidas para un día. Si el día es hoy, las que ya han pasado se caen — ofrecerlas
 * sería ofrecer un 400 `SLOT_IN_THE_PAST`, y devolver la lista vacía es lo que hace que la vista
 * pueda decir "hoy ya no quedan horas" en vez de enseñar una rejilla muerta.
 */
export function buildHours(dayValue: string, now: Date): HourOption[] {
  const hours: HourOption[] = [];
  for (let hour = HOUR_FROM; hour <= HOUR_TO; hour++) {
    for (const minute of [0, 30]) {
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const at = new Date(`${dayValue}T${label}`);
      if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) continue;
      hours.push({ value: `${dayValue}T${label}`, label });
    }
  }
  return hours;
}

/**
 * `Date` → el valor que entiende un `<input type="datetime-local">` ("2026-08-07T22:00").
 *
 * A mano y no con `toISOString()`: ese devuelve UTC, y el input interpreta lo que recibe como
 * hora LOCAL. Usarlo desplazaría el mínimo tantas horas como diga la zona del usuario, que en
 * España son una o dos — suficiente para dejar elegir una hora ya pasada.
 */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
