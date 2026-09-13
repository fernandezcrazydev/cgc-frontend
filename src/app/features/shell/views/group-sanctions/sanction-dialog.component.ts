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
import { GroupSanctionsStore, SanctionScope } from '../../../../core/group-sanctions';
import { LeaguesStore } from '../../../../core/leagues';
import { Member } from '../../../../core/lobby';
import { ToastService } from '../../../../core/toast';
import { errorMessage } from '../../../../core/http';
import {
  NfButton,
  NfModal,
  NfSegmentOption,
  NfSegmented,
  NfSelect,
  NfSelectOption,
} from '../../../../ui';

const DURATION_OPTIONS: readonly NfSegmentOption[] = [
  { value: '1', label: '1 día' },
  { value: '3', label: '3 días' },
  { value: '7', label: '7 días' },
  { value: '14', label: '14 días' },
  { value: 'other', label: 'Otra' },
];

@Component({
  selector: 'app-sanction-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NfModal,
    NfButton,
    NfSegmented,
    NfSelect,
  ],
  templateUrl: './sanction-dialog.component.html',
  styleUrl: './sanction-dialog.component.scss',
})
export class SanctionDialogComponent {
  private readonly leagues = inject(LeaguesStore);
  private readonly sanctionsStore = inject(GroupSanctionsStore);
  private readonly toasts = inject(ToastService);

  readonly groupId = input.required<string>();
  readonly player = input<{ userId: string; name: string } | null>(null);
  readonly roster = input<readonly Member[]>([]);
  readonly leagueName = input<string>('Competitivo');
  readonly currentUserName = input<string | null>(null);
  readonly currentUserId = input<string | null>(null);
  /**
   * Con qué potestad se sanciona, que es lo que la fila del panel pinta debajo del nombre
   * («por Victor (árbitro)»). Estaba escrito a fuego como 'árbitro', así que un veto puesto por
   * el propietario aparecía firmado por un cargo que no tenía: el panel existe justamente para
   * decir quién decidió cada cosa.
   */
  readonly actorRole = input<'árbitro' | 'propietario'>('árbitro');

  readonly closed = output<void>();
  readonly confirmed = output<void>();

  readonly durationOptions = DURATION_OPTIONS;
  readonly selectedDuration = signal<string>('');
  readonly customDays = signal<number | null>(null);
  readonly scope = signal<SanctionScope>('LEAGUE');
  readonly reason = signal<string>('');
  readonly selectedPlayerId = signal<string>('');
  readonly submitting = signal<boolean>(false);

  readonly playerOptions = computed<NfSelectOption[]>(() => {
    return this.roster()
      .filter((m) => Boolean(m.userId))
      .map((m) => ({
        value: m.userId!,
        label: m.name,
      }));
  });

  readonly effectiveTarget = computed<{ userId: string; name: string } | null>(() => {
    const fixed = this.player();
    if (fixed) return fixed;
    const pId = this.selectedPlayerId();
    if (!pId) return null;
    const found = this.roster().find((m) => m.userId === pId);
    if (!found || !found.userId) return null;
    return { userId: found.userId, name: found.name };
  });

  readonly effectiveDays = computed<number | null>(() => {
    const dur = this.selectedDuration();
    if (!dur) return null;
    if (dur === 'other') {
      const c = this.customDays();
      if (c && c >= 1 && c <= 90) return c;
      return null;
    }
    const parsed = parseInt(dur, 10);
    return Number.isFinite(parsed) ? parsed : null;
  });

  readonly isValid = computed<boolean>(() => {
    return Boolean(
      this.effectiveTarget() &&
      this.effectiveDays() !== null &&
      this.reason().trim().length > 0,
    );
  });

  async confirm(): Promise<void> {
    if (!this.isValid() || this.submitting()) return;
    const target = this.effectiveTarget();
    const days = this.effectiveDays();
    const reasonText = this.reason().trim();
    const groupId = this.groupId();

    if (!target || !days || !reasonText || !groupId) return;

    this.submitting.set(true);
    try {
      const untilIso = new Date(Date.now() + days * 86_400_000).toISOString();
      await this.leagues.sanction(groupId, target.userId, {
        reason: reasonText,
        until: untilIso,
      });

      this.sanctionsStore.recordSanction(groupId, {
        kind: 'BAN',
        targetUserId: target.userId,
        targetName: target.name,
        targetAvatar: null,
        targetHue: 120,
        lpDelta: null,
        days,
        scope: this.scope(),
        modality: this.leagueName() as 'Competitivo' | 'Equilibrado' | 'Caos',
        seasonId: null,
        seasonName: null,
        reason: reasonText,
        roomId: null,
        byUserId: this.currentUserId(),
        byName: this.currentUserName(),
        byRole: this.actorRole(),
        endsAt: Date.now() + days * 86_400_000,
      }, this.roster(), this.leagues.seasons(), this.currentUserId());

      this.toasts.success(`${target.name} queda fuera de la competición`);
      this.confirmed.emit();
      this.closed.emit();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    } finally {
      this.submitting.set(false);
    }
  }
}
