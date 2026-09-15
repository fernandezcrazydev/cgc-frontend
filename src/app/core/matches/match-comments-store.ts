/**
 * El hilo de comentarios de UNA partida: la que está abierta ahora mismo.
 *
 * Store propio y no tres métodos más en `MatchHistoryStore`, que ya es el más grande de `core/`:
 * esto tiene su propio ciclo de vida (se carga al abrir una partida y se tira al salir), sus
 * propias escrituras y su propio estado de envío. Mezclarlo habría metido un `pending` de
 * escritura en un store que hasta hoy solo lee.
 *
 * Patrón `Session`: `status` explícito, `ensureLoaded` idempotente por `matchId`, `reload()` y
 * `clear()`. Guarda un hilo cada vez —el de la partida abierta— porque es lo único que la pantalla
 * necesita; mantener un mapa por partida sería una caché que nadie invalida.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Session } from '../auth';
import { MatchesApi } from './matches-api';
import { MatchComment } from './models';

export type MatchCommentsStatus = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class MatchCommentsStore {
  private readonly api = inject(MatchesApi);
  private readonly session = inject(Session);

  private readonly _comments = signal<readonly MatchComment[]>([]);
  private readonly _status = signal<MatchCommentsStatus>('idle');
  private readonly _saving = signal(false);
  /** Qué comentario se está borrando, para deshabilitar solo ese botón y no los diez. */
  private readonly _deleting = signal<string | null>(null);

  private matchId: string | null = null;
  private seq = 0;

  readonly comments = this._comments.asReadonly();
  readonly status = this._status.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly deleting = this._deleting.asReadonly();

  /**
   * Si el usuario ya dejó el suyo. Es lo que decide si se pinta la caja de texto, y sale del hilo
   * que ya está en pantalla: preguntarlo aparte sería una petición para algo que ya se sabe.
   *
   * `false` mientras no hay sesión resuelta, que es el estado en el que la caja tampoco se pinta.
   */
  readonly alreadyCommented = computed(() => {
    const me = this.session.user()?.userId;
    return !!me && this._comments().some((comment) => comment.userId === me);
  });

  /** El hilo de esa partida. Repetir el mismo id no vuelve a la red. */
  ensureLoaded(matchId: string): Promise<void> {
    if (matchId === this.matchId && this._status() === 'ready') return Promise.resolve();
    return this.load(matchId);
  }

  reload(matchId: string): Promise<void> {
    return this.load(matchId);
  }

  /**
   * Deja el comentario del usuario. Pesimista: no se pinta nada hasta que el servidor confirma, y
   * el hilo se recompone con la fila que él devuelve —no con el texto que se escribió, que puede
   * venir recortado—.
   *
   * No reentrante: un segundo envío mientras el primero viaja se ignora. Sin eso, el doble toque
   * de un móvil con mala cobertura produce el `409 COMMENT_ALREADY_EXISTS` que este guard existe
   * para no provocar (el backend también lo para, pero avisando de un error que fue nuestro).
   *
   * Lanza si falla, para que la vista lo traduzca con `errorMessage()`.
   */
  async leave(matchId: string, text: string): Promise<MatchComment> {
    if (this._saving()) throw new Error('Ya hay un comentario en camino');
    this._saving.set(true);
    try {
      const saved = await firstValueFrom(this.api.leaveComment(matchId, text));
      if (matchId === this.matchId) {
        // Al final: el hilo va de más antiguo a más nuevo, y el que acaba de escribirse es el
        // más nuevo por definición. Se añade en vez de refetchear porque la respuesta ES la fila.
        this._comments.update((thread) => [...thread, saved]);
      }
      return saved;
    } finally {
      this._saving.set(false);
    }
  }

  /**
   * Borra un comentario. Solo funciona siendo admin del grupo; el backend responde
   * `403 COMMENT_DELETE_NOT_ALLOWED` a todos los demás, incluido el autor.
   *
   * Pesimista también: la fila se quita cuando el servidor dice que se ha ido. Optimista aquí
   * dejaría un hilo al que le falta una línea que sigue existiendo para todos los demás.
   */
  async remove(matchId: string, commentId: string): Promise<void> {
    if (this._deleting()) throw new Error('Ya hay un borrado en curso');
    this._deleting.set(commentId);
    try {
      await firstValueFrom(this.api.deleteComment(matchId, commentId));
      if (matchId === this.matchId) {
        this._comments.update((thread) => thread.filter((comment) => comment.id !== commentId));
      }
    } finally {
      this._deleting.set(null);
    }
  }

  /** Al cerrar sesión, o al salir de la partida, no debe quedar el hilo de nadie en memoria. */
  clear(): void {
    this.seq++;
    this.matchId = null;
    this._comments.set([]);
    this._status.set('idle');
    this._saving.set(false);
    this._deleting.set(null);
  }

  private async load(matchId: string): Promise<void> {
    const current = ++this.seq;
    this.matchId = matchId;
    this._status.set('loading');
    try {
      const thread = await firstValueFrom(this.api.comments(matchId));
      // La respuesta de la partida anterior no puede escribir sobre el hilo de esta.
      if (current !== this.seq) return;
      this._comments.set(thread);
      this._status.set('ready');
    } catch {
      if (current !== this.seq) return;
      this.matchId = null;
      this._comments.set([]);
      this._status.set('error');
    }
  }
}
