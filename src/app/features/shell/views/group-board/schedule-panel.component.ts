import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { NfButton, NfSkeleton } from '../../../../ui';
import { LobbyResponse, LobbySlotResponse } from '../../../../core/lobbies';
import { ScheduleCardComponent, ScheduleStanding } from './schedule-card.component';

/** Una convocatoria ya preparada para pintar. La arma la vista, que es quien orquesta. */
export interface ScheduleEntry {
  lobby: LobbyResponse;
  /** La franja que la representa: la confirmada, o la que más gente ha juntado. */
  slot: LobbySlotResponse | null;
  standing: ScheduleStanding;
  when: string;
  acting: boolean;
}

/** Apuntarse o borrarse de una franja concreta de una convocatoria concreta. */
export interface ScheduleAction {
  lobbyId: string;
  slotId: string;
}

/**
 * Columna derecha del panel de convocatorias (§5.5.6): lo que viene, de lo más
 * cercano a lo más lejano.
 *
 * Solo compone y reenvía: cada tarjeta se pinta sola y las acciones suben a la
 * vista, que es la que habla con el store. El estado de error tiene su propio
 * reintento porque quedarse sin convocatorias por un fallo de red no es lo mismo
 * que no tener ninguna.
 */
@Component({
  selector: 'app-schedule-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton, NfSkeleton, ScheduleCardComponent],
  template: `
    <section class="mt-card sp" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="mt-card__head">
        <div class="sp__title-wrap">
          <h2 class="mt-card__title">Próximas convocatorias</h2>
          @if (!loading() && entries().length) {
            <span class="sp__count nf-mono">{{ entries().length }}</span>
          }
        </div>
        <button nfButton variant="primary" size="sm" (click)="schedule.emit()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          Agendar fecha
        </button>
      </header>

      @if (loading()) {
        @for (s of [0, 1]; track s) {
          <nf-skeleton width="100%" height="164px" radius="11px" />
        }
      } @else if (failed()) {
        <p class="mt-card__empty">No hemos podido cargar las convocatorias.</p>
        <button nfButton variant="secondary" size="sm" (click)="retry.emit()">Reintentar</button>
      } @else if (entries().length) {
        <ul class="sp__list">
          @for (entry of entries(); track entry.lobby.id) {
            <li>
              <app-schedule-card
                [lobby]="entry.lobby"
                [slot]="entry.slot"
                [standing]="entry.standing"
                [when]="entry.when"
                [acting]="entry.acting"
                [myUserId]="myUserId()"
                (signUp)="signUp.emit({ lobbyId: entry.lobby.id, slotId: $event })"
                (withdraw)="withdraw.emit({ lobbyId: entry.lobby.id, slotId: $event })"
                (openAvailability)="openAvailability.emit(entry.lobby)"
                (openDetail)="openDetail.emit($event)"
              />
            </li>
          }
        </ul>
      } @else {
        <p class="mt-card__empty">
          Nadie ha convocado todavía. Agenda una fecha y el grupo se apunta desde aquí.
        </p>
      }
    </section>
  `,
  styleUrls: ['./board-card.scss', './schedule-panel.component.scss'],
})
export class SchedulePanelComponent {
  readonly entries = input<readonly ScheduleEntry[]>([]);
  readonly loading = input(false);
  readonly failed = input(false);
  readonly myUserId = input<string | null>(null);

  readonly signUp = output<ScheduleAction>();
  readonly withdraw = output<ScheduleAction>();
  /** Pide abrir el modal de disponibilidad de esa convocatoria. */
  readonly openAvailability = output<LobbyResponse>();
  readonly openDetail = output<LobbyResponse>();
  readonly schedule = output<void>();
  readonly retry = output<void>();
}
