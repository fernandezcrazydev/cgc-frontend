import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfModal } from './nf-modal';

/** Host mínimo: el modal se abre/cierra con `@if`, como en las vistas reales. */
@Component({
  standalone: true,
  imports: [NfModal],
  template: `
    @if (open()) {
      <nf-modal title="prueba.exe" (closed)="onClosed()">
        <button id="uno">uno</button>
        <button id="dos">dos</button>
      </nf-modal>
    }
  `,
})
class Host {
  readonly open = signal(true);
  closes = 0;
  onClosed(): void {
    this.closes++;
  }
}

describe('NfModal', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const query = <T extends HTMLElement>(sel: string) =>
    fixture.nativeElement.querySelector(sel) as T;

  it('pide cierre al pulsar Escape', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(host.closes).toBe(1);
  });

  it('pide cierre al hacer clic en el fondo difuminado', () => {
    query('.nf-modal__overlay').click();
    expect(host.closes).toBe(1);
  });

  it('no pide cierre al hacer clic dentro del diálogo', () => {
    query('.nf-modal').click();
    expect(host.closes).toBe(0);
  });

  it('bloquea el scroll de fondo mientras está abierto y lo restaura al cerrar', () => {
    expect(document.body.style.overflow).toBe('hidden');

    host.open.set(false);
    fixture.detectChanges();

    expect(document.body.style.overflow).toBe('');
  });

  it('devuelve el foco al elemento que lo tenía antes de abrirse', () => {
    // el modal se abre en el `beforeEach`, así que reabrimos con un disparador enfocado
    host.open.set(false);
    fixture.detectChanges();

    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    host.open.set(true);
    fixture.detectChanges();
    expect(document.activeElement).not.toBe(trigger);

    host.open.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
