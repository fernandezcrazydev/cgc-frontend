import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  NfAvatar,
  NfCombobox,
  NfComboboxOption,
  NfSegmented,
  NfSegmentOption,
} from '../../../../ui';

export type TarjetasTab = 'cabecera' | 'duos' | 'builds' | 'skills' | 'montaje';

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

export interface RuneOption {
  key: string;
  name: string;
  selected: boolean;
  tree: 'domination' | 'sorcery';
}

export interface StatModOption {
  file: string;
  name: string;
  selected: boolean;
}

export interface RuneTreePage {
  recordText: string;
  primary: {
    id: number;
    tree: 'domination';
    name: string;
    icon: string;
    keystone: RuneOption[];
    row1: RuneOption[];
    row2: RuneOption[];
    row3: RuneOption[];
  };
  secondary: {
    id: number;
    tree: 'sorcery';
    name: string;
    icon: string;
    row1: RuneOption[];
    row2: RuneOption[];
    row3: RuneOption[];
  };
  statMods: {
    row1: StatModOption[];
    row2: StatModOption[];
    row3: StatModOption[];
  };
  selectedList: {
    primaryKeystone: RuneOption;
    primaryRunes: RuneOption[];
    secondaryRunes: RuneOption[];
    statMods: StatModOption[];
    namesSummary: string;
  };
}

export const RUNAS_PAGINA: RuneTreePage = {
  recordText: 'En 7 de 12 partidas · 57% de victorias',
  primary: {
    id: 7200,
    tree: 'domination',
    name: 'Dominación',
    icon: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7200_domination.png',
    keystone: [
      { key: 'electrocute', name: 'Electrocutar', selected: true, tree: 'domination' },
      { key: 'predator', name: 'Depredador', selected: false, tree: 'domination' },
      { key: 'darkharvest', name: 'Cosecha Oscura', selected: false, tree: 'domination' },
      { key: 'hailofblades', name: 'Lluvia de Espadas', selected: false, tree: 'domination' },
    ],
    row1: [
      { key: 'cheapshot', name: 'Golpe Bajo', selected: false, tree: 'domination' },
      { key: 'tasteofblood', name: 'Sabor a Sangre', selected: false, tree: 'domination' },
      { key: 'suddenimpact', name: 'Impacto Súbito', selected: true, tree: 'domination' },
    ],
    row2: [
      { key: 'zombieward', name: 'Guardián Zombi', selected: false, tree: 'domination' },
      { key: 'ghostporo', name: 'Poro Fantasma', selected: false, tree: 'domination' },
      { key: 'eyeballcollection', name: 'Colección de Globos Oculares', selected: true, tree: 'domination' },
    ],
    row3: [
      { key: 'treasurehunter', name: 'Cazatesoros', selected: false, tree: 'domination' },
      { key: 'ingenioushunter', name: 'Cazador Ingenioso', selected: false, tree: 'domination' },
      { key: 'relentlesshunter', name: 'Cazador Tenaz', selected: false, tree: 'domination' },
      { key: 'ultimatehunter', name: 'Cazador Definitivo', selected: true, tree: 'domination' },
    ],
  },
  secondary: {
    id: 7202,
    tree: 'sorcery',
    name: 'Hechicería',
    icon: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/7202_sorcery.png',
    row1: [
      { key: 'nullifyingorb', name: 'Orbe Anulador', selected: false, tree: 'sorcery' },
      { key: 'manaflowband', name: 'Banda de Flujo de Maná', selected: true, tree: 'sorcery' },
      { key: 'nimbuscloak', name: 'Capa de Nimbo', selected: false, tree: 'sorcery' },
    ],
    row2: [
      { key: 'transcendence', name: 'Trascendencia', selected: false, tree: 'sorcery' },
      { key: 'celerity', name: 'Celeridad', selected: false, tree: 'sorcery' },
      { key: 'absolutefocus', name: 'Enfoque Absoluto', selected: false, tree: 'sorcery' },
    ],
    row3: [
      { key: 'scorch', name: 'Abrasar', selected: false, tree: 'sorcery' },
      { key: 'waterwalking', name: 'Caminar sobre el Agua', selected: false, tree: 'sorcery' },
      { key: 'gatheringstorm', name: 'Tormenta Creciente', selected: true, tree: 'sorcery' },
    ],
  },
  statMods: {
    row1: [
      { file: 'statmodsadaptiveforceicon.png', name: 'Fuerza Adaptable', selected: true },
      { file: 'statmodsattackspeedicon.png', name: 'Velocidad de Ataque', selected: false },
      { file: 'statmodscdrscalingicon.png', name: 'Aceleración de Habilidad', selected: false },
    ],
    row2: [
      { file: 'statmodsadaptiveforceicon.png', name: 'Fuerza Adaptable', selected: true },
      { file: 'statmodsmovementspeedicon.png', name: 'Velocidad de Movimiento', selected: false },
      { file: 'statmodshealthscalingicon.png', name: 'Salud Escalada', selected: false },
    ],
    row3: [
      { file: 'statmodshealthplusicon.png', name: 'Salud', selected: true },
      { file: 'statmodstenacityicon.png', name: 'Tenacidad y Resistencia a Ralentizaciones', selected: false },
      { file: 'statmodshealthscalingicon.png', name: 'Salud Escalada', selected: false },
    ],
  },
  selectedList: {
    primaryKeystone: { key: 'electrocute', name: 'Electrocutar', selected: true, tree: 'domination' },
    primaryRunes: [
      { key: 'suddenimpact', name: 'Impacto Súbito', selected: true, tree: 'domination' },
      { key: 'eyeballcollection', name: 'Colección de Globos Oculares', selected: true, tree: 'domination' },
      { key: 'ultimatehunter', name: 'Cazador Definitivo', selected: true, tree: 'domination' },
    ],
    secondaryRunes: [
      { key: 'manaflowband', name: 'Banda de Flujo de Maná', selected: true, tree: 'sorcery' },
      { key: 'gatheringstorm', name: 'Tormenta Creciente', selected: true, tree: 'sorcery' },
    ],
    statMods: [
      { file: 'statmodsadaptiveforceicon.png', name: 'Fuerza Adaptable', selected: true },
      { file: 'statmodsadaptiveforceicon.png', name: 'Fuerza Adaptable', selected: true },
      { file: 'statmodshealthplusicon.png', name: 'Salud', selected: true },
    ],
    namesSummary: 'Electrocutar · Impacto Súbito · Globos Oculares · Cazador Definitivo · Banda de Maná · Tormenta Creciente',
  },
};

export interface SkillInfo {
  key: 'Q' | 'W' | 'E' | 'R';
  name: string;
  icon: string;
}

export interface SkillLevel {
  level: number;
  skill: 'Q' | 'W' | 'E' | 'R';
}

export const HABILIDADES = {
  progression: [
    { level: 1, skill: 'Q' },
    { level: 2, skill: 'W' },
    { level: 3, skill: 'E' },
    { level: 4, skill: 'Q' },
    { level: 5, skill: 'Q' },
    { level: 6, skill: 'R' },
    { level: 7, skill: 'Q' },
    { level: 8, skill: 'W' },
    { level: 9, skill: 'Q' },
    { level: 10, skill: 'W' },
    { level: 11, skill: 'R' },
    { level: 12, skill: 'W' },
    { level: 13, skill: 'W' },
    { level: 14, skill: 'E' },
    { level: 15, skill: 'E' },
    { level: 16, skill: 'R' },
    { level: 17, skill: 'E' },
    { level: 18, skill: 'E' },
  ] as SkillLevel[],
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
  levels: Array.from({ length: 18 }, (_, i) => i + 1),
};

export interface DivergingEntry {
  slug: string;
  nombre: string;
  partidas: number;
  winrate: number;
  tipo: 'sinergia' | 'rival';
}

export interface TableRowEntry {
  slug: string;
  nombre: string;
  juntos: string;
  contra: string;
  balance: number;
  balanceFormatted: string;
}

@Component({
  selector: 'app-pruebas',
  standalone: true,
  imports: [NfSegmented, NfCombobox, NfAvatar, NgTemplateOutlet],
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
  readonly objetos = OBJETOS;
  readonly runasPagina = RUNAS_PAGINA;
  readonly habilidades = HABILIDADES;

  readonly tabOptions: NfSegmentOption[] = [
    { value: 'cabecera', label: 'Cabecera' },
    { value: 'duos', label: 'Sinergias y rivales' },
    { value: 'builds', label: 'Objetos y runas' },
    { value: 'skills', label: 'Habilidades' },
    { value: 'montaje', label: 'Montaje' },
  ];

  readonly selectedTab = signal<TarjetasTab>('cabecera');
  readonly selectedChampion = signal<string>('');

  readonly altCabecera = signal<string>('1');
  readonly altSinergias = signal<string>('1');
  readonly altBuilds = signal<string>('1');
  readonly altSkills = signal<string>('1');

  readonly cabeceraOptions: NfComboboxOption[] = [
    { value: '1', label: 'Alternativa 1 · Splash panorámico' },
    { value: '2', label: 'Alternativa 2 · Retrato lateral y rejilla de cifras' },
    { value: '3', label: 'Alternativa 3 · Carta vertical' },
    { value: '4', label: 'Alternativa 4 · La cifra protagonista' },
    { value: '5', label: 'Alternativa 5 · Continuación de la tabla' },
  ];

  readonly sinergiasOptions: NfComboboxOption[] = [
    { value: '1', label: 'Alternativa 1 · Dos paneles hermanos' },
    { value: '2', label: 'Alternativa 2 · Una lista, dos lados' },
    { value: '3', label: 'Alternativa 3 · Barras divergentes' },
    { value: '4', label: 'Alternativa 4 · Rejilla de iconos' },
    { value: '5', label: 'Alternativa 5 · Tabla' },
  ];

  readonly buildsOptions: NfComboboxOption[] = [
    { value: '1', label: 'Alternativa 1 · Tres columnas' },
    { value: '2', label: 'Alternativa 2 · Runas arriba, objetos abajo' },
    { value: '3', label: 'Alternativa 3 · Objetos arriba, runas abajo' },
    { value: '4', label: 'Alternativa 4 · Solo lo elegido' },
    { value: '5', label: 'Alternativa 5 · Dos tarjetas separadas' },
  ];

  readonly skillsOptions: NfComboboxOption[] = [
    { value: '1', label: 'Alternativa 1 · Rejilla de 18 niveles' },
    { value: '2', label: 'Alternativa 2 · Orden de maximización' },
    { value: '3', label: 'Alternativa 3 · Secuencia lineal' },
    { value: '4', label: 'Alternativa 4 · Titular y detalle' },
    { value: '5', label: 'Alternativa 5 · Solo texto' },
  ];

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

  readonly divergingList: DivergingEntry[] = [
    { slug: 'Zed', nombre: 'Zed', partidas: 4, winrate: 25, tipo: 'rival' },
    { slug: 'Fizz', nombre: 'Fizz', partidas: 3, winrate: 33, tipo: 'rival' },
    { slug: 'Viktor', nombre: 'Viktor', partidas: 2, winrate: 50, tipo: 'rival' },
    { slug: 'Orianna', nombre: 'Orianna', partidas: 2, winrate: 50, tipo: 'rival' },
    { slug: 'Ornn', nombre: 'Ornn', partidas: 2, winrate: 50, tipo: 'sinergia' },
    { slug: 'Jinx', nombre: 'Jinx', partidas: 5, winrate: 60, tipo: 'sinergia' },
    { slug: 'Sejuani', nombre: 'Sejuani', partidas: 3, winrate: 67, tipo: 'sinergia' },
    { slug: 'Leona', nombre: 'Leona', partidas: 4, winrate: 75, tipo: 'sinergia' },
  ];

  readonly tableRows: TableRowEntry[] = [
    { slug: 'Leona', nombre: 'Leona', juntos: '4 · 75%', contra: '—', balance: 25, balanceFormatted: '+25' },
    { slug: 'Sejuani', nombre: 'Sejuani', juntos: '3 · 67%', contra: '—', balance: 17, balanceFormatted: '+17' },
    { slug: 'Jinx', nombre: 'Jinx', juntos: '5 · 60%', contra: '—', balance: 10, balanceFormatted: '+10' },
    { slug: 'Ornn', nombre: 'Ornn', juntos: '2 · 50%', contra: '—', balance: 0, balanceFormatted: '0' },
    { slug: 'Orianna', nombre: 'Orianna', juntos: '—', contra: '2 · 50%', balance: 0, balanceFormatted: '0' },
    { slug: 'Viktor', nombre: 'Viktor', juntos: '—', contra: '2 · 50%', balance: 0, balanceFormatted: '0' },
    { slug: 'Fizz', nombre: 'Fizz', juntos: '—', contra: '3 · 33%', balance: -17, balanceFormatted: '−17' },
    { slug: 'Zed', nombre: 'Zed', juntos: '—', contra: '4 · 25%', balance: -25, balanceFormatted: '−25' },
  ];

  readonly filteredSinergias = computed(() => {
    const selected = this.selectedChampion();
    if (selected) {
      const found = this.sinergias.find((s) => s.slug === selected || s.nombre === selected);
      return found ? [found] : [];
    }
    return [...this.sinergias].sort((a, b) => b.winrate - a.winrate).slice(0, 4);
  });

  readonly filteredRivales = computed(() => {
    const selected = this.selectedChampion();
    if (selected) {
      const found = this.rivales.find((r) => r.slug === selected || r.nombre === selected);
      return found ? [found] : [];
    }
    return [...this.rivales].sort((a, b) => b.winrate - a.winrate).slice(0, 4);
  });

  readonly duoPairs = computed(() => {
    const allies = this.filteredSinergias();
    const rivals = this.filteredRivales();
    const len = Math.max(allies.length, rivals.length);
    const pairs: Array<{ ally?: (typeof allies)[0]; rival?: (typeof rivals)[0] }> = [];
    for (let i = 0; i < len; i++) {
      pairs.push({
        ally: allies[i],
        rival: rivals[i],
      });
    }
    return pairs;
  });

  readonly divergingFiltered = computed(() => {
    const selected = this.selectedChampion();
    if (selected) {
      return this.divergingList.filter((d) => d.slug === selected || d.nombre === selected);
    }
    return this.divergingList;
  });

  readonly tableRowsFiltered = computed(() => {
    const selected = this.selectedChampion();
    if (selected) {
      return this.tableRows.filter((row) => row.slug === selected || row.nombre === selected);
    }
    return this.tableRows;
  });

  readonly duosCountLabel = computed(() => {
    const sel = this.selectedChampion();
    if (sel) {
      return 'Filtrando por ' + sel;
    }
    return '10 campeones con datos';
  });

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

  isSkillLevel(skillKey: string, level: number): boolean {
    return this.habilidades.progression.find((p) => p.level === level)?.skill === skillKey;
  }

  formatPartidas(n: number): string {
    return n === 1 ? '1 partida' : n + ' partidas';
  }

  formatPartidasShort(n: number): string {
    return n === 1 ? '1 part.' : n + ' part.';
  }
}
