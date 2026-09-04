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
import { Router } from '@angular/router';
import { NfAvatar, NfEmojiPicker, NfSkeleton } from '../../../../ui';
import { HubComment } from '../../../../core/group-hub';
import { ReactionsStore } from '../../../../core/reactions';

/**
 * Voces del vestuario (§5.5.4): la tarjeta fija de comentarios del grupo.
 *
 * La tarjeta entera es el enlace a la partida comentada —no hay un botón aparte para eso—, y las
 * reacciones viven dentro sin disparar esa navegación. El paso entre comentarios lo marca una
 * barra de vida que se vacía sola, con un par de flechas para adelantarlo a mano; al pasar el
 * cursor por encima (o al enfocar con el teclado) se detiene **y reinicia su tiempo**, para que
 * nadie pierda a media frase el comentario que estaba leyendo.
 *
 * Quién ha reaccionado y con qué lo lleva `ReactionsStore`, que es también quien sabe cuáles son
 * los emojis más usados del grupo para encabezar el selector.
 */
@Component({
  selector: 'app-hub-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfEmojiPicker, NfSkeleton],
  host: {
    '(mouseenter)': 'pause()',
    '(mouseleave)': 'resume()',
    '(focusin)': 'pause()',
    '(focusout)': 'resume()',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'picking.set(false)',
  },
  template: `
    <section class="hub-card hub-comments" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="hub-card__head">
        <h2 class="hub-card__title nf-mono">Voces del vestuario</h2>
        @if (comments().length > 1) {
          <span class="hub-card__nav">
            <span class="hub-comments__pos nf-mono">{{ index() + 1 }}/{{ comments().length }}</span>
            <button
              type="button"
              class="hub-card__nav-btn"
              aria-label="Comentario anterior"
              (click)="prev()"
            >‹</button>
            <button
              type="button"
              class="hub-card__nav-btn"
              aria-label="Comentario siguiente"
              (click)="next()"
            >›</button>
          </span>
        }
      </header>

      @if (loading()) {
        <nf-skeleton width="100%" height="128px" radius="10px" />
      } @else if (current(); as c) {
        <!-- La tarjeta entera abre la partida comentada. Es un botón para que llegue también por
             teclado; lo de dentro que no navega (las reacciones) frena la propagación. -->
        <button type="button" class="hub-comments__card" (click)="openMatch(c)">
          <span class="hub-comments__quote" aria-hidden="true">“</span>
          <span class="hub-comments__text"
            >{{ c.text }}<span class="hub-comments__quote-end" aria-hidden="true">”</span></span
          >
          <span class="hub-comments__author">
            <nf-avatar [src]="c.avatar ?? null" [fallback]="c.author" [tint]="c.hue" [size]="26" shape="round" />
            <span class="hub-comments__name nf-mono">{{ c.author }}</span>
            <span class="hub-comments__match nf-mono">{{ c.matchLabel }}</span>
          </span>
        </button>

        <div class="hub-comments__reactions">
          @for (r of reactions(); track r.emoji) {
            <button
              type="button"
              class="hub-comments__reaction"
              [class.is-mine]="r.mine"
              [attr.aria-pressed]="r.mine"
              [attr.aria-label]="(r.mine ? 'Quitar tu reacción ' : 'Reaccionar con ') + r.emoji"
              (click)="toggle(c.id, r.emoji, $event)"
            >
              <span aria-hidden="true">{{ r.emoji }}</span>
              <span class="nf-mono">{{ r.count }}</span>
            </button>
          }

          <span class="hub-comments__picker">
            <button
              type="button"
              class="hub-comments__add"
              aria-haspopup="menu"
              [attr.aria-expanded]="picking()"
              aria-label="Añadir una reacción"
              (click)="togglePicker($event)"
            >＋</button>
            @if (picking()) {
              <span class="hub-comments__palette">
                <nf-emoji-picker
                  [quick]="quickEmojis()"
                  [selected]="myReaction(c.id)"
                  (picked)="toggle(c.id, $event)"
                />
              </span>
            }
          </span>
        </div>

        <!-- Barra de vida: dice cuánto queda del comentario y por qué se ha parado. -->
        <div
          class="hub-comments__life"
          [class.is-paused]="paused()"
          role="progressbar"
          aria-label="Tiempo restante del comentario"
          [attr.aria-valuenow]="percent()"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <span class="hub-comments__life-fill" [style.width.%]="percent()"></span>
        </div>
      } @else {
        <p class="hub-card__empty">Todavía no hay comentarios en este grupo.</p>
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-comments.component.scss'],
})
export class HubCommentsComponent {
  readonly comments = input<readonly HubComment[]>([]);
  readonly loading = input(false);
  /** Grupo al que pertenecen: es el ámbito de «los emojis más usados». */
  readonly groupId = input('');

  /** Cuánto vive un comentario en pantalla, en milisegundos. */
  static readonly TTL = 9000;
  /** Cada cuánto avanza la barra. 100 ms es suave y no obliga a un `requestAnimationFrame`. */
  private static readonly STEP = 100;

  private readonly router = inject(Router);
  private readonly reactionsStore = inject(ReactionsStore);

  private readonly _index = signal(0);
  private readonly _elapsed = signal(0);
  private readonly _paused = signal(false);
  /** Selector de emoji abierto. */
  readonly picking = signal(false);

  readonly index = this._index.asReadonly();
  readonly paused = this._paused.asReadonly();

  readonly current = computed<HubComment | null>(() => this.comments()[this._index()] ?? null);

  /** Lo que queda de vida, en porcentaje: la barra se vacía de izquierda a derecha. */
  readonly percent = computed(() =>
    Math.max(0, Math.round(100 - (this._elapsed() / HubCommentsComponent.TTL) * 100)),
  );

  /** Reacciones del comentario activo, de la más repetida a la menos. */
  readonly reactions = computed(() => {
    const comment = this.current();
    return comment ? this.reactionsStore.tally(this.groupId(), comment.id) : [];
  });

  /** Los que más usa el grupo encabezan el selector; si aún no hay, los de siempre. */
  readonly quickEmojis = computed(() => this.reactionsStore.mostUsed(this.groupId()));

  constructor() {
    const timer = setInterval(() => this.tick(), HubCommentsComponent.STEP);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));

    // Al cambiar la lista (otro grupo) se vuelve al primer comentario con el tiempo entero, y sus
    // reacciones se siembran en el store, que lleva la cuenta a partir de ahí.
    effect(() => {
      const comments = this.comments();
      const scope = this.groupId();
      for (const comment of comments) {
        this.reactionsStore.seed(scope, comment.id, comment.reactions);
      }
      this._index.set(0);
      this._elapsed.set(0);
    });
  }

  /** El emoji con el que ha reaccionado quien mira, o `null`. */
  myReaction(commentId: string): string | null {
    return this.reactionsStore.mine(this.groupId(), commentId);
  }

  /**
   * Pone, cambia o quita la reacción propia. Pulsar la que ya tenías la retira; pulsar otra la
   * sustituye, porque una persona reacciona una vez a cada frase.
   */
  toggle(commentId: string, emoji: string, event?: Event): void {
    event?.stopPropagation();
    this.picking.set(false);
    this.reactionsStore.toggle(this.groupId(), commentId, emoji);
  }

  togglePicker(event: Event): void {
    event.stopPropagation();
    this.picking.update((open) => !open);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.picking()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.hub-comments__picker')) return;
    this.picking.set(false);
  }

  /** Abre la partida que se está comentando. */
  openMatch(comment: HubComment): void {
    void this.router.navigate(['/app', 'historial', comment.matchId]);
  }

  /** Pasa al comentario siguiente y le devuelve el tiempo entero. */
  next(): void {
    const total = this.comments().length;
    if (total < 2) return;
    this._index.update((i) => (i + 1) % total);
    this._elapsed.set(0);
  }

  prev(): void {
    const total = this.comments().length;
    if (total < 2) return;
    this._index.update((i) => (i - 1 + total) % total);
    this._elapsed.set(0);
  }

  /** Detiene la barra y le devuelve todo su tiempo: al soltar el cursor se lee desde el principio. */
  pause(): void {
    this._paused.set(true);
    this._elapsed.set(0);
  }

  resume(): void {
    this._paused.set(false);
  }

  private tick(): void {
    if (this._paused() || this.comments().length < 2) return;
    const elapsed = this._elapsed() + HubCommentsComponent.STEP;
    if (elapsed >= HubCommentsComponent.TTL) {
      this._elapsed.set(0);
      this._index.update((i) => (i + 1) % this.comments().length);
      return;
    }
    this._elapsed.set(elapsed);
  }
}
