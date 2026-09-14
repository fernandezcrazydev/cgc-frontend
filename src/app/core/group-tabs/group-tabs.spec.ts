import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { GROUP_TABS, GroupTabsService, MIN_VISIBLE_TABS } from './group-tabs';

describe('GroupTabsService', () => {
  const STORAGE_KEY = 'cgc-group-tabs';

  beforeEach(() => {
    localStorage.clear();
  });

  function createService(): GroupTabsService {
    return TestBed.runInInjectionContext(() => new GroupTabsService());
  }

  it('devuelve las 6 pestañas por defecto en orden y todas visibles si el storage está vacío', () => {
    const service = createService();
    const tabs = service.tabs();
    const visible = service.visibleTabs();

    expect(tabs.length).toBe(6);
    expect(tabs.every((t) => t.visible)).toBe(true);
    expect(tabs.map((t) => t.path)).toEqual(GROUP_TABS.map((t) => t.path));
    expect(visible.map((t) => t.path)).toEqual(GROUP_TABS.map((t) => t.path));
  });

  it('ocultar una pestaña no desordena la lista y se refleja en visibleTabs', () => {
    const service = createService();
    service.toggle('tierlist');

    const tabs = service.tabs();
    expect(tabs.find((t) => t.path === 'tierlist')?.visible).toBe(false);
    expect(tabs.map((t) => t.path)).toEqual(GROUP_TABS.map((t) => t.path));

    const visible = service.visibleTabs();
    expect(visible.map((t) => t.path)).toEqual([
      'ranking',
      'estadisticas',
      'historial',
      'perfil',
      'sanciones',
    ]);

    // Volver a marcarla la devuelve a su sitio
    service.toggle('tierlist');
    expect(service.visibleTabs().map((t) => t.path)).toEqual(GROUP_TABS.map((t) => t.path));
  });

  it('impide ocultar si quedan exactamente MIN_VISIBLE_TABS (3) visibles', () => {
    const service = createService();
    service.toggle('ranking');
    service.toggle('tierlist');
    service.toggle('estadisticas');

    expect(service.visibleTabs().length).toBe(3);

    // Intentar ocultar una cuarta no hace nada
    service.toggle('historial');
    expect(service.visibleTabs().length).toBe(3);
    expect(service.tabs().find((t) => t.path === 'historial')?.visible).toBe(true);
  });

  it('reordena las pestañas con move()', () => {
    const service = createService();
    // Mover 'sanciones' (última) a la primera posición (índice 0)
    service.move('sanciones', 0);

    expect(service.tabs().map((t) => t.path)).toEqual([
      'sanciones',
      'ranking',
      'tierlist',
      'estadisticas',
      'historial',
      'perfil',
    ]);
  });

  it('persiste cambios en localStorage y los recupera al instanciar', () => {
    const service = createService();
    service.move('historial', 0);
    service.toggle('perfil');
    TestBed.flushEffects();

    // Comprobar que se guardó en localStorage
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.order[0]).toBe('historial');
    expect(stored.hidden).toContain('perfil');

    // Nueva instancia lee lo guardado
    const service2 = createService();
    expect(service2.tabs()[0].path).toBe('historial');
    expect(service2.tabs().find((t) => t.path === 'perfil')?.visible).toBe(false);
  });

  it('descarta paths desconocidos guardados en storage (ej. discord retirado)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        order: ['discord', 'ranking', 'tierlist', 'estadisticas', 'historial', 'perfil', 'sanciones'],
        hidden: ['discord'],
      }),
    );

    const service = createService();
    expect(service.tabs().map((t) => t.path)).toEqual(GROUP_TABS.map((t) => t.path));
    expect(service.tabs().every((t) => t.visible)).toBe(true);
  });

  it('añade paths del catálogo que falten en storage como visibles y al final', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        order: ['tierlist', 'ranking', 'estadisticas'],
        hidden: [],
      }),
    );

    const service = createService();
    const paths = service.tabs().map((t) => t.path);
    expect(paths).toEqual([
      'tierlist',
      'ranking',
      'estadisticas',
      'historial',
      'perfil',
      'sanciones',
    ]);
    expect(service.tabs().every((t) => t.visible)).toBe(true);
  });

  it('vuelve al valor por defecto si lo guardado deja menos de 3 visibles o está corrupto', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        order: ['ranking', 'tierlist', 'estadisticas', 'historial', 'perfil', 'sanciones'],
        hidden: ['ranking', 'tierlist', 'estadisticas', 'historial'], // 2 visibles
      }),
    );

    const service = createService();
    expect(service.visibleTabs().length).toBe(6);

    localStorage.setItem(STORAGE_KEY, '{ invalid json');
    const service2 = createService();
    expect(service2.visibleTabs().length).toBe(6);
  });

  it('reset() restaura el valor por defecto y borra localStorage', () => {
    const service = createService();
    service.move('sanciones', 0);
    service.toggle('ranking');

    service.reset();

    expect(service.tabs().map((t) => t.path)).toEqual(GROUP_TABS.map((t) => t.path));
    expect(service.tabs().every((t) => t.visible)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
