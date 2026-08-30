import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { NfAvatar, NfAvatarTint } from '../avatar/nf-avatar';

/**
 * Una opción del combobox. `iconUrl`/`tint` son opcionales: si vienen, la fila
 * pinta un `<nf-avatar>` (icono de campeón, escudo de grupo, objeto...) y si no,
 * la lista queda solo de texto.
 */
export interface NfComboboxOption {
  value: string;
  label: string;
  iconUrl?: string | null;
  tint?: NfAvatarTint;
}

let nextId = 0;

/**
 * Combobox — el select con búsqueda por teclado que le faltaba al kit.
 * `nf-select` envuelve el `<select>` nativo, que sirve para listas cortas y cerradas
 * (una región, un rol); en cuanto la lista pasa de ~15 entradas —los campeones son
 * 170— el nativo obliga a arrastrar el ratón por un menú larguísimo, así que aquí el
 * usuario escribe y la lista se reduce.
 *
 *   <nf-combobox
 *     [options]="campeones()"
 *     [(value)]="campeonId"
 *     placeholder="Todos los campeones"
 *     ariaLabel="Filtrar por campeón" />
 *
 * `value` vacío significa "nada seleccionado": el control enseña el `placeholder` y
 * el botón de limpiar desaparece. Quien lo consume decide qué representa ese vacío
 * (en un filtro, "sin filtrar"); el primitivo no conoce ningún valor centinela.
 *
 * La búsqueda ignora acentos y signos, así que `kaisa` encuentra `Kai'Sa` y `belveth`
 * encuentra `Bel'Veth`: nadie debería tener que acertar la puntuación de un nombre
 * propio para filtrar por él. Prioriza además los que *empiezan* por lo escrito, que
 * es casi siempre lo que se busca.
 *
 * `maxVisible` recorta la lista a las N mejores coincidencias cuando se quiere que
 * el control se comporte como un autocompletado (sugerir) y no como un menú
 * (enumerar).
 */
@Component({
  selector: 'nf-combobox',
  standalone: true,
  imports: [NfAvatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'nf-combobox',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
  template: `
    <div class="nf-combobox__field" [class.nf-combobox__field--open]="open()">
      @if (selectedOption(); as sel) {
        @if (!open() && (sel.iconUrl || sel.tint !== undefined)) {
          <nf-avatar
            class="nf-combobox__icon"
            [src]="sel.iconUrl ?? null"
            [fallback]="sel.label"
            [tint]="sel.tint ?? 0"
            [size]="22"
            shape="square"
          />
        }
      }

      <input
        #input
        class="nf-combobox__input"
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        [id]="inputId"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && activeOption() ? optionId(activeIndex()) : null"
        [attr.placeholder]="placeholder()"
        [value]="displayText()"
        (focus)="onFocus()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />

      @if (clearable() && value() && !open()) {
        <button
          type="button"
          class="nf-combobox__clear"
          [attr.aria-label]="'Quitar ' + (selectedOption()?.label ?? 'la selección')"
          (click)="clear()"
        >
          ✕
        </button>
      } @else {
        <span class="nf-combobox__caret nf-mono" aria-hidden="true">▾</span>
      }
    </div>

    @if (open()) {
      <ul #list class="nf-combobox__list" [id]="listId" role="listbox" [attr.aria-label]="ariaLabel() || null">
        @for (opt of visibleOptions(); track opt.value; let i = $index) {
          <li
            class="nf-combobox__option"
            [class.nf-combobox__option--active]="i === activeIndex()"
            [class.nf-combobox__option--on]="opt.value === value()"
            [id]="optionId(i)"
            [attr.data-idx]="i"
            role="option"
            [attr.aria-selected]="opt.value === value()"
            (pointerenter)="activeIndex.set(i)"
            (click)="choose(opt)"
          >
            @if (opt.iconUrl || opt.tint !== undefined) {
              <nf-avatar
                class="nf-combobox__option-icon"
                [src]="opt.iconUrl ?? null"
                [fallback]="opt.label"
                [tint]="opt.tint ?? 0"
                [size]="24"
                shape="square"
              />
            }
            <span class="nf-combobox__option-label">{{ opt.label }}</span>
          </li>
        } @empty {
          <li class="nf-combobox__empty">{{ emptyText() }}</li>
        }
      </ul>
    }
  `,
  styleUrl: './nf-combobox.scss',
})
export class NfCombobox {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<readonly NfComboboxOption[]>();
  /** El valor elegido. Cadena vacía = nada seleccionado (el control enseña el placeholder). */
  readonly value = model<string>('');
  readonly placeholder = input('');
  readonly ariaLabel = input('');
  /** Texto de la lista cuando lo escrito no encuentra nada. */
  readonly emptyText = input('Sin resultados');
  /** Ofrece el botón de limpiar cuando hay algo elegido. */
  readonly clearable = input(true);
  /**
   * Tope de sugerencias visibles. `null` (por defecto) las enseña todas y deja
   * que la lista haga scroll, que es lo correcto cuando el combobox ES el
   * selector. Con un tope, en cambio, la lista deja de ser un menú y pasa a ser
   * una ayuda de escritura: se recorta DESPUÉS de ordenar, así que lo que
   * sobrevive es siempre lo mejor emparejado, y se llega al resto escribiendo
   * más, no arrastrando el ratón.
   */
  readonly maxVisible = input<number | null>(null);

  protected readonly inputId = `nf-cb-${++nextId}`;
  protected readonly listId = `nf-cb-${nextId}-list`;

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly listEl = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  protected readonly selectedOption = computed(() => {
    const v = this.value();
    return v ? this.options().find((o) => o.value === v) ?? null : null;
  });

  /** Cerrado enseña la etiqueta elegida; abierto, lo que el usuario está escribiendo. */
  protected readonly displayText = computed(() =>
    this.open() ? this.query() : this.selectedOption()?.label ?? '',
  );

  protected readonly visibleOptions = computed(() => {
    const q = normalize(this.query());
    const all = this.options();
    if (!q) return this.cap([...all]);

    const starts: NfComboboxOption[] = [];
    const contains: NfComboboxOption[] = [];
    for (const opt of all) {
      const label = normalize(opt.label);
      if (label.startsWith(q)) starts.push(opt);
      else if (label.includes(q)) contains.push(opt);
    }
    return this.cap([...starts, ...contains]);
  });

  /** Recorta al tope pedido. Se aplica al final, nunca antes de ordenar. */
  private cap(list: NfComboboxOption[]): NfComboboxOption[] {
    const max = this.maxVisible();
    return max !== null && max >= 0 && list.length > max ? list.slice(0, max) : list;
  }

  protected readonly activeOption = computed(() => this.visibleOptions()[this.activeIndex()] ?? null);

  protected optionId(index: number): string {
    return `${this.inputId}-opt-${index}`;
  }

  protected onFocus(): void {
    if (this.open()) return;
    // Se abre en blanco, no con la etiqueta ya elegida dentro: quien vuelve al filtro
    // casi siempre quiere buscar otra cosa, y tener que borrar el texto anterior antes
    // de escribir es el peaje clásico de este control.
    this.query.set('');
    this.activeIndex.set(this.indexOfSelected());
    this.open.set(true);
  }

  protected onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(0);
    this.open.set(true);
  }

  protected onKeydown(event: KeyboardEvent): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.onFocus();
          return;
        }
        this.moveActive(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(-1);
        return;
      case 'Home':
        if (!this.open()) return;
        event.preventDefault();
        this.setActive(0);
        return;
      case 'End':
        if (!this.open()) return;
        event.preventDefault();
        this.setActive(this.visibleOptions().length - 1);
        return;
      case 'Enter': {
        if (!this.open()) return;
        // Puede vivir dentro de un formulario: sin esto, elegir con Enter lo enviaría.
        event.preventDefault();
        const opt = this.activeOption();
        if (opt) this.choose(opt);
        return;
      }
      case 'Escape':
        if (!this.open()) return;
        event.preventDefault();
        this.close();
        return;
      case 'Tab':
        this.close();
        return;
      default:
        return;
    }
  }

  protected choose(opt: NfComboboxOption): void {
    this.value.set(opt.value);
    this.close();
  }

  protected clear(): void {
    this.value.set('');
    this.query.set('');
    this.inputEl()?.nativeElement.focus();
  }

  protected onDocumentPointerDown(event: Event): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.close();
  }

  private close(): void {
    this.open.set(false);
    this.query.set('');
  }

  private indexOfSelected(): number {
    const v = this.value();
    const i = this.options().findIndex((o) => o.value === v);
    return i >= 0 ? i : 0;
  }

  private moveActive(delta: number): void {
    const total = this.visibleOptions().length;
    if (total === 0) return;
    // Envuelve por los extremos: bajar desde el último vuelve al primero.
    this.setActive((this.activeIndex() + delta + total) % total);
  }

  private setActive(index: number): void {
    this.activeIndex.set(index);
    // El resaltado con teclado tiene que arrastrar el scroll de la lista, o se pierde
    // de vista a la tercera flecha.
    queueMicrotask(() => {
      const el = this.listEl()?.nativeElement.querySelector<HTMLElement>(`[data-idx="${index}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }
}

/**
 * Minúsculas sin acentos ni signos: `Kai'Sa` → `kaisa`, `Bel'Veth` → `belveth`.
 * Se aplica igual a lo escrito y a la etiqueta, así que la comparación es simétrica.
 */
function normalize(text: string): string {
  // NFD separa la tilde de su letra y el filtro final se queda solo con a-z0-9, asi que
  // la marca diacritica cae sola: no hace falta un rango unicode aparte.
  return text.normalize('NFD').toLowerCase().replace(/[^a-z0-9]/g, '');
}
