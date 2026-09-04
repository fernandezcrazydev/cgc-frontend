import { Injectable, signal } from '@angular/core';

/**
 * Estado de interfaz del menú de gestión del grupo (invitar, borrar y salir).
 *
 * Vive en un servicio y no dentro del componente porque el menú se pinta en la cabecera del shell
 * mientras que quien lo abre puede estar en otra parte: el hub, por ejemplo, ofrece «Invitar a
 * alguien» desde el estado vacío de su lista de invitaciones. Es estado de interfaz, no de
 * dominio (`CLAUDE.md`, regla de oro 5); las escrituras siguen en `GroupDetailStore`.
 */
@Injectable({ providedIn: 'root' })
export class GroupActionsService {
  readonly showInvite = signal(false);
  readonly confirmDelete = signal(false);
  readonly confirmLeave = signal(false);

  openInvite(): void {
    this.confirmDelete.set(false);
    this.confirmLeave.set(false);
    this.showInvite.set(true);
  }

  closeAll(): void {
    this.showInvite.set(false);
    this.confirmDelete.set(false);
    this.confirmLeave.set(false);
  }
}
