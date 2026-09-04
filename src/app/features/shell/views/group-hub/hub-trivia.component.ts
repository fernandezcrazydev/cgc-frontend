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
import { NfSkeleton } from '../../../../ui';
import { HubTrivia } from '../../../../core/group-hub';

/**
 * Trivia y telemetría (§5.5.4, tarjeta gemela derecha): las curiosidades del historial del grupo.
 *
 * Cada dato se cuenta como un titular —cifra grande, qué significa y la letra pequeña— con una
 * barra que da escala al número. Los datos se van pasando solos, con el mismo idioma que «Voces
 * del vestuario»: las rayitas de abajo son a la vez indicador de posición y cuenta atrás, la del
 * dato activo se va llenando, y al poner el cursor encima el tiempo se detiene y se reinicia.
 */
@Component({
  selector: 'app-hub-trivia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton],
  host: {
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
    '(focusin)': 'pause()',
    '(focusout)': 'resume()',
  },
  template: `
    <section class="hub-card hub-trivia" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="hub-card__head">
        <h2 class="hub-card__title nf-mono">Trivia y telemetría</h2>
        @if (items().length > 1) {
          <span class="hub-card__nav">
            <button type="button" class="hub-card__nav-btn" aria-label="Dato anterior" (click)="prev()">‹</button>
            <button type="button" class="hub-card__nav-btn" aria-label="Dato siguiente" (click)="next()">›</button>
          </span>
        }
      </header>

      @if (loading()) {
        <nf-skeleton width="100%" height="150px" radius="10px" />
      } @else if (current(); as t) {
        <div class="hub-trivia__body" [attr.data-kind]="t.icon">
          <div class="hub-trivia__top">
            <span class="hub-trivia__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                @switch (t.icon) {
                  @case ('tower') {
                    <path d="M7 20h10M8 20V9h8v11M8 9l1-4h6l1 4M10 5V3h4v2" stroke-linejoin="round" />
                  }
                  @case ('farm') {
                    <path d="M4 20h16M7 20V9M12 20V5M17 20v-7M7 9l-2 2M12 5l3 3M17 13l2 2" stroke-linecap="round" />
                  }
                  @case ('blood') {
                    <path d="M12 3.5s6 6.5 6 10.2A6 6 0 016 13.7C6 10 12 3.5 12 3.5z" stroke-linejoin="round" />
                  }
                  @default {
                    <path d="M4 12c3-6 9-8 16-7-1 7-4 11-10 12-3 .5-5-1-6-5zM8 17l-3 3" stroke-linejoin="round" />
                  }
                }
              </svg>
            </span>
            <span class="hub-trivia__kicker nf-mono">{{ t.kicker }}</span>
          </div>

          <p class="hub-trivia__value nf-mono">{{ t.value }}</p>
          <p class="hub-trivia__headline">{{ t.headline }}</p>

          <div class="hub-trivia__meter" role="img" [attr.aria-label]="t.meterLabel">
            <span class="hub-trivia__meter-fill" [style.width.%]="t.meter"></span>
          </div>
          <p class="hub-trivia__detail nf-mono">{{ t.detail }}</p>
        </div>

        @if (items().length > 1) {
          <div class="hub-trivia__dots" role="tablist" aria-label="Datos del grupo">
            @for (item of items(); track item.id; let i = $index) {
              <button
                type="button"
                class="hub-trivia__dot"
                role="tab"
                [class.is-on]="i === index()"
                [class.is-paused]="paused()"
                [attr.aria-selected]="i === index()"
                [attr.aria-label]="item.kicker"
                (click)="go(i)"
              >
                <!-- En la rayita activa, el relleno es la cuenta atrás hasta el siguiente dato. -->
                <span class="hub-trivia__dot-fill" [style.width.%]="i === index() ? percent() : 0"></span>
              </button>
            }
          </div>
        }
      } @else {
        <p class="hub-card__empty">Aún no hay datos suficientes para sacar curiosidades.</p>
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-trivia.component.scss'],
})
export class HubTriviaComponent {
  readonly items = input<readonly HubTrivia[]>([]);
  readonly loading = input(false);

  /** Cuánto vive un dato en pantalla. Algo más que un comentario: aquí hay una cifra que digerir. */
  static readonly TTL = 10000;
  private static readonly STEP = 100;

  private readonly _index = signal(0);
  private readonly _elapsed = signal(0);
  private readonly _paused = signal(false);

  readonly index = this._index.asReadonly();
  readonly paused = this._paused.asReadonly();

  readonly current = computed<HubTrivia | null>(() => this.items()[this._index()] ?? null);

  /** Cuánto lleva en pantalla el dato activo, en porcentaje: la rayita se llena de izquierda a derecha. */
  readonly percent = computed(() =>
    Math.min(100, Math.round((this._elapsed() / HubTriviaComponent.TTL) * 100)),
  );

  constructor() {
    const timer = setInterval(() => this.tick(), HubTriviaComponent.STEP);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    effect(() => {
      this.items();
      this._index.set(0);
      this._elapsed.set(0);
    });
  }

  go(index: number): void {
    this._index.set(index);
    this._elapsed.set(0);
  }

  next(): void {
    const total = this.items().length;
    if (total < 2) return;
    this._index.update((i) => (i + 1) % total);
    this._elapsed.set(0);
  }

  prev(): void {
    const total = this.items().length;
    if (total < 2) return;
    this._index.update((i) => (i - 1 + total) % total);
    this._elapsed.set(0);
  }

  /** Detiene la cuenta atrás y la reinicia, para poder leer el dato con calma. */
  pause(): void {
    this._paused.set(true);
    this._elapsed.set(0);
  }

  resume(): void {
    this._paused.set(false);
  }

  private tick(): void {
    if (this._paused() || this.items().length < 2) return;
    const elapsed = this._elapsed() + HubTriviaComponent.STEP;
    if (elapsed >= HubTriviaComponent.TTL) {
      this._elapsed.set(0);
      this._index.update((i) => (i + 1) % this.items().length);
      return;
    }
    this._elapsed.set(elapsed);
  }
}
