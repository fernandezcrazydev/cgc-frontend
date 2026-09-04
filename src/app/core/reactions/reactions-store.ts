import { Injectable, signal } from '@angular/core';

/** Una reacción tal y como se pinta: el emoji, cuánta gente lo ha puesto y si tú eres una de ellas. */
export interface ReactionTally {
  emoji: string;
  count: number;
  mine: boolean;
}

/** Estado interno de un objetivo (un comentario, un jugador de una partida…). */
interface TargetState {
  /** emoji → recuento ajeno + el orden en que apareció por primera vez. */
  readonly counts: Record<string, { count: number; seq: number }>;
  /** El emoji con el que ha reaccionado quien mira, o `null`. */
  mine: string | null;
  /** Siguiente número de orden, para desempatar por antigüedad. */
  seq: number;
}

/**
 * Emojis que se ofrecen cuando un grupo todavía no ha reaccionado a nada.
 *
 * Son la excepción a «cero emojis» que aprueba §5.5.4: en las reacciones el emoji ES el
 * contenido, no un adorno.
 */
export const DEFAULT_REACTIONS = ['🔥', '💀', '👑', '🤡', '😂', '🫡', '🧊'] as const;

/**
 * Reacciones con emoji del grupo: sobre los comentarios del muro y sobre los jugadores de una
 * partida.
 *
 * PLACEHOLDER: hoy vive en memoria, así que se pierde al recargar. La forma del estado sí es la
 * definitiva —recuento por emoji, tu voto, y el orden de aparición para desempatar—, para que la
 * interfaz no cambie al conectar el backend.
 *
 * BACKEND NOTE: al migrar, `POST` y `DELETE /reactions/{targetType}/{targetId}` devuelven el
 * recuento ya resuelto, y los más usados del grupo salen de `GET /groups/{id}/reactions/top`.
 * Una persona reacciona UNA vez a cada cosa: el servidor sustituye su reacción anterior.
 */
@Injectable({ providedIn: 'root' })
export class ReactionsStore {
  private readonly state = signal<Record<string, TargetState>>({});

  private key(scope: string, targetId: string): string {
    return scope + '|' + targetId;
  }

  /**
   * Carga las reacciones que ya traía el objetivo. Idempotente: volver a entrar en la vista no
   * duplica los recuentos ni borra lo que hayas votado en esta sesión.
   */
  seed(scope: string, targetId: string, reactions: readonly { emoji: string; count: number }[]): void {
    const key = this.key(scope, targetId);
    if (this.state()[key]) return;
    const counts: TargetState['counts'] = {};
    reactions.forEach((r, i) => {
      counts[r.emoji] = { count: r.count, seq: i };
    });
    this.state.update((all) => ({
      ...all,
      [key]: { counts, mine: null, seq: reactions.length },
    }));
  }

  /**
   * Pone, cambia o quita tu reacción. Pulsar la que ya tenías la retira; pulsar otra la
   * sustituye, porque una persona reacciona una vez a cada cosa.
   */
  toggle(scope: string, targetId: string, emoji: string): void {
    const key = this.key(scope, targetId);
    this.state.update((all) => {
      const current = all[key] ?? { counts: {}, mine: null, seq: 0 };
      const counts = { ...current.counts };
      let seq = current.seq;
      if (!counts[emoji]) {
        counts[emoji] = { count: 0, seq: seq++ };
      }
      return {
        ...all,
        [key]: { counts, mine: current.mine === emoji ? null : emoji, seq },
      };
    });
  }

  /** El emoji con el que has reaccionado a este objetivo, o `null`. */
  mine(scope: string, targetId: string): string | null {
    return this.state()[this.key(scope, targetId)]?.mine ?? null;
  }

  /**
   * Las reacciones del objetivo, de la más repetida a la menos y, a igual recuento, por el orden
   * en que se pusieron. Tu voto ya viene sumado.
   */
  tally(scope: string, targetId: string): ReactionTally[] {
    const target = this.state()[this.key(scope, targetId)];
    if (!target) return [];
    const mine = target.mine;
    const rows = Object.entries(target.counts).map(([emoji, { count, seq }]) => ({
      emoji,
      count: count + (mine === emoji ? 1 : 0),
      mine: mine === emoji,
      seq,
    }));
    return rows
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count || a.seq - b.seq)
      .map(({ emoji, count, mine: isMine }) => ({ emoji, count, mine: isMine }));
  }

  /**
   * Los emojis que más usa este grupo, para encabezar el selector. Mientras nadie haya reaccionado
   * —o si no llegan a `limit`— se completan con los de siempre, para que el selector nunca salga
   * medio vacío.
   */
  mostUsed(scope: string, limit = DEFAULT_REACTIONS.length): string[] {
    const totals = new Map<string, { count: number; seq: number }>();
    const prefix = scope + '|';
    for (const [key, target] of Object.entries(this.state())) {
      if (!key.startsWith(prefix)) continue;
      for (const [emoji, { count, seq }] of Object.entries(target.counts)) {
        const total = count + (target.mine === emoji ? 1 : 0);
        if (total <= 0) continue;
        const acc = totals.get(emoji);
        if (acc) {
          acc.count += total;
          acc.seq = Math.min(acc.seq, seq);
        } else {
          totals.set(emoji, { count: total, seq });
        }
      }
    }

    const used = [...totals.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[1].seq - b[1].seq)
      .map(([emoji]) => emoji);

    const out = [...used];
    for (const emoji of DEFAULT_REACTIONS) {
      if (out.length >= limit) break;
      if (!out.includes(emoji)) out.push(emoji);
    }
    return out.slice(0, limit);
  }

  /** Al cerrar sesión no debe quedar rastro de lo que votó el usuario anterior. */
  clear(): void {
    this.state.set({});
  }
}
