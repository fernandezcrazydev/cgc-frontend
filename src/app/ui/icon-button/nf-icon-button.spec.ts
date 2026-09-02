import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfIconButton } from './nf-icon-button';

/**
 * Lo que se blinda aquí es el motivo de existir del primitivo: un botón cuyo
 * único contenido es un dibujo se queda sin nombre accesible y sin explicación
 * si `label` no llega hasta el DOM por las dos vías (`aria-label` y `title`).
 */
@Component({
  standalone: true,
  imports: [NfIconButton],
  template: `
    <button id="fijo" nfIconButton label="Ver el catálogo completo de campeones" class="pf-extra">
      <svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z" /></svg>
    </button>
    <button
      id="variable"
      nfIconButton
      [label]="etiqueta()"
      variant="accent"
      size="sm"
      [disabled]="apagado()"
    >
      <svg viewBox="0 0 16 16"><path d="M0 0h16v16H0z" /></svg>
    </button>
  `,
})
class Host {
  readonly etiqueta = signal('Página siguiente');
  readonly apagado = signal(false);
}

describe('NfIconButton', () => {
  let fixture: ComponentFixture<Host>;

  const el = (id: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(`#${id}`)!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('usa el mismo texto como nombre accesible y como tooltip', () => {
    const b = el('fijo');
    expect(b.getAttribute('aria-label')).toBe('Ver el catálogo completo de campeones');
    expect(b.getAttribute('title')).toBe('Ver el catálogo completo de campeones');
  });

  it('es un <button type="button">, para no enviar formularios sin querer', () => {
    expect(el('fijo').getAttribute('type')).toBe('button');
  });

  it('combina sus clases con las del sitio de uso', () => {
    const c = el('fijo').classList;
    expect(c.contains('nf-icon-btn')).toBe(true);
    expect(c.contains('nf-icon-btn--ghost')).toBe(true);
    expect(c.contains('nf-icon-btn--md')).toBe(true);
    expect(c.contains('pf-extra')).toBe(true);
  });

  it('aplica variante y tamaño elegidos', () => {
    const c = el('variable').classList;
    expect(c.contains('nf-icon-btn--accent')).toBe(true);
    expect(c.contains('nf-icon-btn--sm')).toBe(true);
  });

  it('sigue a la etiqueta cuando cambia', () => {
    fixture.componentInstance.etiqueta.set('Página anterior');
    fixture.detectChanges();
    expect(el('variable').getAttribute('aria-label')).toBe('Página anterior');
    expect(el('variable').getAttribute('title')).toBe('Página anterior');
  });

  it('refleja disabled en el atributo, no solo en la clase', () => {
    expect(el('variable').hasAttribute('disabled')).toBe(false);
    fixture.componentInstance.apagado.set(true);
    fixture.detectChanges();
    expect(el('variable').hasAttribute('disabled')).toBe(true);
  });
});
