import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfLane, NfLaneIcon } from './nf-lane-icon';

@Component({
  standalone: true,
  imports: [NfLaneIcon],
  template: `<nf-lane-icon [lane]="lane()" [fallbackGlyph]="glyph()" />`,
})
class Host {
  readonly lane = signal<NfLane>('TOP');
  readonly glyph = signal('◤');
}

describe('NfLaneIcon', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const mask = () => root().querySelector<HTMLElement>('.nf-laneicon__mask');
  const glyph = () => root().querySelector('.nf-laneicon__glyph');
  const probe = () => root().querySelector<HTMLImageElement>('.nf-laneicon__probe');

  /**
   * El mapeo rol → fichero NO es 1:1 con el nombre del rol salvo en TOP: es
   * justo el punto donde el plan avisa que se cuela un bug si se toca a
   * ciegas, así que se fija con un caso por rol.
   */
  const cases: Array<[NfLane, string]> = [
    ['TOP', 'top'],
    ['JUNGLA', 'jungle'],
    ['MID', 'middle'],
    ['ADC', 'bottom'],
    ['SUPPORT', 'utility'],
  ];

  it.each(cases)('%s pinta la máscara del fichero position-%s.svg', (lane, file) => {
    host.lane.set(lane);
    fixture.detectChanges();

    expect(probe()!.src).toContain(`/lanes/position-${file}.svg`);
    expect(mask()!.getAttribute('style')).toContain(`/lanes/position-${file}.svg`);
    expect(glyph()).toBeFalsy();
  });

  it('si la sonda no carga el SVG, cae al glifo Unicode', () => {
    probe()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(mask()).toBeFalsy();
    expect(glyph()!.textContent).toBe('◤');
  });

  it('el glifo de reserva es el que pasa el consumidor', () => {
    host.glyph.set('♣');
    host.lane.set('JUNGLA');
    fixture.detectChanges();
    probe()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(glyph()!.textContent).toBe('♣');
  });
});
