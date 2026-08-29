import { Injectable, computed, signal } from '@angular/core';
import { EMPTY_FILTERS, MatchFilterState } from '../../../../core/matches/match-filtering';

/**
 * Estado de interfaz del historial: qué filtros hay puestos, en qué página estás y qué filas
 * tienes desplegadas.
 *
 * **No lleva `providedIn`**. Se declara en `providers: []` de `Historial` y de
 * `GrupoHistorial`, así que cada ruta tiene su propia instancia y Angular la destruye al
 * salir. Eso arregla de raíz dos cosas que hacía la versión anterior, que guardaba esto en
 * `MatchHistoryStore` (un singleton de `core/`):
 *
 * 1. Los filtros se colaban entre vistas. Filtrabas por MID en tu historial, entrabas a un
 *    grupo y su lista salía filtrada sin que nada lo indicase.
 * 2. Rompía la regla de oro del proyecto: estado de UI ≠ estado de dominio.
 */
@Injectable()
export class MatchHistoryUiState {
  private readonly _filters = signal<MatchFilterState>(EMPTY_FILTERS);
  private readonly _expandedIds = signal<ReadonlySet<string>>(new Set());
  private readonly _page = signal(1);

  readonly filters = this._filters.asReadonly();
  readonly page = this._page.asReadonly();

  /**
   * Varias filas pueden estar abiertas a la vez. Antes era un único id, así que abrir una
   * partida cerraba la anterior y comparar dos seguidas era imposible.
   */
  readonly expandedIds = this._expandedIds.asReadonly();

  readonly hasSearch = computed(() => this._filters().searchQuery.trim().length > 0);

  /**
   * Cualquier cambio de filtro devuelve a la página 1. Sin esto, filtrar desde la página 3
   * dejaba la lista vacía y pintaba «no se encontraron partidas» habiendo resultados.
   */
  update(partial: Partial<MatchFilterState>): void {
    this._filters.update((current) => ({ ...current, ...partial }));
    this._page.set(1);
  }

  reset(): void {
    this._filters.set(EMPTY_FILTERS);
    this._page.set(1);
  }

  setPage(page: number): void {
    this._page.set(page);
  }

  isExpanded(matchId: string): boolean {
    return this._expandedIds().has(matchId);
  }

  toggleExpand(matchId: string): void {
    this._expandedIds.update((current) => {
      const next = new Set(current);
      if (!next.delete(matchId)) next.add(matchId);
      return next;
    });
  }
}
