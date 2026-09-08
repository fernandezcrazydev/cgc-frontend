import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NfSegmented } from '../../../../ui';
import { ObjectiveId, ObjectiveImpact } from '../../../../core/group-stats';

export type PruebasFilter = 'all' | 'opt1' | 'opt2' | 'opt3' | 'opt4' | 'opt5';

export interface ObjectiveMock extends ObjectiveImpact {
  ratioText: string;
}

interface RadarPoint {
  id: ObjectiveId;
  label: string;
  winrate: number;
  x: number;
  y: number;
  axisX: number;
  axisY: number;
  labelX: number;
  labelY: number;
}

@Component({
  selector: 'app-pruebas-hof',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSegmented],
  templateUrl: './pruebas-hof.html',
  styleUrls: ['./pruebas-hof.scss'],
})
export class PruebasHof {
  readonly selectedFilter = signal<PruebasFilter>('all');
  readonly hoveredObjective = signal<ObjectiveId | null>(null);

  readonly filterOptions = [
    { label: 'Ver todas', value: 'all' },
    { label: '1. Radial Tokens', value: 'opt1' },
    { label: '2. Pilares Verticales', value: 'opt2' },
    { label: '3. Banners Broadcast', value: 'opt3' },
    { label: '4. Reliquias Épicas', value: 'opt4' },
    { label: '5. Radar Pentagonal', value: 'opt5' },
  ];

  readonly objectives: ObjectiveMock[] = [
    {
      id: 'dragon',
      label: 'Primer dragón',
      winrate: 78,
      wins: 18,
      games: 23,
      impact: 'Decisivo',
      iconUrl: '/assets/objectives/dragon.png',
      ratioText: '18W - 5L',
    },
    {
      id: 'grubs',
      label: 'Larvas del vacío',
      winrate: 74,
      wins: 17,
      games: 23,
      impact: 'Alto',
      iconUrl: '/assets/objectives/grubs.png',
      ratioText: '17W - 6L',
    },
    {
      id: 'herald',
      label: 'Primer heraldo',
      winrate: 65,
      wins: 15,
      games: 23,
      impact: 'Medio',
      iconUrl: '/assets/objectives/herald.png',
      ratioText: '15W - 8L',
    },
    {
      id: 'baron',
      label: 'Primer barón',
      winrate: 86,
      wins: 12,
      games: 14,
      impact: 'Decisivo',
      iconUrl: '/assets/objectives/baron.png',
      ratioText: '12W - 2L',
    },
    {
      id: 'tower',
      label: 'Primera torre',
      winrate: 70,
      wins: 16,
      games: 23,
      impact: 'Alto',
      iconUrl: '/assets/objectives/tower.png',
      ratioText: '16W - 7L',
    },
  ];

  protected setFilter(value: string): void {
    this.selectedFilter.set(value as PruebasFilter);
  }

  protected showSection(key: PruebasFilter): boolean {
    const f = this.selectedFilter();
    return f === 'all' || f === key;
  }

  protected setHovered(id: ObjectiveId | null): void {
    this.hoveredObjective.set(id);
  }

  protected onIconError(event: Event, id: ObjectiveId): void {
    const img = event.target as HTMLImageElement;
    const fallbacks: Record<ObjectiveId, string> = {
      dragon: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/dragon.png',
      grubs: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/grub.png',
      herald: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/riftherald.png',
      baron: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/baron.png',
      tower: 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons/tower.png',
    };
    if (img.src !== fallbacks[id]) {
      img.src = fallbacks[id];
    }
  }

  /**
   * Puntos calculados para el radar pentagonal de la Opción 5.
   * Centro en (140, 140), radio base 95px.
   */
  readonly radarData = computed(() => {
    const cx = 140;
    const cy = 140;
    const maxR = 95;
    const points: RadarPoint[] = this.objectives.map((o, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const r = (o.winrate / 100) * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      const axisX = cx + maxR * Math.cos(angle);
      const axisY = cy + maxR * Math.sin(angle);
      const labelX = cx + (maxR + 24) * Math.cos(angle);
      const labelY = cy + (maxR + 18) * Math.sin(angle);

      return {
        id: o.id,
        label: o.label,
        winrate: o.winrate,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        axisX: Math.round(axisX * 10) / 10,
        axisY: Math.round(axisY * 10) / 10,
        labelX: Math.round(labelX * 10) / 10,
        labelY: Math.round(labelY * 10) / 10,
      };
    });

    const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ');
    const outerPoints = points.map((p) => `${p.axisX},${p.axisY}`).join(' ');

    return { points, polygonPoints, outerPoints };
  });
}
