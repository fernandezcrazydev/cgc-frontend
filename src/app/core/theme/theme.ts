import { Injectable, effect, signal } from '@angular/core';

/**
 * Temas visuales disponibles. Son SKINS puras: solo cambian valores de tokens
 * `--nf-*` bajo `:root[data-theme="…"]`. No tocan markup, componentes ni
 * lógica de dominio, y no hay excepciones a esa regla.
 *
 *  - `nocturne` → el look por defecto: oscuro minimalista, tipografía del
 *                 sistema. Vive en `styles/tokens/`, sin atributo `data-theme`.
 *  - `original` → el look de la app legacy (cristal índigo/fucsia sobre azul
 *                 noche), en `styles/themes/original.css`.
 */
export type ThemeId = 'nocturne' | 'original';

export const THEMES: readonly { id: ThemeId; label: string; description: string }[] = [
  { id: 'nocturne', label: 'Nocturne', description: 'Oscuro minimalista, tipografía del sistema.' },
  { id: 'original', label: 'Original', description: 'El estilo de la primera versión: cristal índigo y fucsia.' },
];

const DEFAULT_THEME: ThemeId = 'nocturne';
const STORAGE_KEY = 'cgc-theme';

function isTheme(v: unknown): v is ThemeId {
  return THEMES.some((t) => t.id === v);
}

/** Lee la preferencia guardada; si no hay o es basura, cae al tema por defecto. */
function readStored(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isTheme(v) ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Estado del tema activo. Es estado de UI, no de dominio: vive aquí (no en un
 * store de `core/<dominio>`) y se refleja en `<html data-theme>` para que el CSS
 * de `styles/themes/` haga todo el reskin.
 *
 * El atributo inicial lo pone un script inline en index.html (evita el flash de
 * tema al arrancar); este servicio lo mantiene sincronizado a partir de ahí.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<ThemeId>(readStored());

  /** Tema activo. Las vistas lo leen; solo `set()` lo cambia. */
  readonly theme = this._theme.asReadonly();

  constructor() {
    // Refleja el tema al DOM y lo persiste. El tema por defecto no lleva
    // atributo (así `:root` a secas ya es nocturne y el CSS base no se duplica).
    effect(() => {
      const t = this._theme();
      const root = document.documentElement;
      if (t === DEFAULT_THEME) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', t);
      try {
        localStorage.setItem(STORAGE_KEY, t);
      } catch {
        /* modo incógnito / storage bloqueado: el tema sigue aplicándose en memoria */
      }
    });
  }

  /** Cambia el tema activo. Ignora valores desconocidos. */
  set(theme: string): void {
    if (isTheme(theme)) this._theme.set(theme);
  }
}
