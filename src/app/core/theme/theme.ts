import { Injectable, effect, signal } from '@angular/core';

/**
 * Temas visuales disponibles. Son SKINS puras: solo cambian valores de tokens
 * `--nf-*` y aplanan efectos "firma" vía `:root[data-theme="…"]`. No tocan
 * markup, componentes ni lógica de dominio.
 *
 *  - `nexus`    → NEXUS//FORGE, el look por defecto (vaporwave neón).
 *  - `nocturne` → Apple-dark minimalista.
 *  - `original` → el look de la app legacy (glass índigo/fucsia sobre azul noche).
 *
 * `original` es la única skin que además apaga el cromo de ventana retro: ver
 * `NfWindow`, que no renderiza barra/semáforo bajo este tema. Es la excepción
 * consciente a "las skins son solo CSS" — el semáforo es markup, no un token.
 */
export type ThemeId = 'nexus' | 'nocturne' | 'original';

export const THEMES: readonly { id: ThemeId; label: string; description: string }[] = [
  { id: 'nexus', label: 'Nexus', description: 'Vaporwave neón sobre violeta. El look de casa.' },
  { id: 'nocturne', label: 'Nocturne', description: 'Oscuro minimalista, tipografía del sistema.' },
  { id: 'original', label: 'Original', description: 'El estilo de la primera versión: cristal índigo y fucsia.' },
];

const DEFAULT_THEME: ThemeId = 'nexus';
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
    // atributo (así `:root` a secas = nexus y el CSS base no necesita duplicarse).
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
