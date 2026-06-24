import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

/**
 * Lightweight transient-notification store. Components inject this and call
 * `success`/`error`/`info` (or `show`) to push a toast; the host component
 * (`<nf-toast-host>`) renders the stack and each toast auto-dismisses.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  /** Push a toast; it auto-dismisses after `durationMs`. */
  show(message: string, variant: ToastVariant = 'info', durationMs = 3400): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, message, variant }]);
    setTimeout(() => this.dismiss(id), durationMs);
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

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
