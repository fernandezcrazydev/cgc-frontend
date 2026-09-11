import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { CrossRelation } from '../../../../core/matches/cross-history';
import { MatchHistoryStore } from '../../../../core/matches/match-history-store';
import {
  MatchParticipation,
  MatchSortBy,
  SORT_OPTIONS,
  normalizeForSearch,
} from '../../../../core/matches/match-filtering';
import { laneLabel } from '../../../../core/matches/match-view';
import { GameDataStore } from '../../../../core/game-data';
import { GroupsStore } from '../../../../core/groups';
import { Lane, Match, MatchGameMode, MatchLobbyType } from '../../../../core/matches/models';
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

interface SearchSuggestion {
  key: string;
  type: 'champion' | 'player' | 'group';
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
  /** Cuántas partidas quedan tras filtrar y cuántas hay en total, para el contador. */
  readonly resultCount = input.required<number>();
  readonly totalCount = input.required<number>();

  private readonly ui = inject(MatchHistoryUiState);
  private readonly store = inject(MatchHistoryStore);
  private readonly gameData = inject(GameDataStore);
  private readonly groupsStore = inject(GroupsStore);
  private readonly viewport = inject(Viewport);

  readonly filters = this.ui.filters;

  /**
   * Si la vista se mide contra TU participación (personal y cruzada) o contra los diez
   * participantes (grupo). Es lo que decide qué controles tienen sentido, y por eso se
   * pregunta esto y no el modo concreto: añadir una vista nueva no debe obligar a repasar
   * ocho condiciones sueltas.
   */
  protected readonly measuresMe = computed(() => this.mode() !== 'group');

  protected readonly showGroupFilter = computed(() => this.mode() === 'personal');

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

  protected readonly roleOptions: { value: Lane | 'all'; label: string; lane: Lane | null }[] = [
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

  protected readonly modeOptions: readonly NfComboboxOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'Competitivo', label: 'Competitivo' },
    { value: 'Casual', label: 'Casual' },
  ];

  protected readonly lobbyTypeOptions: readonly NfComboboxOption[] = [
    { value: 'all', label: 'Todas' },
    { value: 'Room', label: 'Room' },
    { value: 'Party', label: 'Party' },
  ];

  /**
   * Las ligas del usuario, del backend (`GroupsStore`), no del mock legacy de `core/lobby`. Es
   * la misma lista que pinta la barra lateral: si el desplegable ofreciese otros nombres, elegir
   * uno vaciaría la lista sin explicar por qué.
   */
  protected readonly groupComboboxOptions = computed<NfComboboxOption[]>(() => [
    { value: 'all', label: 'Todos los grupos' },
    ...this.groupsStore.groups().map((g) => ({ value: g.id, label: g.name })),
  ]);

  private readonly availableSeasons = computed<string[]>(() => {
    const ctxId = this.contextGroupId();
    const filterGroupId = this.filters().groupId;
    let matches: readonly Match[];
    if (ctxId) {
      matches = this.store.matchesByGroup(ctxId);
    } else if (filterGroupId !== 'all') {
      matches = this.store.matchesByGroup(filterGroupId);
    } else {
      matches = this.measuresMe() ? this.store.allPersonalMatches() : this.store.allMatches();
    }
    const set = new Set<string>();
    for (const m of matches) {
      const s = m.leagueName ?? m.group.seasonName;
      if (s) set.add(s);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  });

  protected readonly seasonOptions = computed<NfComboboxOption[]>(() => [
    { value: 'all', label: 'Todas' },
    ...this.availableSeasons().map((s) => ({ value: s, label: s })),
  ]);

  /** «18 de 47 partidas» — antes no había forma de saber cuánto había recortado el filtro. */
  protected readonly resultCountLabel = computed(() => {
    const total = this.totalCount();
    const shown = this.resultCount();
    const noun = total === 1 ? 'partida' : 'partidas';
    return shown === total ? `${total} ${noun}` : `${shown} de ${total} ${noun}`;
  });

  /** Solo los campeones que se han jugado de verdad en el contexto activo. */
  private readonly champions = computed(() => {
    const champMap = this.gameData.championById();
    const ctxId = this.contextGroupId();
    const filterGroupId = this.filters().groupId;

    let playedIds: readonly number[];
    const given = this.championIds();
    if (given) playedIds = given;
    else if (ctxId) playedIds = this.store.playedChampionIdsInGroup(ctxId);
    else if (filterGroupId !== 'all') playedIds = this.store.playedChampionIdsInGroup(filterGroupId);
    else playedIds = this.store.playedChampionIdsInPersonal();

    return playedIds
      .map((id) => ({ id, champion: champMap.get(id) }))
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

  protected readonly searchPlaceholder = computed(() =>
    this.measuresMe() ? 'Buscar jugador, campeón o grupo…' : 'Buscar jugador o campeón…',
  );

  private readonly playerRiotIds = computed(() => {
    const ctxId = this.contextGroupId();
    const matches = ctxId
      ? this.store.matchesByGroup(ctxId)
      : this.store.allPersonalMatches();
    const set = new Set<string>();
    for (const m of matches) {
      for (const p of [...m.blueTeam.participants, ...m.redTeam.participants]) {
        if (p.riotId) set.add(p.riotId);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  });

  protected readonly searchSuggestions = computed<SearchSuggestion[]>(() => {
    const raw = this.filters().searchQuery.trim();
    const q = normalize(raw);
    if (!q) return [];

    const results: SearchSuggestion[] = [];
    const isPersonal = this.measuresMe();

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

    // 2. Jugadores
    for (const riotId of this.playerRiotIds()) {
      const n = normalize(riotId);
      if (n.startsWith(q) || n.includes(q)) {
        results.push({
          key: `player-${riotId}`,
          type: 'player',
          label: riotId,
          sub: 'Jugador',
          tag: initialsOf(riotId),
          priority: n.startsWith(q) ? 1 : 2,
        });
      }
    }

    // 3. Grupos (solo en personal)
    if (this.showGroupFilter()) {
      for (const g of this.groupsStore.groups()) {
        const n = normalize(g.name);
        if (n.startsWith(q) || n.includes(q)) {
          results.push({
            key: `group-${g.id}`,
            type: 'group',
            label: g.name,
            sub: 'Grupo',
            tag: g.initials,
            priority: n.startsWith(q) ? 1 : 2,
          });
        }
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

  protected setRole(role: Lane | 'all'): void {
    this.ui.update({ role });
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

  protected setSeason(val: string): void {
    this.ui.update({ season: val || 'all' });
  }

  protected setGameMode(val: string): void {
    this.ui.update({ gameMode: (val || 'all') as MatchGameMode | 'all' });
  }

  protected setLobbyType(val: string): void {
    this.ui.update({ lobbyType: (val || 'all') as MatchLobbyType | 'all' });
  }

  protected setGroup(groupId: string): void {
    this.ui.update({ groupId: groupId || 'all' });
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

/** `Pix3lQueen#LAN` → `PI`. Marca al jugador en la sugerencia con su propio dato. */
function initialsOf(riotId: string): string {
  const name = riotId.split('#')[0] ?? riotId;
  return name.slice(0, 2).toUpperCase();
}
