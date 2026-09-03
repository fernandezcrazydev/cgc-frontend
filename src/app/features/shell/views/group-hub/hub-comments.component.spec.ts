import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubCommentsComponent } from './hub-comments.component';
import { HubComment } from '../../../../core/group-hub';

const COMMENTS: HubComment[] = [
  {
    id: 'c1',
    author: 'EduUC',
    hue: 200,
    matchId: 'seed-042',
    matchLabel: 'Partida 42',
    text: 'Primero',
    reactions: [{ emoji: '🔥', count: 3 }],
  },
  {
    id: 'c2',
    author: 'Adri',
    hue: 20,
    matchId: 'seed-043',
    matchLabel: 'Partida 43',
    text: 'Segundo',
    reactions: [],
  },
];

describe('HubCommentsComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createComponent(comments: HubComment[] = COMMENTS) {
    const fixture = TestBed.createComponent(HubCommentsComponent);
    fixture.componentRef.setInput('comments', comments);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('empieza en el primer comentario y con la barra de vida llena', () => {
    const { component } = createComponent();

    expect(component.index()).toBe(0);
    expect(component.percent()).toBe(100);
  });

  it('vacía la barra de vida conforme pasa el tiempo', () => {
    const { component } = createComponent();

    vi.advanceTimersByTime(HubCommentsComponent.TTL / 2);

    expect(component.percent()).toBeLessThan(60);
    expect(component.percent()).toBeGreaterThan(40);
    expect(component.index()).toBe(0);
  });

  it('pasa al siguiente comentario cuando la barra se agota', () => {
    const { component } = createComponent();

    vi.advanceTimersByTime(HubCommentsComponent.TTL);

    expect(component.index()).toBe(1);
    expect(component.percent()).toBe(100);
  });

  it('vuelve al primero al terminar la vuelta', () => {
    const { component } = createComponent();

    vi.advanceTimersByTime(HubCommentsComponent.TTL * 2);

    expect(component.index()).toBe(0);
  });

  it('detiene la barra y le devuelve todo su tiempo al pasar el cursor', () => {
    const { component } = createComponent();

    vi.advanceTimersByTime(HubCommentsComponent.TTL * 0.8);
    component.pause();

    expect(component.paused()).toBe(true);
    expect(component.percent()).toBe(100);

    // En pausa el tiempo no corre: el comentario no se cambia debajo de quien lo está leyendo.
    vi.advanceTimersByTime(HubCommentsComponent.TTL * 2);
    expect(component.index()).toBe(0);
    expect(component.percent()).toBe(100);
  });

  it('reanuda con el tiempo entero al retirar el cursor', () => {
    const { component } = createComponent();

    component.pause();
    component.resume();
    vi.advanceTimersByTime(HubCommentsComponent.TTL * 0.9);

    expect(component.paused()).toBe(false);
    expect(component.index()).toBe(0);

    vi.advanceTimersByTime(HubCommentsComponent.TTL * 0.2);
    expect(component.index()).toBe(1);
  });

  it('no rota con un solo comentario', () => {
    const { component } = createComponent([COMMENTS[0]]);

    vi.advanceTimersByTime(HubCommentsComponent.TTL * 3);

    expect(component.index()).toBe(0);
  });
  it('marca la reacción propia y la suma al recuento', () => {
    const { component } = createComponent();

    component.toggle('c1', '🔥');

    const fuego = component.reactions().find((r) => r.emoji === '🔥');
    expect(fuego).toEqual({ emoji: '🔥', count: 4, mine: true });
  });

  it('quita la reacción al volver a pulsarla', () => {
    const { component } = createComponent();

    component.toggle('c1', '🔥');
    component.toggle('c1', '🔥');

    expect(component.reactions().find((r) => r.emoji === '🔥')).toEqual({
      emoji: '🔥',
      count: 3,
      mine: false,
    });
    expect(component.myReaction('c1')).toBeNull();
  });

  it('sustituye la reacción anterior: una persona reacciona una vez a cada frase', () => {
    const { component } = createComponent();

    component.toggle('c1', '🔥');
    component.toggle('c1', '👑');

    expect(component.myReaction('c1')).toBe('👑');
    expect(component.reactions().filter((r) => r.mine).map((r) => r.emoji)).toEqual(['👑']);
  });

  it('añade un emoji que nadie había usado al final de la fila', () => {
    const { component } = createComponent();

    component.toggle('c1', '🫡');

    const nueva = component.reactions().at(-1);
    expect(nueva).toEqual({ emoji: '🫡', count: 1, mine: true });
  });
});
