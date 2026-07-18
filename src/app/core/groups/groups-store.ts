import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupResponse, GroupRole, Region } from './models';
import { GroupView, groupView } from './group-view';

export type GroupsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Lo que la vista de creación recoge del usuario: nombre, región y (opcional) la foto. */
export interface CreateGroupInput {
  name: string;
  region: Region;
  /** Foto como data URL (lo que emite `NfAvatarPicker`), o null/omitida si no hay. */
  avatarDataUrl?: string | null;
}

/**
 * El dominio de grupos contra el backend real: la LISTA del usuario (`/me/groups`, patrón
 * `Session`) más las escrituras (alta, gestión de miembros, ciclo de vida). Es la fuente de
 * verdad de la barra lateral, la lista y la cabecera; el detalle + roster de un grupo concreto
 * vive en `GroupDetailStore`. Tras una escritura que cambie tu pertenencia o tu rol, la lista
 * se refetch para que la barra lateral no mienta.
 */
@Injectable({ providedIn: 'root' })
export class GroupsStore {
  private readonly api = inject(GroupsApi);

  private readonly _groups = signal<GroupView[]>([]);
  private readonly _status = signal<GroupsStatus>('idle');
  /** La carga en vuelo, para que N llamadas concurrentes compartan una petición. */
  private inFlight: Promise<GroupView[]> | null = null;

  readonly groups = this._groups.asReadonly();
  readonly status = this._status.asReadonly();
  readonly isLoading = computed(() => this._status() === 'loading');
  readonly isReady = computed(() => this._status() === 'ready');

  /**
   * Grupo activo (barra lateral + banner de la cabecera). Es estado de UI viviendo en un store
   * de dominio —el mismo compromiso conocido que tenía el mock `GroupStore`—; se conserva para
   * no reescribir el shell. La vista de detalle lo fija al entrar en la ruta.
   */
  private readonly _selectedId = signal<string | null>(null);
  readonly selectedId = this._selectedId.asReadonly();
  readonly selected = computed(() => this.byId(this._selectedId()));

  select(id: string): void {
    this._selectedId.set(id);
  }

  byId(id: string | null): GroupView | null {
    return id ? this._groups().find((g) => g.id === id) ?? null : null;
  }

  private readonly _pending = signal(false);
  /** En vuelo una escritura: la vista deshabilita el botón mientras sea true. */
  readonly pending = this._pending.asReadonly();

  /** La lista de grupos del usuario, cargándola si hace falta. Idempotente; nunca lanza. */
  ensureLoaded(): Promise<GroupView[]> {
    if (this._status() === 'ready') return Promise.resolve(this._groups());
    return (this.inFlight ??= this.load());
  }

  /** Fuerza una recarga contra el backend (tras una escritura, o al re-entrar en la ruta). */
  reload(): Promise<GroupView[]> {
    this.inFlight = null;
    return (this.inFlight ??= this.load());
  }

  private async load(): Promise<GroupView[]> {
    this._status.set('loading');
    try {
      const memberships = await firstValueFrom(this.api.myGroups());
      const groups = memberships.map(groupView);
      this._groups.set(groups);
      this._status.set('ready');
      return groups;
    } catch {
      this._groups.set([]);
      this._status.set('error');
      return [];
    } finally {
      this.inFlight = null;
    }
  }

  /** Al cerrar sesión no debe quedar rastro de los grupos del usuario anterior. */
  clear(): void {
    this.inFlight = null;
    this._groups.set([]);
    this._status.set('idle');
    this._selectedId.set(null);
  }

  /**
   * Crea el grupo y, si hay foto, la sube en un SEGUNDO paso — el "doble call": primero
   * `POST /groups` (JSON con nombre y región), y solo con el `groupId` que devuelve,
   * `PUT /groups/{id}/avatar` (multipart). Pesimista y no reentrante: `await` de ambas
   * confirmaciones y guarda contra doble submit. Refetch de la lista para que aparezca en la
   * barra lateral. Devuelve el grupo ya con su `avatarUrl`; lanza si algo falla.
   */
  async create(input: CreateGroupInput): Promise<GroupResponse> {
    if (this._pending()) throw new Error('Ya hay una creación de grupo en curso');
    this._pending.set(true);
    try {
      let group = await firstValueFrom(
        this.api.create({ name: input.name.trim(), region: input.region }),
      );
      if (input.avatarDataUrl) {
        // Solo tras crear el grupo: la foto se sube contra el id real que dio el backend.
        const blob = dataUrlToBlob(input.avatarDataUrl);
        group = await firstValueFrom(this.api.uploadAvatar(group.groupId, blob));
      }
      await this.reload();
      return group;
    } finally {
      this._pending.set(false);
    }
  }

  /**
   * Gestión de miembros y ciclo de vida del grupo, contra el backend real. Todas son
   * escrituras pesimistas y no reentrantes (guard con `pending`): `await` de la confirmación
   * 204 y devuelven void; la vista traduce el fallo a un toast en español. Las que cambian TU
   * pertenencia o TU rol (leave/delete/transfer) refetch la lista; expulsar/cambiar-rol de otro
   * no tocan tu lista (el detalle refetch su roster por su cuenta).
   */
  async leave(groupId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.leave(groupId)));
    await this.reload();
  }

  /** Borra el grupo (solo owner); desaparece de tu lista. */
  async deleteGroup(groupId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.deleteGroup(groupId)));
    await this.reload();
  }

  /** Expulsa a un miembro (por su UUID). No cambia tu lista; el detalle refetch su roster. */
  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.removeMember(groupId, userId)));
  }

  /** Cambia el rol de un miembro (por su UUID). No cambia tu lista. */
  async changeRole(groupId: string, userId: string, role: GroupRole): Promise<void> {
    await this.write(() => firstValueFrom(this.api.changeRole(groupId, userId, role)));
  }

  /** Transfiere la propiedad a otro miembro; tu rol pasa a ADMIN, así que refetch la lista. */
  async transferOwnership(groupId: string, newOwnerId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.transferOwnership(groupId, newOwnerId)));
    await this.reload();
  }

  /** Envoltorio no reentrante compartido por las escrituras que solo confirman (204). */
  private async write(call: () => Promise<void>): Promise<void> {
    if (this._pending()) throw new Error('Ya hay una operación de grupo en curso');
    this._pending.set(true);
    try {
      await call();
    } finally {
      this._pending.set(false);
    }
  }
}

/**
 * `data:<mime>;base64,<...>` (lo que emite el picker) → `Blob` para subirlo como fichero.
 * Vive aquí porque hoy solo lo usa el alta de grupo; si aparece un segundo consumidor, se
 * sube a `shared/`.
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(meta)?.[1] ?? 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
