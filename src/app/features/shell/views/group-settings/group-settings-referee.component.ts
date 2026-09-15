import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GroupStore } from '../../../../core/group-store';
import { Member } from '../../../../core/lobby';
import { groupRefereeFor } from '../../../../core/group-hub';
import { ToastService } from '../../../../core/toast';
import { NfAvatar, NfButton } from '../../../../ui';

@Component({
  selector: 'app-group-settings-referee',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfButton],
  templateUrl: './group-settings-referee.component.html',
  styleUrl: './group-settings-referee.component.scss',
})
export class GroupSettingsRefereeComponent {
  private readonly groupStore = inject(GroupStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly groupId = input.required<string>();

  readonly roster = computed<Member[]>(() => {
    return this.groupStore.rosterOf(this.groupId());
  });

  readonly referee = computed(() => {
    const rId = groupRefereeFor(this.groupId(), this.roster());
    if (!rId) return null;
    return this.roster().find((m: Member) => m.userId === rId) ?? null;
  });

  openVote(): void {
    this.toasts.success('Votación de árbitro abierta. Está en el hub del grupo.');
    void this.router.navigate(['/app', 'grupos', this.groupId()]);
  }
}
