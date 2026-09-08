import { Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY_FILTERS, MatchFilterState } from '../../../../core/matches/match-filtering';
import { ViewMemoryService } from '../../../../shared/view-memory';

/**
 * Estado de interfaz del historial: qué filtros hay puestos, en qué página estás y qué filas
 * tienes desplegadas.
 *
 * Persiste su fotografía (scroll, acordeones abiertos, página y foco temporal) en
 * ViewMemoryService [F5.5-03] para restaurarlos de inmediato al volver atrás.
 */
@Injectable()
export class MatchHistoryUiState {
  private readonly viewMemory = inject(ViewMemoryService);

  private _contextKey = '/app/historial';
  private readonly _filters = signal<MatchFilterState>(EMPTY_FILTERS);
  private readonly _expandedId = signal<string | null>(null);
  private readonly _page = signal(1);
  private readonly _focusedId = signal<string | null>(null);

  readonly filters = this._filters.asReadonly();
  readonly page = this._page.asReadonly();
  readonly expandedId = this._expandedId.asReadonly();
  readonly expandedIds = computed<ReadonlySet<string>>(
    () => (this._expandedId() ? new Set([this._expandedId()!]) : new Set()),
  );
  readonly focusedId = this._focusedId.asReadonly();

  readonly hasSearch = computed(() => this._filters().searchQuery.trim().length > 0);

  setContextKey(key: string): void {
    this._contextKey = key;

    // Los filtros son una decisión deliberada del usuario y sobreviven a la navegación.
    const saved = this.viewMemory.get(key);
    if (saved?.filters) {
      this._filters.set(saved.filters as MatchFilterState);
    }

    // La página, los acordeones y el foco describen DÓNDE ESTABAS, así que solo se recuperan si
    // esto es una vuelta desde el detalle. Entrar al historial desde el menú lo pinta plegado.
    const returning = this.viewMemory.consumeReturn(key);
    if (!returning) return;

    if (typeof returning.page === 'number' && returning.page > 0) {
      this._page.set(returning.page);
    }
    if (returning.expandedIds && returning.expandedIds.length > 0) {
      this._expandedId.set(returning.expandedIds[0]);
    }
    const focused = this.viewMemory.consumeFocusedId(key);
    if (focused) {
      this._focusedId.set(focused);
      this._expandedId.set(focused);
    }
  }

  /**
   * Fotografía de la vista justo antes de salir hacia el detalle de una partida. Se guarda
   * *armada*: solo se restaurará si el usuario vuelve de ahí.
   */
  recordNavigation(matchId?: string): void {
    const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
    this.viewMemory.save(
      this._contextKey,
      {
        scrollY,
        page: this._page(),
        expandedIds: this._expandedId() ? [this._expandedId()!] : [],
        lastFocusedId: matchId ?? null,
        filters: this._filters(),
      },
      true,
    );
  }

  clearFocusedId(): void {
    this._focusedId.set(null);
  }

  /**
   * Cualquier cambio de filtro devuelve a la página 1.
   */
  update(partial: Partial<MatchFilterState>): void {
    this._filters.update((current) => ({ ...current, ...partial }));
    this._page.set(1);
    this.viewMemory.save(this._contextKey, {
      filters: this._filters(),
      page: 1,
    });
  }

  reset(): void {
    this._filters.set(EMPTY_FILTERS);
    this._page.set(1);
    this.viewMemory.save(this._contextKey, {
      filters: EMPTY_FILTERS,
      page: 1,
    });
  }

  setPage(page: number): void {
    this._page.set(page);
    this.viewMemory.save(this._contextKey, {
      page,
    });
  }

  isExpanded(matchId: string): boolean {
    return this._expandedId() === matchId;
  }

  toggleExpand(matchId: string): void {
    this._expandedId.update((current) => (current === matchId ? null : matchId));
    this.viewMemory.save(this._contextKey, {
      expandedIds: this._expandedId() ? [this._expandedId()!] : [],
      page: this._page(),
    });
  }
}
