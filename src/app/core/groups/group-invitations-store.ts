import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InvitationsApi } from './invitations-api';
import { GroupInvitationResponse } from './models';

export type GroupInvitationsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Las invitaciones PENDIENTES que un grupo tiene enviadas: lo que pinta la pestaña "Invitados" del
 * detalle de grupo (lecturas, patrón `Session`) más la escritura de cancelar una. Es una vista de
 * gestión (solo owner/admin), distinta de `InvitationsStore` —que son las invitaciones que el usuario
 * *recibe*—: aquí el grupo mira las que *ha emitido*.
 *
 * Ligado a UN grupo a la vez: `load(groupId)` recuerda el id activo y descarta respuestas de un id ya
 * abandonado (misma técnica que `GroupDetailStore`), para que al cambiar de `:id` la lista no mienta.
 */
@Injectable({ providedIn: 'root' })
export class GroupInvitationsStore {
  private readonly api = inject(InvitationsApi);

  private readonly _status = signal<GroupInvitationsStatus>('idle');
  private readonly _invitations = signal<GroupInvitationResponse[]>([]);
  /** El grupo que se está mostrando; descarta respuestas de un id ya abandonado. */
  private currentId: string | null = null;

  readonly status = this._status.asReadonly();
  readonly invitations = this._invitations.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  /** userIds ya con invitación pendiente: el buscador del modal los marca como "INVITADO". */
  readonly pendingInviteeIds = computed(
    () => new Set(this._invitations().map((i) => i.inviteeUserId)),
  );

  /** invitationIds con un cancelar en vuelo: la fila se deshabilita mientras sea true. */
  private readonly _cancelling = signal<ReadonlySet<string>>(new Set());
  readonly cancelling = this._cancelling.asReadonly();
  isCancelling(invitationId: string): boolean {
    return this._cancelling().has(invitationId);
  }

  /**
   * Carga (o recarga) las invitaciones pendientes de un grupo. Si el `:id` cambia antes de que
   * responda, se descarta. Un fallo deja `status === 'error'` y la lista intacta para reintentar.
   */
  async load(groupId: string): Promise<void> {
    this.currentId = groupId;
    this._status.set('loading');
    try {
      const list = await firstValueFrom(this.api.forGroup(groupId));
      if (this.currentId !== groupId) return;
      this._invitations.set(list);
      this._status.set('ready');
    } catch {
      if (this.currentId !== groupId) return;
      this._status.set('error');
    }
  }

  /** Refetch de la lista del grupo activo (tras invitar a alguien nuevo). No-op si no hay grupo. */
  async reload(): Promise<void> {
    const groupId = this.currentId;
    if (groupId) await this.load(groupId);
  }

  /**
   * Cancela una invitación pendiente. Pesimista y no reentrante por id: `await` de la confirmación
   * y solo entonces se saca de la lista. Lanza si falla (404/409) para que la vista muestre el toast.
   */
  async cancel(invitationId: string): Promise<void> {
    const groupId = this.currentId;
    if (!groupId || this._cancelling().has(invitationId)) return;
    this._cancelling.update((set) => new Set(set).add(invitationId));
    try {
      await firstValueFrom(this.api.cancel(groupId, invitationId));
      this._invitations.update((list) => list.filter((i) => i.id !== invitationId));
    } finally {
      this._cancelling.update((set) => {
        const next = new Set(set);
        next.delete(invitationId);
        return next;
      });
    }
  }

  /** Al salir de la vista (o en logout) no debe quedar rastro de las invitaciones del grupo anterior. */
  clear(): void {
    this.currentId = null;
    this._status.set('idle');
    this._invitations.set([]);
    this._cancelling.set(new Set());
  }
}
