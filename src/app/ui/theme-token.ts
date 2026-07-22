import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Tema visual activo, visto desde el UI kit.
 *
 * `ui/` no puede importar de `core/` (regla de capas), pero un primitivo sí
 * necesita saber si estamos en un tema de "escritorio retro" para decidir si
 * pinta cromo de ventana. La dependencia se invierte con este token: `ui/`
 * declara qué necesita y `app.config.ts` lo cablea a `ThemeService`.
 *
 * El default (`'nexus'`) hace que los primitivos funcionen aislados —tests,
 * storybook— sin proveer nada.
 */
export const NF_THEME = new InjectionToken<Signal<string>>('NF_THEME', {
  providedIn: 'root',
  factory: () => signal('nexus').asReadonly(),
});
