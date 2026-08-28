import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfGameIcon, NfGameIconSet } from './nf-game-icon';

@Component({
  standalone: true,
  imports: [NfGameIcon],
  template: `<nf-game-icon [set]="set()" [id]="id()" [label]="label()" [size]="size()" />`,
})
class Host {
  readonly set = signal<NfGameIconSet>('spell');
  readonly id = signal(4);
  readonly label = signal('Destello');
  readonly size = signal(18);
}

describe('NfGameIcon', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const image = () => root().querySelector<HTMLImageElement>('.nf-gameicon__img');
  const fallback = () => root().querySelector<HTMLElement>('.nf-gameicon__fallback');

  it('un hechizo se resuelve por su id de ddragon', () => {
    expect(image()!.src).toContain('/assets/spells/4.png');
  });

  it('una runa se resuelve contra la carpeta de perks', () => {
    host.set.set('perk');
    host.id.set(8112);
    host.label.set('Electrocutar');
    fixture.detectChanges();

    expect(image()!.src).toContain('/assets/perks/8112.png');
    expect(image()!.getAttribute('alt')).toBe('Electrocutar');
  });

  it('el hueco de reserva conserva el tamaño exacto del icono', () => {
    host.size.set(24);
    fixture.detectChanges();
    image()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(image()).toBeFalsy();
    expect(fallback()!.style.width).toBe('24px');
    expect(fallback()!.style.height).toBe('24px');
    expect(fallback()!.getAttribute('title')).toBe('Destello');
  });
});
