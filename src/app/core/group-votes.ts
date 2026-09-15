/**
 * Votaciones abiertas del grupo — PLACEHOLDER DESECHABLE.
 *
 * Todo lo de aquí es maqueta en memoria y estado local con signals, para que el modal
 * de liga pueda proponer el cierre o cambio de nombre de una temporada y la ficha hermana
 * (F5.5-23b) pueda consumir las votaciones en curso en el hub y la campana.
 *
 * BACKEND NOTE: al migrar, las votaciones se gestionan con:
 *   - `GET /groups/{id}/votes`         → lista de votaciones activas
 *   - `POST /groups/{id}/votes`        → abrir nueva votación
 *   - `POST /groups/{id}/votes/{id}/cast` → votar a favor o en contra
 */
import { Injectable, Signal, computed, signal } from '@angular/core';
import { hash, seeded } from './group-ranking';

export type GroupVoteKind = 'SEASON_CLOSE' | 'SEASON_RENAME';

export interface GroupMemberLite {
  userId: string;
  name: string;
}

export interface RefereeElection {
  /** Id estable: `referee-${groupId}`. Lo consulta también la campana. */
  id: string;
  /** Cuándo se cierra, epoch ms. Siempre 24 h después de abrirse. */
  closesAt: number;
  /** Una papeleta por votante: userId del votante → userId del candidato. */
  ballots: Record<string, string>;
}

export interface GroupVote {
  id: string;
  kind: GroupVoteKind;
  /** Quién la propuso, tal como se pinta: 'Adri'. */
  proposedBy: string;
  /** Rol de quien la propuso: 'admin' | 'propietario'. */
  proposedByRole: string;
  /** 'Competitivo' | 'Equilibrado' | 'Caos'. */
  leagueLabel: string;
  /** Nombre de la temporada afectada. */
  seasonName: string;
  /** Solo en 'SEASON_RENAME': el nombre propuesto. */
  proposedName: string | null;
  /** Lo que escribió quien la propuso. */
  reason: string;
  /** Cuándo se cierra, en epoch ms. Siempre 24 h después de abrirse. */
  closesAt: number;
  /** userId de cada miembro que ya ha votado a favor. */
  inFavor: string[];
  /** userId de cada miembro que ha votado en contra. */
  against: string[];
}

@Injectable({ providedIn: 'root' })
export class GroupVotesStore {
  private readonly votesByGroup = signal<Record<string, GroupVote[]>>({});
  private readonly refereeElectionsByGroup = signal<Record<string, RefereeElection>>({});

  /** Las votaciones abiertas del grupo, la más reciente primero. Señal derivada. */
  votesFor(groupId: string, members: readonly GroupMemberLite[] = []): Signal<GroupVote[]> {
    return computed(() => {
      const stored = this.votesByGroup()[groupId];
      if (stored !== undefined) {
        return stored;
      }
      return [];
    });
  }

  /**
   * Votación de árbitro del grupo — PLACEHOLDER DESECHABLE.
   *
   * BACKEND NOTE: al migrar, las votaciones se gestionan con:
   *   - `GET /groups/{id}/votes`              → lista de votaciones activas
   *   - `POST /groups/{id}/votes/{voteId}/cast` → votar a un candidato
   * Este bloque y su siembra determinista se borran enteros al migrar.
   */
  refereeElectionFor(
    groupId: string,
    members: readonly GroupMemberLite[] = [],
    currentUserId: string | null = null,
  ): Signal<RefereeElection | null> {
    return computed(() => {
      if (!groupId) return null;
      const stored = this.refereeElectionsByGroup()[groupId];
      if (stored !== undefined) {
        return stored;
      }
      return this.seedRefereeElection(groupId, members, currentUserId);
    });
  }

  /** Registra el voto de árbitro. Idempotente: votar dos veces sustituye la papeleta. */
  castRefereeVote(
    groupId: string,
    voterUserId: string,
    candidateUserId: string,
    members: readonly GroupMemberLite[] = [],
    currentUserId: string | null = null,
  ): void {
    this.refereeElectionsByGroup.update((all) => {
      const current = all[groupId] ?? this.seedRefereeElection(groupId, members, currentUserId);
      return {
        ...all,
        [groupId]: {
          ...current,
          ballots: {
            ...current.ballots,
            [voterUserId]: candidateUserId,
          },
        },
      };
    });
  }

  private seedRefereeElection(
    groupId: string,
    members: readonly GroupMemberLite[] = [],
    currentUserId: string | null = null,
  ): RefereeElection {
    const rnd = seeded(hash(groupId + '::referee-election'));
    const closesAt = Date.now() + (4 + Math.floor(rnd() * 19)) * 3600_000;
    const ballots: Record<string, string> = {};

    if (members.length > 0) {
      for (const m of members) {
        if (currentUserId && m.userId === currentUserId) {
          continue;
        }
        const mRnd = seeded(hash(groupId + '::referee-ballot::' + m.userId));
        if (mRnd() < 0.65) {
          const biased = mRnd() < 0.6;
          const pool = biased ? members.slice(0, Math.min(4, members.length)) : members;
          const target = pool[Math.floor(mRnd() * pool.length)];
          if (target) {
            ballots[m.userId] = target.userId;
          }
        }
      }
    }

    return {
      id: `referee-${groupId}`,
      closesAt,
      ballots,
    };
  }

  /** Registra una propuesta nueva. Vive en memoria: se pierde al recargar, y es correcto. */
  open(
    groupId: string,
    vote: Omit<GroupVote, 'id' | 'closesAt' | 'inFavor' | 'against'>,
    members: readonly GroupMemberLite[] = [],
  ): void {
    const now = Date.now();
    const voteId = `vote-${groupId}-${now}`;

    const inFavor: string[] = [];
    const against: string[] = [];

    if (members.length > 0) {
      for (const m of members) {
        const rnd = seeded(hash(groupId + '::vote::' + voteId + '::' + m.userId));
        if (rnd() < 0.7) {
          inFavor.push(m.userId);
        }
      }
    }

    const newVote: GroupVote = {
      ...vote,
      id: voteId,
      closesAt: now + 24 * 60 * 60 * 1000,
      inFavor,
      against,
    };

    this.votesByGroup.update((all) => {
      const current = all[groupId] ?? [];
      return {
        ...all,
        [groupId]: [newVote, ...current],
      };
    });
  }

  /** Registra el voto de alguien. Idempotente: votar dos veces lo mismo no acumula. */
  cast(groupId: string, voteId: string, userId: string, inFavor: boolean): void {
    this.votesByGroup.update((all) => {
      const current = all[groupId] ?? [];
      const updated = current.map((v) => {
        if (v.id !== voteId) return v;
        const newInFavor = v.inFavor.filter((id) => id !== userId);
        const newAgainst = v.against.filter((id) => id !== userId);
        if (inFavor) {
          newInFavor.push(userId);
        } else {
          newAgainst.push(userId);
        }
        return {
          ...v,
          inFavor: newInFavor,
          against: newAgainst,
        };
      });
      return {
        ...all,
        [groupId]: updated,
      };
    });
  }

  /** Si esa persona ya votó esa propuesta, en cualquier sentido. Lo consulta la campana. */
  hasVoted(groupId: string, voteId: string, userId: string): boolean {
    if (voteId === `referee-${groupId}` || voteId.startsWith('referee-')) {
      const election = this.refereeElectionsByGroup()[groupId];
      if (election) {
        return election.ballots[userId] !== undefined;
      }
      return false;
    }
    const list = this.votesByGroup()[groupId] ?? [];
    const vote = list.find((v) => v.id === voteId);
    if (!vote) return false;
    return vote.inFavor.includes(userId) || vote.against.includes(userId);
  }
}
