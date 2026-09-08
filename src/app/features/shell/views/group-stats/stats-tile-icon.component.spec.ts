import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { StatsTileIconComponent } from './stats-tile-icon.component';
import { PlayerTileIcon } from '../../../../core/group-stats';

describe('StatsTileIconComponent', () => {
  const ALL_ICONS: PlayerTileIcon[] = [
    'games',
    'winrate',
    'kda',
    'kda-split',
    'cs',
    'gold',
    'damage',
    'vision',
    'penta',
    'streak',
    'ranking',
  ];

  for (const icon of ALL_ICONS) {
    it(`renderiza el icono ${icon} sin fallar`, () => {
      const fixture = TestBed.createComponent(StatsTileIconComponent);
      fixture.componentRef.setInput('icon', icon);
      fixture.detectChanges();

      const svg = fixture.nativeElement.querySelector('svg');
      expect(svg).toBeTruthy();
    });
  }
});
