import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfSkeleton } from '../../../../ui';
import { EpicRecord } from '../../../../core/group-stats';

/**
 * Récords históricos del grupo (§5.5.5, bloque 3): los tres hitos de máxima
 * dificultad, cada uno con enlace a la partida en la que se firmaron.
 *
 * El enlace es la razón de ser de la tarjeta, así que es un botón formal y no una
 * flecha suelta, y apunta a una partida que existe de verdad en el historial: si
 * prometemos «ver partida», tiene que abrirse una.
 */
@Component({
  selector: 'app-stats-records',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton, RouterLink],
  template: `
    <section class="st-card" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Récords históricos</h2>
      </header>

      @if (loading()) {
        <div class="st-grid rec-grid">
          @for (s of [0, 1, 2]; track s) {
            <nf-skeleton width="100%" height="146px" radius="10px" />
          }
        </div>
      } @else if (records().length) {
        <ul class="st-grid rec-grid">
          @for (r of records(); track r.id) {
            <li class="rec-card">
              <span class="rec-card__icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  @switch (r.icon) {
                    @case ('blood') {
                      <path d="M12 3.5c3.2 4 5 6.6 5 9a5 5 0 0 1-10 0c0-2.4 1.8-5 5-9z" />
                      <path d="M9.6 13.4a2.6 2.6 0 0 0 2.4 3.1" />
                    }
                    @case ('damage') {
                      <path d="M4 20l7-7M14 4l6 6-9 9-6-6zM15 9l-2-2" />
                    }
                    @default {
                      <circle cx="12" cy="12.6" r="7.6" />
                      <path d="M12 8.6v4.4l2.8 1.8M9.4 3.4h5.2" />
                    }
                  }
                </svg>
              </span>

              <h3 class="rec-card__title">{{ r.title }}</h3>
              <p class="rec-card__value nf-mono">{{ r.value }}</p>
              <p class="rec-card__detail">{{ r.detail }}</p>

              <a
                class="rec-card__link"
                [routerLink]="['/app', 'historial', r.matchId]"
                [attr.aria-label]="'Ver la ' + r.matchLabel.toLowerCase()"
              >
                Ver {{ r.matchLabel.toLowerCase() }}
              </a>
            </li>
          }
        </ul>
      } @else {
        <p class="st-card__empty">Todavía no hay partidas suficientes para batir ningún récord.</p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-records.component.scss'],
})
export class StatsRecordsComponent {
  readonly records = input<readonly EpicRecord[]>([]);
  readonly loading = input(false);
}
