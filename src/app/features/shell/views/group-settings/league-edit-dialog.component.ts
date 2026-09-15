import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupLeague } from '../../../../core/group-leagues';
import { GroupVotesStore } from '../../../../core/group-votes';
import { GroupDetailStore } from '../../../../core/groups';
import { Session } from '../../../../core/auth';
import { ToastService } from '../../../../core/toast';
import { NfButton, NfModal, NfSelect, NfSelectOption } from '../../../../ui';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

@Component({
  selector: 'app-league-edit-dialog',
  standalone: true,
  imports: [FormsModule, NfModal, NfButton, NfSelect],
  templateUrl: './league-edit-dialog.component.html',
  styleUrl: './league-edit-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeagueEditDialogComponent {
  readonly league = input.required<GroupLeague>();
  readonly groupId = input.required<string>();

  readonly closed = output<void>();
  readonly saved = output<{ durationMonths: number; seasonName: string | null; named: boolean }>();

  private readonly groupVotesStore = inject(GroupVotesStore);
  private readonly groupDetailStore = inject(GroupDetailStore);
  private readonly session = inject(Session);
  private readonly toasts = inject(ToastService);

  readonly step = signal<'edit' | 'propose'>('edit');

  readonly durationOptions: readonly NfSelectOption[] = [
    { value: '1', label: '1 mes' },
    { value: '2', label: '2 meses' },
    { value: '3', label: '3 meses' },
    { value: '6', label: '6 meses' },
    { value: '12', label: '12 meses' },
  ];

  readonly seasonNameInput = linkedSignal<GroupLeague, string>({
    source: () => this.league(),
    computation: (l) => (l.named ? l.seasonName ?? '' : ''),
  });

  readonly durationValue = linkedSignal<GroupLeague, string>({
    source: () => this.league(),
    computation: (l) => String(l.durationMonths),
  });

  readonly proposeKind = signal<'SEASON_CLOSE' | 'SEASON_RENAME'>('SEASON_RENAME');
  readonly proposedName = signal<string>('');
  readonly reason = signal<string>('');

  readonly dialogTitle = computed(() =>
    this.step() === 'propose' ? 'Proponer al grupo' : 'Liga ' + this.league().label,
  );

  readonly defaultSeasonName = computed(() => {
    const l = this.league();
    return 'Liga ' + l.label + ' · ' + (l.ordinal ?? 'Temp. 1');
  });

  readonly liveTrofeeName = computed(() => {
    const raw = this.seasonNameInput().trim();
    if (raw) return raw;
    return this.defaultSeasonName();
  });

  readonly nameFieldLabel = computed(() => {
    const l = this.league();
    if (l.state === 'IN_PROGRESS' && l.named) {
      return 'Nombre de la próxima temporada';
    }
    return 'Nombre de la temporada';
  });

  readonly durationRangeLabel = computed(() => {
    const l = this.league();
    if (l.state === 'NOT_STARTED') {
      return 'Empieza con la primera partida';
    }

    const durationMonths = Number(this.durationValue()) || l.durationMonths;
    const now = new Date();
    const startDate = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const endDate = new Date(startDate.getTime() + durationMonths * 30.4375 * 24 * 60 * 60 * 1000);

    const startStr = `${startDate.getDate()} ${MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}`;
    const endStr = `${endDate.getDate()} ${MONTHS[endDate.getMonth()]} ${endDate.getFullYear()}`;

    return `Del ${startStr} al ${endStr}`;
  });

  readonly hasChanges = computed(() => {
    const l = this.league();
    const initialName = l.named ? l.seasonName ?? '' : '';
    const initialDuration = String(l.durationMonths);

    return (
      this.seasonNameInput().trim() !== initialName.trim() ||
      this.durationValue() !== initialDuration
    );
  });

  readonly canSubmitProposal = computed(() => {
    if (!this.reason().trim()) return false;
    if (this.proposeKind() === 'SEASON_RENAME' && !this.proposedName().trim()) return false;
    return true;
  });

  save(): void {
    if (!this.hasChanges()) return;

    const l = this.league();
    const newDuration = Number(this.durationValue()) || l.durationMonths;
    const inputName = this.seasonNameInput().trim();

    let newNamed = l.named;
    let newSeasonName = l.seasonName;

    if (l.state === 'NOT_STARTED') {
      newSeasonName = inputName || null;
      newNamed = Boolean(inputName);
      this.toasts.success('Guardado. Se aplicará cuando arranque la temporada.');
    } else if (l.state === 'IN_PROGRESS' && !l.named) {
      if (inputName) {
        newSeasonName = inputName;
        newNamed = true;
        this.toasts.success(`Temporada bautizada como «${inputName}».`);
      } else {
        this.toasts.success(
          `Guardado. Esta temporada sigue terminando el ${l.endsAtLabel}. El cambio se aplicará a la siguiente.`,
        );
      }
    } else {
      this.toasts.success(
        `Guardado. Esta temporada sigue terminando el ${l.endsAtLabel}. El cambio se aplicará a la siguiente.`,
      );
    }

    this.saved.emit({
      durationMonths: newDuration,
      seasonName: newSeasonName,
      named: newNamed,
    });
    this.closed.emit();
  }

  openProposeStep(): void {
    this.step.set('propose');
  }

  backToEdit(): void {
    this.step.set('edit');
  }

  submitProposal(): void {
    if (!this.canSubmitProposal()) return;

    const l = this.league();
    const currentUser = this.session.user();
    const group = this.groupDetailStore.group();
    const userName = currentUser?.discordUsername || 'Admin';
    const proposedByRole = group?.role === 'OWNER' ? 'propietario' : 'admin';
    const currentSeasonName =
      l.seasonName ?? ('Liga ' + l.label + ' · ' + (l.ordinal ?? 'Temp. 1'));

    const members = this.groupDetailStore.roster().map((m) => ({
      userId: m.userId,
      name: m.discordUsername,
    }));

    this.groupVotesStore.open(
      this.groupId(),
      {
        kind: this.proposeKind(),
        proposedBy: userName,
        proposedByRole,
        leagueLabel: l.label,
        seasonName: currentSeasonName,
        proposedName: this.proposeKind() === 'SEASON_RENAME' ? this.proposedName().trim() : null,
        reason: this.reason().trim(),
      },
      members,
    );

    this.toasts.success('Votación abierta. El grupo tiene 24 h para responder.');
    this.closed.emit();
  }
}
