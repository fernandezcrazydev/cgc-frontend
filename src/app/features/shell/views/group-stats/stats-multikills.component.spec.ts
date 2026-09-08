import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsMultikillsComponent } from './stats-multikills.component';
import { GroupMultikills } from '../../../../core/group-stats';

describe('StatsMultikillsComponent', () => {
  const MULTIKILLS: GroupMultikills = {
    pentas: 4,
    quadras: 14,
    triples: 42,
    topPentaHunter: { name: 'EduUC', tag: 'EduUC#EUW', count: 3 },
    topQuadraHunter: { name: 'Adri', tag: 'Adri#EUW', count: 6 },
  };

  function createComponent(multikills: GroupMultikills | null = MULTIKILLS, loading = false) {
    const fixture = TestBed.createComponent(StatsMultikillsComponent);
    fixture.componentRef.setInput('multikills', multikills);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('muestra las tres tarjetas de pentakills, cuádruples y triples', () => {
    const { fixture } = createComponent();
    const items = fixture.nativeElement.querySelectorAll('.mk-item');
    expect(items).toHaveLength(3);

    const pentaCount = fixture.nativeElement.querySelector('.mk-item--penta .mk-item__count');
    expect(pentaCount.textContent.trim()).toBe('4');

    const quadraCount = fixture.nativeElement.querySelector('.mk-item--quadra .mk-item__count');
    expect(quadraCount.textContent.trim()).toBe('14');

    const tripleCount = fixture.nativeElement.querySelector('.mk-item--triple .mk-item__count');
    expect(tripleCount.textContent.trim()).toBe('42');
  });

  it('muestra los líderes destacados de pentas y cuádruples', () => {
    const { fixture } = createComponent();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('EduUC');
    expect(text).toContain('Adri');
  });

  it('muestra el estado de carga con esqueletos', () => {
    const { fixture } = createComponent(null, true);
    const skeletons = fixture.nativeElement.querySelectorAll('nf-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
