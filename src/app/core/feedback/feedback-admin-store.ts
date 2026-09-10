import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FeedbackAdminApi } from './feedback-admin-api';
import {
  FeedbackDetail,
  FeedbackListFilters,
  FeedbackStatusTag,
  FeedbackSummary,
  PageResponse,
  UpdateFeedbackRequest,
} from './admin-models';

/**
 * Grafo de transiciones de estado, espejo de `FeedbackStatus` del backend
 * (`NEW → IN_REVIEW → RESOLVED | REJECTED`, con los dos últimos terminales). El estado
 * actual siempre se incluye: el PATCH permite editar solo la nota sin mover el estado.
 *
 * Es una comodidad de UI (qué ofrecer en el selector); el backend revalida y responde 409
 * a un salto ilegal, así que esto no es la barrera de seguridad, solo evita ofrecer lo imposible.
 */
export function allowedNextStatuses(status: FeedbackStatusTag): FeedbackStatusTag[] {
  switch (status) {
    case 'NEW':
      return ['NEW', 'IN_REVIEW'];
    case 'IN_REVIEW':
      return ['IN_REVIEW', 'RESOLVED', 'REJECTED'];
    case 'RESOLVED':
      return ['RESOLVED'];
    case 'REJECTED':
      return ['REJECTED'];
  }
}

/**
 * Lecturas y triaje del feedback para el panel de admin. Al estilo `Session`: el estado
 * (página cargada, detalle, banderas de carga) vive en signals que las vistas leen; los
 * errores se propagan (la vista los traduce a un toast).
 */
@Injectable({ providedIn: 'root' })
export class FeedbackAdminStore {
  private readonly api = inject(FeedbackAdminApi);

  static readonly PAGE_SIZE = 20;

  private readonly _page = signal<PageResponse<FeedbackSummary> | null>(null);
  private readonly _loading = signal(false);
  private readonly _filters = signal<FeedbackListFilters>({});

  /** La página cargada (o null antes de la primera carga). */
  readonly page = this._page.asReadonly();
  /** Hay una lista en vuelo: la vista muestra el esqueleto. */
  readonly loading = this._loading.asReadonly();
  readonly filters = this._filters.asReadonly();

  /**
   * Cuántos reportes están sin triar. Lo pinta el badge del directorio de admin, que es una
   * pantalla distinta de la tabla, así que vive aparte de `_page` y no lo invalida un filtro.
   */
  private readonly _pendingCount = signal<number | null>(null);
  private readonly _pendingStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  private pendingInFlight: Promise<void> | null = null;

  /** Reportes en `NEW`, o `null` mientras no se haya llegado a saber. Nunca 0 por defecto. */
  readonly pendingCount = this._pendingCount.asReadonly();
  readonly pendingStatus = this._pendingStatus.asReadonly();

  private readonly _detail = signal<FeedbackDetail | null>(null);
  private readonly _detailLoading = signal(false);
  private readonly _saving = signal(false);

  readonly detail = this._detail.asReadonly();
  readonly detailLoading = this._detailLoading.asReadonly();
  /** Hay un PATCH en vuelo: la vista deshabilita el botón de guardar. */
  readonly saving = this._saving.asReadonly();

  /**
   * Carga una página (0-based) con los filtros actuales. Guarda contra recargas solapadas.
   * Lanza si falla; la vista lo traduce a un toast y deja reintentar.
   */
  async loadPage(pageIndex = 0): Promise<void> {
    this._loading.set(true);
    try {
      const result = await firstValueFrom(
        this.api.list(this._filters(), pageIndex, FeedbackAdminStore.PAGE_SIZE),
      );
      this._page.set(result);
    } finally {
      this._loading.set(false);
    }
  }

  /** Cambia los filtros y recarga desde la primera página (un filtro nuevo invalida el offset). */
  async applyFilters(filters: FeedbackListFilters): Promise<void> {
    this._filters.set(filters);
    await this.loadPage(0);
  }

  /**
   * Refresca el número de reportes sin triar. Deduplica la petición en vuelo, así que dos
   * vistas montándose a la vez no piden dos veces.
   *
   * Se llama al entrar en la ruta y no una sola vez por sesión: otro admin puede haber
   * triado mientras tanto. Quien lo pinta conserva el valor anterior mientras llega el
   * nuevo, de modo que volver a la pantalla no parpadea.
   *
   * BACKEND NOTE: no hay endpoint de conteo, así que se pide la primera página del filtro
   * `NEW` con `size=1` y se lee `totalElements` (el total de la colección, no de la página).
   * Si algún día existe un resumen del panel, este es el sitio que cambia.
   */
  refreshPendingCount(): Promise<void> {
    return (this.pendingInFlight ??= this.fetchPendingCount());
  }

  /**
   * A diferencia del resto del store, este fallo NO se propaga: el contador es un extra de
   * una pantalla que funciona sin él, y un toast de error por un badge que no ha cargado es
   * ruido sobre algo que el admin no puede arreglar. Se queda en `error` y no se pinta nada.
   */
  private async fetchPendingCount(): Promise<void> {
    this._pendingStatus.set('loading');
    try {
      const page = await firstValueFrom(this.api.list({ status: 'NEW' }, 0, 1));
      this._pendingCount.set(page.totalElements);
      this._pendingStatus.set('ready');
    } catch {
      this._pendingStatus.set('error');
    } finally {
      this.pendingInFlight = null;
    }
  }

  /** Carga el detalle de un reporte. Lo deja en `detail()`; lanza (p. ej. 404) para que la vista reaccione. */
  async loadDetail(id: string): Promise<void> {
    this._detail.set(null);
    this._detailLoading.set(true);
    try {
      this._detail.set(await firstValueFrom(this.api.detail(id)));
    } finally {
      this._detailLoading.set(false);
    }
  }

  /**
   * Aplica el cambio de estado/nota. Pesimista y no reentrante: espera la confirmación del
   * servidor y guarda contra doble submit. Refresca `detail()` con lo que devuelve el back
   * (incluido el `updatedAt`). Devuelve `false` si ya había un guardado en vuelo; lanza si
   * el servidor rechaza (p. ej. 409 transición ilegal), para que la vista muestre el error.
   */
  async save(id: string, body: UpdateFeedbackRequest): Promise<boolean> {
    if (this._saving()) return false;
    this._saving.set(true);
    try {
      this._detail.set(await firstValueFrom(this.api.update(id, body)));
      return true;
    } finally {
      this._saving.set(false);
    }
  }
}
