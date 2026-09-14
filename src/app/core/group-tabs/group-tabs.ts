import { Injectable, computed, effect, signal } from '@angular/core';

export interface GroupTab {
  /** Segmento de ruta bajo `/app/grupos/:id/`. */
  path: string;
  label: string;
}

/** Las seis pestañas del hub, en el orden por defecto. */
export const GROUP_TABS: readonly GroupTab[] = [
  { path: 'ranking', label: 'Clasificación' },
  { path: 'tierlist', label: 'Tierlist' },
  { path: 'estadisticas', label: 'Estadísticas' },
  { path: 'historial', label: 'Historial' },
  { path: 'perfil', label: 'Perfil' },
  { path: 'sanciones', label: 'Sanciones' },
];

export const MIN_VISIBLE_TABS = 3;

/** Lo que se guarda: el orden completo y qué paths están ocultos. */
interface StoredTabPrefs {
  order: string[];
  hidden: string[];
}

const STORAGE_KEY = 'cgc-group-tabs';

const DEFAULT_PREFS: StoredTabPrefs = {
  order: GROUP_TABS.map((t) => t.path),
  hidden: [],
};

function sanitizeStored(orderRaw: unknown, hiddenRaw: unknown): StoredTabPrefs {
  if (!Array.isArray(orderRaw) || !Array.isArray(hiddenRaw)) {
    return DEFAULT_PREFS;
  }

  const validPaths = new Set(GROUP_TABS.map((t) => t.path));

  // 1. Descartar paths desconocidos y duplicados del orden guardado
  const seenOrder = new Set<string>();
  const sanitizedOrder: string[] = [];
  for (const p of orderRaw) {
    if (typeof p === 'string' && validPaths.has(p) && !seenOrder.has(p)) {
      seenOrder.add(p);
      sanitizedOrder.push(p);
    }
  }

  // 2. Añadir paths del catálogo que falten, visibles y al final
  for (const tab of GROUP_TABS) {
    if (!seenOrder.has(tab.path)) {
      seenOrder.add(tab.path);
      sanitizedOrder.push(tab.path);
    }
  }

  // 3. Filtrar hidden para contener solo paths válidos y existentes en el orden
  const seenHidden = new Set<string>();
  const sanitizedHidden: string[] = [];
  for (const h of hiddenRaw) {
    if (typeof h === 'string' && seenOrder.has(h) && !seenHidden.has(h)) {
      seenHidden.add(h);
      sanitizedHidden.push(h);
    }
  }

  // 4. Si quedan menos de MIN_VISIBLE_TABS visibles, descartar y volver al defecto
  const visibleCount = sanitizedOrder.length - sanitizedHidden.length;
  if (visibleCount < MIN_VISIBLE_TABS) {
    return DEFAULT_PREFS;
  }

  return {
    order: sanitizedOrder,
    hidden: sanitizedHidden,
  };
}

function readStored(): StoredTabPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS;
    return sanitizeStored(parsed.order, parsed.hidden);
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Servicio de preferencia de pestañas del hub del grupo.
 *
 * BACKEND NOTE: al migrar, esto viaja en las preferencias del usuario
 * (PATCH /me/preferences) y el bloque de localStorage se borra entero.
 */
@Injectable({ providedIn: 'root' })
export class GroupTabsService {
  private readonly _prefs = signal<StoredTabPrefs>(readStored());

  /** Las seis pestañas en el orden del usuario, indicando visibilidad. */
  readonly tabs = computed<readonly (GroupTab & { visible: boolean })[]>(() => {
    const { order, hidden } = this._prefs();
    const tabMap = new Map(GROUP_TABS.map((t) => [t.path, t]));
    const hiddenSet = new Set(hidden);
    return order
      .map((path) => {
        const tab = tabMap.get(path);
        if (!tab) return null;
        return {
          ...tab,
          visible: !hiddenSet.has(path),
        };
      })
      .filter((t): t is GroupTab & { visible: boolean } => t !== null);
  });

  /** Solo las pestañas visibles, en el orden del usuario. */
  readonly visibleTabs = computed<readonly GroupTab[]>(() => {
    return this.tabs()
      .filter((t) => t.visible)
      .map(({ path, label }) => ({ path, label }));
  });

  constructor() {
    effect(() => {
      const prefs = this._prefs();
      try {
        const isDefault =
          prefs.hidden.length === 0 &&
          prefs.order.length === GROUP_TABS.length &&
          prefs.order.every((p, i) => p === GROUP_TABS[i].path);

        if (isDefault) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
        }
      } catch {
        // Modo privado o storage bloqueado: sigue funcionando en memoria
      }
    });
  }

  /**
   * Conmuta la visibilidad de una pestaña.
   * Ignora la llamada si dejaría menos de MIN_VISIBLE_TABS.
   */
  toggle(path: string): void {
    const { order, hidden } = this._prefs();
    const isHidden = hidden.includes(path);
    if (isHidden) {
      this._prefs.set({
        order,
        hidden: hidden.filter((p) => p !== path),
      });
    } else {
      const visibleCount = order.length - hidden.length;
      if (visibleCount <= MIN_VISIBLE_TABS) {
        return;
      }
      this._prefs.set({
        order,
        hidden: [...hidden, path],
      });
    }
  }

  /**
   * Mueve una pestaña a una nueva posición de índice.
   */
  move(path: string, to: number): void {
    const { order, hidden } = this._prefs();
    const from = order.indexOf(path);
    if (from === -1) return;
    const targetIndex = Math.max(0, Math.min(to, order.length - 1));
    if (from === targetIndex) return;

    const newOrder = [...order];
    const [item] = newOrder.splice(from, 1);
    newOrder.splice(targetIndex, 0, item);

    this._prefs.set({
      order: newOrder,
      hidden,
    });
  }

  /**
   * Vuelve a las seis pestañas visibles en el orden por defecto y borra la clave de localStorage.
   */
  reset(): void {
    this._prefs.set(DEFAULT_PREFS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
