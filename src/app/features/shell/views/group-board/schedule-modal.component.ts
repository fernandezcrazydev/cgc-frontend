import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NfButton } from '../../../../ui';
import { MAX_NOTE_LENGTH, MAX_SLOTS, RepeatOption } from '../../../../core/lobbies';
import {
  CalendarCell,
  HourOption,
  WEEKDAY_INITIALS,
  buildHours,
  buildMonth,
  describeDay,
  monthKeyOf,
  shiftMonth,
} from '../../../../shared/schedule-options';

/** Lo que se manda al convocar: las horas propuestas y la descripción opcional. */
export interface ScheduleDraft {
  /** Horas en el formato local de `datetime-local` ("2026-09-08T22:00"). */
  slotStartTimes: string[];
  note: string | null;
}

/** Una banda de la rejilla de horas, con su rótulo. */
interface HourBand {
  id: string;
  label: string;
  hours: HourOption[];
}

/** Las cuatro bandas que reparten las cuarenta y ocho pastillas del día. */
const BANDS: readonly { id: string; label: string; from: number; open: boolean }[] = [
  { id: 'madrugada', label: 'Madrugada', from: 0, open: false },
  { id: 'manana', label: 'Mañana', from: 6, open: false },
  { id: 'tarde', label: 'Tarde', from: 13, open: true },
  { id: 'noche', label: 'Noche', from: 20, open: true },
];

/**
 * Agendar una custom (§5.5.6): elige un día y hasta seis horas de ese día.
 *
 * **Un solo día por convocatoria.** Las horas propuestas son alternativas entre sí
 * («¿a las 19 o a las 21?»), y mezclar el martes con el sábado convierte esa pregunta
 * en otra distinta. Para otro día, otra convocatoria.
 *
 * **Rediseñado el 2026-09-07.** La versión anterior tenía tres límites que no eran del
 * dominio ni del servidor, sino del cliente: una tira de catorce días (no se podía
 * convocar para el mes que viene), una rejilla de 17:00 a 23:30 (no se podía convocar
 * por la mañana) y ninguna forma de repetir lo del otro día. Ahora hay un calendario sin
 * tope hacia delante, las veinticuatro horas en bandas y una tira de «repetir».
 *
 * Va todo en un componente y no en cuatro **a propósito**: cada `.scss` de más
 * redeclara su propia estructura, y el presupuesto `css-total-size` de `npm run arch`
 * está al límite y solo baja. El bloque del calendario lleva su BEM propio
 * (`.sm-cal__*`) para que promoverlo algún día a `ui/nf-calendar` sea mover, no
 * reescribir.
 */
@Component({
  selector: 'app-schedule-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NfButton],
  templateUrl: './schedule-modal.component.html',
  styleUrl: './schedule-modal.component.scss',
})
export class ScheduleModalComponent {
  /** Hay una convocatoria en vuelo: el botón se apaga para que no salgan dos. */
  readonly pending = input(false);

  /** Convocatorias recientes del grupo. Vacío: la tira de «repetir» no se pinta. */
  readonly recent = input<RepeatOption[]>([]);

  readonly create = output<ScheduleDraft>();

  protected readonly maxSlots = MAX_SLOTS;
  protected readonly maxNote = MAX_NOTE_LENGTH;
  protected readonly weekdays = WEEKDAY_INITIALS;

  /**
   * El instante en que se abrió la ventana. Todo se deriva de él y nada lo relee: si el
   * calendario se recalculara solo, cruzar la medianoche con el modal abierto movería el
   * día elegido bajo el dedo.
   */
  private readonly openedAt = new Date();

  protected readonly selectedDay = signal(toDayValue(this.openedAt));
  protected readonly note = signal('');

  /** El mes que se está mirando, "2026-09". Navegar no cambia el día elegido. */
  private readonly monthKey = signal(monthKeyOf(this.openedAt));

  /**
   * Las horas pedidas, sin fecha ("22:00"). Guardar la hora del día y no el instante es
   * lo que permite que «repetir» y elegir fecha funcionen en cualquier orden.
   */
  private readonly wantedTimes = signal<string[]>([]);

  /**
   * Las horas que vienen de una plantilla. `null` cuando no hay ninguna aplicada.
   * Es lo único que sobrevive a cambiar de día.
   */
  private readonly carried = signal<string[] | null>(null);

  protected readonly repeatId = signal<string | null>(null);

  /** Qué bandas están desplegadas. Las customs son de tarde-noche: la mañana empieza plegada. */
  private readonly openBands = signal<ReadonlySet<string>>(
    new Set(BANDS.filter((b) => b.open).map((b) => b.id)),
  );

  protected readonly month = computed(() => buildMonth(this.monthKey(), this.openedAt));

  protected readonly atFirstMonth = computed(() => !this.month().canGoBack);

  protected readonly chosenDay = computed(() => describeDay(this.selectedDay()));

  private readonly hours = computed(() => buildHours(this.selectedDay(), this.openedAt));

  private readonly offered = computed(() => new Set(this.hours().map((h) => h.label)));

  /**
   * Las horas partidas en bandas. Cuarenta y ocho pastillas iguales no se escanean;
   * cuatro grupos rotulados, sí. Una banda vacía no se pinta —a las 22:00 ya no hay tarde—.
   */
  protected readonly bands = computed<HourBand[]>(() => {
    const hours = this.hours();
    return BANDS.map((band, index) => {
      const to = BANDS[index + 1]?.from ?? 24;
      return {
        id: band.id,
        label: band.label,
        hours: hours.filter((h) => hourOf(h) >= band.from && hourOf(h) < to),
      };
    }).filter((band) => band.hours.length > 0);
  });

  /** Lo que de verdad se va a mandar: las horas pedidas que ese día todavía se ofrecen. */
  protected readonly picked = computed(() => {
    const day = this.selectedDay();
    const offered = this.offered();
    return this.wantedTimes()
      .filter((time) => offered.has(time))
      .map((time) => `${day}T${time}`);
  });

  /** Horas de la plantilla que en el día elegido ya han pasado. Se dicen, no se esconden. */
  protected readonly droppedTimes = computed(() => {
    const offered = this.offered();
    return this.wantedTimes().filter((time) => !offered.has(time));
  });

  protected readonly atLimit = computed(() => this.wantedTimes().length >= MAX_SLOTS);

  /** A partir del 90% el contador avisa; antes sería gritar durante novecientos caracteres. */
  protected readonly noteNearLimit = computed(() => this.note().length >= MAX_NOTE_LENGTH * 0.9);

  protected isOpen(bandId: string): boolean {
    return this.openBands().has(bandId);
  }

  protected toggleBand(bandId: string): void {
    this.openBands.update((open) => {
      const next = new Set(open);
      if (!next.delete(bandId)) next.add(bandId);
      return next;
    });
  }

  protected isPicked(label: string): boolean {
    return this.wantedTimes().includes(label);
  }

  /** "2026-09-08T22:00" → "22:00". */
  protected labelOf(value: string): string {
    return value.slice(11);
  }

  protected moveMonth(delta: number): void {
    if (delta < 0 && this.atFirstMonth()) return;
    this.monthKey.update((key) => shiftMonth(key, delta));
  }

  /**
   * Cambiar de día vacía lo elegido a mano: una convocatoria es de un solo día. Lo que
   * viene de una plantilla sí viaja, que es exactamente lo que se pidió al repetirla.
   */
  protected pickDay(cell: CalendarCell): void {
    if (cell.isPast || cell.isFiller || this.selectedDay() === cell.value) return;
    this.selectedDay.set(cell.value);
    this.wantedTimes.set(this.carried() ?? []);
  }

  protected toggleHour(label: string): void {
    const current = this.wantedTimes();
    let next: string[];
    if (current.includes(label)) next = current.filter((time) => time !== label);
    else if (current.length >= MAX_SLOTS) return;
    else next = [...current, label].sort();

    this.wantedTimes.set(next);
    // Retocar a mano no rompe la plantilla: la actualiza, para que el retoque viaje también.
    if (this.carried() !== null) this.carried.set(next);
  }

  protected applyRepeat(option: RepeatOption): void {
    if (this.repeatId() === option.id) {
      // Segundo clic: se suelta la plantilla. La descripción NO se borra — quitar texto
      // que el usuario está viendo es peor que dejarlo de más.
      this.repeatId.set(null);
      this.carried.set(null);
      this.wantedTimes.set([]);
      return;
    }
    this.repeatId.set(option.id);
    this.carried.set(option.times);
    this.wantedTimes.set(option.times);
    if (!this.note().trim()) this.note.set(option.note);
  }

  protected publish(): void {
    if (!this.picked().length || this.pending()) return;
    // El recorte también aquí: `maxlength` no ata lo que entra por «repetir».
    const note = this.note().trim().slice(0, MAX_NOTE_LENGTH);
    this.create.emit({ slotStartTimes: this.picked(), note: note || null });
  }
}

/** La hora en punto de una opción, para repartirla entre bandas. */
function hourOf(option: HourOption): number {
  return Number(option.label.slice(0, 2));
}

/** `Date` → "2026-09-08". Duplicado mínimo para no exportar de más desde `shared/`. */
function toDayValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
