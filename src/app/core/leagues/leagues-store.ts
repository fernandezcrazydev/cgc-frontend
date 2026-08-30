import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../http';
import { LeaguesApi, LeaderboardQuery } from './leagues-api';
import {
  LeaderboardEntryResponse,
  LeaderboardResponse,
  LeaderboardSearchSuggestion,
  LeaderboardSort,
  LeagueResponse,
  SortDirection,
} from './models';

export type LeaguesStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Filas por página. El backend usa el mismo valor por defecto. */
export const LEADERBOARD_PAGE_SIZE = 15;

/**
 * La clasificación del grupo: una página de la tabla, el podio y la liga activa.
 *
 * Clon del patrón de `core/auth/session.ts`, que es el molde obligatorio de CLAUDE.md. Antes no
 * había store: la vista inyectaba `LeaguesApi` y se suscribía dentro de un `effect()`, lo que
 * arrastraba tres problemas que aquí desaparecen de raíz.
 *
 * - **Respuestas obsoletas.** Aquella suscripción no comprobaba el id, así que al pasar del
 *   grupo A al B, si A respondía después, se pintaba la clasificación de A sobre B. Cada carga
 *   lleva ahora un número de secuencia y solo la última escribe en las signals.
 * - **Error indistinguible.** Un fallo se traducía en `null`, el mismo valor que "liga vacía" y
 *   que "aún no ha llegado", y la vista acababa tapando los tres con datos inventados. Aquí hay
 *   un `status` explícito y el mensaje en español sale de `errorMessage()`.
 * - **Fuga.** La suscripción no se cancelaba al destruir la vista.
 */
@Injectable({ providedIn: 'root' })
export class LeaguesStore {
  private readonly api = inject(LeaguesApi);

  private readonly _board = signal<LeaderboardResponse | null>(null);
  private readonly _status = signal<LeaguesStatus>('idle');
  private readonly _error = signal<string | null>(null);

  /** Qué grupo y qué página/orden describe `_board`. */
  private readonly _groupId = signal<string | null>(null);
  private readonly _query = signal<LeaderboardQuery>({
    page: 0,
    size: LEADERBOARD_PAGE_SIZE,
    sort: 'RANK',
    dir: 'ASC',
  });

  /**
   * Descarta la respuesta de una petición que ya no es la vigente. Un contador y no el id del
   * grupo: cambiar de página o de orden dentro del MISMO grupo dispara la misma carrera.
   */
  private sequence = 0;
  /** Petición en vuelo por clave de consulta, para que N llamadas simultáneas compartan una. */
  private inFlight: { key: string; promise: Promise<void> } | null = null;

  readonly status = this._status.asReadonly();
  readonly error = this._error.asReadonly();
  readonly query = this._query.asReadonly();

  readonly isLoading = computed(() => this._status() === 'loading');

  /** La liga activa, o `null` mientras no haya llegado. */
  readonly league = computed<LeagueResponse | null>(() => this._board()?.league ?? null);

  /** Top 3 de la LIGA, no de la página: no cambia al paginar. */
  readonly podium = computed<LeaderboardEntryResponse[]>(() => this._board()?.podium ?? []);

  /** Las filas de la página servida. */
  readonly rows = computed<LeaderboardEntryResponse[]>(() => this._board()?.entries.content ?? []);

  /** Total de la liga entera: es el contador que se pinta, nunca `rows().length`. */
  readonly totalPlayers = computed(() => this._board()?.totalPlayers ?? 0);
  readonly page = computed(() => this._board()?.entries.page ?? 0);
  readonly pageSize = computed(() => this._board()?.entries.size ?? LEADERBOARD_PAGE_SIZE);

  /**
   * Liga cargada y sin que nadie haya jugado ninguna partida todavía. Distinto de `loading` y de
   * `error`: es el estado vacío con CTA, no un fallo.
   *
   * No se basa en `totalPlayers`: el creador del grupo cuenta siempre como miembro, así que ese
   * número nunca es cero y esa comprobación jamás detectaría una liga sin competir. Lo que de
   * verdad importa —si alguien tiene ya una partida registrada— lo manda el servidor en
   * `hasActivity`, calculado sobre la liga entera y no solo sobre esta página.
   */
  readonly isEmpty = computed(() => this._status() === 'ready' && !(this._board()?.hasActivity ?? false));

  /**
   * La temporada ha terminado: lo que se ve es la clasificación final, en solo lectura.
   *
   * El servidor deja de considerar activa una liga vencida, así que esto no es "está a punto de
   * acabar": es que ya acabó y no hay ninguna abierta detrás.
   */
  readonly isSeasonClosed = computed(() => this.league()?.status === 'FINISHED');

  /** Campeón de la temporada cerrada: el primero del podio, que ya excluye a los sancionados. */
  readonly champion = computed<LeaderboardEntryResponse | null>(() => this.podium()[0] ?? null);

  /** Si quien mira puede abrir la siguiente temporada. Solo UX; el backend revalida. */
  readonly canManageLeague = computed(() => this._board()?.canManageLeague ?? false);

  /**
   * Carga la clasificación del grupo si no la tiene ya. Idempotente: repetir la llamada con la
   * misma consulta no toca la red. Nunca lanza; un fallo se traduce en `status === 'error'`.
   */
  ensureLoaded(groupId: string): Promise<void> {
    if (!groupId) return Promise.resolve();
    const key = this.keyOf(groupId, this._query());
    if (this._groupId() === groupId && this._status() === 'ready' && this.loadedKey === key) {
      return Promise.resolve();
    }
    if (this.inFlight?.key === key) return this.inFlight.promise;
    return this.fetch(groupId, this._query());
  }

  /** Fuerza un refetch de lo que haya cargado (p. ej. al reentrar en la ruta). */
  reload(): Promise<void> {
    const groupId = this._groupId();
    if (!groupId) return Promise.resolve();
    return this.fetch(groupId, this._query());
  }

  /** Cambia de página conservando el orden. `page` es 0-based. */
  goToPage(page: number): Promise<void> {
    return this.applyQuery({ page });
  }

  /**
   * Cambia el orden y vuelve a la primera página: quedarse en la página 7 de un orden nuevo
   * enseña un tramo arbitrario de la tabla.
   */
  sortBy(sort: LeaderboardSort, dir: SortDirection): Promise<void> {
    return this.applyQuery({ sort, dir, page: 0 });
  }

  /**
   * Busca jugadores en la liga entera, no solo en la página cargada.
   *
   * Va contra el servidor a propósito: filtrar en cliente solo encontraría a quien ya se hubiera
   * descargado, y con la tabla paginada eso deja fuera a casi todo el mundo. Devuelve lista vacía
   * si falla — un buscador que no encuentra nada es una molestia, un toast de error por cada
   * tecla es peor.
   */
  async search(groupId: string, query: string): Promise<LeaderboardSearchSuggestion[]> {
    const q = query.trim();
    if (!q) return [];
    const { sort, dir } = this._query();
    try {
      return await firstValueFrom(
        this.api.searchLeaderboard(groupId, q, LEADERBOARD_PAGE_SIZE, sort, dir),
      );
    } catch {
      return [];
    }
  }

  /**
   * Abre la siguiente temporada del grupo.
   *
   * Escritura **pesimista**, como manda CLAUDE.md: la señal `starting` deshabilita el botón, se
   * espera la confirmación del servidor y solo entonces se recarga la clasificación. Nada de
   * navegar ni de pintar la liga nueva antes de que exista.
   *
   * No reentrante: un doble clic no abre dos temporadas. Además la base de datos lo impide por su
   * cuenta (una sola liga viva por grupo), así que el segundo intento sería un 409, no un duplicado.
   */
  async startNextSeason(groupId: string, name: string, endsAt: string): Promise<void> {
    if (this._starting()) return;
    this._starting.set(true);
    try {
      await firstValueFrom(this.api.createLeague(groupId, { name, endsAt }));
      // La temporada nueva empieza vacía, así que se recarga desde cero en vez de parchear en local.
      this._query.set({ page: 0, size: LEADERBOARD_PAGE_SIZE, sort: 'RANK', dir: 'ASC' });
      await this.fetch(groupId, this._query());
    } finally {
      this._starting.set(false);
    }
  }

  private readonly _starting = signal(false);

  /** Hay una creación de temporada en vuelo: el botón que la dispara va deshabilitado. */
  readonly starting = this._starting.asReadonly();

  /** En logout no debe quedar rastro de la clasificación del grupo anterior. */
  clear(): void {
    this.sequence++;
    this.inFlight = null;
    this.loadedKey = null;
    this._board.set(null);
    this._groupId.set(null);
    this._status.set('idle');
    this._error.set(null);
    this._query.set({ page: 0, size: LEADERBOARD_PAGE_SIZE, sort: 'RANK', dir: 'ASC' });
  }

  private loadedKey: string | null = null;

  private applyQuery(patch: Partial<LeaderboardQuery>): Promise<void> {
    const groupId = this._groupId();
    const next = { ...this._query(), ...patch };
    this._query.set(next);
    if (!groupId) return Promise.resolve();
    return this.fetch(groupId, next);
  }

  private fetch(groupId: string, query: LeaderboardQuery): Promise<void> {
    const key = this.keyOf(groupId, query);
    const promise = this.load(groupId, query, key);
    this.inFlight = { key, promise };
    return promise;
  }

  private async load(groupId: string, query: LeaderboardQuery, key: string): Promise<void> {
    const ticket = ++this.sequence;
    this._groupId.set(groupId);
    this._status.set('loading');
    this._error.set(null);

    try {
      const board = await firstValueFrom(this.api.getLeaderboard(groupId, query));
      // Llegó tarde: ya hay otra carga en curso o terminada. Escribirla pintaría la
      // clasificación de un grupo, una página o un orden que el usuario ya ha dejado atrás.
      if (ticket !== this.sequence) return;
      this._board.set(board);
      this.loadedKey = key;
      this._status.set('ready');
    } catch (e) {
      if (ticket !== this.sequence) return;
      this._board.set(null);
      this.loadedKey = null;
      // El texto en español lo decide el front a partir del `code`; `detail` no se pinta nunca.
      this._error.set(errorMessage(e));
      this._status.set('error');
    } finally {
      if (this.inFlight?.key === key) this.inFlight = null;
    }
  }

  private keyOf(groupId: string, q: LeaderboardQuery): string {
    return `${groupId}|${q.page}|${q.size}|${q.sort}|${q.dir}`;
  }
}
