import { Component, EventEmitter, Input, Output, ViewEncapsulation, computed, signal } from '@angular/core';

/** A rendered slot in the pager: either a page number or an ellipsis gap. */
type PageItem = { kind: 'page'; n: number } | { kind: 'gap' };

/**
 * NEXUS//FORGE Pagination — presentational pager for any list view.
 *
 * Stateless about the data: the parent owns the full collection, this only
 * reports which page is wanted. Give it the total item count + page size and
 * it draws prev/next, a windowed page list ("1 … 4 5 6 … 20") and an
 * "X–Y de Z" summary.
 *
 *   <nf-pagination
 *     [total]="items.length"
 *     [pageSize]="10"
 *     [page]="page()"
 *     (pageChange)="page.set($event)" />
 *
 * The parent then slices: `items.slice((page-1)*pageSize, page*pageSize)`.
 */
@Component({
  selector: 'nf-pagination',
  standalone: true,
  template: `
    @if (pageCount() > 1) {
      <nav class="nf-pager" aria-label="Paginación">
        <span class="nf-pager__summary nf-mono">
          {{ rangeStart() }}–{{ rangeEnd() }} <span class="nf-pager__of">de</span> {{ total }}
        </span>

        <div class="nf-pager__controls">
          <button
            type="button"
            class="nf-pager__btn nf-pager__btn--nav nf-mono"
            [disabled]="page <= 1"
            (click)="go(page - 1)"
            aria-label="Página anterior"
          >◄</button>

          @for (item of items(); track $index) {
            @if (item.kind === 'gap') {
              <span class="nf-pager__gap nf-mono">…</span>
            } @else {
              <button
                type="button"
                class="nf-pager__btn nf-mono"
                [class.is-active]="item.n === page"
                [attr.aria-current]="item.n === page ? 'page' : null"
                (click)="go(item.n)"
              >{{ item.n }}</button>
            }
          }

          <button
            type="button"
            class="nf-pager__btn nf-pager__btn--nav nf-mono"
            [disabled]="page >= pageCount()"
            (click)="go(page + 1)"
            aria-label="Página siguiente"
          >►</button>
        </div>
      </nav>
    }
  `,
  styleUrl: './nf-pagination.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfPagination {
  /** Total number of items across all pages. */
  @Input({ required: true })
  set total(v: number) { this._total.set(v); }
  get total(): number { return this._total(); }

  /** Items per page. */
  @Input()
  set pageSize(v: number) { this._pageSize.set(v); }
  get pageSize(): number { return this._pageSize(); }

  /** Current page, 1-based. */
  @Input()
  set page(v: number) { this._page.set(v); }
  get page(): number { return this._page(); }

  /** How many numbered buttons to keep around the current page on each side. */
  @Input()
  set siblings(v: number) { this._siblings.set(v); }
  get siblings(): number { return this._siblings(); }

  @Output() readonly pageChange = new EventEmitter<number>();

  private readonly _total = signal(0);
  private readonly _pageSize = signal(10);
  private readonly _page = signal(1);
  private readonly _siblings = signal(1);

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this._total() / this._pageSize())));
  readonly rangeStart = computed(() => this._total() === 0 ? 0 : (this._page() - 1) * this._pageSize() + 1);
  readonly rangeEnd = computed(() => Math.min(this._page() * this._pageSize(), this._total()));

  /** Windowed list of page buttons with ellipsis gaps where pages are skipped. */
  readonly items = computed<PageItem[]>(() => {
    const count = this.pageCount();
    const current = this._page();
    const sib = this._siblings();
    const pages = new Set<number>([1, count]);
    for (let n = current - sib; n <= current + sib; n++) {
      if (n >= 1 && n <= count) pages.add(n);
    }
    const sorted = [...pages].sort((a, b) => a - b);

    const out: PageItem[] = [];
    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) out.push({ kind: 'gap' });
      out.push({ kind: 'page', n });
      prev = n;
    }
    return out;
  });

  go(n: number): void {
    const clamped = Math.min(Math.max(1, n), this.pageCount());
    if (clamped !== this._page()) {
      this._page.set(clamped);
      this.pageChange.emit(clamped);
    }
  }
}
