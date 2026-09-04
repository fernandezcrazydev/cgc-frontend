import { TestBed } from '@angular/core/testing';
import { Router, Routes, provideRouter } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { ViewMemoryService } from './view-memory';

/** Rutas de mentira: solo hacen falta URLs por las que navegar. */
const ROUTES: Routes = [
  { path: 'lista', children: [] },
  { path: 'detalle', children: [] },
  { path: 'otra-cosa', children: [] },
];

describe('ViewMemoryService [F5.5-03]', () => {
  let service: ViewMemoryService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(ROUTES)] });
    router = TestBed.inject(Router);
    service = TestBed.inject(ViewMemoryService);
  });

  it('guarda y recupera snapshots de vista por clave de ruta', () => {
    service.save('/app/historial', {
      scrollY: 840,
      page: 2,
      expandedIds: ['partida-12'],
      lastFocusedId: 'partida-12',
    });

    const snapshot = service.get('/app/historial');
    expect(snapshot).not.toBeNull();
    expect(snapshot?.scrollY).toBe(840);
    expect(snapshot?.page).toBe(2);
    expect(snapshot?.expandedIds).toEqual(['partida-12']);
    expect(snapshot?.lastFocusedId).toBe('partida-12');
  });

  it('consume el scroll guardado una única vez para evitar saltos posteriores', () => {
    service.save('/app/historial', { scrollY: 650 });
    const y1 = service.consumeScroll('/app/historial');
    expect(y1).toBe(650);

    const y2 = service.consumeScroll('/app/historial');
    expect(y2).toBeNull();
  });

  it('consume el lastFocusedId una única vez para no repetir el destello de foco', () => {
    service.save('/app/historial', { lastFocusedId: 'partida-99' });
    const id1 = service.consumeFocusedId('/app/historial');
    expect(id1).toBe('partida-99');

    const id2 = service.consumeFocusedId('/app/historial');
    expect(id2).toBeNull();
  });

  it('persiste en sessionStorage como respaldo ante recargas', () => {
    service.save('/app/tierlist', { scrollY: 120, expandedIds: ['266'] });

    const raw = sessionStorage.getItem('cgc_view_snap_/app/tierlist');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).expandedIds).toEqual(['266']);
  });

  it('devuelve la fotografía al volver de la pantalla que la armó', async () => {
    await router.navigateByUrl('/lista');
    service.save('/lista', { scrollY: 500, expandedIds: ['p-1'] }, true);
    await router.navigateByUrl('/detalle');

    await router.navigateByUrl('/lista');

    expect(service.consumeReturn('/lista')?.expandedIds).toEqual(['p-1']);
  });

  it('NO la devuelve al entrar desde cualquier otro sitio', async () => {
    await router.navigateByUrl('/lista');
    service.save('/lista', { scrollY: 500, expandedIds: ['p-1'] }, true);
    await router.navigateByUrl('/detalle');
    // El usuario se va por ahí en vez de volver...
    await router.navigateByUrl('/otra-cosa');

    // ...y más tarde entra a la lista por el menú: se pinta limpia.
    await router.navigateByUrl('/lista');

    expect(service.consumeReturn('/lista')).toBeNull();
  });

  it('responde lo mismo a las dos preguntas de una misma vuelta', async () => {
    await router.navigateByUrl('/lista');
    service.save('/lista', { scrollY: 500, expandedIds: ['p-1'] }, true);
    await router.navigateByUrl('/detalle');
    await router.navigateByUrl('/lista');

    // El estado de interfaz pregunta al montarse y el scroll tras el primer render.
    expect(service.consumeReturn('/lista')).not.toBeNull();
    expect(service.consumeReturn('/lista')).not.toBeNull();
  });

  it('no restaura dos veces la misma salida', async () => {
    await router.navigateByUrl('/lista');
    service.save('/lista', { scrollY: 500, expandedIds: ['p-1'] }, true);
    await router.navigateByUrl('/detalle');
    await router.navigateByUrl('/lista');
    expect(service.consumeReturn('/lista')).not.toBeNull();

    // Se sale y se vuelve a entrar sin haber armado nada nuevo.
    await router.navigateByUrl('/otra-cosa');
    await router.navigateByUrl('/lista');

    expect(service.consumeReturn('/lista')).toBeNull();
  });
});
