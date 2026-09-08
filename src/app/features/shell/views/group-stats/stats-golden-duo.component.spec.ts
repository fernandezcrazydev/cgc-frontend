import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsGoldenDuoComponent } from './stats-golden-duo.component';
import { GoldenDuo } from '../../../../core/group-stats';

const MOCK_DUO: GoldenDuo = {
  player1: { name: 'EduUC', tag: 'EduUC#EUW', avatar: null, hue: 200 },
  player2: { name: 'Adri', tag: 'Adri#EUW', avatar: null, hue: 140 },
  winrate: 81,
  games: 16,
  wins: 13,
  losses: 3,
};

function createComponent(duo: GoldenDuo | null, loading = false) {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(StatsGoldenDuoComponent);
  fixture.componentRef.setInput('duo', duo);
  fixture.componentRef.setInput('loading', loading);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance };
}

describe('StatsGoldenDuoComponent', () => {
  it('muestra los dos jugadores del dúo y su winrate conjunto', () => {
    const { fixture } = createComponent(MOCK_DUO);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('EduUC');
    expect(text).toContain('Adri');
    expect(text).toContain('81%');
    expect(text).toContain('16 partidas juntos');
  });

  it('muestra esqueletos de carga cuando loading es true', () => {
    const { fixture } = createComponent(null, true);
    expect(fixture.nativeElement.querySelector('.st-card').getAttribute('aria-busy')).toBe('true');
  });

  it('muestra estado vacío cuando no hay dúo suficiente', () => {
    const { fixture } = createComponent(null, false);
    expect(fixture.nativeElement.querySelector('.st-card__empty')).not.toBeNull();
  });

  it('renderiza la variante wood con sus textos temáticos', () => {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(StatsGoldenDuoComponent);
    fixture.componentRef.setInput('duo', MOCK_DUO);
    fixture.componentRef.setInput('variant', 'wood');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Dúo de madera');
    expect(text).toContain('Donantes de LP');
    expect(fixture.nativeElement.querySelector('.gd-card').getAttribute('data-variant')).toBe('wood');
  });
});
