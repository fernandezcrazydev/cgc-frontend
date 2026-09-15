import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { NfAvatarPicker, NfButton, NfSelect } from '../../../../ui';
import { GroupDetailStore, GroupView } from '../../../../core/groups';
import { groupProfileFor } from '../../../../core/group-hub';
import { ToastService } from '../../../../core/toast';
import { errorMessage } from '../../../../core/http';

/**
 * Sección de Identidad de los Ajustes del Grupo.
 * Permite cambiar el avatar del grupo de forma pesimista y muestra el resto de campos
 * institucionales deshabilitados hasta que el backend implemente su edición.
 */
@Component({
  selector: 'app-group-settings-identity',
  standalone: true,
  imports: [NfAvatarPicker, NfButton, NfSelect],
  templateUrl: './group-settings-identity.component.html',
  styleUrl: './group-settings-identity.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupSettingsIdentityComponent {
  readonly group = input.required<GroupView>();

  protected readonly store = inject(GroupDetailStore);
  private readonly toasts = inject(ToastService);

  readonly draftAvatar = linkedSignal<string | null>(() => this.group().avatarUrl ?? null);
  readonly avatarChanged = computed(
    () => (this.draftAvatar() ?? null) !== (this.group().avatarUrl ?? null),
  );
  readonly isSavingAvatar = signal(false);

  readonly profile = computed(() => groupProfileFor(this.group().id, this.store.memberCount()));
  readonly rulesJoined = computed(() => this.profile().rules.join('\n'));

  onAvatarChange(value: string | null): void {
    this.draftAvatar.set(value);
  }

  async saveAvatar(): Promise<void> {
    const avatar = this.draftAvatar();
    if (!avatar || !this.avatarChanged() || this.isSavingAvatar()) return;
    this.isSavingAvatar.set(true);
    try {
      await this.store.updateAvatar(this.group().id, avatar);
      this.toasts.success('Foto del grupo actualizada');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.isSavingAvatar.set(false);
    }
  }
}
