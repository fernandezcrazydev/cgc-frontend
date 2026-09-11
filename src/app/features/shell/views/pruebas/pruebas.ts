import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NfAvatar, NfCombobox, NfComboboxOption, NfIconButton } from '../../../../ui';

export const CAMPEON = {
  id: 103,
  nombre: 'Ahri',
  titulo: 'la Zorra de Nueve Colas',
  tags: ['Mago', 'Asesino'],
  rol: 'MID',
  tier: 'S+',
  icono: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/Ahri.png',
  retrato: 'https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_0.jpg',
  splash: 'https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Ahri_0.jpg',
};

export const CIFRAS = {
  partidas: 12,
  winrate: 58,
  victorias: 7,
  derrotas: 5,
  presencia: 30,
  kda: '3.42',
  banrate: 15,
};

export const MACRO = {
  oro14: 5480,
  csMin: 7.4,
  primeraSangre: 25,
  primeraTorre: 58,
};

export const ESPECIALISTAS = [
  { nombre: 'N1ght', record: '5V-1D', winrate: 83, kda: '4.10', partidas: 6 },
  { nombre: 'Kaori', record: '2V-2D', winrate: 50, kda: '2.85', partidas: 4 },
  { nombre: 'Turbo', record: '0V-2D', winrate: 0, kda: '1.20', partidas: 2 },
];

export const SINERGIAS = [
  { slug: 'Leona', nombre: 'Leona', partidas: 4, winrate: 75 },
  { slug: 'Sejuani', nombre: 'Sejuani', partidas: 3, winrate: 67 },
  { slug: 'Jinx', nombre: 'Jinx', partidas: 5, winrate: 60 },
  { slug: 'Ornn', nombre: 'Ornn', partidas: 2, winrate: 50 },
  { slug: 'Yasuo', nombre: 'Yasuo', partidas: 3, winrate: 33 },
];

export const RIVALES = [
  { slug: 'Zed', nombre: 'Zed', partidas: 4, winrate: 25 },
  { slug: 'Fizz', nombre: 'Fizz', partidas: 3, winrate: 33 },
  { slug: 'Viktor', nombre: 'Viktor', partidas: 2, winrate: 50 },
  { slug: 'Orianna', nombre: 'Orianna', partidas: 2, winrate: 50 },
  { slug: 'Sylas', nombre: 'Sylas', partidas: 3, winrate: 67 },
];

export const OBJETOS = [
  { id: 6655, nombre: 'Compañero de Luden', corto: 'Luden', partidas: 10, winrate: 60 },
  { id: 3089, nombre: 'Sombrero Mortal de Rabadon', corto: 'Rabadon', partidas: 8, winrate: 63 },
  { id: 3157, nombre: 'Reloj de Arena de Zhonya', corto: 'Zhonya', partidas: 7, winrate: 71 },
  { id: 4645, nombre: 'Llama Sombría', corto: 'Llama', partidas: 6, winrate: 50 },
  { id: 3135, nombre: 'Bastón del Vacío', corto: 'Vacío', partidas: 6, winrate: 67 },
  { id: 3165, nombre: 'Morellonomicón', corto: 'Morello', partidas: 4, winrate: 50 },
];

export interface RuneEntry {
  key: string;
  name: string;
  tree: 'domination' | 'sorcery';
}

export interface StatModEntry {
  file: string;
  name: string;
}

export const RUNAS_PAGINA = {
  recordText: 'En 7 de 12 partidas · 57% de victorias',
  primaryKeystone: { key: 'electrocute', name: 'Electrocutar', tree: 'domination' as const },
  primaryRunes: [
    { key: 'suddenimpact', name: 'Impacto Súbito', tree: 'domination' as const },
    { key: 'eyeballcollection', name: 'Colección de Globos Oculares', tree: 'domination' as const },
    { key: 'ultimatehunter', name: 'Cazador Definitivo', tree: 'domination' as const },
  ] as RuneEntry[],
  secondaryRunes: [
    { key: 'manaflowband', name: 'Banda de Flujo de Maná', tree: 'sorcery' as const },
    { key: 'gatheringstorm', name: 'Tormenta Creciente', tree: 'sorcery' as const },
  ] as RuneEntry[],
  statMods: [
    { file: 'statmodsadaptiveforceicon.png', name: 'Fuerza Adaptable' },
    { file: 'statmodsadaptiveforceicon.png', name: 'Fuerza Adaptable' },
    { file: 'statmodshealthplusicon.png', name: 'Salud' },
  ] as StatModEntry[],
};

export interface SkillInfo {
  key: 'Q' | 'W' | 'E' | 'R';
  name: string;
  icon: string;
}

export const HABILIDADES = {
  skills: [
    {
      key: 'Q',
      name: 'Orbe del Engaño',
      icon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/AhriOrbofDeception.png',
    },
    {
      key: 'W',
      name: 'Fuego Zorruno',
      icon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/AhriFoxFire.png',
    },
    {
      key: 'E',
      name: 'Encanto',
      icon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/AhriSeduce.png',
    },
    {
      key: 'R',
      name: 'Ráfaga Espiritual',
      icon: 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/spell/AhriTumble.png',
    },
  ] as SkillInfo[],
};

@Component({
  selector: 'app-pruebas',
  standalone: true,
  imports: [NfAvatar, NfCombobox, NfIconButton],
  templateUrl: './pruebas.html',
  styleUrls: ['./pruebas.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pruebas {
  readonly campeon = CAMPEON;
  readonly cifras = CIFRAS;
  readonly macro = MACRO;
  readonly especialistas = ESPECIALISTAS;
  readonly sinergias = SINERGIAS;
  readonly rivales = RIVALES;
  readonly sinergiasTop = [...this.sinergias].sort((a, b) => b.winrate - a.winrate).slice(0, 4);
  readonly rivalesTop = [...this.rivales].sort((a, b) => a.winrate - b.winrate).slice(0, 4);
  readonly objetos = OBJETOS;
  readonly runasPagina = RUNAS_PAGINA;
  readonly habilidades = HABILIDADES;

  readonly selectedSinergia = signal<string>('');
  readonly selectedCounter = signal<string>('');

  readonly sinergiaSearchOpen = signal(false);
  readonly counterSearchOpen = signal(false);

  readonly championFilterOptions: NfComboboxOption[] = [
    { value: 'Fizz', label: 'Fizz', iconUrl: this.championIcon('Fizz') },
    { value: 'Jinx', label: 'Jinx', iconUrl: this.championIcon('Jinx') },
    { value: 'Leona', label: 'Leona', iconUrl: this.championIcon('Leona') },
    { value: 'Orianna', label: 'Orianna', iconUrl: this.championIcon('Orianna') },
    { value: 'Ornn', label: 'Ornn', iconUrl: this.championIcon('Ornn') },
    { value: 'Sejuani', label: 'Sejuani', iconUrl: this.championIcon('Sejuani') },
    { value: 'Sylas', label: 'Sylas', iconUrl: this.championIcon('Sylas') },
    { value: 'Viktor', label: 'Viktor', iconUrl: this.championIcon('Viktor') },
    { value: 'Yasuo', label: 'Yasuo', iconUrl: this.championIcon('Yasuo') },
    { value: 'Zed', label: 'Zed', iconUrl: this.championIcon('Zed') },
  ];

  readonly filteredSinergias = computed(() => {
    const sel = this.selectedSinergia();
    if (sel) {
      const found = this.sinergias.find((s) => s.slug === sel || s.nombre === sel);
      return found ? [found] : [];
    }
    return [...this.sinergias].sort((a, b) => b.winrate - a.winrate).slice(0, 4);
  });

  readonly filteredRivales = computed(() => {
    const sel = this.selectedCounter();
    if (sel) {
      const found = this.rivales.find((r) => r.slug === sel || r.nombre === sel);
      return found ? [found] : [];
    }
    return [...this.rivales].sort((a, b) => a.winrate - b.winrate).slice(0, 4);
  });

  toggleSinergiaSearch(): void {
    this.sinergiaSearchOpen.update((v) => !v);
  }

  toggleCounterSearch(): void {
    this.counterSearchOpen.update((v) => !v);
  }

  championIcon(slug: string): string {
    return 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/champion/' + slug + '.png';
  }

  itemIcon(id: number): string {
    return 'https://ddragon.leagueoflegends.com/cdn/14.24.1/img/item/' + id + '.png';
  }

  runeIcon(tree: 'domination' | 'sorcery', runeKey: string): string {
    return (
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/' +
      tree +
      '/' +
      runeKey +
      '/' +
      runeKey +
      '.png'
    );
  }

  statModIcon(file: string): string {
    return (
      'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/' +
      file
    );
  }
}
