import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GroupSanction } from '../../../../core/group-sanctions';
import { NfAvatar, NfButton } from '../../../../ui';
import { formatRelativeTime } from '../../../../shared/date-format';

const DAY_MONTH = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

@Component({
  selector: 'app-sanction-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfButton],
  templateUrl: './sanction-row.component.html',
  styleUrl: './sanction-row.component.scss',
})
export class SanctionRowComponent {
  readonly sanction = input.required<GroupSanction>();
  readonly groupId = input.required<string>();
  readonly currentUserId = input<string | null>(null);
  readonly isReferee = input<boolean>(false);
  readonly hasReferee = input<boolean>(true);

  readonly openAppealRead = output<GroupSanction>();
  readonly openAppealWrite = output<GroupSanction>();
  readonly liftSanction = output<GroupSanction>();

  readonly isCurrentUserTarget = computed(() => {
    const me = this.currentUserId();
    return Boolean(me && this.sanction().targetUserId === me);
  });

  readonly relativeTime = computed(() => {
    return formatRelativeTime(new Date(this.sanction().createdAt).toISOString());
  });

  readonly endsAtLabel = computed(() => {
    const ends = this.sanction().endsAt;
    if (!ends) return '';
    const formatted = DAY_MONTH.format(new Date(ends)).replace('.', '');
    return `Termina el ${formatted}`;
  });

  readonly scopeText = computed(() => {
    const s = this.sanction();
    if (s.scope === 'ALL_LEAGUES') {
      return 'las 3 ligas';
    }
    return s.modality;
  });

  playerLink(userId: string | null): (string | null)[] {
    if (!userId) return [];
    if (this.currentUserId() && userId === this.currentUserId()) {
      return ['/app', 'perfil'];
    }
    return ['/app', 'perfil', userId];
  }
}
