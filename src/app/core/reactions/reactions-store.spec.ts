import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_REACTIONS, ReactionsStore } from './reactions-store';

describe('ReactionsStore', () => {
  let store: ReactionsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ReactionsStore] });
    store = TestBed.inject(ReactionsStore);
  });

  it('ordena por recuento y, a igualdad, por el orden en que se pusieron', () => {
    store.seed('grp', 'jugador-1', [
      { emoji: '🔥', count: 2 },
      { emoji: '💀', count: 5 },
      { emoji: '👑', count: 2 },
    ]);

    expect(store.tally('grp', 'jugador-1').map((r) => r.emoji)).toEqual(['💀', '🔥', '👑']);
  });

  it('suma tu voto al recuento y lo marca como tuyo', () => {
    store.seed('grp', 'jugador-1', [{ emoji: '🔥', count: 2 }]);

    store.toggle('grp', 'jugador-1', '🔥');

    expect(store.tally('grp', 'jugador-1')[0]).toEqual({ emoji: '🔥', count: 3, mine: true });
    expect(store.mine('grp', 'jugador-1')).toBe('🔥');
  });

  it('quita tu reacción al volver a pulsarla', () => {
    store.seed('grp', 'jugador-1', [{ emoji: '🔥', count: 2 }]);
    store.toggle('grp', 'jugador-1', '🔥');

    store.toggle('grp', 'jugador-1', '🔥');

    expect(store.tally('grp', 'jugador-1')[0]).toEqual({ emoji: '🔥', count: 2, mine: false });
    expect(store.mine('grp', 'jugador-1')).toBeNull();
  });

  it('sustituye la anterior: una persona reacciona una vez a cada cosa', () => {
    store.toggle('grp', 'jugador-1', '🔥');
    store.toggle('grp', 'jugador-1', '👑');

    const tally = store.tally('grp', 'jugador-1');
    expect(tally.filter((r) => r.mine).map((r) => r.emoji)).toEqual(['👑']);
    // La que soltaste se queda a cero y desaparece de la fila.
    expect(tally.map((r) => r.emoji)).toEqual(['👑']);
  });

  it('no duplica lo ya sembrado al volver a entrar en la vista', () => {
    store.seed('grp', 'jugador-1', [{ emoji: '🔥', count: 2 }]);
    store.seed('grp', 'jugador-1', [{ emoji: '🔥', count: 2 }]);

    expect(store.tally('grp', 'jugador-1')[0].count).toBe(2);
  });

  it('ofrece los emojis de siempre mientras el grupo no haya reaccionado a nada', () => {
    expect(store.mostUsed('grp')).toEqual([...DEFAULT_REACTIONS]);
  });

  it('encabeza los más usados del grupo y completa con los de siempre', () => {
    store.seed('grp', 'comentario-1', [{ emoji: '🐐', count: 9 }]);
    store.seed('grp', 'comentario-2', [{ emoji: '🧠', count: 4 }]);
    // De otro grupo: no debe colarse en el recuento.
    store.seed('otro-grupo', 'comentario-3', [{ emoji: '🍿', count: 99 }]);

    const masUsados = store.mostUsed('grp');

    expect(masUsados[0]).toBe('🐐');
    expect(masUsados[1]).toBe('🧠');
    expect(masUsados).not.toContain('🍿');
    expect(masUsados).toHaveLength(DEFAULT_REACTIONS.length);
  });
});
