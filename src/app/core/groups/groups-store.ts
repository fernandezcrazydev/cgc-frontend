import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupResponse, GroupRole, Region } from './models';

/** Lo que la vista de creación recoge del usuario: nombre, región y (opcional) la foto. */
export interface CreateGroupInput {
  name: string;
  region: Region;
  /** Foto como data URL (lo que emite `NfAvatarPicker`), o null/omitida si no hay. */
  avatarDataUrl?: string | null;
}

/**
 * Escrituras del dominio de grupos contra el backend real. De momento SOLO cubre el alta
 * (el camino que el front necesita para el "doble call"); las lecturas de la lista/detalle
 * siguen en el mock `GroupStore` hasta que se migre el dominio entero. No se mezcla mock y
 * real para el MISMO dato: este store no expone ninguna lista.
 *
 * BACKEND NOTE: cuando se migren las lecturas, este store absorberá `ensureLoaded/reload/
 * clear` al estilo `Session` y `GroupStore` (mock) desaparecerá.
 */
@Injectable({ providedIn: 'root' })
export class GroupsStore {
  private readonly api = inject(GroupsApi);

  private readonly _pending = signal(false);
  /** En vuelo una escritura: la vista deshabilita el botón mientras sea true. */
  readonly pending = this._pending.asReadonly();

  /**
   * Crea el grupo y, si hay foto, la sube en un SEGUNDO paso — el "doble call": primero
   * `POST /groups` (JSON con nombre y región), y solo con el `groupId` que devuelve,
   * `PUT /groups/{id}/avatar` (multipart). Pesimista y no reentrante: `await` de ambas
   * confirmaciones y guarda contra doble submit. Devuelve el grupo ya con su `avatarUrl`;
   * lanza si algo falla (la vista traduce el error a un toast en español).
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
      return group;
    } finally {
      this._pending.set(false);
    }
  }

  /**
   * Gestión de miembros y ciclo de vida del grupo, contra el backend real. Todas son
   * escrituras pesimistas y no reentrantes (guard con `pending`): `await` de la
   * confirmación 204 y devuelven void; la vista traduce el fallo a un toast en español.
   *
   * BACKEND NOTE: cablearlas a la UI del detalle de grupo requiere que las LECTURAS de
   * grupos migren a `/me/groups` (hoy la lista/detalle sigue en el mock `GroupStore` con
   * ids-slug, no los UUID reales) y, para expulsar/rol/transferir, un endpoint que liste
   * los miembros de un grupo (no existe aún). Hasta entonces estos métodos quedan listos
   * pero sin punto de invocación real. Tras una escritura que cambie tu pertenencia
   * (leave/delete) o la de otro, el llamante debe refetch de `/me/groups`.
   */
  async leave(groupId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.leave(groupId)));
  }

  /** Borra el grupo (solo owner). Ver BACKEND NOTE de `leave`. */
  async deleteGroup(groupId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.deleteGroup(groupId)));
  }

  /** Expulsa a un miembro (por su UUID). Ver BACKEND NOTE de `leave`. */
  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.removeMember(groupId, userId)));
  }

  /** Cambia el rol de un miembro (por su UUID). Ver BACKEND NOTE de `leave`. */
  async changeRole(groupId: string, userId: string, role: GroupRole): Promise<void> {
    await this.write(() => firstValueFrom(this.api.changeRole(groupId, userId, role)));
  }

  /** Transfiere la propiedad a otro miembro (por su UUID). Ver BACKEND NOTE de `leave`. */
  async transferOwnership(groupId: string, newOwnerId: string): Promise<void> {
    await this.write(() => firstValueFrom(this.api.transferOwnership(groupId, newOwnerId)));
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
