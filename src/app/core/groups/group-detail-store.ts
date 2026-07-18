import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupsStore } from './groups-store';
import { GroupMemberResponse, GroupRole } from './models';
import { GroupView, groupView } from './group-view';

/** `not-found` = el grupo no existe o no eres miembro (403/404): un estado 404 de la vista. */
export type GroupDetailStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-found';

/**
 * El detalle de UN grupo: su identidad (con el rol del llamante) y su roster, más las acciones
 * de gestión de miembros. Las escrituras se delegan en `GroupsStore` (que también refresca la
 * lista cuando cambia tu pertenencia); aquí, tras cada una, se refetch el roster para que la
 * tabla no mienta. Cancela respuestas obsoletas al cambiar de `:id` comprobando el id activo
 * antes de escribir en las signals.
 */
@Injectable({ providedIn: 'root' })
export class GroupDetailStore {
  private readonly api = inject(GroupsApi);
  private readonly groups = inject(GroupsStore);

  private readonly _status = signal<GroupDetailStatus>('idle');
  private readonly _group = signal<GroupView | null>(null);
  private readonly _roster = signal<GroupMemberResponse[]>([]);
  /** El grupo que se está mostrando; descarta respuestas de un id ya abandonado. */
  private currentId: string | null = null;

  readonly status = this._status.asReadonly();
  readonly group = this._group.asReadonly();
  readonly roster = this._roster.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  /** Rol del llamante en este grupo (del detalle). */
  readonly myRole = computed<GroupRole | null>(() => this._group()?.role ?? null);
  readonly isOwner = computed(() => this.myRole() === 'OWNER');
  readonly canManage = computed(() => this.myRole() === 'OWNER' || this.myRole() === 'ADMIN');

  /** userIds con una acción de gestión en vuelo: deshabilita esa fila. */
  private readonly _acting = signal<ReadonlySet<string>>(new Set());
  readonly acting = this._acting.asReadonly();
  isActing(userId: string): boolean {
    return this._acting().has(userId);
  }

  /** En vuelo una acción sobre el grupo entero (salir / borrar). */
  private readonly _busy = signal(false);
  readonly busy = this._busy.asReadonly();

  /**
   * Carga (o recarga) detalle + roster de un grupo. Detalle y roster en paralelo; si el `:id`
   * cambia antes de que respondan, se descartan. Un 403/404 es `not-found` (no existe o no eres
   * miembro), no un error de red.
   */
  async load(groupId: string): Promise<void> {
    this.currentId = groupId;
    this._status.set('loading');
    this._group.set(null);
    this._roster.set([]);
    try {
      const [membership, roster] = await Promise.all([
        firstValueFrom(this.api.detail(groupId)),
        firstValueFrom(this.api.members(groupId)),
      ]);
      if (this.currentId !== groupId) return;
      this._group.set(groupView(membership));
      this._roster.set(roster);
      this._status.set('ready');
      // Mantener la barra lateral y el banner en sintonía con lo que se está viendo.
      this.groups.select(groupId);
    } catch (error) {
      if (this.currentId !== groupId) return;
      this._status.set(isMissing(error) ? 'not-found' : 'error');
    }
  }

  /** Refetch solo del roster (tras expulsar / cambiar rol). No-op si no hay grupo activo. */
  async reloadRoster(): Promise<void> {
    const groupId = this.currentId;
    if (!groupId) return;
    try {
      const roster = await firstValueFrom(this.api.members(groupId));
      if (this.currentId === groupId) this._roster.set(roster);
    } catch {
      // Un fallo de refetch no debe romper la vista; el siguiente `load` corrige.
    }
  }

  /** Expulsa a un miembro y refetch el roster. Lanza si falla (la vista muestra el toast). */
  async removeMember(userId: string): Promise<void> {
    await this.actOn(userId, (groupId) => this.groups.removeMember(groupId, userId));
    await this.reloadRoster();
  }

  /** Cambia el rol de un miembro y refetch el roster. */
  async changeRole(userId: string, role: GroupRole): Promise<void> {
    await this.actOn(userId, (groupId) => this.groups.changeRole(groupId, userId, role));
    await this.reloadRoster();
  }

  /** Transfiere la propiedad a un miembro y recarga detalle + roster (tu rol también cambia). */
  async transferOwnership(userId: string): Promise<void> {
    const groupId = this.currentId;
    await this.actOn(userId, (id) => this.groups.transferOwnership(id, userId));
    if (groupId) await this.load(groupId);
  }

  private async actOn(userId: string, call: (groupId: string) => Promise<void>): Promise<void> {
    const groupId = this.currentId;
    if (!groupId || this._acting().has(userId)) return;
    this._acting.update((set) => new Set(set).add(userId));
    try {
      await call(groupId);
    } finally {
      this._acting.update((set) => {
        const next = new Set(set);
        next.delete(userId);
        return next;
      });
    }
  }

  /** El llamante abandona el grupo. La lista se refresca en `GroupsStore.leave`. */
  async leave(): Promise<void> {
    await this.wholeGroup((groupId) => this.groups.leave(groupId));
  }

  /** Borra el grupo (solo owner). La lista se refresca en `GroupsStore.deleteGroup`. */
  async deleteGroup(): Promise<void> {
    await this.wholeGroup((groupId) => this.groups.deleteGroup(groupId));
  }

  private async wholeGroup(call: (groupId: string) => Promise<void>): Promise<void> {
    const groupId = this.currentId;
    if (!groupId || this._busy()) return;
    this._busy.set(true);
    try {
      await call(groupId);
    } finally {
      this._busy.set(false);
    }
  }

  /** Al cerrar sesión no debe quedar rastro del grupo del usuario anterior. */
  clear(): void {
    this.currentId = null;
    this._status.set('idle');
    this._group.set(null);
    this._roster.set([]);
    this._acting.set(new Set());
    this._busy.set(false);
  }
}

/** Un 403 (no eres miembro) o un 404 (no existe) se tratan igual: la vista muestra su 404. */
function isMissing(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
}
