import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { GroupsApi } from './groups-api';
import { GroupResponse, Region } from './models';

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
