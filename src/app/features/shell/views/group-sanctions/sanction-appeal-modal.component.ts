import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupSanction, GroupSanctionsStore } from '../../../../core/group-sanctions';
import { ToastService } from '../../../../core/toast';
import { NfAvatar, NfButton, NfModal } from '../../../../ui';
import { formatRelativeTime } from '../../../../shared/date-format';

@Component({
  selector: 'app-sanction-appeal-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NfModal, NfAvatar, NfButton],
  templateUrl: './sanction-appeal-modal.component.html',
  styleUrl: './sanction-appeal-modal.component.scss',
})
export class SanctionAppealModalComponent {
  private readonly sanctionsStore = inject(GroupSanctionsStore);
  private readonly toasts = inject(ToastService);

  readonly mode = input<'read' | 'write'>('read');
  readonly sanction = input.required<GroupSanction>();
  readonly groupId = input.required<string>();
  readonly isReferee = input<boolean>(false);
  readonly refereeName = input<string | null>(null);
  readonly currentUserId = input<string | null>(null);
  readonly currentUserName = input<string | null>(null);

  readonly closed = output<void>();

  readonly appealText = signal('');

  readonly modalTitle = computed(() => {
    return this.mode() === 'read' ? 'Solicitud de revisión' : 'Pedir revisión';
  });

  readonly appealMeta = computed(() => {
    const s = this.sanction();
    if (!s.appeal) return '';
    const rel = formatRelativeTime(new Date(s.appeal.at).toISOString());
    return `${s.appeal.byName} pidió revisión · ${rel}`;
  });

  readonly sanctionSummary = computed(() => {
    const s = this.sanction();
    if (s.kind === 'BAN') {
      const scope = s.scope === 'ALL_LEAGUES' ? 'las 3 ligas' : s.modality;
      return `Sin jugar · ${scope} · ${s.days} días`;
    }
    return `−${-s.lpDelta!} LP · ${s.modality}`;
  });

  submitAppeal(): void {
    const text = this.appealText().trim();
    if (!text) return;
    const s = this.sanction();
    const gid = this.groupId();

    this.sanctionsStore.appeal(
      gid,
      s.id,
      {
        text,
        at: Date.now(),
        byUserId: this.currentUserId() ?? s.targetUserId,
        byName: this.currentUserName() ?? s.targetName,
      },
    );

    this.toasts.success('Solicitud enviada. La decide el árbitro.');
    this.closed.emit();
  }

  lift(): void {
    const s = this.sanction();
    const gid = this.groupId();
    const byName = this.currentUserName() ?? this.refereeName() ?? 'el árbitro';

    this.sanctionsStore.lift(gid, s.id, byName);
    this.toasts.success('Sanción levantada.');
    this.closed.emit();
  }
}
