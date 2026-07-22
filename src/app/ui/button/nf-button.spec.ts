import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfButton } from './nf-button';

/**
 * `NfButton` pinta sus clases con un host binding `[class]`, que en Ivy convive
 * con las clases estáticas y con `[class.x]` del sitio de uso. Las vistas
 * dependen de esa convivencia para marcar CTAs con `.nf-go` (la puntita ► que
 * añade el CSS), así que aquí se blinda: si un día `[class]` pisara lo demás,
 * los botones perderían el marcador en silencio.
 */
@Component({
  standalone: true,
  imports: [NfButton],
  template: `
    <button id="estatica" nfButton variant="primary" class="nf-go">Continuar</button>
    <button id="dinamica" nfButton variant="ghost" size="sm" [class.nf-go]="go()">Enviar</button>
  `,
})
class Host {
  readonly go = signal(true);
}

describe('NfButton', () => {
  let fixture: ComponentFixture<Host>;

  const classesOf = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(`#${id}`)!.classList;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('combina las clases del primitivo con la clase estática del uso', () => {
    const c = classesOf('estatica');
    expect(c.contains('nf-btn')).toBe(true);
    expect(c.contains('nf-btn--primary')).toBe(true);
    expect(c.contains('nf-go')).toBe(true);
  });

  it('respeta el binding [class.nf-go] y reacciona al cambio', () => {
    expect(classesOf('dinamica').contains('nf-go')).toBe(true);
    expect(classesOf('dinamica').contains('nf-btn--sm')).toBe(true);

    fixture.componentInstance.go.set(false);
    fixture.detectChanges();
    expect(classesOf('dinamica').contains('nf-go')).toBe(false);
    // El primitivo conserva las suyas al apagarse la del uso.
    expect(classesOf('dinamica').contains('nf-btn--ghost')).toBe(true);
  });
});
