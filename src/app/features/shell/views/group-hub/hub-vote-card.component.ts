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
import { GroupMemberLite, GroupVote } from '../../../../core/group-votes';
import { NfButton, NfSkeleton } from '../../../../ui';

/**
 * Card de votación unánime en el hub del grupo (§5.5.23).
 *
 * Muestra una propuesta de temporada abierta (cerrar o renombrar) que requiere la aprobación
 * unánime de todos los miembros del grupo en un plazo de 24 horas.
 *
 * Cuando [F5.5-22b] traiga la votación de árbitro, esa va encima y la unánime debajo:
 * la de árbitro es la que desbloquea levantar sanciones, así que tiene precedencia.
 */
@Component({
  selector: 'app-hub-vote-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton, NfSkeleton],
  templateUrl: './hub-vote-card.component.html',
  styleUrls: ['./hub-card.scss', './hub-vote-card.component.scss'],
})
export class HubVoteCardComponent {
  readonly vote = input.required<GroupVote>();
  readonly groupId = input<string>('');
  readonly currentUserId = input<string | null>(null);
  readonly members = input<readonly GroupMemberLite[]>([]);
  readonly membersLoading = input(false);

  readonly voteCast = output<{ voteId: string; inFavor: boolean }>();

  readonly changing = signal(false);
  private readonly now = signal(Date.now());

  // BACKEND NOTE: total de miembros usa roster().length mientras no haya endpoint real de votaciones
  readonly totalMembers = computed(() => this.members().length);

  readonly inFavorPercent = computed(() => {
    const total = this.totalMembers();
    if (total <= 0) return 0;
    const count = this.vote().inFavor.length;
    return Math.min(100, Math.max(0, Math.round((count / total) * 100)));
  });

  readonly isExpired = computed(() => this.vote().closesAt <= this.now());

  readonly countdownText = computed(() => {
    const diff = this.vote().closesAt - this.now();
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

  readonly proposalTitle = computed(() => {
    const v = this.vote();
    if (v.kind === 'SEASON_RENAME' && v.proposedName) {
      return `Renombrar la temporada «${v.seasonName}» a «${v.proposedName}» (${v.leagueLabel})`;
    }
    return `Cerrar la temporada «${v.seasonName}» (${v.leagueLabel})`;
  });

  readonly myVote = computed<'favor' | 'against' | null>(() => {
    const myId = this.currentUserId();
    if (!myId) return null;
    const v = this.vote();
    if (v.inFavor.includes(myId)) return 'favor';
    if (v.against.includes(myId)) return 'against';
    return null;
  });

  readonly pendingMembers = computed(() => {
    const v = this.vote();
    return this.members().filter(
      (m) => !v.inFavor.includes(m.userId) && !v.against.includes(m.userId),
    );
  });

  readonly pendingText = computed(() => {
    const pending = this.pendingMembers();
    if (pending.length === 0) {
      return 'Todos los miembros han votado.';
    }
    if (pending.length <= 4) {
      return `Faltan por votar: ${pending.map((m) => m.name).join(', ')}`;
    }
    const firstFour = pending.slice(0, 4).map((m) => m.name).join(', ');
    const remainder = pending.length - 4;
    return `Faltan por votar: ${firstFour}, y ${remainder} más`;
  });

  constructor() {
    const timer = setInterval(() => {
      this.now.set(Date.now());
    }, 60 * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  voteInFavor(): void {
    this.changing.set(false);
    this.voteCast.emit({ voteId: this.vote().id, inFavor: true });
  }

  voteAgainst(): void {
    this.changing.set(false);
    this.voteCast.emit({ voteId: this.vote().id, inFavor: false });
  }

  startChanging(): void {
    this.changing.set(true);
  }
}
