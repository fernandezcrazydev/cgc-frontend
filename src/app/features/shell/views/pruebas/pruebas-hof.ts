import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { NfSegmented, NfAvatar } from '../../../../ui';

export type CardCategory =
  | 'preview'
  | 'mvp-ace'
  | 'honors'
  | 'rift'
  | 'radar'
  | 'pace'
  | 'economy'
  | 'vision'
  | 'all';

export interface ObjectiveData {
  id: string;
  name: string;
  blueScore: number;
  redScore: number;
  icon: string;
}

@Component({
  selector: 'app-pruebas-hof',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSegmented, NfAvatar],
  templateUrl: './pruebas-hof.html',
  styleUrls: ['./pruebas-hof.scss'],
})
export class PruebasHof {
  readonly selectedCategory = signal<CardCategory>('preview');

  readonly categoryOptions = [
    { label: '🏆 Cabecera Completa (Vista Previa)', value: 'preview' },
    { label: '⚔️ MVP & ACE (Cara a Cara)', value: 'mvp-ace' },
    { label: '🎖️ Menciones', value: 'honors' },
    { label: '🐉 Grieta', value: 'rift' },
    { label: '🕸️ Radar', value: 'radar' },
    { label: '⏱️ Ritmo', value: 'pace' },
    { label: '💰 Economía', value: 'economy' },
    { label: '👁️ Visión', value: 'vision' },
    { label: '📋 Catálogo (40)', value: 'all' },
  ];

  // Variantes seleccionadas para la cabecera final (1..5)
  readonly mvpVariant = signal<number>(1);
  readonly honorsVariant = signal<number>(1);
  readonly aceVariant = signal<number>(1);
  readonly riftVariant = signal<number>(1);
  readonly radarVariant = signal<number>(1);
  readonly paceVariant = signal<number>(1);
  readonly economyVariant = signal<number>(1);
  readonly visionVariant = signal<number>(1);

  // Estados dinámicos e interacción en vivo
  readonly hoveredHonorId = signal<string | null>(null);
  readonly hoveredRadarAxis = signal<string | null>(null);
  readonly hoveredObjectiveId = signal<string | null>(null);
  readonly activeEconomyPhase = signal<'final' | '14min'>('final');
  readonly hoveredVisionType = signal<string | null>(null);

  // 1. Datos MVP (Dorado Hextech reservado exclusivamente)
  readonly mvp = {
    playerName: 'Adri_LoL',
    role: 'MID',
    sideLabel: 'Equipo azul',
    championId: 517,
    championName: 'Sylas',
    championLevel: 18,
    championIconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Sylas.png',
    kills: 14,
    deaths: 2,
    assists: 11,
    kdaRatio: '12.5',
    damage: '34.2k',
    damageShare: 32,
    score: 9.8,
    cs: 213,
    csPerMin: 8.9,
    gold: '14.8k',
  };

  // 2. Menciones de honor (Coloridas, sin emojis, sin dorado)
  readonly honors = [
    { id: 'damage', title: 'Cañón de daño', player: 'Adri_LoL', champ: 'Sylas', val: '34.2k', metric: 'daño', color: 'crimson', pct: 32, sub: '32% daño de partida' },
    { id: 'tank', title: 'Muro de hierro', player: 'EdgarP', champ: 'Ornn', val: '41.5k', metric: 'mitigado', color: 'cyan', pct: 40, sub: '40% daño mitigado' },
    { id: 'vision', title: 'Ojo de águila', player: 'Sam_Sup', champ: 'Thresh', val: '68', metric: 'visión', color: 'emerald', pct: 48, sub: '48% visión de equipo' },
    { id: 'farm', title: 'Rey del farm', player: 'DaniG', champ: 'Jhin', val: '9.4', metric: 'CS/min', color: 'indigo', pct: 85, sub: '245 súbditos' },
  ];

  // 3. Datos ACE (Púrpura / Amatista, sin dorado)
  readonly ace = {
    playerName: 'VictorGod',
    role: 'ADC',
    sideLabel: 'Equipo rojo',
    championId: 222,
    championName: 'Jinx',
    championLevel: 16,
    championIconUrl: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Jinx.png',
    kills: 7,
    deaths: 3,
    assists: 6,
    kdaRatio: '4.3',
    damage: '28.1k',
    damageShare: 29,
    score: 8.6,
    cs: 245,
    csPerMin: 8.1,
    gold: '13.2k',
  };

  // 4. Objetivos Grieta
  readonly objectives: ObjectiveData[] = [
    { id: 'dragons', name: 'Dragones', blueScore: 4, redScore: 1, icon: '/assets/objectives/dragon.png' },
    { id: 'grubs', name: 'Larvas', blueScore: 6, redScore: 0, icon: '/assets/objectives/grubs.png' },
    { id: 'herald', name: 'Heraldo', blueScore: 1, redScore: 0, icon: '/assets/objectives/herald.png' },
    { id: 'baron', name: 'Barón', blueScore: 1, redScore: 0, icon: '/assets/objectives/baron.png' },
    { id: 'towers', name: 'Torres', blueScore: 8, redScore: 2, icon: '/assets/objectives/tower.png' },
  ];

  // 5. Radar
  readonly radarMetrics = [
    { id: 'dragons', label: 'Dragones', blue: 80, red: 20 },
    { id: 'grubs', label: 'Larvas', blue: 100, red: 0 },
    { id: 'herald', label: 'Heraldo', blue: 100, red: 0 },
    { id: 'baron', label: 'Barón', blue: 100, red: 0 },
    { id: 'towers', label: 'Torres', blue: 80, red: 20 },
  ];

  // 6. Ritmo
  readonly pace = {
    duration: '31:24',
    killsPerMin: '2.0',
    totalKills: 62,
    fbPlayer: 'EduUC',
    fbRole: 'Top',
    fbTime: '2:48',
  };

  // 7. Economía
  readonly economy = {
    blueTotal: '18.4k',
    redTotal: '14.1k',
    leadTotal: '+4.3k',
    blue14: '8.1k',
    red14: '7.2k',
    lead14: '+900g',
    bluePct: 56,
  };

  // 8. Visión
  readonly vision = {
    blueScore: 142,
    redScore: 98,
    placedBlue: 34,
    placedRed: 21,
    killedBlue: 12,
    killedRed: 6,
    controlBlue: 8,
    controlRed: 3,
  };

  setCategory(val: string): void {
    this.selectedCategory.set(val as CardCategory);
  }

  showCategory(cat: CardCategory): boolean {
    const current = this.selectedCategory();
    if (current === 'all') return true;
    return current === cat;
  }

  setVariant(card: string, val: number): void {
    switch (card) {
      case 'mvp': this.mvpVariant.set(val); break;
      case 'honors': this.honorsVariant.set(val); break;
      case 'ace': this.aceVariant.set(val); break;
      case 'rift': this.riftVariant.set(val); break;
      case 'radar': this.radarVariant.set(val); break;
      case 'pace': this.paceVariant.set(val); break;
      case 'economy': this.economyVariant.set(val); break;
      case 'vision': this.visionVariant.set(val); break;
    }
  }

  setEconomyPhase(phase: 'final' | '14min'): void {
    this.activeEconomyPhase.set(phase);
  }
}
