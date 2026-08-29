import { Injectable, WritableSignal, signal } from '@angular/core';

/**
 * Los mismos escalones que `views.scss` (`$bp-mobile`, `$bp-narrow`).
 *
 * Están aquí y no como números sueltos en cada vista porque el CSS y el markup tienen que
 * cambiar en el MISMO píxel: si una media query dice 760 y un `@if` dice 768, entre medias
 * se pinta un DOM móvil vestido de escritorio (o al revés) y nadie sabe por qué.
 */
const MOBILE_QUERY = '(max-width: 760px)';
const NARROW_QUERY = '(max-width: 420px)';

/**
 * Ancho de la ventana, como signals.
 *
 * Es estado de UI puro, no de dominio, así que vive en `shared/` y no en un store de
 * `core/` (regla de oro 5). Se usa para las decisiones que NO se pueden tomar solo con
 * CSS: mover un control de sitio, cambiar el elemento que lleva `role="button"`, sacar
 * los filtros a un panel inferior.
 *
 * Cuando basta con CSS, se usa CSS: una media query no obliga a recalcular el árbol de
 * componentes ni deja el layout a merced de cuándo se resuelve la señal.
 */
@Injectable({ providedIn: 'root' })
export class Viewport {
  private readonly mobile = signal(false);
  private readonly narrow = signal(false);

  /** Móvil: el mismo umbral con el que el shell cambia a barra inferior. */
  readonly isMobile = this.mobile.asReadonly();
  /** Móvil estrecho (≈360px y por debajo): ajustes finos de densidad. */
  readonly isNarrow = this.narrow.asReadonly();

  constructor() {
    // El servicio es de raíz y vive lo que la aplicación, así que no hay nada que
    // desuscribir: quitar el listener solo tendría sentido si pudiera destruirse.
    this.bind(MOBILE_QUERY, this.mobile);
    this.bind(NARROW_QUERY, this.narrow);
  }

  private bind(query: string, target: WritableSignal<boolean>): void {
    // `matchMedia` no existe en el jsdom de algunos tests ni en un render de servidor:
    // sin él la app se queda en el layout de escritorio, que es el valor por defecto.
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    target.set(mq.matches);
    mq.addEventListener('change', (e) => target.set(e.matches));
  }
}
