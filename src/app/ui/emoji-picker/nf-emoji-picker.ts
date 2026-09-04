import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ALL_EMOJIS } from './emoji-catalog';
import { EMOJI_BLOCKS, createRenderableCheck, emojisOf, isEmoji } from './emoji-blocks';

/**
 * Emoji Picker — la paleta de reacciones.
 *
 * Dos pisos, como la de cualquier app de mensajería: arriba, ocho huecos de acceso rápido que el
 * consumidor rellena con los **más usados del grupo** (o los de siempre si aún no se ha
 * reaccionado a nada); el octavo abre el buscador con el juego de emojis **completo**.
 *
 *   <nf-emoji-picker [quick]="masUsados()" [selected]="miReaccion()" (picked)="reaccionar($event)" />
 *
 * El buscador no descarga ningún catálogo: los emojis se derivan de los bloques Unicode en el
 * momento (ver `emoji-blocks.ts`). Y como ninguna web puede abrir el teclado del sistema por su
 * cuenta, el campo acepta además **cualquier emoji escrito o pegado**, que es como entra lo que
 * elijas con Windows + `.` o con el teclado del móvil.
 *
 * No sabe nada de dominio: recibe la lista rápida y emite el emoji elegido.
 */
@Component({
  selector: 'nf-emoji-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nf-emoji">
      @if (!browsing()) {
        <div class="nf-emoji__quick" role="menu">
          @for (emoji of quick().slice(0, 7); track emoji) {
            <button
              type="button"
              class="nf-emoji__item"
              [class.is-selected]="emoji === selected()"
              role="menuitem"
              [attr.aria-label]="'Reaccionar con ' + emoji"
              (click)="pick(emoji, $event)"
            >{{ emoji }}</button>
          }
          <button
            type="button"
            class="nf-emoji__item nf-emoji__more"
            aria-label="Ver todos los emojis"
            title="Ver todos los emojis"
            (click)="openBrowser($event)"
          >＋</button>
        </div>
      } @else {
        <div class="nf-emoji__browser">
          <div class="nf-emoji__searchbar">
            <button
              type="button"
              class="nf-emoji__back"
              aria-label="Volver a los más usados"
              (click)="closeBrowser($event)"
            >‹</button>
            <input
              class="nf-emoji__search"
              type="search"
              placeholder="Busca o pega un emoji…"
              autocomplete="off"
              [value]="query()"
              (click)="$event.stopPropagation()"
              (input)="onQuery($event)"
            />
          </div>

          <!-- Ninguna web puede abrir el teclado de emojis del sistema: lo abre quien mira, y lo
               que inserte se acepta tal cual. -->
          <p class="nf-emoji__hint nf-mono">Windows + . abre tu teclado de emojis aquí mismo.</p>

          @if (query().trim()) {
            <div class="nf-emoji__scroll">
              @if (pasted(); as emoji) {
                <div class="nf-emoji__group-label nf-mono">Tu emoji</div>
                <div class="nf-emoji__grid">
                  <button
                    type="button"
                    class="nf-emoji__item"
                    [class.is-selected]="emoji === selected()"
                    [attr.aria-label]="'Reaccionar con ' + emoji"
                    (click)="pick(emoji, $event)"
                  >{{ emoji }}</button>
                </div>
              }
              @if (results().length) {
                <div class="nf-emoji__group-label nf-mono">Coincidencias</div>
                <div class="nf-emoji__grid">
                  @for (entry of results(); track entry.emoji) {
                    <button
                      type="button"
                      class="nf-emoji__item"
                      [class.is-selected]="entry.emoji === selected()"
                      [attr.aria-label]="'Reaccionar con ' + entry.emoji"
                      (click)="pick(entry.emoji, $event)"
                    >{{ entry.emoji }}</button>
                  }
                </div>
              } @else if (!pasted()) {
                <p class="nf-emoji__empty nf-mono">
                  Ningún emoji se llama «{{ query() }}». Pégalo aquí y lo usamos igual.
                </p>
              }
            </div>
          } @else {
            <div class="nf-emoji__tabs" role="tablist" aria-label="Familias de emojis">
              @for (block of blocks; track block.id) {
                <button
                  type="button"
                  class="nf-emoji__tab nf-mono"
                  role="tab"
                  [class.is-on]="block.id === blockId()"
                  [attr.aria-selected]="block.id === blockId()"
                  (click)="selectBlock(block.id, $event)"
                >{{ block.label }}</button>
              }
            </div>

            <div class="nf-emoji__scroll">
              <!-- Se pinta una familia cada vez: montar mil ochocientos botones de golpe se nota. -->
              <div class="nf-emoji__grid">
                @for (emoji of blockEmojis(); track emoji) {
                  <button
                    type="button"
                    class="nf-emoji__item"
                    [class.is-selected]="emoji === selected()"
                    [attr.aria-label]="'Reaccionar con ' + emoji"
                    (click)="pick(emoji, $event)"
                  >{{ emoji }}</button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './nf-emoji-picker.scss',
})
export class NfEmojiPicker {
  /** Los ocho huecos de acceso rápido (se usan los 7 primeros; el octavo abre el buscador). */
  readonly quick = input<readonly string[]>([]);
  /** El emoji que ya has elegido, para marcarlo. */
  readonly selected = input<string | null>(null);
  readonly picked = output<string>();

  protected readonly blocks = EMOJI_BLOCKS;
  protected readonly browsing = signal(false);
  protected readonly query = signal('');
  protected readonly blockId = signal(EMOJI_BLOCKS[0].id);

  /**
   * Comprobador de dibujo, creado una sola vez y solo si hace falta: los rangos Unicode traen
   * huecos que la fuente no sabe pintar y saldrían como cuadritos.
   */
  private readonly renderable = createRenderableCheck();

  /** Los emojis de la familia abierta. `emojisOf` cachea, así que cambiar de pestaña es gratis. */
  protected readonly blockEmojis = computed(() => {
    const block = EMOJI_BLOCKS.find((b) => b.id === this.blockId()) ?? EMOJI_BLOCKS[0];
    return emojisOf(block, this.renderable);
  });

  /** Lo que hay escrito ES un emoji: se ofrece tal cual, venga de donde venga. */
  protected readonly pasted = computed(() => {
    const text = this.query().trim();
    return isEmoji(text) ? text : null;
  });

  /** Búsqueda por palabra, sobre los que tienen nombre en español. */
  protected readonly results = computed(() => {
    const term = normalize(this.query());
    if (!term) return [];
    return ALL_EMOJIS.filter((e) => normalize(e.terms).includes(term)).slice(0, 48);
  });

  protected pick(emoji: string, event: Event): void {
    event.stopPropagation();
    this.picked.emit(emoji);
  }

  protected openBrowser(event: Event): void {
    event.stopPropagation();
    this.browsing.set(true);
  }

  protected closeBrowser(event: Event): void {
    event.stopPropagation();
    this.browsing.set(false);
    this.query.set('');
  }

  protected selectBlock(id: string, event: Event): void {
    event.stopPropagation();
    this.blockId.set(id);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}

/** Minúsculas y sin tildes: se busca «corazon» y aparece «corazón». */
function normalize(value: string): string {
  // El rango son los diacríticos combinantes, escritos con escape para que se lean.
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
