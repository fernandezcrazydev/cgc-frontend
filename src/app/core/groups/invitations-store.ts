import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { InvitationsApi } from './invitations-api';
import { InvitationResponse } from './models';

export type InvitationsStatus = 'idle' | 'loading' | 'ready' | 'error';

/**
 * Las invitaciones PENDIENTES del usuario (lecturas, patrón `Session`) más las escrituras
 * de responderlas o emitirlas. La campana pinta la invitación con los `data` de su
 * notificación (que sí traen `groupName`); este store es la fuente de verdad de "¿sigue
 * pendiente?" (`pendingIds`), lo que hace que un aceptar/rechazar en otra pestaña se
 * refleje al recargar en vez de dejar botones que ya no hacen nada.
 */
@Injectable({ providedIn: 'root' })
export class InvitationsStore {
  private readonly api = inject(InvitationsApi);

  private readonly _invitations = signal<InvitationResponse[]>([]);
  private readonly _status = signal<InvitationsStatus>('idle');

  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<InvitationResponse[]> | null = null;

  readonly invitations = this._invitations.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  /** Ids de invitación aún pendientes: la campana la usa para saber si mostrar acciones. */
  readonly pendingIds = computed(() => new Set(this._invitations().map((i) => i.id)));

  /** Ids con un aceptar/rechazar en vuelo: la vista deshabilita esa tarjeta mientras sea true. */
  private readonly _responding = signal<ReadonlySet<string>>(new Set());
  readonly responding = this._responding.asReadonly();
  isResponding(invitationId: string): boolean {
    return this._responding().has(invitationId);
  }

  /** En vuelo una emisión de invitación (invite): la vista deshabilita el botón. */
  private readonly _inviting = signal(false);
  readonly inviting = this._inviting.asReadonly();

  /**
   * Devuelve las invitaciones pendientes, cargándolas si hace falta. Idempotente y
   * deduplicada; nunca lanza — un fallo se traduce en `status === 'error'` y lista vacía.
   */
  ensureLoaded(): Promise<InvitationResponse[]> {
    if (this._status() === 'ready') return Promise.resolve(this._invitations());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza una recarga contra el backend (tras recibir una invitación nueva por SSE). */
  reload(): Promise<InvitationResponse[]> {
    this.inFlight = null;
    return (this.inFlight ??= this.load());
  }

  private async load(): Promise<InvitationResponse[]> {
    this._status.set('loading');
    try {
      const list = await firstValueFrom(this.api.mine());
      this._invitations.set(list);
      this._status.set('ready');
      return list;
    } catch {
      this._invitations.set([]);
      this._status.set('error');
      return [];
    } finally {
      this.inFlight = null;
    }
  }

  /**
   * Acepta una invitación: el usuario pasa a MEMBER del grupo. Pesimista y no reentrante
   * por id: `await` de la confirmación y solo entonces la saca de la lista. Lanza si falla
   * (409 = ya respondida en otro sitio) para que la vista traduzca el error a un toast.
   */
  async accept(invitationId: string): Promise<void> {
    await this.respond(invitationId, () => firstValueFrom(this.api.accept(invitationId)));
  }

  /** Rechaza una invitación: se cierra sin crear membresía. Mismas garantías que `accept`. */
  async decline(invitationId: string): Promise<void> {
    await this.respond(invitationId, () => firstValueFrom(this.api.decline(invitationId)));
  }

  private async respond(invitationId: string, call: () => Promise<void>): Promise<void> {
    if (this._responding().has(invitationId)) return;
    this._responding.update((set) => new Set(set).add(invitationId));
    try {
      await call();
      this._invitations.update((list) => list.filter((i) => i.id !== invitationId));
    } finally {
      this._responding.update((set) => {
        const next = new Set(set);
        next.delete(invitationId);
        return next;
      });
    }
  }

  /**
   * Invita a un usuario (por UUID) a un grupo. Pesimista y no reentrante. Devuelve la
   * invitación creada; lanza si falla (404 no existe, 409 ya miembro/pendiente) para que la
   * vista muestre el mensaje adecuado.
   */
  async invite(groupId: string, inviteeUserId: string): Promise<InvitationResponse> {
    if (this._inviting()) throw new Error('Ya hay una invitación en curso');
    this._inviting.set(true);
    try {
      return await firstValueFrom(this.api.invite(groupId, inviteeUserId));
    } finally {
      this._inviting.set(false);
    }
  }

  /** Al cerrar sesión no debe quedar rastro de las invitaciones del usuario anterior. */
  clear(): void {
    this.inFlight = null;
    this._invitations.set([]);
    this._status.set('idle');
    this._responding.set(new Set());
    this._inviting.set(false);
  }
}
