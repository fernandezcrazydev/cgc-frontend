import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsVisionComponent } from './stats-vision.component';
import { GroupVision } from '../../../../core/group-stats';

describe('StatsVisionComponent', () => {
  const VISION: GroupVision = {
    wardsPlaced: 1842,
    wardsCleared: 534,
    visionPerMin: 3.4,
    topVisionary: { name: 'EduUC', tag: 'EduUC#EUW', score: 62 },
  };

  function createComponent(vision: GroupVision | null = VISION, loading = false) {
    const fixture = TestBed.createComponent(StatsVisionComponent);
    fixture.componentRef.setInput('vision', vision);
    fixture.componentRef.setInput('loading', loading);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  it('muestra los tres bloques de colocados, destruidos y líder de visión', () => {
    const { fixture } = createComponent();
    const items = fixture.nativeElement.querySelectorAll('.vi-item');
    expect(items).toHaveLength(3);

    const placedCount = fixture.nativeElement.querySelector('.vi-item--placed .vi-item__count');
    expect(placedCount.textContent.trim()).toMatch(/1[.,]?842/);

    const clearedCount = fixture.nativeElement.querySelector('.vi-item--cleared .vi-item__count');
    expect(clearedCount.textContent.trim()).toContain('534');

    const leaderCount = fixture.nativeElement.querySelector('.vi-item--leader .vi-item__count');
    expect(leaderCount.textContent.trim()).toContain('3.4');
  });

  it('destaca al líder de visión cuando está disponible', () => {
    const { fixture } = createComponent();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('EduUC');
  });

  it('muestra el estado de carga con esqueletos', () => {
    const { fixture } = createComponent(null, true);
    const skeletons = fixture.nativeElement.querySelectorAll('nf-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
