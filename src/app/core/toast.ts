import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Vida útil total en ms; el host la usa para sincronizar la barra de progreso. */
  durationMs: number;
  /** Marcado para cerrarse: sigue en la lista mientras dura la animación de salida. */
  leaving: boolean;
}

/** Debe coincidir con la duración de la transición de salida de `nf-toast.scss`. */
const EXIT_MS = 240;

/** Toasts vivos a la vez: por encima, el más antiguo se retira antes de tiempo. */
const MAX_STACK = 4;

interface Countdown {
  /** ms que le quedan de vida (se descuenta al pausar). */
  remaining: number;
  /** timestamp del último arranque, para calcular lo consumido al pausar. */
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

/**
 * Store de notificaciones transitorias. Los componentes inyectan este servicio y
 * llaman a `success`/`error`/`info` (o `show`); el host (`<nf-toast-host>`) pinta
 * la pila y cada toast se cierra solo.
 *
 * El cierre es en dos fases: `dismiss()` marca el toast como `leaving` (el host lo
 * anima) y solo pasado `EXIT_MS` sale de la lista. La cuenta atrás se pausa mientras
 * el puntero o el foco están sobre la pila, para que un mensaje no se escape mientras
 * se está leyendo.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly _paused = signal(false);
  /** Cierto mientras el usuario tiene el puntero/foco sobre la pila. */
  readonly paused = this._paused.asReadonly();

  private readonly countdowns = new Map<number, Countdown>();
  private nextId = 1;

  /** Encola un toast; se cierra solo pasados `durationMs` de tiempo no pausado. */
  show(message: string, variant: ToastVariant = 'info', durationMs = 4200): void {
    const id = this.nextId++;
    this._toasts.update((list) => [...list, { id, message, variant, durationMs, leaving: false }]);

    this.countdowns.set(id, { remaining: durationMs, startedAt: Date.now(), handle: null });
    if (!this._paused()) this.startCountdown(id);

    this.trimStack();
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  /** Inicia el cierre: anima la salida y retira el toast al terminar. */
  dismiss(id: number): void {
    const toast = this._toasts().find((t) => t.id === id);
    if (!toast || toast.leaving) return;

    this.stopCountdown(id);
    this.countdowns.delete(id);
    this._toasts.update((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => this.remove(id), EXIT_MS);
  }

  /** Congela la cuenta atrás de toda la pila (puntero o foco encima). */
  pause(): void {
    if (this._paused()) return;
    this._paused.set(true);
    for (const id of this.countdowns.keys()) this.stopCountdown(id);
  }

  /** Reanuda la cuenta atrás con el tiempo que le quedaba a cada toast. */
  resume(): void {
    if (!this._paused()) return;
    this._paused.set(false);
    for (const id of this.countdowns.keys()) this.startCountdown(id);
  }

  /** Vacía la pila sin animación (cambios de sesión, logout). */
  clear(): void {
    for (const id of this.countdowns.keys()) this.stopCountdown(id);
    this.countdowns.clear();
    this._toasts.set([]);
  }

  private remove(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
    // Red de seguridad: si el último toast se fue bajo el puntero, `pointerout` no
    // llega nunca y la pila se quedaría pausada para siempre. Sin toasts, no hay
    // nada que pausar.
    if (this._toasts().length === 0) this.resume();
  }

  /** Con la pila llena, el más antiguo se despide para dejar sitio al nuevo. */
  private trimStack(): void {
    const alive = this._toasts().filter((t) => !t.leaving);
    // Ojo: `slice` con un índice negativo cuenta desde el final; hay que acotarlo a 0.
    const excess = Math.max(0, alive.length - MAX_STACK);
    for (const toast of alive.slice(0, excess)) this.dismiss(toast.id);
  }

  private startCountdown(id: number): void {
    const countdown = this.countdowns.get(id);
    if (!countdown || countdown.handle !== null) return;
    countdown.startedAt = Date.now();
    countdown.handle = setTimeout(() => this.dismiss(id), countdown.remaining);
  }

  private stopCountdown(id: number): void {
    const countdown = this.countdowns.get(id);
    if (!countdown || countdown.handle === null) return;
    clearTimeout(countdown.handle);
    countdown.handle = null;
    countdown.remaining = Math.max(0, countdown.remaining - (Date.now() - countdown.startedAt));
  }
}
