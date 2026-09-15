import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import {
  CrossRelation,
  MatchParticipation,
  MatchSortBy,
  SORT_OPTIONS,
  normalizeForSearch,
} from '../../../../core/matches/match-filtering';
import { GameDataStore } from '../../../../core/game-data';
import { MATCHMAKING_PRESETS, MATCHMAKING_PRESET_INFO } from '../../../../core/groups';
import { LeaguesStore } from '../../../../core/leagues';
import { Lane, MatchPreset } from '../../../../core/matches/models';
import {
  NfAvatar,
  NfButton,
  NfCombobox,
  NfComboboxOption,
  NfLaneIcon,
  NfSegmentOption,
  NfSegmented,
  NfSheet,
} from '../../../../ui';
import { Viewport } from '../../../../shared/viewport';
import { MatchHistoryUiState } from './match-history-ui';

/**
 * Una sugerencia del buscador. **Solo de campeones**, y no por recorte: el catálogo está
 * cargado en el cliente, así que se puede enumerar; los jugadores y los grupos que aparecen en
 * tu historial no, porque la lista vive en el servidor. El texto libre sigue buscando los tres
 * —lo resuelve el parámetro `q`—, lo que no se puede es sugerirlos antes de preguntar.
 */
interface SearchSuggestion {
  key: string;
  type: 'champion';
  label: string;
  sub: string;
  iconUrl?: string | null;
  tint?: number;
  tag?: string;
  priority: number;
}

/**
 * Barra de filtros del historial, compartida por la vista personal y la de grupo.
 *
 * La versión anterior era una fila de seis controles heterogéneos con dos búsquedas que se
 * pisaban (un desplegable de campeón y un campo «Buscar invocador» que también buscaba por
 * campeón), sin contador de resultados y sin control de orden pese a que el estado ya lo
 * soportaba. La jerarquía ahora es: **buscar → ver qué hay puesto → afinar**.
 *
 * La duplicidad se resuelve haciendo explícitos los dos papeles: el campo de texto es la
 * búsqueda libre —dice en su placeholder que mira jugador, campeón y grupo— y el combobox es
 * el filtro estructurado. Ambos aparecen como chip cuando están activos, así que en todo
 * momento se ve qué está recortando la lista.
 */
@Component({
  selector: 'app-match-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, NfAvatar, NfButton, NfCombobox, NfLaneIcon, NfSegmented, NfSheet],
  styleUrl: './match-filters.component.scss',
  templateUrl: './match-filters.component.html',
})
export class MatchFiltersComponent {
  /** Qué pregunta responde la vista: cambia qué filtros tienen sentido. */
  readonly mode = input<'personal' | 'group' | 'cross'>('personal');
  /**
   * Los campeones que puede ofrecer el desplegable, cuando la vista ya sabe cuáles son. Lo
   * necesita el historial cruzado: su lista está acotada a las partidas compartidas, y ofrecer
   * ahí todos los campeones que has jugado alguna vez lleva a elegir uno y vaciar la lista.
   */
  readonly championIds = input<readonly number[] | null>(null);
  /** El grupo del contexto en la vista de grupo; acota la lista de campeones ofrecidos. */
  readonly contextGroupId = input<string | null>(null);
  /** Cuántas partidas quedan tras filtrar, para el contador. */
  readonly resultCount = input.required<number>();
  /**
   * Cuántas hay sin filtrar, si la vista lo sabe. Con la paginación en servidor casi nunca lo
   * sabe —lo que vuelve es el total YA filtrado—, así que por defecto el contador dice cuántas
   * hay y no «18 de 47». Inventar ese 47 sumando páginas sería peor que no darlo.
   */
  readonly totalCount = input<number | null>(null);

  private readonly ui = inject(MatchHistoryUiState);
  private readonly gameData = inject(GameDataStore);
  private readonly leagues = inject(LeaguesStore);
  private readonly viewport = inject(Viewport);

  readonly filters = this.ui.filters;

  /**
   * Si la vista se mide contra TU participación (personal y cruzada) o contra los diez
   * participantes (grupo). Es lo que decide qué controles tienen sentido, y por eso se
   * pregunta esto y no el modo concreto: añadir una vista nueva no debe obligar a repasar
   * ocho condiciones sueltas.
   */
  protected readonly measuresMe = computed(() => this.mode() !== 'group');

  protected readonly isCross = computed(() => this.mode() === 'cross');

  /**
   * Con el dedo, los cinco controles a ancho completo se comían media pantalla antes de
   * la primera partida. Ahí se retiran a un panel inferior y en la vista solo queda lo
   * que informa: qué se está buscando, cuánto queda y qué filtros hay puestos.
   */
  protected readonly isMobile = this.viewport.isMobile;

  /** Estado de UI del propio componente, no del historial (regla de oro 5). */
  protected readonly sheetOpen = signal(false);

  /** «Ver 18 partidas»: el CTA dice qué hay detrás del panel, no «Aceptar». */
  protected readonly applyLabel = computed(() => {
    const shown = this.resultCount();
    return `Ver ${shown} ${shown === 1 ? 'partida' : 'partidas'}`;
  });

  protected readonly laneOptions: { value: Lane | 'all'; label: string; lane: Lane | null }[] = [
    { value: 'all', label: 'Todas', lane: null },
    { value: 'TOP', label: 'Filtrar por TOP', lane: 'TOP' },
    { value: 'JUNGLA', label: 'Filtrar por jungla', lane: 'JUNGLA' },
    { value: 'MID', label: 'Filtrar por MID', lane: 'MID' },
    { value: 'ADC', label: 'Filtrar por ADC', lane: 'ADC' },
    { value: 'SUPPORT', label: 'Filtrar por soporte', lane: 'SUPPORT' },
  ];

  protected readonly outcomeOptions: readonly NfSegmentOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'win', label: 'Victorias', tone: 'success' },
    { value: 'loss', label: 'Derrotas', tone: 'danger' },
  ];

  /** Tres estados y no un interruptor: «otras» sirve para repasar lo que juega el resto. */
  protected readonly participationOptions: readonly NfSegmentOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'mine', label: 'Mis partidas' },
    { value: 'others', label: 'Otras' },
  ];

  /**
   * La dimensión propia del cruce. No se llama «Resultado» ni se mezcla con él: `outcome` dice
   * cómo TE fue y esto dice de qué lado estabais, que son preguntas distintas y combinables.
   */
  protected readonly relationOptions: readonly NfSegmentOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'enemy', label: 'En contra' },
    { value: 'ally', label: 'Juntos' },
  ];

  protected readonly sideOptions: readonly NfSegmentOption[] = [
    { value: 'all', label: 'Todos' },
    { value: 'blue', label: 'Azul' },
    { value: 'red', label: 'Rojo' },
  ];

  protected readonly sortComboboxOptions: readonly NfComboboxOption[] = SORT_OPTIONS.map((o) => ({
    value: o.value,
    label: o.label,
  }));

  /**
   * Las tres modalidades del backend, con la traducción que ya decide `core/groups`: es la
   * misma que lee el usuario al crear el grupo, y una segunda aquí las llamaría distinto en dos
   * pantallas contiguas.
   */
  protected readonly presetOptions: readonly NfComboboxOption[] = [
    { value: 'all', label: 'Todas' },
    ...MATCHMAKING_PRESETS.map((p) => ({ value: p, label: MATCHMAKING_PRESET_INFO[p].label })),
  ];

  /**
   * Las temporadas del grupo del contexto. Salen de `LeaguesStore`, que es la misma lista que
   * pinta la clasificación: si el desplegable ofreciese otros nombres, elegir uno vaciaría la
   * lista sin explicar por qué. Sin grupo de contexto no hay lista, y el control no se pinta.
   */
  protected readonly leagueOptions = computed<NfComboboxOption[]>(() => {
    if (!this.contextGroupId()) return [];
    return [
      { value: 'all', label: 'Todas' },
      ...this.leagues.seasons().map((l) => ({ value: l.id, label: l.name })),
    ];
  });

  /** «18 partidas», o «18 de 47» donde se conozca el total sin filtrar. */
  protected readonly resultCountLabel = computed(() => {
    const total = this.totalCount();
    const shown = this.resultCount();
    const noun = shown === 1 ? 'partida' : 'partidas';
    if (total === null || shown === total) return `${shown} ${noun}`;
    return `${shown} de ${total} ${noun}`;
  });

  /**
   * Los campeones que puede ofrecer el desplegable.
   *
   * Salen del CATÁLOGO, no de las partidas. Antes se ofrecían solo los jugados de verdad, que
   * era mejor, pero eso lo sabía el store cuando tenía el historial entero en memoria: con la
   * paginación en servidor solo hay seis filas en el cliente, y acotar el desplegable a los
   * campeones de esas seis dejaría fuera precisamente los que hay que ir a buscar.
   *
   * `championIds` sigue existiendo para la vista que SÍ sabe cuáles tienen sentido.
   */
  private readonly champions = computed(() => {
    const champMap = this.gameData.championById();
    const given = this.championIds();
    const entries = given
      ? given.map((id) => ({ id, champion: champMap.get(id) }))
      : [...champMap.entries()].map(([id, champion]) => ({ id, champion }));

    return entries
      .map(({ id, champion }) => ({
        id,
        name: champion?.name ?? `Campeón ${id}`,
        iconUrl: champion?.iconUrl ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  protected readonly championOptions = computed<NfComboboxOption[]>(() =>
    this.champions().map((c) => ({
      value: String(c.id),
      label: c.name,
      iconUrl: c.iconUrl,
      tint: c.id,
    })),
  );

  /** El combobox habla en cadenas y su vacío es «sin filtrar»; el estado usa `'all'`. */
  protected readonly selectedChampionValue = computed(() => {
    const id = this.filters().championId;
    return id === 'all' ? '' : String(id);
  });

  protected readonly searchOpen = signal(false);
  protected readonly searchActiveIndex = signal(0);

  protected readonly searchSuggestions = computed<SearchSuggestion[]>(() => {
    const raw = this.filters().searchQuery.trim();
    const q = normalize(raw);
    if (!q) return [];

    const results: SearchSuggestion[] = [];

    // 1. Campeones
    for (const c of this.champions()) {
      const n = normalize(c.name);
      if (n.startsWith(q) || n.includes(q)) {
        results.push({
          key: `champ-${c.id}`,
          type: 'champion',
          label: c.name,
          sub: 'Campeón',
          iconUrl: c.iconUrl,
          tint: c.id,
          priority: n.startsWith(q) ? 1 : 2,
        });
      }
    }

    return results
      .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label, 'es'))
      .slice(0, 4);
  });

  protected onSearchFocus(): void {
    if (this.filters().searchQuery.trim()) {
      this.searchOpen.set(true);
    }
  }

  protected onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.ui.update({ searchQuery: val });
    this.searchActiveIndex.set(0);
    this.searchOpen.set(val.trim().length > 0);
  }

  protected onSearchBlur(event: FocusEvent): void {
    // Si el clic fue en una opción del desplegable, pointerdown ya lo capturó.
    this.searchOpen.set(false);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    const list = this.searchSuggestions();
    if (!this.searchOpen() || list.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.searchActiveIndex.update((i) => (i + 1) % list.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.searchActiveIndex.update((i) => (i - 1 + list.length) % list.length);
        break;
      case 'Enter': {
        event.preventDefault();
        const sel = list[this.searchActiveIndex()];
        if (sel) this.chooseSuggestion(sel);
        break;
      }
      case 'Escape':
        event.preventDefault();
        this.searchOpen.set(false);
        break;
    }
  }

  protected chooseSuggestion(opt: SearchSuggestion, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.ui.update({ searchQuery: opt.label });
    this.searchOpen.set(false);
  }

  protected setLane(lane: Lane | 'all'): void {
    this.ui.update({ lane });
  }

  protected setOutcome(outcome: string): void {
    this.ui.update({ outcome: outcome as 'all' | 'win' | 'loss' });
  }

  protected setWinningSide(side: string): void {
    this.ui.update({ winningSide: side as 'all' | 'blue' | 'red' });
  }

  protected setParticipation(participation: string): void {
    this.ui.update({ participation: participation as MatchParticipation });
  }

  protected setRelation(relation: string): void {
    this.ui.update({ relation: relation as CrossRelation | 'all' });
  }

  protected setChampion(value: string): void {
    this.ui.update({ championId: value === '' ? 'all' : Number(value) });
  }

  protected setPreset(val: string): void {
    this.ui.update({ preset: (val || 'all') as MatchPreset | 'all' });
  }

  protected setLeague(val: string): void {
    this.ui.update({ leagueId: val || 'all' });
  }

  protected setSort(sortBy: string): void {
    this.ui.update({ sortBy: (sortBy || 'date-desc') as MatchSortBy });
  }

  protected reset(): void {
    this.ui.reset();
  }
}

/**
 * La MISMA normalización que aplica el filtrado real (`normalizeForSearch`). Cuando cada lado
 * tenía la suya, el desplegable ofrecía «Kai'Sa» al teclear «kaisa» y pulsar Enter sin elegirla
 * no encontraba nada.
 */
const normalize = normalizeForSearch;


