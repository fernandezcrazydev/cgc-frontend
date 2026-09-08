import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfSkeleton } from '../../../../ui';
import { EpicRecord } from '../../../../core/group-stats';
import { StatsRecordIconComponent } from './stats-record-icon.component';

/**
 * Récords históricos del grupo (§5.5.5, bloque 3): carrusel que muestra los hitos
 * en lotes de 3 tarjetas, rotando automáticamente cada 10 segundos, pausando al pasar
 * el cursor y con navegación manual accesible.
 */
@Component({
  selector: 'app-stats-records',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton, RouterLink, StatsRecordIconComponent],
  host: {
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
    '(focusin)': 'pause()',
    '(focusout)': 'resume()',
  },
  template: `
    <section class="st-card" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Récords históricos</h2>
        @if (totalPages() > 1) {
          <span class="rec-nav">
            <span class="rec-nav__pos nf-mono">{{ page() + 1 }}/{{ totalPages() }}</span>
            <button
              type="button"
              class="rec-nav__btn"
              aria-label="Página anterior de récords"
              (click)="prev($event)"
            >
              ‹
            </button>
            <button
              type="button"
              class="rec-nav__btn"
              aria-label="Página siguiente de récords"
              (click)="next($event)"
            >
              ›
            </button>
          </span>
        }
      </header>

      @if (loading()) {
        <div class="st-grid rec-grid">
          @for (s of [0, 1, 2]; track s) {
            <nf-skeleton width="100%" height="146px" radius="10px" />
          }
        </div>
      } @else if (records().length) {
        <ul class="st-grid rec-grid">
          @for (r of currentRecords(); track r.id) {
            <li class="rec-card">
              <div class="rec-card__top">
                <span class="rec-card__icon" aria-hidden="true">
                  <app-stats-record-icon [icon]="r.icon" />
                </span>
                <h3 class="rec-card__title">{{ r.title }}</h3>
              </div>

              <div class="rec-card__center">
                <span class="rec-card__value nf-mono">{{ r.value }}</span>
                <p class="rec-card__detail">{{ r.detail }}</p>
              </div>

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

        @if (totalPages() > 1) {
          <div class="rec-dots" role="tablist" aria-label="Páginas de récords">
            @for (p of pages(); track p) {
              <button
                type="button"
                class="rec-dot"
                role="tab"
                [class.is-on]="p === page()"
                [class.is-paused]="paused()"
                [attr.aria-selected]="p === page()"
                [attr.aria-label]="'Lote de récords ' + (p + 1)"
                (click)="go(p)"
              >
                <span class="rec-dot__fill" [style.width.%]="p === page() ? percent() : 0"></span>
              </button>
            }
          </div>
        }
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

  static readonly TTL = 10000;
  private static readonly STEP = 100;
  private static readonly PAGE_SIZE = 3;

  private readonly _page = signal(0);
  private readonly _elapsed = signal(0);
  private readonly _paused = signal(false);

  readonly page = this._page.asReadonly();
  readonly paused = this._paused.asReadonly();

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.records().length / StatsRecordsComponent.PAGE_SIZE)),
  );

  readonly pages = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i),
  );

  readonly currentRecords = computed(() => {
    const start = this.page() * StatsRecordsComponent.PAGE_SIZE;
    return this.records().slice(start, start + StatsRecordsComponent.PAGE_SIZE);
  });

  readonly percent = computed(() =>
    Math.min(100, Math.round((this._elapsed() / StatsRecordsComponent.TTL) * 100)),
  );

  constructor() {
    const timer = setInterval(() => this.tick(), StatsRecordsComponent.STEP);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    effect(() => {
      this.records();
      this._page.set(0);
      this._elapsed.set(0);
    });
  }

  go(page: number): void {
    this._page.set(page);
    this._elapsed.set(0);
  }

  next(event?: Event): void {
    if (event) event.stopPropagation();
    const total = this.totalPages();
    if (total < 2) return;
    this._page.update((p) => (p + 1) % total);
    this._elapsed.set(0);
  }

  prev(event?: Event): void {
    if (event) event.stopPropagation();
    const total = this.totalPages();
    if (total < 2) return;
    this._page.update((p) => (p - 1 + total) % total);
    this._elapsed.set(0);
  }

  pause(): void {
    this._paused.set(true);
    this._elapsed.set(0);
  }

  resume(): void {
    this._paused.set(false);
  }

  private tick(): void {
    if (this._paused() || this.totalPages() < 2) return;
    const elapsed = this._elapsed() + StatsRecordsComponent.STEP;
    if (elapsed >= StatsRecordsComponent.TTL) {
      this._elapsed.set(0);
      this._page.update((p) => (p + 1) % this.totalPages());
      return;
    }
    this._elapsed.set(elapsed);
  }
}
