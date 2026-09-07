/**
 * Los días y las horas que se pueden proponer al agendar una custom.
 *
 * Funciones puras sobre el `now` que se les pasa, para poder probarlas sin tocar el
 * reloj. Vivían dentro de `grupo-crear-partida.ts`; se mudaron aquí al pasar el
 * agendado a un modal (`Roadmap.md` §5.5.6), porque ahora las consume esa ventana y
 * no una pantalla entera.
 *
 * **Rediseño del 2026-09-07.** Antes ofrecían una tira de catorce días y una rejilla de
 * 17:00 a 23:30. Las dos cosas eran límites inventados por el cliente —ni el dominio
 * (`FlujoJuego.md` §4.2) ni el servidor imponen horizonte ni granularidad— y dejaban
 * fuera dos casos reales: convocar para dentro de un mes, y convocar una custom que no
 * sea de tarde-noche.
 */

/** Una celda de la rejilla del calendario. Las de relleno cuadran la semana y no se pulsan. */
export interface CalendarCell {
  /** "2026-09-14". Cadena vacía si es relleno. */
  value: string;
  /** "14". Cadena vacía si es relleno. */
  dayNumber: string;
  /** "lunes, 14 de septiembre". Es el nombre accesible del botón. */
  label: string;
  isWeekend: boolean;
  /** Anterior al día de `now`: no se puede proponer nada en él. */
  isPast: boolean;
  isToday: boolean;
  isFiller: boolean;
}

/** Un mes ya cuadriculado, empezando en lunes. */
export interface CalendarMonth {
  /** "2026-09". La clave con la que navega la ventana. */
  key: string;
  /** "septiembre de 2026". El año importa en cuanto se puede navegar sin tope. */
  label: string;
  /**
   * **Siempre** seis semanas de siete celdas. Un mes ocupa cinco o seis filas según en
   * qué día caiga el 1, y una rejilla que cambia de alto mueve el botón bajo el cursor
   * al pasar de mes.
   */
  weeks: CalendarCell[][];
  /** El mes mostrado es posterior al de `now`: la flecha de retroceder sirve para algo. */
  canGoBack: boolean;
}

/** Una hora ofrecida en la rejilla del día elegido. */
export interface HourOption {
  /** "2026-09-14T22:00", ya listo para la lista de propuestas. */
  value: string;
  /** "22:00". */
  label: string;
}

/** Las iniciales de la cabecera, empezando en lunes como en España. */
export const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

const MONTH_YEAR = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const FULL_DAY = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "2026-09" del instante dado. */
export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Suma meses a una clave sin desbordar: "2026-12" +1 → "2027-01". */
export function shiftMonth(key: string, delta: number): string {
  const [year, month] = key.split('-').map(Number);
  return monthKeyOf(new Date(year, month - 1 + delta, 1));
}

/** La rejilla de un mes. Pura sobre `now`: de él salen `isPast` e `isToday`. */
export function buildMonth(key: string, now: Date): CalendarMonth {
  const [year, month] = key.split('-').map(Number);
  const first = new Date(year, month - 1, 1);

  // `getDay()` es 0=domingo; aquí la semana empieza en lunes, así que el domingo va al final.
  const leading = (first.getDay() + 6) % 7;
  const total = new Date(year, month, 0).getDate();
  const todayValue = toDayValue(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const weeks: CalendarCell[][] = [];
  for (let week = 0; week < 6; week++) {
    const row: CalendarCell[] = [];
    for (let weekday = 0; weekday < 7; weekday++) {
      const dayNumber = week * 7 + weekday - leading + 1;
      if (dayNumber < 1 || dayNumber > total) {
        // Relleno en blanco, no el número del mes vecino: un "31" apagado que no se puede
        // pulsar es una trampa; un hueco no lo es.
        row.push(FILLER);
        continue;
      }
      const date = new Date(year, month - 1, dayNumber);
      const dow = date.getDay();
      const value = toDayValue(date);
      row.push({
        value,
        dayNumber: String(dayNumber),
        label: FULL_DAY.format(date),
        isWeekend: dow === 0 || dow === 6,
        isPast: date.getTime() < today,
        isToday: value === todayValue,
        isFiller: false,
      });
    }
    weeks.push(row);
  }

  return {
    key,
    label: MONTH_YEAR.format(first),
    weeks,
    canGoBack: year > now.getFullYear() || (year === now.getFullYear() && month - 1 > now.getMonth()),
  };
}

/** "lunes, 14 de septiembre", para el rótulo que confirma el día elegido. */
export function describeDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return FULL_DAY.format(new Date(year, month - 1, day));
}

/**
 * Las horas ofrecidas para un día, las veinticuatro en tramos de media hora. Si el día es
 * hoy, las que ya han pasado se caen — ofrecerlas sería ofrecer un 400 `SLOT_IN_THE_PAST`,
 * y devolver la lista vacía es lo que hace que la vista pueda decir "hoy ya no quedan
 * horas" en vez de enseñar una rejilla muerta.
 */
export function buildHours(dayValue: string, now: Date): HourOption[] {
  const hours: HourOption[] = [];
  for (let hour = 0; hour <= 23; hour++) {
    for (const minute of [0, 30]) {
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const at = new Date(`${dayValue}T${label}`);
      if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) continue;
      hours.push({ value: `${dayValue}T${label}`, label });
    }
  }
  return hours;
}

/** `Date` → "2026-09-14". A mano y no con `toISOString()`, que devolvería el día en UTC. */
export function toDayValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Una sola instancia: las celdas de relleno no se distinguen entre sí. */
const FILLER: CalendarCell = {
  value: '',
  dayNumber: '',
  label: '',
  isWeekend: false,
  isPast: true,
  isToday: false,
  isFiller: true,
};
