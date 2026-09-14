import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NfButton } from '../../../../ui';
import { GroupView } from '../../../../core/groups';
import { GroupActionsService } from '../../group-actions/group-actions.service';

/**
 * Sección de Zona Peligrosa de los Ajustes del Grupo.
 * Permite al propietario abrir el modal de borrado del grupo o a un administrador el de salida.
 */
@Component({
  selector: 'app-group-settings-danger',
  standalone: true,
  imports: [NfButton],
  template: `
    @if (isOwner()) {
      <div class="gs-danger-card">
        <div class="gs-danger-card__content">
          <h3 class="gs-danger-card__title">Borrar el grupo</h3>
          <p class="gs-danger-card__desc">
            Se borran su clasificación, su historial y sus convocatorias. No hay vuelta atrás.
          </p>
        </div>
        <button nfButton variant="danger" size="md" (click)="openDelete()">
          Borrar
        </button>
      </div>
    } @else {
      <div class="gs-danger-card">
        <div class="gs-danger-card__content">
          <h3 class="gs-danger-card__title">Salir del grupo</h3>
          <p class="gs-danger-card__desc">
            Dejas de ver sus convocatorias y sales de su clasificación.
          </p>
        </div>
        <button nfButton variant="danger" size="md" (click)="openLeave()">
          Salir
        </button>
      </div>
    }
  `,
  styleUrl: './group-settings-danger.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupSettingsDangerComponent {
  readonly group = input.required<GroupView>();

  private readonly actions = inject(GroupActionsService);

  readonly isOwner = computed(() => this.group().role === 'OWNER');

  openDelete(): void {
    this.actions.confirmDelete.set(true);
  }

  openLeave(): void {
    this.actions.confirmLeave.set(true);
  }
}
