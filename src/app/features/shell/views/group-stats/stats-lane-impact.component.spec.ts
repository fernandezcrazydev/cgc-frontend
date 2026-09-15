import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsLaneImpactComponent } from './stats-lane-impact.component';
import { LaneImpact } from '../../../../core/group-stats';

describe('StatsLaneImpactComponent', () => {
  const LANES: LaneImpact[] = [
    { lane: 'MID', label: 'Mid', winrate: 78, games: 32, impactOrder: 1, description: '+1.2k de oro al min. 14 · 32 duelos' },
    { lane: 'JUNGLA', label: 'Jungla', winrate: 74, games: 30, impactOrder: 2, description: '+0.9k de oro al min. 14 · 30 duelos' },
    { lane: 'ADC', label: 'Bot (ADC)', winrate: 69, games: 28, impactOrder: 3, description: '+0.7k de oro al min. 14 · 28 duelos' },
    { lane: 'TOP', label: 'Top', winrate: 65, games: 27, impactOrder: 4, description: '+1.6k de oro al min. 14 · 27 duelos' },
    { lane: 'SUPPORT', label: 'Soporte', winrate: 62, games: 25, impactOrder: 5, description: '+0.3k de oro al min. 14 · 25 duelos' },
  ];

  function createComponent(lanes: LaneImpact[] = LANES, loading = false) {
    const fixture = TestBed.createComponent(StatsLaneImpactComponent);
    fixture.componentRef.setInput('lanes', lanes);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('muestra las 5 líneas ordenadas por orden de impacto con trofeos en el top 3', () => {
    const { fixture } = createComponent();
    const rows = fixture.nativeElement.querySelectorAll('.li-entry');
    expect(rows).toHaveLength(5);

    // Puesto 1 luce el trofeo dorado oficial
    const firstRowTrophy = fixture.nativeElement.querySelector('.li-entry[data-podium="1"] .li-entry__trophy');
    expect(firstRowTrophy).toBeTruthy();
    expect(firstRowTrophy.getAttribute('src')).toBe('/assets/trofeos/Trofeo1.webp');

    const firstRowLabel = fixture.nativeElement.querySelector('.li-entry[data-podium="1"] .li-entry__name');
    expect(firstRowLabel.textContent.trim()).toBe('Mid');

    const firstRowWr = fixture.nativeElement.querySelector('.li-entry[data-podium="1"] .li-entry__value');
    expect(firstRowWr.textContent.trim()).toBe('78% WR');

    // Puesto 4 luce el número de ranking (#4) sin trofeo
    const fourthRowRank = fixture.nativeElement.querySelector('.li-entry[data-rank="4"] .li-entry__rank');
    expect(fourthRowRank.textContent.trim()).toBe('#4');
  });

  it('renderiza el esqueleto mientras carga', () => {
    const { fixture } = createComponent([], true);
    const skeletons = fixture.nativeElement.querySelectorAll('nf-skeleton');
    expect(skeletons).toHaveLength(5);
  });
});
