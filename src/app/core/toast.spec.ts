import '@angular/compiler';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast';

/** Debe coincidir con EXIT_MS de `toast.ts`. */
const EXIT_MS = 240;

describe('ToastService', () => {
  let toasts: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    toasts = new ToastService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('encola el toast con su variante y duración', () => {
    toasts.success('Grupo creado');

    expect(toasts.toasts()).toHaveLength(1);
    expect(toasts.toasts()[0]).toMatchObject({
      message: 'Grupo creado',
      variant: 'success',
      leaving: false,
    });
  });

  it('cierra en dos fases: primero anima, luego retira', () => {
    toasts.show('Hola', 'info', 1000);

    vi.advanceTimersByTime(1000);
    expect(toasts.toasts()[0].leaving).toBe(true);

    vi.advanceTimersByTime(EXIT_MS);
    expect(toasts.toasts()).toHaveLength(0);
  });

  it('no reinicia la salida si se cierra dos veces', () => {
    toasts.show('Hola', 'info', 1000);
    const id = toasts.toasts()[0].id;

    toasts.dismiss(id);
    vi.advanceTimersByTime(EXIT_MS - 20);
    toasts.dismiss(id); // el segundo dismiss debe ser un no-op
    vi.advanceTimersByTime(20);

    expect(toasts.toasts()).toHaveLength(0);
  });

  it('pausa la cuenta atrás y la reanuda con el tiempo que quedaba', () => {
    toasts.show('Hola', 'info', 1000);

    vi.advanceTimersByTime(600);
    toasts.pause();
    expect(toasts.paused()).toBe(true);

    // Con la pila pausada el tiempo no corre, por mucho que pase.
    vi.advanceTimersByTime(10_000);
    expect(toasts.toasts()[0].leaving).toBe(false);

    toasts.resume();
    vi.advanceTimersByTime(399);
    expect(toasts.toasts()[0].leaving).toBe(false);

    vi.advanceTimersByTime(1);
    expect(toasts.toasts()[0].leaving).toBe(true);
  });

  it('un toast encolado durante la pausa tampoco cuenta hasta reanudar', () => {
    toasts.pause();
    toasts.show('Hola', 'info', 1000);

    vi.advanceTimersByTime(5000);
    expect(toasts.toasts()[0].leaving).toBe(false);

    toasts.resume();
    vi.advanceTimersByTime(1000);
    expect(toasts.toasts()[0].leaving).toBe(true);
  });

  it('pause/resume repetidos no descuentan tiempo de más', () => {
    toasts.show('Hola', 'info', 1000);

    for (let i = 0; i < 5; i++) {
      toasts.pause();
      toasts.pause();
      toasts.resume();
      toasts.resume();
    }

    vi.advanceTimersByTime(999);
    expect(toasts.toasts()[0].leaving).toBe(false);
    vi.advanceTimersByTime(1);
    expect(toasts.toasts()[0].leaving).toBe(true);
  });

  it('se despausa sola al vaciarse la pila', () => {
    // El puntero encima cuando desaparece el último toast: `pointerout` no llega
    // nunca, así que la pila no puede quedarse pausada.
    toasts.show('Hola', 'info', 1000);
    toasts.pause();
    toasts.dismiss(toasts.toasts()[0].id);
    vi.advanceTimersByTime(EXIT_MS);

    expect(toasts.toasts()).toHaveLength(0);
    expect(toasts.paused()).toBe(false);

    // Y el siguiente toast cuenta desde el primer momento.
    toasts.show('Otro', 'info', 1000);
    vi.advanceTimersByTime(1000);
    expect(toasts.toasts()[0].leaving).toBe(true);
  });

  it('con la pila llena despide al más antiguo', () => {
    for (let i = 1; i <= 5; i++) toasts.info(`Mensaje ${i}`);

    const alive = toasts.toasts().filter((t) => !t.leaving);
    expect(alive).toHaveLength(4);
    expect(alive[0].message).toBe('Mensaje 2');
    expect(toasts.toasts().find((t) => t.message === 'Mensaje 1')?.leaving).toBe(true);
  });

  it('clear() vacía la pila y cancela los temporizadores', () => {
    toasts.info('Uno');
    toasts.info('Dos');

    toasts.clear();
    expect(toasts.toasts()).toHaveLength(0);

    // Sin temporizadores huérfanos: nada reaparece ni revive.
    vi.advanceTimersByTime(10_000);
    expect(toasts.toasts()).toHaveLength(0);
  });
});
