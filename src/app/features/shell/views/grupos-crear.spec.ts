import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { GroupsStore } from '../../../core/groups';
import { Grupos } from './grupos';

/**
 * El diálogo de creación es la ÚNICA oportunidad que tiene el grupo de elegir su algoritmo de
 * matcheo: el backend no expone forma de cambiarlo después (`diseno-matchmaking.md` §14.1). De ahí
 * lo que se protege aquí:
 *
 * - que la explicación que se lee corresponda al preset seleccionado, porque es lo único con lo
 *   que el usuario decide, y
 * - que el aviso de "esto no se cambia" siga presente — quitarlo no rompe nada visible, y deja al
 *   usuario eligiendo a ciegas algo irreversible (§14.6 lo pide explícitamente en la UI).
 *
 * Se monta el componente pero no se abre el diálogo contra el DOM: basta con leer sus signals y el
 * template, sin doblar media app.
 */
describe('Grupos — elección de algoritmo al crear', () => {
  function createFixture(): ComponentFixture<Grupos> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        // La vista llama a `reload()` en el constructor: el doble del store lo deja en nada, así
        // que `GroupsApi` (privado del barrel) nunca llega a inyectarse ni a tocar la red.
        {
          provide: GroupsStore,
          useValue: {
            status: () => 'ready',
            groups: () => [],
            selectedId: () => null,
            pending: () => false,
            reload: () => Promise.resolve([]),
            select: () => undefined,
          },
        },
      ],
    });
    return TestBed.createComponent(Grupos);
  }

  function createComponent(): Grupos {
    return createFixture().componentInstance;
  }

  it('arranca en Equilibrado, el preset por defecto del backend', () => {
    const grupos = createComponent();

    expect(grupos.preset()).toBe('BALANCED');
    expect(grupos.presetDescription()).toContain('balanceada');
  });

  it('las opciones llevan el valor del enum y la etiqueta en español', () => {
    const grupos = createComponent();

    expect(grupos.presetOptions).toEqual([
      { value: 'BALANCED', label: 'Equilibrado' },
      { value: 'PRECISION', label: 'Competitivo' },
      { value: 'CHAOS', label: 'Caos' },
    ]);
  });

  it('la explicación cambia con la selección', () => {
    const grupos = createComponent();

    grupos.setPreset('CHAOS');
    expect(grupos.preset()).toBe('CHAOS');
    expect(grupos.presetDescription()).toContain('peor rol');

    grupos.setPreset('PRECISION');
    expect(grupos.presetDescription()).toContain('cara a cara');
  });

  it('reabrir el diálogo vuelve al preset por defecto', () => {
    const grupos = createComponent();

    grupos.setPreset('CHAOS');
    grupos.openCreate();

    expect(grupos.preset()).toBe('BALANCED');
  });

  it('el diálogo avisa de que la elección es irreversible', () => {
    const fixture = createFixture();
    fixture.componentInstance.openCreate();
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector('.field__warning');
    expect(warning?.textContent).toContain('no se puede cambiar');
  });
});
