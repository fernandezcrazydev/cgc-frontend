import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PageResponse } from '../http';
import { SecurityAuditApi } from './security-audit-api';
import {
  SecurityAuditClient,
  SecurityAuditEvent,
  SecurityAuditFilters,
  SecurityAuditSummary,
} from './security-audit-models';

/** Estado de una carga, como en `Session`. */
export type SecurityAuditStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * El log de seguridad para el panel de admin.
 *
 * Las tres lecturas (resumen, ranking y listado) se piden **a la vez** y comparten filtros: son
 * tres vistas del mismo periodo y enseñarlas desincronizadas —el resumen de ayer junto al
 * listado de hoy— llevaría a conclusiones falsas justo mientras se investiga algo.
 *
 * Un fallo parcial no vacía lo demás: si el ranking cae pero el listado llega, se pinta el
 * listado. Con un log, la mitad de la información sigue siendo información.
 */
@Injectable({ providedIn: 'root' })
export class SecurityAuditStore {
  private readonly api = inject(SecurityAuditApi);

  static readonly PAGE_SIZE = 25;
  /** Suficiente para ver la forma de un ranking sin convertirlo en un segundo listado. */
  static readonly TOP_CLIENTS = 15;

  private readonly _status = signal<SecurityAuditStatus>('idle');
  private readonly _page = signal<PageResponse<SecurityAuditEvent> | null>(null);
  private readonly _summary = signal<SecurityAuditSummary | null>(null);
  private readonly _clients = signal<SecurityAuditClient[] | null>(null);
  private readonly _filters = signal<SecurityAuditFilters>({});
  private readonly _lastError = signal<unknown>(null);

  readonly status = this._status.asReadonly();
  readonly page = this._page.asReadonly();
  readonly summary = this._summary.asReadonly();
  readonly clients = this._clients.asReadonly();
  readonly filters = this._filters.asReadonly();
  /** El primer fallo de la última carga, para que la vista lo traduzca. Null si no hubo. */
  readonly lastError = this._lastError.asReadonly();

  /**
   * Cargando de verdad. `idle` cuenta: la vista se construye antes de que arranque la primera
   * petición, y sin esto parpadearía un «no hay nada» falso antes del primer esqueleto.
   */
  readonly loading = computed(() => this._status() === 'loading' || this._status() === 'idle');

  /** Evita que dos cargas solapadas se pisen: gana siempre la última pedida. */
  private requestId = 0;

  /**
   * Carga las tres lecturas para `pageIndex` (0-based) con los filtros actuales.
   *
   * No lanza: deja el estado en `error` y que la vista lo pinte. Es una pantalla de solo
   * lectura y con tres peticiones a la vez, así que propagar la primera que falle escondería
   * las otras dos, que puede que sí hayan traído algo.
   */
  async load(pageIndex = 0): Promise<void> {
    const id = ++this.requestId;
    this._status.set('loading');

    const filters = this._filters();
    const [page, summary, clients] = await Promise.allSettled([
      firstValueFrom(this.api.list(filters, pageIndex, SecurityAuditStore.PAGE_SIZE)),
      firstValueFrom(this.api.summary(filters)),
      firstValueFrom(this.api.topClients(filters, SecurityAuditStore.TOP_CLIENTS)),
    ]);

    // La respuesta de una carga que ya no es la vigente se descarta entera: escribirla
    // machacaría lo que pidió el filtro nuevo con datos del viejo.
    if (id !== this.requestId) return;

    this._page.set(page.status === 'fulfilled' ? page.value : null);
    this._summary.set(summary.status === 'fulfilled' ? summary.value : null);
    this._clients.set(clients.status === 'fulfilled' ? clients.value : null);

    // El primero que falle, si falla alguno. Basta con uno: los tres comparten filtros, así que
    // un 400 por una IP mal escrita los tumba a la vez y con el mismo motivo — repetir el toast
    // tres veces solo serviría para taparlo.
    const fallos = [page, summary, clients].filter((r) => r.status === 'rejected');
    this._lastError.set(fallos.length ? (fallos[0] as PromiseRejectedResult).reason : null);
    this._status.set(fallos.length === 3 ? 'error' : 'ready');
  }

  /** Cambia filtros y recarga desde la primera página: un filtro nuevo invalida el offset. */
  async applyFilters(filters: SecurityAuditFilters): Promise<void> {
    this._filters.set(filters);
    await this.load(0);
  }

  /** Vuelve a pedir lo mismo, para el botón de reintentar. */
  async retry(): Promise<void> {
    await this.load(this._page()?.page ?? 0);
  }
}
