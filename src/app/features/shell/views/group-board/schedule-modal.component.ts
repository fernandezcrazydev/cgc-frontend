import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NfButton } from '../../../../ui';
import { MAX_NOTE_LENGTH, MAX_SLOTS } from '../../../../core/lobbies';
import { DAYS_AHEAD, HourOption, buildDays, buildHours } from '../../../../shared/schedule-options';

/** Lo que se manda al convocar: las horas propuestas y la nota opcional. */
export interface ScheduleDraft {
  /** Horas en el formato local de `datetime-local` ("2026-09-08T22:00"). */
  slotStartTimes: string[];
  note: string | null;
}

/** Una banda de la rejilla de horas, con su rótulo. */
interface HourBand {
  id: 'tarde' | 'noche';
  label: string;
  hours: HourOption[];
}

/** A partir de esta hora empieza la banda de noche. */
const NIGHT_FROM = 20;

/**
 * Agendar una custom (§5.5.6): elige un día y hasta seis horas de ese día.
 *
 * **Un solo día por convocatoria.** Las horas propuestas son alternativas entre sí
 * («¿a las 19 o a las 21?»), y mezclar el martes con el sábado convierte esa pregunta
 * en otra distinta. Para otro día, otra convocatoria.
 *
 * El diseño está pensado para que se resuelva sin leer: la tira de días lleva su mes
 * encima y marca los fines de semana —que es cuando se juega—, las catorce horas van
 * partidas en dos bandas rotuladas en vez de un muro de pastillas iguales, y lo
 * elegido se acumula en «vas a proponer», donde se ve la propuesta montándose y se
 * quita una sin buscarla otra vez en la rejilla.
 */
@Component({
  selector: 'app-schedule-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NfButton],
  template: `
    <div class="sm">
      <p class="sm__legend">
        Propón varias horas y el grupo dirá a cuáles puede. La que junte diez jugadores se
        confirma sola; del once en adelante, banquillo.
      </p>

      <section class="sm__block">
        <h3 class="sm__month">{{ month() }}</h3>

        <div class="sm-days" role="tablist" aria-label="Elige el día">
          @for (d of days; track d.value) {
            <button
              type="button"
              role="tab"
              class="sm-day"
              [class.is-on]="selectedDay() === d.value"
              [class.is-weekend]="d.isWeekend"
              [attr.aria-selected]="selectedDay() === d.value"
              [attr.aria-label]="d.fullLabel"
              (click)="pickDay(d.value)"
            >
              <span class="sm-day__weekday nf-mono">{{ d.weekday }}</span>
              <span class="sm-day__number">{{ d.dayNumber }}</span>
            </button>
          }
        </div>

        <p class="sm__chosen">{{ chosenDay()?.fullLabel }}</p>
      </section>

      @if (bands().length) {
        <section class="sm__block">
          @for (band of bands(); track band.id) {
            <div class="sm-band">
              <h4 class="sm-band__label">{{ band.label }}</h4>
              <div class="sm-hours">
                @for (h of band.hours; track h.value) {
                  <button
                    type="button"
                    class="sm-hour"
                    [class.is-on]="picked().includes(h.value)"
                    [disabled]="atLimit() && !picked().includes(h.value)"
                    [attr.aria-pressed]="picked().includes(h.value)"
                    (click)="toggleHour(h.value)"
                  >
                    {{ h.label }}
                  </button>
                }
              </div>
            </div>
          }
        </section>
      } @else {
        <p class="sm__empty">Hoy ya no quedan horas por proponer. Prueba con otro día.</p>
      }

      <!-- La propuesta montándose. Es lo que convierte «pulsar pastillas» en «estoy
           proponiendo estas tres horas», y deja quitar una sin volver a buscarla. -->
      <section class="sm__block sm-basket" [class.is-empty]="!picked().length">
        <h3 class="sm__label">
          Vas a proponer
          <span class="sm__count nf-mono">{{ picked().length }} de {{ maxSlots }}</span>
        </h3>

        @if (picked().length) {
          <ul class="sm-basket__list">
            @for (value of picked(); track value) {
              <li>
                <button
                  type="button"
                  class="sm-chip"
                  [attr.aria-label]="'Quitar las ' + labelOf(value)"
                  (click)="toggleHour(value)"
                >
                  {{ labelOf(value) }}
                  <span class="sm-chip__x" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M7 7l10 10M17 7L7 17" stroke-linecap="round" />
                    </svg>
                  </span>
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="sm__hint">Toca una hora de arriba para empezar.</p>
        }

        @if (atLimit()) {
          <p class="sm__hint">
            Seis es el tope. Con más horas nadie se lee la lista y no se decide nada.
          </p>
        }
      </section>

      <section class="sm__block">
        <label class="sm__label" for="sm-note">
          Nota para el grupo (opcional)
          <span class="sm__count nf-mono">{{ note().length }} / {{ maxNote }}</span>
        </label>
        <input
          id="sm-note"
          class="sm__note"
          type="text"
          [maxlength]="maxNote"
          placeholder="Scrims contra los del curro, veníos con ganas…"
          [ngModel]="note()"
          (ngModelChange)="note.set($event)"
        />
      </section>

      <footer class="sm__foot">
        <button
          nfButton
          variant="primary"
          size="md"
          [disabled]="!picked().length || pending()"
          (click)="publish()"
        >
          {{ pending() ? 'Convocando…' : 'Convocar partida' }}
        </button>
      </footer>
    </div>
  `,
  styleUrl: './schedule-modal.component.scss',
})
export class ScheduleModalComponent {
  /** Hay una convocatoria en vuelo: el botón se apaga para que no salgan dos. */
  readonly pending = input(false);

  readonly create = output<ScheduleDraft>();

  protected readonly maxSlots = MAX_SLOTS;
  protected readonly maxNote = MAX_NOTE_LENGTH;

  /**
   * Los días se calculan una vez, al abrir. Recalcularlos en un `computed` los movería
   * al pasar la medianoche con la ventana abierta, y el día elegido dejaría de existir.
   */
  protected readonly days = buildDays(new Date(), DAYS_AHEAD);

  protected readonly selectedDay = signal(this.days[0].value);
  protected readonly picked = signal<string[]>([]);
  protected readonly note = signal('');

  protected readonly chosenDay = computed(() =>
    this.days.find((d) => d.value === this.selectedDay()),
  );

  protected readonly month = computed(() => this.chosenDay()?.monthLabel ?? '');

  private readonly hours = computed(() => buildHours(this.selectedDay(), new Date()));

  /**
   * Las horas partidas en tarde y noche. Catorce pastillas iguales no se escanean; dos
   * filas rotuladas, sí. Una banda vacía no se pinta —a las 22:00 ya no hay tarde—.
   */
  protected readonly bands = computed<HourBand[]>(() => {
    const hours = this.hours();
    const bands: HourBand[] = [
      { id: 'tarde', label: 'Tarde', hours: hours.filter((h) => hourOf(h) < NIGHT_FROM) },
      { id: 'noche', label: 'Noche', hours: hours.filter((h) => hourOf(h) >= NIGHT_FROM) },
    ];
    return bands.filter((band) => band.hours.length > 0);
  });

  protected readonly atLimit = computed(() => this.picked().length >= MAX_SLOTS);

  /** "2026-09-08T22:00" → "22:00". */
  protected labelOf(value: string): string {
    return value.slice(11);
  }

  /** Cambiar de día vacía lo elegido: una convocatoria es de un solo día. */
  protected pickDay(value: string): void {
    if (this.selectedDay() === value) return;
    this.selectedDay.set(value);
    this.picked.set([]);
  }

  protected toggleHour(value: string): void {
    this.picked.update((picked) => {
      if (picked.includes(value)) return picked.filter((v) => v !== value);
      if (picked.length >= MAX_SLOTS) return picked;
      return [...picked, value].sort();
    });
  }

  protected publish(): void {
    if (!this.picked().length || this.pending()) return;
    const note = this.note().trim();
    this.create.emit({ slotStartTimes: this.picked(), note: note || null });
  }
}

/** La hora en punto de una opción, para repartirla entre tarde y noche. */
function hourOf(option: HourOption): number {
  return Number(option.label.slice(0, 2));
}
