import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NfAvatar, NfButton } from '../../../../ui';
import {
  LobbyModality,
  LobbyParticipantResponse,
  LobbyResponse,
  LobbySlotResponse,
} from '../../../../core/lobbies';
import { hueFromId } from '../../../../shared/avatar-bg';

/** Cómo se sitúa el usuario respecto a esta convocatoria. */
export type ScheduleStanding =
  | { kind: 'starter'; position: number; slot: LobbySlotResponse }
  | { kind: 'bench'; position: number; slot: LobbySlotResponse }
  | { kind: 'out' };

export type ParticipationState =
  | 'confirmed-starter'
  | 'confirmed-bench'
  | 'confirmed-out'
  | 'polling-voted'
  | 'polling-unvoted';

/**
 * Tarjeta de convocatoria en la columna de agenda (§5.5.6, Opción 4).
 *
 * El marco y las insignias transmiten visualmente con colores el estado:
 * - Verde: Inscrito como titular (confirmed-starter)
 * - Dorado: Inscrito en banquillo (confirmed-bench)
 * - Gris neutro: No inscrito (confirmed-out)
 * - Azul: Horas propuestas con disponibilidad votada (polling-voted)
 * - Ámbar: Horas propuestas pendiente de votar (polling-unvoted)
 *
 * Clic en la tarjeta abre el modal completo con detalles.
 */
@Component({
  selector: 'app-schedule-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfButton, RouterLink],
  templateUrl: './schedule-card.component.html',
  styleUrl: './schedule-card.component.scss',
})
export class ScheduleCardComponent {
  private readonly router = inject(Router);

  readonly lobby = input<LobbyResponse | null>(null);
  readonly slot = input<LobbySlotResponse | null>(null);
  readonly standing = input<ScheduleStanding>({ kind: 'out' });
  readonly when = input('');
  readonly acting = input(false);
  readonly myUserId = input<string | null>(null);

  readonly signUp = output<string>();
  readonly withdraw = output<string>();
  readonly openAvailability = output<void>();
  readonly openDetail = output<LobbyResponse>();

  protected readonly tintOf = hueFromId;

  protected readonly modality = computed<LobbyModality>(() => {
    return this.lobby()?.modality ?? 'BALANCED';
  });

  protected readonly modalityLabel = computed<string>(() => {
    switch (this.modality()) {
      case 'COMPETITIVE':
        return 'Competitivo';
      case 'CHAOS':
        return 'Caos';
      default:
        return 'Equilibrado';
    }
  });

  protected readonly isParty = computed(
    () =>
      this.lobby()?.distribution === 'PARTY' ||
      this.lobby()?.subType === 'PARTY_POOL' ||
      this.lobby()?.subType === 'PARTY_ROUNDS',
  );

  protected readonly isContiguous = computed(
    () =>
      !this.isParty() &&
      (this.lobby()?.subType === 'CONTIGUOUS_ROOMS' ||
        (this.slot()?.secondaryStarters?.length ?? 0) > 0),
  );

  protected readonly isPartyRounds = computed(
    () =>
      this.isParty() &&
      (this.lobby()?.subType === 'PARTY_ROUNDS' ||
        (this.slot()?.secondaryStarters?.length ?? 0) > 0),
  );

  protected readonly isPartyPool = computed(
    () => this.lobby()?.subType === 'PARTY_POOL',
  );

  protected readonly totalStarters = computed(() => {
    const s = this.slot();
    if (!s) return 0;
    return s.starters.length + (s.secondaryStarters?.length ?? 0);
  });

  protected readonly totalCapacity = computed(() => {
    const lb = this.lobby();
    if (!lb) return 10;
    return (this.isContiguous() || this.isPartyRounds()) ? lb.capacity * 2 : lb.capacity;
  });

  protected readonly totalParticipantsCount = computed<number>(() => {
    const s = this.slot();
    if (!s) return 0;
    return s.signedUp ?? (s.starters.length + (s.secondaryStarters?.length ?? 0) + s.bench.length);
  });

  protected readonly hasVoted = computed<boolean>(() => {
    const me = this.myUserId();
    const lb = this.lobby();
    if (!me || !lb || lb.status !== 'POLLING') return false;
    return lb.slots.some(
      (s) =>
        s.starters.some((p) => p.userId === me) ||
        (s.secondaryStarters?.some((p) => p.userId === me) ?? false) ||
        s.bench.some((p) => p.userId === me),
    );
  });

  protected readonly votedHoursCount = computed<number>(() => {
    const me = this.myUserId();
    const lb = this.lobby();
    if (!me || !lb || lb.status !== 'POLLING') return 0;
    return lb.slots.filter(
      (s) =>
        s.starters.some((p) => p.userId === me) ||
        (s.secondaryStarters?.some((p) => p.userId === me) ?? false) ||
        s.bench.some((p) => p.userId === me),
    ).length;
  });

  protected readonly participationState = computed<ParticipationState>(() => {
    const lb = this.lobby();
    if (!lb) return 'confirmed-out';
    if (lb.status === 'POLLING') {
      return this.hasVoted() ? 'polling-voted' : 'polling-unvoted';
    }
    const st = this.standing();
    if (st.kind === 'starter') return 'confirmed-starter';
    if (st.kind === 'bench') return 'confirmed-bench';
    return 'confirmed-out';
  });

  protected readonly previewParticipants = computed<{ list: LobbyParticipantResponse[]; extraCount: number }>(() => {
    const s = this.slot();
    if (!s) return { list: [], extraCount: 0 };
    const all = [...s.starters, ...(s.secondaryStarters ?? []), ...s.bench];
    const MAX_PREVIEW = 7;
    if (all.length <= MAX_PREVIEW) {
      return { list: all, extraCount: 0 };
    }
    return { list: all.slice(0, MAX_PREVIEW), extraCount: all.length - MAX_PREVIEW };
  });

  protected readonly barProgressPercent = computed<number>(() => {
    const lb = this.lobby();
    const s = this.slot();
    if (!lb || !s) return 0;
    if (lb.status === 'POLLING') {
      const bestSlotCount = Math.max(...lb.slots.map((slot) => slot.signedUp), 0);
      return Math.min((bestSlotCount / 10) * 100, 100);
    }
    if (this.isParty()) {
      return Math.min((this.totalParticipantsCount() / 10) * 100, 100);
    }
    return Math.min((this.totalStarters() / this.totalCapacity()) * 100, 100);
  });

  protected readonly cardSummaryText = computed<string>(() => {
    const lb = this.lobby();
    const s = this.slot();
    if (!lb || !s) return '';
    if (lb.status === 'POLLING') {
      return `${lb.slots.length} ${lb.slots.length === 1 ? 'hora propuesta' : 'horas propuestas'} · ${this.totalParticipantsCount()} votos`;
    }
    if (this.isParty()) {
      const n = this.totalParticipantsCount();
      return `${n} inscritos · ${n >= 10 ? 'Party confirmada' : 'Faltan ' + (10 - n)}`;
    }
    if (this.isContiguous()) {
      return `${this.totalStarters()}/20 plazas`;
    }
    return `${s.starters.length}/${lb.capacity} plazas`;
  });

  protected onCardClick(event: MouseEvent): void {
    const lb = this.lobby();
    if (!lb) return;
    this.openDetail.emit(lb);
  }

  protected onSignUp(event: MouseEvent, slotId: string): void {
    event.stopPropagation();
    this.signUp.emit(slotId);
  }

  protected onWithdraw(event: MouseEvent, slotId: string): void {
    event.stopPropagation();
    this.withdraw.emit(slotId);
  }

  protected onOpenAvailability(event: MouseEvent): void {
    event.stopPropagation();
    const lb = this.lobby();
    if (lb) this.openDetail.emit(lb);
    this.openAvailability.emit();
  }
}
