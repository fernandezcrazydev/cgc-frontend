import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupsStore } from './groups-store';
import { GroupMemberResponse, GroupRole } from './models';
import { GroupView, groupView } from './group-view';
import { PageResponse } from '../http';

/** `not-found` = el grupo no existe o no eres miembro (403/404): un estado 404 de la vista. */
export type GroupDetailStatus = 'idle' | 'loading' | 'ready' | 'error' | 'not-found';

/**
 * El detalle de UN grupo: su identidad (con el rol del llamante) y su roster, más las acciones
 * de gestión de miembros. Las escrituras se delegan en `GroupsStore` (que también refresca la
 * lista cuando cambia tu pertenencia); aquí, tras cada una, se refetch el roster para que la
 * tabla no mienta. Cancela respuestas obsoletas al cambiar de `:id` comprobando el id activo
 * antes de escribir en las signals.
 *
 * El roster está paginado EN SERVIDOR: `roster()` es solo la página visible, y el número real
 * de miembros del grupo es `memberCount()` (el `totalElements` de la página). Cualquier vista
 * que quiera decir "N miembros" debe leer ese contador, nunca `roster().length`.
 */
@Injectable({ providedIn: 'root' })
export class GroupDetailStore {
  private readonly api = inject(GroupsApi);
  private readonly groups = inject(GroupsStore);

  /** Miembros por página. Encaja con el alto de la ventana sin obligar a hacer scroll. */
  static readonly MEMBERS_PAGE_SIZE = 10;

  private readonly _status = signal<GroupDetailStatus>('idle');
  private readonly _group = signal<GroupView | null>(null);
  private readonly _members = signal<PageResponse<GroupMemberResponse> | null>(null);
  private readonly _membersLoading = signal(false);
  /** El grupo que se está mostrando; descarta respuestas de un id ya abandonado. */
  private currentId: string | null = null;
  /** Secuencia de peticiones de página: descarta la respuesta de una página ya abandonada. */
  private membersSeq = 0;

  readonly status = this._status.asReadonly();
  readonly group = this._group.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');

  /** Los miembros de la página visible. NO es el grupo entero: para eso, `memberCount()`. */
  readonly roster = computed<GroupMemberResponse[]>(() => this._members()?.content ?? []);
  /** Miembros totales del grupo (`totalElements`), lo que se pinta como "N MIEMBROS". */
  readonly memberCount = computed(() => this._members()?.totalElements ?? 0);
  /** Página visible, 0-based (como la manda el backend). */
  readonly membersPage = computed(() => this._members()?.page ?? 0);
  readonly membersPageSize = computed(
    () => this._members()?.size ?? GroupDetailStore.MEMBERS_PAGE_SIZE,
  );
  /** Hay un cambio de página en vuelo: la lista se pinta con esqueletos, la vista no se vacía. */
  readonly membersLoading = this._membersLoading.asReadonly();

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
    this.membersSeq++;
    this._status.set('loading');
    this._group.set(null);
    this._members.set(null);
    try {
      const [membership, members] = await Promise.all([
        firstValueFrom(this.api.detail(groupId)),
        firstValueFrom(this.api.members(groupId, 0, GroupDetailStore.MEMBERS_PAGE_SIZE)),
      ]);
      if (this.currentId !== groupId) return;
      this._group.set(groupView(membership));
      this._members.set(members);
      this._status.set('ready');
      // Mantener la barra lateral y el banner en sintonía con lo que se está viendo.
      this.groups.select(groupId);
    } catch (error) {
      if (this.currentId !== groupId) return;
      this._status.set(isMissing(error) ? 'not-found' : 'error');
    }
  }

  /**
   * Salta a una página del roster (0-based). Deja la página anterior en pantalla mientras la
   * nueva viaja —marcada con `membersLoading()`— para que la ventana no colapse y vuelva a
   * crecer. Si se pide otra página antes de que llegue esta, la respuesta vieja se descarta.
   */
  async goToMembersPage(page: number): Promise<void> {
    const groupId = this.currentId;
    if (!groupId) return;
    const seq = ++this.membersSeq;
    this._membersLoading.set(true);
    try {
      const members = await firstValueFrom(
        this.api.members(groupId, Math.max(0, page), GroupDetailStore.MEMBERS_PAGE_SIZE),
      );
      if (seq !== this.membersSeq || this.currentId !== groupId) return;
      this._members.set(members);
    } catch {
      // Un fallo de paginación no debe romper la vista: se queda la página que ya estaba.
    } finally {
      if (seq === this.membersSeq) this._membersLoading.set(false);
    }
  }

  /**
   * Refetch de la página visible del roster (tras expulsar / cambiar rol). Si al expulsar se
   * vacía la última página, retrocede una: quedarse en una página que ya no existe pintaría una
   * lista vacía con el paginador diciendo que hay miembros.
   */
  async reloadRoster(): Promise<void> {
    const groupId = this.currentId;
    if (!groupId) return;
    const page = this.membersPage();
    await this.goToMembersPage(page);
    if (page > 0 && this.currentId === groupId && this.roster().length === 0) {
      await this.goToMembersPage(page - 1);
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
    this.membersSeq++;
    this._status.set('idle');
    this._group.set(null);
    this._members.set(null);
    this._membersLoading.set(false);
    this._acting.set(new Set());
    this._busy.set(false);
  }
}

/** Un 403 (no eres miembro) o un 404 (no existe) se tratan igual: la vista muestra su 404. */
function isMissing(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
}
