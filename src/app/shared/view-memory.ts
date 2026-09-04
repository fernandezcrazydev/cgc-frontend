import { Injectable, inject } from '@angular/core';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

export interface ViewSnapshot {
  scrollY: number;
  page?: number;
  expandedIds?: string[];
  lastFocusedId?: string | null;
  filters?: Record<string, any>;
  timestamp: number;
}

/**
 * Servicio transversal para la persistencia de estado de scroll, acordeones y
 * elementos inspeccionados [F5.5-03].
 *
 * Mantiene en memoria de sesión (RAM + sessionStorage) la fotografía exacta de cada
 * vista de listado (/app/historial, /app/grupos/:id/historial, etc.). Al navegar al
 * detalle de una partida y volver atrás (por history.back() o botón "Volver"),
 * permite restaurar:
 * 1. La posición de scroll exacta (Y).
 * 2. La página de paginación activa.
 * 3. Los acordeones que estaban abiertos.
 * 4. Un pulso suave de foco temporal en el elemento que se inspeccionó.
 *
 * **Restaurar solo al VOLVER.** Una fotografía se *arma* al salir hacia el detalle y solo se
 * consume si el usuario regresa de ahí —por el botón «Volver» o por el atrás del navegador—.
 * Entrar a la lista desde cualquier otro sitio la encuentra desarmada y la vista se pinta limpia.
 * Antes no era así: los acordeones se guardaban en `sessionStorage` y se restauraban en cualquier
 * entrada, así que una partida desplegada seguía desplegada días después, sin haber vuelto atrás.
 */
@Injectable({ providedIn: 'root' })
export class ViewMemoryService {
  private readonly memory = new Map<string, ViewSnapshot>();
  private readonly STORAGE_PREFIX = 'cgc_view_snap_';

  /** URL desde la que se llegó a la actual. Es la que decide si esto es «volver». */
  private previousUrl: string | null = null;
  private currentUrl: string | null = null;
  /** La navegación en curso vino del atrás/adelante del navegador. */
  private cameFromPopstate = false;

  /**
   * Fotografías armadas: clave de la vista → URL a la que se marchó el usuario. Volver de esa
   * URL es la única forma (junto al `popstate`) de que la fotografía se restaure.
   */
  private readonly armed = new Map<string, string>();
  /** Clave que ha pedido armarse y espera a saber a qué URL se va el usuario. */
  private pendingArm: string | null = null;
  /**
   * Veredicto de «¿esto es una vuelta?» por clave, válido solo dentro de la MISMA navegación.
   * Se numera en vez de compararse por URL: entrar dos veces a la misma lista son dos preguntas
   * distintas, y con la URL como clave la segunda heredaba la respuesta de la primera.
   */
  private readonly verdicts = new Map<string, { seq: number; snapshot: ViewSnapshot | null }>();
  /** Cuántas navegaciones han terminado. Identifica «esta» navegación. */
  private navSeq = 0;

  constructor() {
    const router = inject(Router);
    router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.cameFromPopstate = event.navigationTrigger === 'popstate';
        return;
      }
      if (event instanceof NavigationEnd) {
        this.navSeq++;
        this.previousUrl = this.currentUrl;
        this.currentUrl = event.urlAfterRedirects;
        // La fotografía se armó justo antes de salir: ahora ya se sabe a dónde fue.
        if (this.pendingArm) {
          this.armed.set(this.pendingArm, event.urlAfterRedirects);
          this.pendingArm = null;
        }
      }
    });
  }

  /**
   * Guarda (o completa) la fotografía de una vista. Con `arm`, además la deja lista para
   * restaurarse cuando el usuario vuelva de la pantalla a la que está a punto de ir.
   */
  save(key: string, data: Partial<ViewSnapshot>, arm = false): void {
    const existing = this.get(key) ?? {
      scrollY: 0,
      timestamp: Date.now(),
    };
    const updated: ViewSnapshot = {
      ...existing,
      ...data,
      timestamp: Date.now(),
    };
    this.memory.set(key, updated);
    if (arm) this.pendingArm = key;
    try {
      sessionStorage.setItem(this.STORAGE_PREFIX + key, JSON.stringify(updated));
    } catch {
      // Ignorar fallos de cuota o entornos restringidos
    }
  }

  get(key: string): ViewSnapshot | null {
    if (this.memory.has(key)) {
      return this.memory.get(key)!;
    }
    try {
      const raw = sessionStorage.getItem(this.STORAGE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw) as ViewSnapshot;
        this.memory.set(key, parsed);
        return parsed;
      }
    } catch {
      // Ignorar fallos de lectura/parseo
    }
    return null;
  }

  /**
   * La fotografía **solo si esto es una vuelta**: se regresa de la URL que la armó, o la
   * navegación fue un `popstate`. En cualquier otro caso devuelve `null` y la vista se pinta
   * desde cero.
   *
   * El veredicto se cachea por navegación: una misma vista lo pregunta desde varios sitios (el
   * estado de interfaz al montarse, el scroll tras el primer render) y las dos preguntas tienen
   * que recibir la misma respuesta. Al cambiar de URL el veredicto caduca y la fotografía queda
   * desarmada, así que una salida no se restaura dos veces.
   */
  consumeReturn(key: string): ViewSnapshot | null {
    const seq = this.navSeq;
    const cached = this.verdicts.get(key);
    if (cached && cached.seq === seq) return cached.snapshot;

    const armedFrom = this.armed.get(key) ?? null;
    const isReturn =
      this.cameFromPopstate || (!!armedFrom && !!this.previousUrl && this.previousUrl === armedFrom);
    this.armed.delete(key);
    if (this.pendingArm === key) this.pendingArm = null;

    const snapshot = isReturn ? this.get(key) : null;
    this.verdicts.set(key, { seq, snapshot });
    return snapshot;
  }

  /**
   * Consume la posición de scroll almacenada para restaurarla una única vez y
   * evitar saltos en futuras navegaciones directas.
   */
  consumeScroll(key: string): number | null {
    const item = this.get(key);
    if (!item || typeof item.scrollY !== 'number' || item.scrollY <= 0) return null;
    const y = item.scrollY;
    this.save(key, { scrollY: 0 });
    return y;
  }

  /**
   * Consume el ID del elemento sobre el que aplicar el destello visual de foco.
   */
  consumeFocusedId(key: string): string | null {
    const item = this.get(key);
    if (!item?.lastFocusedId) return null;
    const id = item.lastFocusedId;
    this.save(key, { lastFocusedId: null });
    return id;
  }

  clear(key: string): void {
    this.memory.delete(key);
    this.armed.delete(key);
    try {
      sessionStorage.removeItem(this.STORAGE_PREFIX + key);
    } catch {}
  }
}
