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
import { Lane } from '../../../../core/matches/models';
import {
  NfAvatar,
  NfButton,
  NfCombobox,
  NfComboboxOption,
  NfLaneIcon,
  NfSegmentOption,
  NfSegmented,
  NfSelect,
  NfSelectOption,
  NfSheet,
} from '../../../../ui';
import { Viewport } from '../../../../shared/viewport';
import { MatchHistoryUiState } from './match-history-ui';

/** Un filtro puesto, tal y como se pinta en la fila de chips. */
interface ActiveChip {
  key: string;
  label: string;
  clear: () => void;
}

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
  imports: [NgTemplateOutlet, NfAvatar, NfButton, NfCombobox, NfLaneIcon, NfSegmented, NfSelect, NfSheet],
  styleUrl: './match-filters.component.scss',
  template: `
    <div class="m-filters">
      <!-- FILA 1: búsqueda libre + cuánto queda tras filtrar -->
      <div class="m-filters__search-row">
        <div class="m-filters__search-wrap" (focusout)="onSearchBlur($event)">
          <input
            type="search"
            class="m-filters__search"
            autocomplete="off"
            [placeholder]="searchPlaceholder()"
            aria-label="Buscar en el historial"
            [value]="filters().searchQuery"
            (focus)="onSearchFocus()"
            (input)="onSearchInput($event)"
            (keydown)="onSearchKeydown($event)"
          />
          @if (searchOpen() && searchSuggestions().length > 0) {
            <ul class="m-filters__suggest-list" role="listbox">
              @for (opt of searchSuggestions(); track opt.key; let i = $index) {
                <li
                  class="m-filters__suggest-option"
                  [class.is-active]="i === searchActiveIndex()"
                  role="option"
                  (pointerdown)="chooseSuggestion(opt, $event)"
                  (mouseenter)="searchActiveIndex.set(i)"
                >
                  @if (opt.iconUrl) {
                    <nf-avatar [src]="opt.iconUrl" [fallback]="opt.label" [tint]="opt.tint ?? 0" [size]="22" shape="square" />
                  } @else {
                    <span class="m-filters__suggest-tag nf-mono">{{ opt.tag }}</span>
                  }
                  <div class="m-filters__suggest-info">
                    <span class="m-filters__suggest-label">{{ opt.label }}</span>
                    <span class="m-filters__suggest-type nf-mono">{{ opt.sub }}</span>
                  </div>
                </li>
              }
            </ul>
          }
        </div>
        <span class="m-filters__count nf-mono" aria-live="polite">
          {{ resultCountLabel() }}
        </span>
      </div>

      <!-- FILA 2: lo que hay puesto ahora mismo, y cómo quitarlo -->
      @if (chips().length > 0) {
        <div class="m-filters__chips">
          @for (chip of chips(); track chip.key) {
            <button
              type="button"
              class="m-chip"
              [attr.aria-label]="'Quitar el filtro ' + chip.label"
              (click)="chip.clear()"
            >
              <span class="m-chip__label">{{ chip.label }}</span>
            </button>
          }
          <button type="button" class="m-chip m-chip--clear nf-mono" (click)="reset()">
            Limpiar todo
          </button>
        </div>
      }

      <!-- FILA 3: los filtros estructurados.
           En escritorio, en su sitio de siempre. En móvil, dentro del panel inferior: son
           los mismos controles y el mismo estado, montados en otro contenedor. -->
      @if (isMobile()) {
        <button type="button" class="m-filters__more" (click)="sheetOpen.set(true)">
          <span>Filtros</span>
          @if (chips().length > 0) {
            <span class="m-filters__more-count nf-mono">{{ chips().length }}</span>
          }
        </button>

        @if (sheetOpen()) {
          <nf-sheet title="Filtros" (closed)="sheetOpen.set(false)">
            <div class="m-filters__controls m-filters__controls--sheet">
              <ng-container [ngTemplateOutlet]="controls" />
            </div>
            <!--
              Los filtros ya se aplican en vivo, así que este pie no confirma nada: el CTA
              solo cierra el panel, y su texto es el resultado que se va a encontrar detrás.
              Un botón «Aplicar» de verdad exigiría un segundo estado en vuelo y dos fuentes
              de verdad para lo mismo.
            -->
            <div sheetFoot class="m-filters__sheet-foot">
              <button nfButton variant="secondary" size="md" (click)="reset()">
                Limpiar todo
              </button>
              <button nfButton variant="primary" size="md" (click)="sheetOpen.set(false)">
                {{ applyLabel() }}
              </button>
            </div>
          </nf-sheet>
        }
      } @else {
        <div class="m-filters__controls">
          <ng-container [ngTemplateOutlet]="controls" />
        </div>
      }
    </div>

    <ng-template #controls>
      <!--
        La posición solo se ofrece en el historial personal, donde significa «las partidas que
        jugaste TÚ en esa línea». En el de grupo se medía contra los diez participantes, y un
        5v5 completo siempre cubre las cinco posiciones: el control se pintaba, ponía su chip
        de filtro activo y no descartaba ni una partida.
      -->
      @if (isCross()) {
        <div class="m-field">
          <span class="m-field__label nf-mono">Relación</span>
          <nf-segmented
            [options]="relationOptions"
            [value]="filters().relation"
            (valueChange)="setRelation($event)"
            ariaLabel="Filtrar por cómo coincidisteis"
          />
        </div>
      }

      @if (measuresMe()) {
        <div class="m-field">
          <span class="m-field__label nf-mono" id="mf-role">Posición</span>
          <div class="m-role-pills" role="radiogroup" aria-labelledby="mf-role">
            @for (r of roleOptions; track r.value) {
              <button
                type="button"
                role="radio"
                class="m-role-pill"
                [class.is-active]="filters().role === r.value"
                [attr.aria-checked]="filters().role === r.value"
                [attr.aria-label]="r.label"
                [attr.tabindex]="filters().role === r.value ? 0 : -1"
                (click)="setRole(r.value)"
              >
                @if (r.lane; as lane) {
                  <nf-lane-icon [lane]="lane" mode="tinted" />
                } @else {
                  <span class="m-role-pill__text nf-mono">{{ r.label }}</span>
                }
              </button>
            }
          </div>
        </div>

        <div class="m-field">
          <span class="m-field__label nf-mono">Resultado</span>
          <nf-segmented
            [options]="outcomeOptions"
            [value]="filters().outcome"
            (valueChange)="setOutcome($event)"
            ariaLabel="Filtrar por resultado"
          />
        </div>
      } @else {
        <div class="m-field">
          <span class="m-field__label nf-mono">Bando ganador</span>
          <nf-segmented
            [options]="sideOptions"
            [value]="filters().winningSide"
            (valueChange)="setWinningSide($event)"
            ariaLabel="Filtrar por bando ganador"
          />
        </div>

        <div class="m-field">
          <span class="m-field__label nf-mono">Participación</span>
          <nf-segmented
            [options]="participationOptions"
            [value]="filters().participation"
            (valueChange)="setParticipation($event)"
            ariaLabel="Filtrar por tu participación"
          />
        </div>
      }

      <div class="m-field m-field--champion">
        <span class="m-field__label nf-mono">Campeón</span>
        <nf-combobox
          [options]="championOptions()"
          [value]="selectedChampionValue()"
          (valueChange)="setChampion($event)"
          placeholder="Todos los campeones"
          ariaLabel="Filtrar por campeón"
          emptyText="Ningún campeón jugado coincide"
        />
      </div>

      @if (showGroupFilter()) {
        <div class="m-field m-field--group">
          <span class="m-field__label nf-mono">Grupo</span>
          <nf-select
            [options]="groupOptions()"
            [value]="filters().groupId"
            (valueChange)="setGroup($event)"
          />
        </div>
      }

      <div class="m-field m-field--sort">
      <span class="m-field__label nf-mono">Orden</span>
      <nf-select [options]="sortOptions" [value]="filters().sortBy" (valueChange)="setSort($event)" />
      </div>
    </ng-template>
  `,
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

  protected readonly sortOptions: NfSelectOption[] = SORT_OPTIONS.map((o) => ({ ...o }));

  /**
   * Las ligas del usuario, del backend (`GroupsStore`), no del mock legacy de `core/lobby`. Es
   * la misma lista que pinta la barra lateral: si el desplegable ofreciese otros nombres, elegir
   * uno vaciaría la lista sin explicar por qué.
   */
  protected readonly groupOptions = computed<NfSelectOption[]>(() => [
    { value: 'all', label: 'Todos los grupos' },
    ...this.groupsStore.groups().map((g) => ({ value: g.id, label: g.name })),
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

  protected readonly chips = computed<ActiveChip[]>(() => {
    const f = this.filters();
    const isPersonal = this.measuresMe();
    const chips: ActiveChip[] = [];

    if (this.isCross() && f.relation !== 'all') {
      chips.push({
        key: 'relation',
        label: f.relation === 'ally' ? 'Juntos' : 'En contra',
        clear: () => this.ui.update({ relation: 'all' }),
      });
    }

    if (f.searchQuery.trim()) {
      chips.push({
        key: 'search',
        label: `«${f.searchQuery.trim()}»`,
        clear: () => this.ui.update({ searchQuery: '' }),
      });
    }
    if (isPersonal && f.role !== 'all') {
      // Por la función de etiqueta: el enum en crudo pintaba «SUPPORT» en el chip.
      chips.push({
        key: 'role',
        label: laneLabel(f.role),
        clear: () => this.ui.update({ role: 'all' }),
      });
    }
    if (f.championId !== 'all') {
      const champ = this.champions().find((c) => c.id === f.championId);
      chips.push({
        key: 'champion',
        label: champ?.name ?? 'Campeón',
        clear: () => this.ui.update({ championId: 'all' }),
      });
    }
    if (isPersonal && f.outcome !== 'all') {
      chips.push({
        key: 'outcome',
        label: f.outcome === 'win' ? 'Victorias' : 'Derrotas',
        clear: () => this.ui.update({ outcome: 'all' }),
      });
    }
    if (this.showGroupFilter() && f.groupId !== 'all') {
      const group = this.groupsStore.groups().find((g) => g.id === f.groupId);
      chips.push({
        key: 'group',
        label: group?.name ?? 'Grupo',
        clear: () => this.ui.update({ groupId: 'all' }),
      });
    }
    if (this.mode() === 'group' && f.winningSide !== 'all') {
      chips.push({
        key: 'side',
        label: f.winningSide === 'blue' ? 'Ganó el azul' : 'Ganó el rojo',
        clear: () => this.ui.update({ winningSide: 'all' }),
      });
    }
    if (this.mode() === 'group' && f.participation !== 'all') {
      chips.push({
        key: 'participation',
        label: f.participation === 'mine' ? 'Mis partidas' : 'Otras partidas',
        clear: () => this.ui.update({ participation: 'all' }),
      });
    }
    return chips;
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

  protected setGroup(groupId: string): void {
    this.ui.update({ groupId });
  }

  protected setSort(sortBy: string): void {
    this.ui.update({ sortBy: sortBy as MatchSortBy });
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
