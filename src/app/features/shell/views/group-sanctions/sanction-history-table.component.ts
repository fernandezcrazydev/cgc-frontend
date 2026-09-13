import {
  ChangeDetectionStrategy,
  Component,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GroupSanction } from '../../../../core/group-sanctions';
import { NfAvatar } from '../../../../ui';
import { formatLongDate } from '../../../../shared/date-format';

const DAY_MONTH = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

@Component({
  selector: 'app-sanction-history-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar],
  templateUrl: './sanction-history-table.component.html',
  styleUrl: './sanction-history-table.component.scss',
})
export class SanctionHistoryTableComponent {
  readonly sanctions = input.required<readonly GroupSanction[]>();
  readonly groupId = input.required<string>();
  readonly currentUserId = input<string | null>(null);

  /** Id de la sanción cuyo detalle está desplegado. Un solo detalle abierto a la vez. */
  readonly openDetailId = signal<string | null>(null);

  toggleDetail(id: string): void {
    this.openDetailId.update((current) => (current === id ? null : id));
  }

  formatShortDate(epochMs: number): string {
    return DAY_MONTH.format(new Date(epochMs)).replace('.', '');
  }

  formatEndedDate(epochMs: number | null): string {
    if (!epochMs) return '';
    return formatLongDate(new Date(epochMs).toISOString());
  }

  playerLink(userId: string | null): (string | null)[] {
    if (!userId) return [];
    if (this.currentUserId() && userId === this.currentUserId()) {
      return ['/app', 'perfil'];
    }
    return ['/app', 'perfil', userId];
  }

  sanctionLabel(s: GroupSanction): string {
    if (s.kind === 'AUTO_LP') {
      return `−${-s.lpDelta!} LP`;
    }
    return 'Sin jugar';
  }

  roleAbbr(role: 'árbitro' | 'propietario' | null): string {
    if (role === 'árbitro') return 'árb';
    if (role === 'propietario') return 'prop';
    return '';
  }
}
