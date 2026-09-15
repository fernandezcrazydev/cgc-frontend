/**
 * El historial de partidas contra el backend real.
 *
 * Patrón `Session` (`status` / `ensureLoaded` / `reload` / `clear`), una vez por superficie:
 * la lista del grupo, la lista personal —que es también la del cruce, porque el cruce es un
 * filtro y no un endpoint—, los dos resúmenes y el detalle.
 *
 * ## Lo que este store ya NO hace
 *
 * Con la paginación en servidor **el store deja de tener la lista entera**, así que nada de lo
 * que se derivaba de tenerla sigue existiendo: `personalSummary` y `groupSummary` son ahora
 * endpoints (por eso son endpoints y no `computed`), y filtrar, ordenar y buscar los hace el
 * servidor. Sumar «cuántas victorias llevo» sobre las seis filas de la página en pantalla es
 * exactamente el error que esa separación evita.
 *
 * ## Una petición por superficie, y las obsoletas se tiran
 *
 * Cada carga lleva número de secuencia: al cambiar de filtro, de página o de `:id` la respuesta
 * que llegue tarde ya no escribe en la signal. Sin eso, teclear en el buscador deja la lista en
 * el resultado de la penúltima letra.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Session } from '../auth';
import { PageResponse, parseApiError } from '../http';
import { MatchesApi } from './matches-api';
import {
  GroupMatchQuery,
  MAX_PAGE_SIZE,
  PersonalMatchQuery,
  PersonalSummaryQuery,
  sortParam,
} from './match-filtering';
import { GroupHistorySummary, Match, MatchDetail, PersonalHistorySummary } from './models';
import { MatchMappingContext } from './match-mapper';

export type MatchHistoryStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Una página vacía: lo que se pinta antes de la primera carga y tras un `clear()`. */
const EMPTY_PAGE: PageResponse<Match> = {
  content: [],
  page: 0,
  size: 0,
  totalElements: 0,
  totalPages: 0,
};

@Injectable({ providedIn: 'root' })
export class MatchHistoryStore {
  private readonly api = inject(MatchesApi);
  private readonly session = inject(Session);

  // ── Historial personal (y el del cruce, que es el mismo con `with`) ────────
  private readonly _personal = signal<PageResponse<Match>>(EMPTY_PAGE);
  private readonly _personalStatus = signal<MatchHistoryStatus>('idle');
  private personalKey: string | null = null;
  private personalSeq = 0;

  /**
   * `true` cuando el backend respondió `403 PROFILE_PRIVATE`: la persona del `with=` tiene el
   * perfil privado y quien mira no es ella ni administra un grupo con ella.
   *
   * Signal propia y no un `status: 'forbidden'` porque no es un fallo del que haya que
   * reintentar: es una respuesta correcta a la que le corresponde una pantalla entera —la del
   * candado—, igual que el 404 del detalle tiene la suya. Mezclarla con `error` haría que el
   * cruce ofreciera un botón de «Reintentar» que no puede funcionar nunca.
   */
  private readonly _personalProfilePrivate = signal(false);

  readonly personal = this._personal.asReadonly();
  readonly personalStatus = this._personalStatus.asReadonly();
  readonly personalProfilePrivate = this._personalProfilePrivate.asReadonly();
  readonly personalMatches = computed(() => this._personal().content);
  readonly personalTotal = computed(() => this._personal().totalElements);

  // ── Historial de un grupo ─────────────────────────────────────────────────
  private readonly _group = signal<PageResponse<Match>>(EMPTY_PAGE);
  private readonly _groupStatus = signal<MatchHistoryStatus>('idle');
  private groupKey: string | null = null;
  private groupSeq = 0;

  readonly group = this._group.asReadonly();
  readonly groupStatus = this._groupStatus.asReadonly();
  readonly groupMatches = computed(() => this._group().content);
  readonly groupTotal = computed(() => this._group().totalElements);

  // ── Muestra de un grupo (superficies analíticas) ──────────────────────────
  /**
   * Las últimas partidas de un grupo, en una sola página del tamaño máximo que admite el
   * servidor.
   *
   * Existe porque hay pantallas que no son una lista —la tier list de campeones, el cajón de
   * partidas recientes de un jugador en el ranking— y necesitan un CORPUS, no una página de
   * seis. Es una muestra acotada y se dice en pantalla: «sobre las últimas N partidas». Lo que
   * NO es: el historial entero. Esa vuelta ya no existe en el cliente, y llamar «tier list del
   * grupo» a lo que sale de seis filas sería peor que no darla.
   *
   * Va en su propio hueco para que abrir la tier list no le pise la página al historial, que
   * consulta el mismo endpoint con otros parámetros.
   *
   * BACKEND NOTE: estas agregaciones son regla de negocio y acabarán siendo del servidor, que
   * es quien puede recorrer el grupo entero. Cuando existan sus endpoints, esta muestra se borra.
   */
  private readonly _groupSample = signal<PageResponse<Match>>(EMPTY_PAGE);
  private readonly _groupSampleStatus = signal<MatchHistoryStatus>('idle');
  private groupSampleKey: string | null = null;
  private groupSampleSeq = 0;

  readonly groupSampleStatus = this._groupSampleStatus.asReadonly();
  readonly groupSample = computed(() => this._groupSample().content);
  /** Cuántas hay en el grupo en total, para poder decir sobre cuántas se ha calculado. */
  readonly groupSampleTotal = computed(() => this._groupSample().totalElements);

  ensureGroupSample(group: { id: string; name: string }): Promise<void> {
    if (group.id === this.groupSampleKey && this._groupSampleStatus() === 'ready') {
      return Promise.resolve();
    }
    return this.loadGroupSample(group);
  }

  private async loadGroupSample(group: { id: string; name: string }): Promise<void> {
    const seq = ++this.groupSampleSeq;
    this.groupSampleKey = group.id;
    this._groupSampleStatus.set('loading');
    try {
      const page = await firstValueFrom(
        this.api.groupMatches(
          group.id,
          { page: 0, size: MAX_PAGE_SIZE, sort: sortParam('date-desc') },
          this.ctx(),
        ),
      );
      if (seq !== this.groupSampleSeq) return;
      this._groupSample.set(page);
      this._groupSampleStatus.set('ready');
    } catch {
      if (seq !== this.groupSampleSeq) return;
      this.groupSampleKey = null;
      this._groupSample.set(EMPTY_PAGE);
      this._groupSampleStatus.set('error');
    }
  }

  // ── Resúmenes ─────────────────────────────────────────────────────────────
  /**
   * Los resúmenes personales pedidos, **por consulta**.
   *
   * Es un mapa y no un solo valor porque la pantalla del cruce enseña TRES a la vez —todas,
   * juntos y enfrentados— y son la misma llamada con distinta relación. Con un único hueco, las
   * tres pestañas acababan enseñando el número de la última que se pidió.
   */
  private readonly _personalSummaries = signal<ReadonlyMap<string, PersonalHistorySummary>>(
    new Map(),
  );
  private readonly _personalSummaryStatus = signal<MatchHistoryStatus>('idle');
  private readonly personalSummaryKeys = new Set<string>();
  private personalSummarySeq = 0;

  readonly personalSummaryStatus = this._personalSummaryStatus.asReadonly();

  /** El resumen de una consulta concreta, o `null` si todavía no ha llegado. */
  personalSummaryFor(query: PersonalSummaryQuery): PersonalHistorySummary | null {
    return this._personalSummaries().get(keyOf(query)) ?? null;
  }

  private readonly _groupSummary = signal<GroupHistorySummary | null>(null);
  private readonly _groupSummaryStatus = signal<MatchHistoryStatus>('idle');
  private groupSummaryKey: string | null = null;
  private groupSummarySeq = 0;

  readonly groupSummary = this._groupSummary.asReadonly();
  readonly groupSummaryStatus = this._groupSummaryStatus.asReadonly();

  // ── Detalle ───────────────────────────────────────────────────────────────
  private readonly _detail = signal<MatchDetail | null>(null);
  private readonly _detailStatus = signal<MatchHistoryStatus>('idle');
  /** `true` cuando el backend respondió 404: la partida no existe, o no es de un grupo tuyo. */
  private readonly _detailNotFound = signal(false);
  private detailKey: string | null = null;
  private detailSeq = 0;

  readonly detail = this._detail.asReadonly();
  readonly detailStatus = this._detailStatus.asReadonly();
  readonly detailNotFound = this._detailNotFound.asReadonly();
  readonly detailMatch = computed(() => this._detail()?.match ?? null);

  /** El contexto con el que se mapea cada fila: quién soy, para resolver mi asiento. */
  private ctx(): MatchMappingContext {
    return { currentUserId: this.session.user()?.userId ?? null };
  }

  // ── Cargas ────────────────────────────────────────────────────────────────

  /** La página pedida del historial personal. Idempotente: repetir la misma consulta no refetch. */
  ensurePersonal(query: PersonalMatchQuery): Promise<void> {
    const key = keyOf(query);
    if (key === this.personalKey && this._personalStatus() === 'ready') return Promise.resolve();
    return this.loadPersonal(query, key);
  }

  reloadPersonal(query: PersonalMatchQuery): Promise<void> {
    return this.loadPersonal(query, keyOf(query));
  }

  private async loadPersonal(query: PersonalMatchQuery, key: string): Promise<void> {
    const seq = ++this.personalSeq;
    this.personalKey = key;
    this._personalStatus.set('loading');
    this._personalProfilePrivate.set(false);
    try {
      const page = await firstValueFrom(this.api.myMatches(query, this.ctx()));
      if (seq !== this.personalSeq) return;
      this._personal.set(page);
      this._personalStatus.set('ready');
    } catch (error: unknown) {
      if (seq !== this.personalSeq) return;
      this.personalKey = null;
      this._personal.set(EMPTY_PAGE);
      this._personalProfilePrivate.set(isProfilePrivate(error));
      this._personalStatus.set('error');
    }
  }

  /** La página pedida del historial de un grupo. */
  ensureGroup(
    group: { id: string; name: string },
    query: GroupMatchQuery,
  ): Promise<void> {
    const key = group.id + '|' + keyOf(query);
    if (key === this.groupKey && this._groupStatus() === 'ready') return Promise.resolve();
    return this.loadGroup(group, query, key);
  }

  reloadGroup(group: { id: string; name: string }, query: GroupMatchQuery): Promise<void> {
    return this.loadGroup(group, query, group.id + '|' + keyOf(query));
  }

  private async loadGroup(
    group: { id: string; name: string },
    query: GroupMatchQuery,
    key: string,
  ): Promise<void> {
    const seq = ++this.groupSeq;
    this.groupKey = key;
    this._groupStatus.set('loading');
    try {
      const page = await firstValueFrom(this.api.groupMatches(group.id, query, this.ctx()));
      if (seq !== this.groupSeq) return;
      this._group.set(page);
      this._groupStatus.set('ready');
    } catch {
      if (seq !== this.groupSeq) return;
      this.groupKey = null;
      this._group.set(EMPTY_PAGE);
      this._groupStatus.set('error');
    }
  }

  /**
   * El resumen personal. Acepta los mismos filtros que el listado, así que el recuento del
   * cruce sale de aquí: sin `with`, «cómo me ha ido»; con él, «cómo nos ha ido cuando
   * coincidimos»; con la relación encima, «juntos» o «enfrentados».
   */
  ensurePersonalSummary(query: PersonalSummaryQuery): Promise<void> {
    const key = keyOf(query);
    if (this.personalSummaryKeys.has(key)) return Promise.resolve();
    this.personalSummaryKeys.add(key);
    return this.loadPersonalSummary(query, key);
  }

  private async loadPersonalSummary(query: PersonalSummaryQuery, key: string): Promise<void> {
    const seq = ++this.personalSummarySeq;
    this._personalSummaryStatus.set('loading');
    try {
      const summary = await firstValueFrom(this.api.mySummary(query));
      const next = new Map(this._personalSummaries());
      next.set(key, summary);
      this._personalSummaries.set(next);
      // El estado global solo lo mueve la ÚLTIMA petición: con tres resúmenes en vuelo, la
      // primera en volver dejaría la pantalla en 'ready' con las otras dos sin llegar.
      if (seq === this.personalSummarySeq) this._personalSummaryStatus.set('ready');
    } catch {
      this.personalSummaryKeys.delete(key);
      if (seq === this.personalSummarySeq) this._personalSummaryStatus.set('error');
    }
  }

  /** El resumen del grupo. No acepta filtros: describe el grupo entero. */
  ensureGroupSummary(groupId: string): Promise<void> {
    if (groupId === this.groupSummaryKey && this._groupSummaryStatus() === 'ready') {
      return Promise.resolve();
    }
    return this.loadGroupSummary(groupId);
  }

  private async loadGroupSummary(groupId: string): Promise<void> {
    const seq = ++this.groupSummarySeq;
    this.groupSummaryKey = groupId;
    this._groupSummaryStatus.set('loading');
    try {
      const summary = await firstValueFrom(this.api.groupSummary(groupId));
      if (seq !== this.groupSummarySeq) return;
      this._groupSummary.set(summary);
      this._groupSummaryStatus.set('ready');
    } catch {
      if (seq !== this.groupSummarySeq) return;
      this.groupSummaryKey = null;
      this._groupSummary.set(null);
      this._groupSummaryStatus.set('error');
    }
  }

  /**
   * El detalle de una partida. El 404 se distingue del error de red: «no existe» tiene su
   * propia pantalla, y un fallo de conexión no puede pintarse como una partida inexistente.
   */
  ensureDetail(matchId: string): Promise<void> {
    if (matchId === this.detailKey && this._detailStatus() === 'ready') return Promise.resolve();
    return this.loadDetail(matchId);
  }

  reloadDetail(matchId: string): Promise<void> {
    return this.loadDetail(matchId);
  }

  private async loadDetail(matchId: string): Promise<void> {
    const seq = ++this.detailSeq;
    this.detailKey = matchId;
    this._detailStatus.set('loading');
    this._detailNotFound.set(false);
    try {
      const detail = await firstValueFrom(this.api.detail(matchId, this.ctx()));
      if (seq !== this.detailSeq) return;
      this._detail.set(detail);
      this._detailStatus.set('ready');
    } catch (error: unknown) {
      if (seq !== this.detailSeq) return;
      this.detailKey = null;
      this._detail.set(null);
      this._detailNotFound.set((error as { status?: number })?.status === 404);
      this._detailStatus.set('error');
    }
  }

  /** Al cerrar sesión no debe quedar rastro del historial del usuario anterior. */
  clear(): void {
    this.personalSeq++;
    this.groupSeq++;
    this.groupSampleSeq++;
    this.personalSummarySeq++;
    this.groupSummarySeq++;
    this.detailSeq++;
    this.personalKey = null;
    this.groupKey = null;
    this.groupSampleKey = null;
    this.personalSummaryKeys.clear();
    this.groupSummaryKey = null;
    this.detailKey = null;
    this._personal.set(EMPTY_PAGE);
    this._group.set(EMPTY_PAGE);
    this._groupSample.set(EMPTY_PAGE);
    this._personalSummaries.set(new Map());
    this._groupSummary.set(null);
    this._detail.set(null);
    this._personalStatus.set('idle');
    this._personalProfilePrivate.set(false);
    this._groupStatus.set('idle');
    this._groupSampleStatus.set('idle');
    this._personalSummaryStatus.set('idle');
    this._groupSummaryStatus.set('idle');
    this._detailStatus.set('idle');
    this._detailNotFound.set(false);
  }
}

/**
 * Si ese fallo es el 403 con el que el backend tapa un perfil privado.
 *
 * Se mira el `code` y no solo el status: un 403 sin code es «no tienes permiso» a secas, y la
 * pantalla del candado afirma algo más concreto —que esa persona lo ha elegido— que sería mentira
 * pintar sobre cualquier otro 403.
 */
function isProfilePrivate(error: unknown): boolean {
  return parseApiError(error).code === 'PROFILE_PRIVATE';
}

/** Dos consultas iguales son la misma carga. Las claves van ordenadas para que eso sea cierto. */
function keyOf(query: object): string {
  return JSON.stringify(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
