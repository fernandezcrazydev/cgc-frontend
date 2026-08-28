import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NfRankEmblem, NfRankTier } from './nf-rank-emblem';

@Component({
  standalone: true,
  imports: [NfRankEmblem],
  template: `<nf-rank-emblem [tier]="tier()" [label]="label()" [size]="size()" />`,
})
class Host {
  readonly tier = signal<NfRankTier>('MASTER');
  readonly label = signal('SoloQ: Master');
  readonly size = signal(24);
}

describe('NfRankEmblem', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const image = () => root().querySelector<HTMLImageElement>('.nf-rankemblem__img');
  const glyph = () => root().querySelector('.nf-rankemblem__glyph');

  /**
   * Tier → fichero es un mapeo explícito, no un `toLowerCase()`: si algún día
   * deja de coincidir, este test es el que lo caza. Un caso por tier.
   */
  const cases: Array<[NfRankTier, string]> = [
    ['CHALLENGER', 'challenger'],
    ['GRANDMASTER', 'grandmaster'],
    ['MASTER', 'master'],
    ['DIAMOND', 'diamond'],
    ['EMERALD', 'emerald'],
    ['PLATINUM', 'platinum'],
    ['GOLD', 'gold'],
    ['SILVER', 'silver'],
    ['BRONZE', 'bronze'],
    ['IRON', 'iron'],
  ];

  it.each(cases)('%s carga el emblema %s.svg', (tier, file) => {
    host.tier.set(tier);
    fixture.detectChanges();

    expect(image()!.src).toContain(`/assets/ranks/${file}.svg`);
    expect(glyph()).toBeFalsy();
  });

  it('la etiqueta es el nombre accesible y el tooltip del escudo', () => {
    expect(image()!.getAttribute('alt')).toBe('SoloQ: Master');
    expect(image()!.getAttribute('title')).toBe('SoloQ: Master');
  });

  it('el tamaño se aplica al <img> para que no haya salto de layout', () => {
    host.size.set(40);
    fixture.detectChanges();

    expect(image()!.style.width).toBe('40px');
    expect(image()!.style.height).toBe('40px');
  });

  it('si el SVG no carga, cae al glifo de reserva conservando el tooltip', () => {
    image()!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(image()).toBeFalsy();
    expect(glyph()!.textContent).toBe('◆');
    expect(glyph()!.getAttribute('title')).toBe('SoloQ: Master');
  });
});
