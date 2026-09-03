import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { NfButton } from '../../../../ui';
import { LobbyResponse, LobbySlotResponse } from '../../../../core/lobbies';

/** El cambio que pide el usuario: a qué horas se apunta y de cuáles se borra. */
export interface AvailabilityChange {
  join: string[];
  leave: string[];
}

/** Una franja tal y como se pinta en la lista. */
interface SlotRow {
  slot: LobbySlotResponse;
  label: string;
  confirmed: boolean;
  full: boolean;
}

/**
 * Decir a qué horas puedes (§5.5.6).
 *
 * Se marcan TODAS las que te vengan bien, no una: si puedes a dos de las tres, dices
 * dos, y así la que más gente junte es la que se confirma. Ese es el sentido de
 * proponer varias horas, y con un botón por franja repartido por la pantalla se
 * perdía — parecía que había que elegir.
 *
 * Se manda al cerrar y no franja a franja: marcar tres horas eran tres peticiones y
 * tres recargas de la lista, con la pantalla saltando debajo del dedo.
 */
@Component({
  selector: 'app-availability-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton],
  template: `
    @if (lobby(); as lb) {
      <div class="av">
        <p class="av__legend">
          Marca todas las horas a las que puedas. La que junte {{ lb.capacity }} jugadores
          se confirma sola.
        </p>

        <ul class="av__list">
          @for (row of rows(); track row.slot.id) {
            <li>
              <button
                type="button"
                class="av-slot"
                [class.is-on]="picked().includes(row.slot.id)"
                [attr.aria-pressed]="picked().includes(row.slot.id)"
                [disabled]="pending()"
                (click)="toggle(row.slot.id)"
              >
                <span class="av-slot__check" aria-hidden="true">
                  @if (picked().includes(row.slot.id)) {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                      <path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  }
                </span>

                <span class="av-slot__meta">
                  <span class="av-slot__head">
                    <span class="av-slot__when">{{ row.label }}</span>
                    <span class="av-slot__count nf-mono">
                      {{ projected(row) }}/{{ lb.capacity }}
                    </span>
                  </span>

                  <!-- La barra dice de un vistazo qué hora va camino de llenarse, que es
                       lo que decide a cuál te apuntas. Se mueve al marcar porque enseña
                       cómo quedaría, no cómo está. -->
                  <span class="av-slot__bar" aria-hidden="true">
                    <span
                      class="av-slot__bar-fill"
                      [style.width.%]="(projected(row) / lb.capacity) * 100"
                    ></span>
                  </span>

                  @if (row.confirmed) {
                    <span class="av-slot__tag av-slot__tag--confirmed">Ya confirmada</span>
                  } @else if (row.full) {
                    <span class="av-slot__tag">Llena · entrarías de suplente</span>
                  }
                </span>
              </button>
            </li>
          }
        </ul>

        <footer class="av__foot">
          <span class="av__foot-status nf-mono">{{ summary() }}</span>
          <button
            nfButton
            variant="primary"
            size="md"
            [disabled]="!dirty() || pending()"
            (click)="apply()"
          >
            {{ pending() ? 'Guardando…' : 'Guardar' }}
          </button>
        </footer>
      </div>
    }
  `,
  styleUrl: './availability-modal.component.scss',
})
export class AvailabilityModalComponent {
  readonly lobby = input<LobbyResponse | null>(null);
  /** El id del usuario, para saber en qué franjas está ya. */
  readonly myUserId = input<string | null>(null);
  readonly pending = input(false);

  readonly apply$ = output<AvailabilityChange>({ alias: 'apply' });

  protected readonly rows = computed<SlotRow[]>(() => {
    const lb = this.lobby();
    if (!lb) return [];
    return [...lb.slots]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((slot) => ({
        slot,
        label: formatSlot(slot.startsAt),
        confirmed: slot.id === lb.confirmedSlotId,
        full: slot.starters.length >= lb.capacity,
      }));
  });

  /** En cuáles estoy ya, según lo que manda el servidor. */
  private readonly mine = computed(() => {
    const me = this.myUserId();
    if (!me) return [];
    return this.rows()
      .filter(
        (row) =>
          row.slot.starters.some((p) => p.userId === me) ||
          row.slot.bench.some((p) => p.userId === me),
      )
      .map((row) => row.slot.id);
  });

  /**
   * Lo marcado ahora mismo. Arranca de lo que dice el servidor y se reinicia si la
   * convocatoria cambia debajo —alguien se apuntó mientras mirabas—, para no guardar
   * un diff calculado contra una foto vieja.
   */
  protected readonly picked = linkedSignal<string[], string[]>({
    source: () => this.mine(),
    computation: (mine) => [...mine],
  });

  protected readonly dirty = computed(() => {
    const a = [...this.mine()].sort().join('|');
    const b = [...this.picked()].sort().join('|');
    return a !== b;
  });

  protected readonly summary = computed(() => {
    const n = this.picked().length;
    if (!n) return 'No puedes a ninguna';
    return `Puedes a ${n} hora${n === 1 ? '' : 's'}`;
  });

  /**
   * Cuántos titulares tendría esa hora si guardaras lo que has marcado ahora mismo.
   *
   * No es un `+1` a ciegas. Marcar una hora **llena** no mueve la barra, porque entrarías
   * de suplente y no de titular; y desmarcar una en la que estás **en el banquillo**
   * tampoco, porque tu sitio no era ninguna de las diez plazas. Una barra que se moviera
   * en esos dos casos estaría prometiendo una plaza que no existe.
   */
  protected projected(row: SlotRow): number {
    const me = this.myUserId();
    const starters = row.slot.starters.length;
    if (!me) return starters;

    const marcada = this.picked().includes(row.slot.id);
    const eraTitular = row.slot.starters.some((p) => p.userId === me);
    const eraSuplente = row.slot.bench.some((p) => p.userId === me);

    if (marcada && !eraTitular && !eraSuplente) return row.full ? starters : starters + 1;
    if (!marcada && eraTitular) return starters - 1;
    return starters;
  }

  protected toggle(slotId: string): void {
    this.picked.update((picked) =>
      picked.includes(slotId) ? picked.filter((id) => id !== slotId) : [...picked, slotId],
    );
  }

  protected apply(): void {
    const mine = this.mine();
    const picked = this.picked();
    this.apply$.emit({
      join: picked.filter((id) => !mine.includes(id)),
      leave: mine.filter((id) => !picked.includes(id)),
    });
  }
}

/** "lunes 8, 22:00". El día se repite en todas porque una convocatoria es de un solo día. */
function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
