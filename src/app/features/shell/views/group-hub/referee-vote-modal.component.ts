import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RefereeElection } from '../../../../core/group-votes';
import { NfAvatar, NfButton } from '../../../../ui';

export interface RefereeCandidate {
  userId: string;
  name: string;
  hue: number;
  avatar?: string;
}

function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Contenido del modal de votación de árbitro [F5.5-22b].
 *
 * Muestra el censo completo de miembros del grupo con sus votos actuales en barras
 * animadas, permite buscar (si >12 miembros) y seleccionar a un candidato por radio.
 */
@Component({
  selector: 'app-referee-vote-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NfAvatar, NfButton],
  templateUrl: './referee-vote-modal.component.html',
  styleUrl: './referee-vote-modal.component.scss',
})
export class RefereeVoteModalComponent {
  readonly election = input.required<RefereeElection>();
  readonly members = input<readonly RefereeCandidate[]>([]);
  readonly currentUserId = input<string | null>(null);

  readonly voteConfirmed = output<string>();
  readonly closed = output<void>();

  readonly searchTerm = signal('');
  private readonly now = signal(Date.now());

  readonly selectedCandidateId = linkedSignal<string | null>(() => {
    const myId = this.currentUserId();
    if (!myId) return null;
    return this.election().ballots[myId] ?? null;
  });

  private initialMemberIds: string[] | null = null;

  /**
   * Orden inicial: votos descendente y nombre ascendente.
   * No se altera dentro de la misma apertura del modal para no hacer saltar las filas al votar.
   */
  readonly orderedMembers = computed<RefereeCandidate[]>(() => {
    const allMembers = this.members();
    const ballots = this.election().ballots;

    if (!this.initialMemberIds || this.initialMemberIds.length !== allMembers.length) {
      const counts: Record<string, number> = {};
      for (const vId of Object.keys(ballots)) {
        const candId = ballots[vId];
        counts[candId] = (counts[candId] ?? 0) + 1;
      }

      const sorted = [...allMembers].sort((a, b) => {
        const votesA = counts[a.userId] ?? 0;
        const votesB = counts[b.userId] ?? 0;
        if (votesB !== votesA) {
          return votesB - votesA;
        }
        return a.name.localeCompare(b.name, 'es');
      });

      this.initialMemberIds = sorted.map((m) => m.userId);
    }

    const memberMap = new Map(allMembers.map((m) => [m.userId, m]));
    return this.initialMemberIds
      .map((id) => memberMap.get(id))
      .filter((m): m is RefereeCandidate => m !== undefined);
  });

  readonly showSearch = computed(() => this.members().length > 12);

  readonly filteredMembers = computed(() => {
    const term = normalizeSearch(this.searchTerm().trim());
    const list = this.orderedMembers();
    if (!term) return list;
    return list.filter((m) => normalizeSearch(m.name).includes(term));
  });

  /**
   * Papeletas efectivas con preview: refleja el candidato seleccionado actualmente
   * por el usuario antes de confirmar el voto.
   */
  readonly previewBallots = computed<Record<string, string>>(() => {
    const ballots = { ...this.election().ballots };
    const myId = this.currentUserId() ?? '__preview_user__';
    const selected = this.selectedCandidateId();
    if (selected) {
      ballots[myId] = selected;
    } else {
      delete ballots[myId];
    }
    return ballots;
  });

  readonly voteCounts = computed<Record<string, number>>(() => {
    const ballots = this.previewBallots();
    const counts: Record<string, number> = {};
    for (const vId of Object.keys(ballots)) {
      const candId = ballots[vId];
      counts[candId] = (counts[candId] ?? 0) + 1;
    }
    return counts;
  });

  readonly maxVotes = computed(() => {
    const counts = this.voteCounts();
    let max = 0;
    for (const id of Object.keys(counts)) {
      if (counts[id] > max) max = counts[id];
    }
    return max;
  });

  /**
   * Cuántos han votado DE VERDAD: cuenta solo las papeletas confirmadas, nunca la selección
   * en curso. Las barras de cada fila sí muestran la selección como anticipo —es el único
   * momento en que se puede ver la animación, porque confirmar cierra el modal—, pero el pie
   * es un dato de participación y no puede decir que alguien ha votado cuando todavía no lo ha
   * hecho: pulsar «Cancelar» dejaría el recuento desmentido.
   */
  readonly totalVoted = computed(() => Object.keys(this.election().ballots).length);
  readonly totalMembers = computed(() => this.members().length);

  readonly isExpired = computed(() => this.election().closesAt <= this.now());

  readonly introText = computed(() => {
    const diff = this.election().closesAt - this.now();
    let timeText = 'La votación ha terminado.';
    if (diff > 0) {
      if (diff < 60 * 1000) {
        timeText = 'Queda menos de un minuto.';
      } else if (diff < 60 * 60 * 1000) {
        const mins = Math.floor(diff / (60 * 1000));
        timeText = `Quedan ${mins} min.`;
      } else {
        const hours = Math.floor(diff / (3600 * 1000));
        const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
        timeText = `Quedan ${hours} h ${mins.toString().padStart(2, '0')} min.`;
      }
    }
    return `Vota a quien creas que va a ser justo. Puede ser cualquier miembro del grupo. ${timeText}`;
  });

  constructor() {
    const timer = setInterval(() => {
      this.now.set(Date.now());
    }, 60 * 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  votesFor(userId: string): number {
    return this.voteCounts()[userId] ?? 0;
  }

  barPercentFor(userId: string): number {
    const max = this.maxVotes();
    if (max <= 0) return 0;
    const count = this.votesFor(userId);
    return Math.min(100, Math.max(0, Math.round((count / max) * 100)));
  }

  selectCandidate(userId: string): void {
    this.selectedCandidateId.set(userId);
  }

  confirm(): void {
    const selected = this.selectedCandidateId();
    if (selected && !this.isExpired()) {
      this.voteConfirmed.emit(selected);
    }
  }
}
