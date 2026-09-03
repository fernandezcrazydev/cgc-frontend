import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { MatchHistoryUiState } from './match-history-ui';
import { ViewMemoryService } from '../../../../shared/view-memory';

/** Rutas de mentira que imitan lista → detalle → otra pantalla. */
const ROUTES: Routes = [
  { path: 'app/historial', children: [] },
  { path: 'app/historial/:id', children: [] },
  { path: 'app/inicio', children: [] },
];

describe('MatchHistoryUiState [F5.5-03]', () => {
  let ui: MatchHistoryUiState;
  let memory: ViewMemoryService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(ROUTES), MatchHistoryUiState],
    });
    ui = TestBed.inject(MatchHistoryUiState);
    memory = TestBed.inject(ViewMemoryService);
    router = TestBed.inject(Router);
  });

  /** Deja la lista con una partida desplegada y navega al detalle, como haría el usuario. */
  async function saleAlDetalle(): Promise<void> {
    await router.navigateByUrl('/app/historial');
    ui.setContextKey('/app/historial');
    ui.setPage(2);
    ui.toggleExpand('match-1');
    ui.toggleExpand('match-2');
    ui.recordNavigation('match-1');
    await router.navigateByUrl('/app/historial/match-1');
  }

  it('restaura página, acordeones y focusedId AL VOLVER del detalle', async () => {
    await saleAlDetalle();
    await router.navigateByUrl('/app/historial');

    const otra = TestBed.runInInjectionContext(() => new MatchHistoryUiState());
    otra.setContextKey('/app/historial');

    expect(otra.page()).toBe(2);
    expect(otra.isExpanded('match-1')).toBe(true);
    expect(otra.isExpanded('match-2')).toBe(true);
    expect(otra.focusedId()).toBe('match-1');
  });

  it('NO restaura los acordeones al entrar de nuevo desde otra pantalla', async () => {
    await saleAlDetalle();
    // El usuario se va a Inicio en vez de volver, y más tarde abre el historial por el menú.
    await router.navigateByUrl('/app/inicio');
    await router.navigateByUrl('/app/historial');

    const otra = TestBed.runInInjectionContext(() => new MatchHistoryUiState());
    otra.setContextKey('/app/historial');

    expect(otra.isExpanded('match-1')).toBe(false);
    expect(otra.isExpanded('match-2')).toBe(false);
    expect(otra.focusedId()).toBeNull();
    expect(otra.page()).toBe(1);
  });

  it('conserva los filtros aunque no sea una vuelta: son una decisión del usuario', async () => {
    await router.navigateByUrl('/app/historial');
    ui.setContextKey('/app/historial');
    ui.update({ searchQuery: 'aatrox' });
    await router.navigateByUrl('/app/inicio');
    await router.navigateByUrl('/app/historial');

    const otra = TestBed.runInInjectionContext(() => new MatchHistoryUiState());
    otra.setContextKey('/app/historial');

    expect(otra.filters().searchQuery).toBe('aatrox');
  });

  it('persiste la fotografía al registrar navegación a detalle', () => {
    ui.setContextKey('/app/historial');
    ui.setPage(3);
    ui.toggleExpand('match-42');
    ui.recordNavigation('match-42');

    const snap = memory.get('/app/historial');
    expect(snap?.page).toBe(3);
    expect(snap?.expandedIds).toContain('match-42');
    expect(snap?.lastFocusedId).toBe('match-42');
  });

  it('limpia el focusedId cuando se solicita', async () => {
    await saleAlDetalle();
    await router.navigateByUrl('/app/historial');

    const otra = TestBed.runInInjectionContext(() => new MatchHistoryUiState());
    otra.setContextKey('/app/historial');
    expect(otra.focusedId()).toBe('match-1');

    otra.clearFocusedId();
    expect(otra.focusedId()).toBeNull();
  });
});
