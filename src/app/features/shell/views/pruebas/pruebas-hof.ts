import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NfAvatar, NfSegmented } from '../../../../ui';
import { MedalIconComponent } from '../group-stats/medal-icon.component';
import { MEDALS, MedalBoard } from '../../../../core/group-medals';

export type HofFilter = 'all' | 'actual' | 'opt1' | 'opt2' | 'opt3' | 'opt4' | 'opt5';

interface MockItem {
  board: MedalBoard;
}

@Component({
  selector: 'app-pruebas-hof',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfSegmented, MedalIconComponent],
  templateUrl: './pruebas-hof.html',
  styleUrls: ['./pruebas-hof.scss'],
})
export class PruebasHof {
  readonly selectedFilter = signal<HofFilter>('all');

  readonly filterOptions = [
    { label: 'Ver todas', value: 'all' },
    { label: '0. Actual', value: 'actual' },
    { label: '1. Opción A', value: 'opt1' },
    { label: '2. Opción B', value: 'opt2' },
    { label: '3. Opción C', value: 'opt3' },
    { label: '4. Opción D', value: 'opt4' },
    { label: '5. Opción E', value: 'opt5' },
  ];

  protected setFilter(value: string): void {
    this.selectedFilter.set(value as HofFilter);
  }

  protected showSection(key: HofFilter): boolean {
    const f = this.selectedFilter();
    return f === 'all' || f === key;
  }

  readonly sampleCards: MockItem[] = [
    {
      board: {
        medal: MEDALS.find((m) => m.id === 'penta-king') ?? MEDALS[0],
        leader: {
          rank: 1,
          member: {
            name: 'VictorKing',
            tag: 'VictorKing#EUW',
            initials: 'VK',
            role: 'ADC',
            owner: false,
            hue: 280,
          },
          raw: 3,
          value: '3 pentakills',
        },
        podium: [],
        me: {
          rank: 2,
          member: {
            name: 'EduUC',
            tag: 'EduUC#EUW',
            initials: 'ED',
            role: 'TOP',
            owner: true,
            hue: 200,
          },
          raw: 1,
          value: '1 pentakill',
        },
        progress: 33,
        gap: '2 pentakills',
      },
    },
    {
      board: {
        medal: MEDALS.find((m) => m.id === 'demolisher') ?? MEDALS[5],
        leader: {
          rank: 1,
          member: {
            name: 'EduUC',
            tag: 'EduUC#EUW',
            initials: 'ED',
            role: 'TOP',
            owner: true,
            hue: 200,
          },
          raw: 48,
          value: '48 torres',
        },
        podium: [],
        me: {
          rank: 1,
          member: {
            name: 'EduUC',
            tag: 'EduUC#EUW',
            initials: 'ED',
            role: 'TOP',
            owner: true,
            hue: 200,
          },
          raw: 48,
          value: '48 torres',
        },
        progress: 100,
        gap: null,
      },
    },
    {
      board: {
        medal: MEDALS.find((m) => m.id === 'farmer') ?? MEDALS[9],
        leader: {
          rank: 1,
          member: {
            name: 'DaniG',
            tag: 'DaniG#LAN',
            initials: 'DG',
            role: 'MID',
            owner: false,
            hue: 140,
          },
          raw: 9.2,
          value: '9.2 CS/m',
        },
        podium: [],
        me: {
          rank: 4,
          member: {
            name: 'EduUC',
            tag: 'EduUC#EUW',
            initials: 'ED',
            role: 'TOP',
            owner: true,
            hue: 200,
          },
          raw: 7.8,
          value: '7.8 CS/m',
        },
        progress: 85,
        gap: '1.4 CS/m',
      },
    },
    {
      board: {
        medal: MEDALS.find((m) => m.id === 'almost-penta') ?? MEDALS[1],
        leader: null,
        podium: [],
        me: null,
        progress: null,
        gap: null,
      },
    },
  ];
}
