import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Viewport } from './viewport';

/** Un `MediaQueryList` de mentira con el gancho para disparar el cambio a mano. */
function stubMatchMedia(initial: Record<string, boolean>) {
  const listeners = new Map<string, (e: { matches: boolean }) => void>();

  const impl = vi.fn((query: string) => ({
    matches: initial[query] ?? false,
    media: query,
    addEventListener: (_: string, cb: (e: { matches: boolean }) => void) =>
      listeners.set(query, cb),
    removeEventListener: () => listeners.delete(query),
  }));

  Object.defineProperty(window, 'matchMedia', { value: impl, configurable: true, writable: true });

  return {
    emit(query: string, matches: boolean) {
      listeners.get(query)?.({ matches });
    },
  };
}

const MOBILE = '(max-width: 760px)';
const NARROW = '(max-width: 420px)';

describe('Viewport', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.unstubAllGlobals();
  });

  it('arranca con el valor que ya tiene la consulta, sin esperar a un evento', () => {
    stubMatchMedia({ [MOBILE]: true, [NARROW]: false });

    const vp = TestBed.inject(Viewport);

    // Importa que sea síncrono: si `isMobile` empezara en false y se corrigiera después,
    // la primera pintada saldría con el layout de escritorio y saltaría al de móvil.
    expect(vp.isMobile()).toBe(true);
    expect(vp.isNarrow()).toBe(false);
  });

  it('sigue los cambios de ancho de cada consulta por separado', () => {
    const mq = stubMatchMedia({ [MOBILE]: false, [NARROW]: false });

    const vp = TestBed.inject(Viewport);
    expect(vp.isMobile()).toBe(false);

    mq.emit(MOBILE, true);
    expect(vp.isMobile()).toBe(true);
    expect(vp.isNarrow()).toBe(false);

    mq.emit(NARROW, true);
    expect(vp.isNarrow()).toBe(true);
  });

  it('sin `matchMedia` se queda en escritorio en vez de romper', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const vp = TestBed.inject(Viewport);

    expect(vp.isMobile()).toBe(false);
    expect(vp.isNarrow()).toBe(false);
  });
});
