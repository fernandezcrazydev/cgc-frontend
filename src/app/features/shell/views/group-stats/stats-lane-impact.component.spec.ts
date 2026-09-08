import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsLaneImpactComponent } from './stats-lane-impact.component';
import { LaneImpact } from '../../../../core/group-stats';

describe('StatsLaneImpactComponent', () => {
  const LANES: LaneImpact[] = [
    { lane: 'MID', label: 'Mid', winrate: 78, impactOrder: 1, description: 'Control de mapa' },
    { lane: 'JUNGLA', label: 'Jungla', winrate: 74, impactOrder: 2, description: 'Presión en objetivos' },
    { lane: 'ADC', label: 'Bot (ADC)', winrate: 69, impactOrder: 3, description: 'Poder de fuego' },
    { lane: 'TOP', label: 'Top', winrate: 65, impactOrder: 4, description: 'Presión dividida' },
    { lane: 'SUPPORT', label: 'Soporte', winrate: 62, impactOrder: 5, description: 'Visión aliada' },
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
