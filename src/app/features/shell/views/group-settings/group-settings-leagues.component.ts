import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { GroupLeague, groupLeaguesFor } from '../../../../core/group-leagues';
import { GroupDetailStore } from '../../../../core/groups';
import { NfIconButton, NfSkeleton } from '../../../../ui';
import { LeagueEditDialogComponent } from './league-edit-dialog.component';

@Component({
  selector: 'app-group-settings-leagues',
  standalone: true,
  imports: [NfIconButton, NfSkeleton, LeagueEditDialogComponent],
  templateUrl: './group-settings-leagues.component.html',
  styleUrl: './group-settings-leagues.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupSettingsLeaguesComponent {
  readonly groupId = input.required<string>();

  private readonly store = inject(GroupDetailStore);

  readonly isLoading = computed(() => this.store.status() === 'loading');

  private readonly leaguesOverride = signal<Record<string, GroupLeague[]>>({});

  readonly leagues = computed<GroupLeague[]>(() => {
    const gid = this.groupId();
    return this.leaguesOverride()[gid] ?? groupLeaguesFor(gid);
  });

  readonly selectedLeague = signal<GroupLeague | null>(null);

  openEdit(league: GroupLeague, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedLeague.set(league);
  }

  closeEdit(): void {
    this.selectedLeague.set(null);
  }

  onSaved(event: { durationMonths: number; seasonName: string | null; named: boolean }): void {
    const sel = this.selectedLeague();
    if (!sel) return;

    const currentList = this.leagues();
    const updated = currentList.map((l) => {
      if (l.modality !== sel.modality) return l;
      return {
        ...l,
        durationMonths: event.durationMonths,
        seasonName: event.seasonName,
        named: event.named,
      };
    });

    this.leaguesOverride.update((all) => ({
      ...all,
      [this.groupId()]: updated,
    }));
  }
}
