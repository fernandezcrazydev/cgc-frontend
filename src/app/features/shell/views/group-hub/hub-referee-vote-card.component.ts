import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { GroupMemberLite, RefereeElection } from '../../../../core/group-votes';
import { NfButton, NfSkeleton } from '../../../../ui';

/**
 * Card de votación de árbitro en el hub del grupo [F5.5-22b].
 *
 * Muestra la votación activa para elegir al árbitro del grupo por mayoría simple.
 * Tiene precedencia y se sitúa encima de la card de propuesta unánime.
 */
@Component({
  selector: 'app-hub-referee-vote-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton, NfSkeleton],
  templateUrl: './hub-referee-vote-card.component.html',
  styleUrls: ['./hub-card.scss', './hub-referee-vote-card.component.scss'],
})
export class HubRefereeVoteCardComponent {
  readonly election = input.required<RefereeElection>();
  readonly groupId = input<string>('');
  readonly currentUserId = input<string | null>(null);
  readonly members = input<readonly GroupMemberLite[]>([]);
  readonly membersLoading = input(false);

  readonly openVoteModal = output<void>();

  private readonly now = signal(Date.now());

  readonly totalMembers = computed(() => this.members().length);

  readonly votedCount = computed(() => Object.keys(this.election().ballots).length);

  readonly participationPercent = computed(() => {
    const total = this.totalMembers();
    if (total <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((this.votedCount() / total) * 100)));
  });

  readonly isExpired = computed(() => this.election().closesAt <= this.now());

  readonly countdownText = computed(() => {
    const diff = this.election().closesAt - this.now();
    if (diff <= 0) {
      return 'la votación ha terminado';
    }
    if (diff < 60 * 1000) {
      return 'queda menos de un minuto';
    }
    if (diff < 60 * 60 * 1000) {
      const mins = Math.floor(diff / (60 * 1000));
      return `quedan ${mins} min`;
    }
    const hours = Math.floor(diff / (3600 * 1000));
    const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    return `quedan ${hours} h ${mins.toString().padStart(2, '0')} min`;
  });

  readonly myVotedCandidateName = computed<string | null>(() => {
    const myId = this.currentUserId();
    if (!myId) return null;
    const candId = this.election().ballots[myId];
    if (!candId) return null;
    const member = this.members().find((m) => m.userId === candId);
    return member?.name ?? 'un miembro';
  });

  readonly leaderLine = computed(() => {
    const ballots = this.election().ballots;
    const voterIds = Object.keys(ballots);
    if (voterIds.length === 0) {
      return 'Todavía no ha votado nadie';
    }

    const counts: Record<string, number> = {};
    for (const vId of voterIds) {
      const candId = ballots[vId];
      counts[candId] = (counts[candId] ?? 0) + 1;
    }

    let maxVotes = 0;
    for (const candId of Object.keys(counts)) {
      if (counts[candId] > maxVotes) {
        maxVotes = counts[candId];
      }
    }

    if (maxVotes === 0) {
      return 'Todavía no ha votado nadie';
    }

    const leaders = Object.keys(counts).filter((candId) => counts[candId] === maxVotes);
    const votesWord = maxVotes === 1 ? '1 voto' : `${maxVotes} votos`;

    if (leaders.length === 1) {
      const name = this.members().find((m) => m.userId === leaders[0])?.name ?? 'un miembro';
      return `Ahora mismo lidera ${name} con ${votesWord}`;
    }

    if (leaders.length === 2) {
      const name1 = this.members().find((m) => m.userId === leaders[0])?.name ?? 'un miembro';
      const name2 = this.members().find((m) => m.userId === leaders[1])?.name ?? 'un miembro';
      return `Hay empate entre ${name1} y ${name2} con ${votesWord}`;
    }

    return `Hay empate en cabeza con ${votesWord}`;
  });

  constructor() {
    const timer = setInterval(() => {
      this.now.set(Date.now());
    }, 60 * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  onVoteClick(): void {
    if (!this.isExpired()) {
      this.openVoteModal.emit();
    }
  }
}
