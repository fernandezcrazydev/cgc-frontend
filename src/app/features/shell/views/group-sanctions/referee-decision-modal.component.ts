import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SanctionScope } from '../../../../core/group-sanctions';
import { NfAvatar, NfButton, NfModal } from '../../../../ui';

export interface RefereeDecisionIncident {
  date: string;
  type: string;
  modality: string;
  detail?: string;
  lpDelta: number;
}

export interface RefereeDecisionData {
  notificationId: string;
  groupId: string;
  groupName: string;
  targetUserId: string;
  targetName: string;
  targetAvatar?: string;
  targetHue?: number;
  modality: 'Competitivo' | 'Equilibrado' | 'Caos';
  recommendedDays: number;
  incidents: RefereeDecisionIncident[];
}

export function parseRefereeDecision(n: { id: string; type: string; data: Record<string, string> }): RefereeDecisionData {
  let incidents: RefereeDecisionIncident[] = [];
  try {
    if (n.data['incidents']) {
      incidents = JSON.parse(n.data['incidents']);
    }
  } catch {
    incidents = [];
  }
  if (!incidents.length) {
    incidents = [
      { date: '5 sept', type: 'Ausencia', modality: (n.data['modality'] as 'Competitivo' | 'Equilibrado' | 'Caos') || 'Equilibrado', detail: '', lpDelta: -5 },
      { date: '8 sept', type: 'Abandono', modality: (n.data['modality'] as 'Competitivo' | 'Equilibrado' | 'Caos') || 'Equilibrado', detail: 'Sala #4092', lpDelta: -10 },
      { date: '12 sept', type: 'Abandono', modality: (n.data['modality'] as 'Competitivo' | 'Equilibrado' | 'Caos') || 'Equilibrado', detail: 'Sala #4131', lpDelta: -10 },
    ];
  }
  return {
    notificationId: n.id,
    groupId: n.data['groupId'] || '',
    groupName: n.data['groupName'] || '',
    targetUserId: n.data['targetUserId'] || '',
    targetName: n.data['targetName'] || 'Jugador',
    targetAvatar: n.data['targetAvatar'] || '',
    modality: (n.data['modality'] as 'Competitivo' | 'Equilibrado' | 'Caos') || 'Equilibrado',
    recommendedDays: parseInt(n.data['recommendedDays'] || '7', 10) || 7,
    incidents,
  };
}

@Component({
  selector: 'app-referee-decision-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NfModal,
    NfButton,
    NfAvatar,
  ],
  templateUrl: './referee-decision-modal.component.html',
  styleUrl: './referee-decision-modal.component.scss',
})
export class RefereeDecisionModalComponent {
  readonly decision = input.required<RefereeDecisionData>();
  readonly snoozesLeft = input<number>(3);

  readonly snooze = output<void>();
  readonly dismiss = output<void>();
  readonly apply = output<{ days: number; scope: SanctionScope; reason: string }>();
  readonly closed = output<void>();

  readonly days = linkedSignal(() =>
    Math.min(14, Math.max(1, this.decision().recommendedDays || 7)),
  );
  readonly scope = linkedSignal<SanctionScope>(() => 'LEAGUE');
  readonly reason = linkedSignal(() => 'Tercera incidencia esta temporada');

  readonly isValid = computed(() => {
    const d = this.days();
    return Number.isFinite(d) && d >= 1 && d <= 14 && this.reason().trim().length > 0;
  });

  setDays(val: number | string): void {
    const parsed = typeof val === 'string' ? parseInt(val, 10) : val;
    if (Number.isFinite(parsed)) {
      this.days.set(Math.min(14, Math.max(1, parsed)));
    }
  }

  onSnooze(): void {
    if (this.snoozesLeft() > 0) {
      this.snooze.emit();
      this.closed.emit();
    }
  }

  onDismiss(): void {
    this.dismiss.emit();
    this.closed.emit();
  }

  onApply(): void {
    if (!this.isValid()) return;
    this.apply.emit({
      days: this.days(),
      scope: this.scope(),
      reason: this.reason().trim(),
    });
    this.closed.emit();
  }
}
