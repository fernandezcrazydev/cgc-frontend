import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  ViewEncapsulation,
  contentChild,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

let nextTypeaheadId = 0;

/**
 * Primitiva accesible de Typeahead (búsqueda predictiva con autocompletado).
 * Soporta navegación por teclado completa (`ArrowDown`, `ArrowUp`, `Enter`, `Escape`, `Tab`),
 * renderizado dinámico de sugerencias, estados de carga y cierre al clic exterior.
 */
@Component({
  selector: 'nf-typeahead',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'nf-typeahead',
    '(document:pointerdown)': 'onDocumentPointerDown($event)',
  },
  template: `
    <div class="nf-typeahead__field" [class.nf-typeahead__field--open]="open() && (suggestions().length > 0 || (loading() && query().trim().length >= minChars()))">
      @if (showSearchIcon()) {
        <span class="nf-typeahead__prefix-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.6" />
            <path d="M10 10l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </span>
      }

      <input
        #input
        class="nf-typeahead__input"
        type="text"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        [id]="inputId"
        [attr.aria-label]="ariaLabel() || null"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="open() && activeIndex() >= 0 ? optionId(activeIndex()) : null"
        [attr.placeholder]="placeholder()"
        [value]="query()"
        (focus)="onFocus()"
        (input)="onInput($event)"
        (keydown)="onKeydown($event)"
      />

      @if (loading()) {
        <span class="nf-typeahead__spinner" aria-hidden="true">◌</span>
      } @else if (query() && clearable()) {
        <button
          type="button"
          class="nf-typeahead__clear"
          tabindex="-1"
          aria-label="Borrar búsqueda"
          (click)="clear()"
        >
          ✕
        </button>
      } @else if (shortcut()) {
        <kbd class="nf-typeahead__shortcut nf-mono">{{ shortcut() }}</kbd>
      }
    </div>

    @if (open() && (suggestions().length > 0 || loading() || (query().trim().length >= minChars() && emptyText()))) {
      <ul
        #list
        class="nf-typeahead__dropdown"
        [id]="listId"
        role="listbox"
        [attr.aria-label]="ariaLabel() || 'Sugerencias'"
      >
        @if (loading() && suggestions().length === 0) {
          <li class="nf-typeahead__loading" aria-busy="true">
            <span class="nf-mono">Buscando…</span>
          </li>
        } @else {
          @for (item of suggestions(); track itemTrackBy(item, $index); let i = $index) {
            <li
              class="nf-typeahead__item"
              [class.nf-typeahead__item--active]="i === activeIndex()"
              [id]="optionId(i)"
              [attr.data-idx]="i"
              role="option"
              [attr.aria-selected]="i === activeIndex()"
              (pointerenter)="activeIndex.set(i)"
              (click)="choose(item)"
            >
              @if (itemTemplate(); as tpl) {
                <ng-container *ngTemplateOutlet="tpl; context: { $implicit: item, index: i, active: i === activeIndex() }" />
              } @else {
                <span class="nf-typeahead__item-default">{{ defaultLabel(item) }}</span>
              }
            </li>
          } @empty {
            @if (!loading() && query().trim().length >= minChars()) {
              <li class="nf-typeahead__empty">{{ emptyText() }}</li>
            }
          }
        }
      </ul>
    }
  `,
  styleUrl: './nf-typeahead.scss',
})
export class NfTypeahead<T = any> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly placeholder = input<string>('Buscar…');
  readonly ariaLabel = input<string>('Buscar');
  readonly emptyText = input<string>('Sin resultados');
  readonly minChars = input<number>(1);
  readonly clearable = input<boolean>(true);
  readonly loading = input<boolean>(false);
  readonly showSearchIcon = input<boolean>(false);
  readonly shortcut = input<string | null>(null);
  readonly suggestions = input<readonly T[]>([]);

  /** Función opcional para extraer la clave de tracking */
  readonly trackBy = input<((item: T) => any) | null>(null);

  /** Función opcional para extraer la etiqueta por defecto si no hay template */
  readonly labelKey = input<string | ((item: T) => string)>('label');

  /** Modelo de texto de búsqueda en dos direcciones */
  readonly query = model<string>('');

  /** Eventos */
  readonly selectOption = output<T>();

  /** Template proyectado para cada sugerencia */
  readonly itemTemplate = contentChild<TemplateRef<{ $implicit: T; index: number; active: boolean }>>(TemplateRef);

  protected readonly inputId = `nf-ta-${++nextTypeaheadId}`;
  protected readonly listId = `nf-ta-${nextTypeaheadId}-list`;

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('input');
  private readonly listEl = viewChild<ElementRef<HTMLElement>>('list');

  readonly open = signal(false);
  readonly activeIndex = signal(-1);

  protected itemTrackBy(item: T, index: number): any {
    const fn = this.trackBy();
    if (fn) return fn(item);
    return (item as any)?.id ?? (item as any)?.userId ?? (item as any)?.name ?? index;
  }

  protected defaultLabel(item: T): string {
    const key = this.labelKey();
    if (typeof key === 'function') return key(item);
    return (item as any)?.[key] ?? String(item);
  }

  protected optionId(index: number): string {
    return `${this.inputId}-opt-${index}`;
  }

  protected onFocus(): void {
    if (this.query().trim().length >= this.minChars()) {
      this.open.set(true);
    }
  }

  protected onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.query.set(val);
    this.activeIndex.set(-1);
    this.open.set(val.trim().length >= this.minChars());
  }

  protected onKeydown(event: KeyboardEvent): void {
    const list = this.suggestions();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.open.set(true);
          return;
        }
        if (list.length > 0) {
          const next = this.activeIndex() + 1;
          this.setActive(next >= list.length ? 0 : next);
        }
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (this.open() && list.length > 0) {
          const next = this.activeIndex() - 1;
          this.setActive(next < 0 ? list.length - 1 : next);
        }
        return;
      case 'Enter':
        if (!this.open()) return;
        if (this.activeIndex() >= 0 && this.activeIndex() < list.length) {
          event.preventDefault();
          this.choose(list[this.activeIndex()]);
        }
        return;
      case 'Escape':
        if (!this.open()) return;
        event.preventDefault();
        this.close();
        return;
      case 'Tab':
        if (this.open() && list.length > 0) {
          event.preventDefault();
          if (event.shiftKey) {
            const next = this.activeIndex() - 1;
            this.setActive(next < 0 ? list.length - 1 : next);
          } else {
            const next = this.activeIndex() + 1;
            this.setActive(next >= list.length ? 0 : next);
          }
          return;
        }
        this.close();
        return;
      default:
        return;
    }
  }

  protected choose(item: T): void {
    this.selectOption.emit(item);
    this.close();
  }

  focus(): void {
    this.inputEl()?.nativeElement.focus();
  }

  clear(): void {
    this.query.set('');
    this.close();
    this.inputEl()?.nativeElement.focus();
  }

  close(): void {
    this.open.set(false);
    this.activeIndex.set(-1);
  }

  protected onDocumentPointerDown(event: Event): void {
    if (!this.open()) return;
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) return;
    this.close();
  }

  private setActive(index: number): void {
    this.activeIndex.set(index);
    queueMicrotask(() => {
      const el = this.listEl()?.nativeElement.querySelector<HTMLElement>(`[data-idx="${index}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    });
  }
}
