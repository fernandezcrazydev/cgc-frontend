import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { NfAvatar, NfButton } from '../../../../ui';
import {
  LobbyModality,
  LobbyParticipantResponse,
  LobbyResponse,
  LobbySlotResponse,
} from '../../../../core/lobbies';
import { hueFromId } from '../../../../shared/avatar-bg';
import { ScheduleStanding } from './schedule-card.component';

/** El cambio que pide el usuario: a qué horas se apunta y de cuáles se borra. */
export interface AvailabilityChange {
  join: string[];
  leave: string[];
}

interface PollingSlotRow {
  slot: LobbySlotResponse;
  label: string;
  confirmed: boolean;
  isAlreadySigned: boolean;
}

@Component({
  selector: 'app-convocatoria-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfButton],
  templateUrl: './convocatoria-modal.component.html',
  styleUrl: './convocatoria-modal.component.scss',
})
export class ConvocatoriaModalComponent {
  readonly lobby = input<LobbyResponse | null>(null);
  readonly slot = input<LobbySlotResponse | null>(null);
  readonly myUserId = input<string | null>(null);
  readonly pending = input(false);
  readonly acting = input(false);

  readonly signUp = output<string>();
  readonly withdraw = output<string>();
  readonly saveAvailability = output<AvailabilityChange>();

  protected readonly tintOf = hueFromId;

  protected readonly modality = computed<LobbyModality>(() => {
    return this.lobby()?.modality ?? 'BALANCED';
  });

  protected readonly isParty = computed<boolean>(() => {
    const lb = this.lobby();
    return (
      lb?.distribution === 'PARTY' ||
      lb?.subType === 'PARTY_POOL' ||
      lb?.subType === 'PARTY_ROUNDS'
    );
  });

  protected readonly isContiguous = computed<boolean>(() => {
    const lb = this.lobby();
    const s = this.representativeSlot();
    return (
      !this.isParty() &&
      (lb?.subType === 'CONTIGUOUS_ROOMS' || (s?.secondaryStarters?.length ?? 0) > 0)
    );
  });

  protected readonly isPartyRounds = computed<boolean>(() => {
    const lb = this.lobby();
    const s = this.representativeSlot();
    return (
      this.isParty() &&
      (lb?.subType === 'PARTY_ROUNDS' || (s?.secondaryStarters?.length ?? 0) > 0)
    );
  });

  protected readonly isPartyPool = computed<boolean>(() => {
    return this.lobby()?.subType === 'PARTY_POOL';
  });

  protected readonly representativeSlot = computed<LobbySlotResponse | null>(() => {
    const directSlot = this.slot();
    if (directSlot) return directSlot;
    const lb = this.lobby();
    if (!lb) return null;
    const confirmed = lb.slots.find((s) => s.id === lb.confirmedSlotId);
    if (confirmed) return confirmed;
    return (
      [...lb.slots].sort(
        (a, b) => b.signedUp - a.signedUp || a.startsAt.localeCompare(b.startsAt),
      )[0] ?? null
    );
  });

  protected readonly whenText = computed<string>(() => {
    const s = this.representativeSlot();
    if (!s) return '';
    return formatKickoff(s.startsAt);
  });

  protected readonly myStanding = computed<ScheduleStanding>(() => {
    const me = this.myUserId();
    const lb = this.lobby();
    if (!me || !lb) return { kind: 'out' };

    for (const s of lb.slots) {
      const stIdx = s.starters.findIndex((p) => p.userId === me);
      if (stIdx >= 0) return { kind: 'starter', position: stIdx + 1, slot: s };
      if (s.secondaryStarters) {
        const secIdx = s.secondaryStarters.findIndex((p) => p.userId === me);
        if (secIdx >= 0) {
          return {
            kind: 'starter',
            position: s.starters.length + secIdx + 1,
            slot: s,
          };
        }
      }
      const benchIdx = s.bench.findIndex((p) => p.userId === me);
      if (benchIdx >= 0) return { kind: 'bench', position: benchIdx + 1, slot: s };
    }
    return { kind: 'out' };
  });

  /* ── POLLING (Horas propuestas) ── */

  protected readonly rows = computed<PollingSlotRow[]>(() => {
    const lb = this.lobby();
    const me = this.myUserId();
    if (!lb) return [];
    return [...lb.slots]
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((slot) => {
        const isAlreadySigned = !!me && (
          slot.starters.some((p) => p.userId === me) ||
          (slot.secondaryStarters?.some((p) => p.userId === me) ?? false) ||
          slot.bench.some((p) => p.userId === me)
        );
        return {
          slot,
          label: formatSlot(slot.startsAt),
          confirmed: slot.id === lb.confirmedSlotId,
          isAlreadySigned,
        };
      });
  });

  private readonly mine = computed<string[]>(() => {
    const me = this.myUserId();
    if (!me) return [];
    return this.rows()
      .filter((row) => row.isAlreadySigned)
      .map((row) => row.slot.id);
  });

  protected readonly picked = linkedSignal<string[], string[]>({
    source: () => this.mine(),
    computation: (mine) => [...mine],
  });

  protected readonly dirty = computed<boolean>(() => {
    const a = [...this.mine()].sort().join('|');
    const b = [...this.picked()].sort().join('|');
    return a !== b;
  });

  protected readonly summary = computed<string>(() => {
    const n = this.picked().length;
    if (!n) return 'No puedes a ninguna hora';
    return `Has seleccionado ${n} hora${n === 1 ? '' : 's'}`;
  });

  protected projected(row: PollingSlotRow): number {
    const me = this.myUserId();
    const currentCount = row.slot.signedUp ?? (row.slot.starters.length + row.slot.bench.length);
    if (!me) return currentCount;

    const isPicked = this.picked().includes(row.slot.id);
    const wasSigned = row.isAlreadySigned;

    if (isPicked && !wasSigned) return currentCount + 1;
    if (!isPicked && wasSigned) return Math.max(0, currentCount - 1);
    return currentCount;
  }

  protected toggle(slotId: string): void {
    this.picked.update((list) =>
      list.includes(slotId) ? list.filter((id) => id !== slotId) : [...list, slotId],
    );
  }

  protected applyAvailability(): void {
    const mine = this.mine();
    const picked = this.picked();
    this.saveAvailability.emit({
      join: picked.filter((id) => !mine.includes(id)),
      leave: mine.filter((id) => !picked.includes(id)),
    });
  }

  /* ── CONFIRMED Handlers ── */

  protected onSignUp(slotId: string): void {
    this.signUp.emit(slotId);
  }

  protected onWithdraw(slotId: string): void {
    this.withdraw.emit(slotId);
  }

  protected allPartyParticipants(s: LobbySlotResponse): LobbyParticipantResponse[] {
    return [...s.starters, ...(s.secondaryStarters ?? []), ...s.bench];
  }

  protected emptyStarterSlots(s: LobbySlotResponse, capacity = 10): number[] {
    const missing = Math.max(0, capacity - s.starters.length);
    return Array.from({ length: missing }, (_, i) => i);
  }

  protected formatKickoff(iso: string): string {
    return formatKickoff(iso);
  }
}

function formatKickoff(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatSlot(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
