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
  template: `
    <div class="m-filters">
      <!-- FILA 1: búsqueda libre + cuánto queda tras filtrar -->
      <div class="m-filters__search-row">
        <div class="m-filters__search-wrap" (focusout)="onSearchBlur($event)">
          <input
            type="search"
            class="m-filters__search"
            autocomplete="off"
            placeholder="Buscar jugador o campeón…"
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

      <!-- FILA 2: los filtros estructurados.
           En escritorio, en su sitio de siempre. En móvil, dentro del panel inferior: son
           los mismos controles y el mismo estado, montados en otro contenedor. -->
      @if (isMobile()) {
        <button type="button" class="m-filters__more" (click)="sheetOpen.set(true)">
          <span>Filtros</span>
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
          <span class="m-field__label nf-mono" id="mf-lane">Posición</span>
          <div class="m-role-pills" role="radiogroup" aria-labelledby="mf-lane">
            @for (r of laneOptions; track r.value) {
              <button
                type="button"
                role="radio"
                class="m-role-pill"
                [class.is-active]="filters().lane === r.value"
                [attr.aria-checked]="filters().lane === r.value"
                [attr.aria-label]="r.label"
                [attr.tabindex]="filters().lane === r.value ? 0 : -1"
                (click)="setLane(r.value)"
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

      <!--
        La modalidad con la que se abrió la sala. Sustituye a los antiguos «Modalidad» y «Sala»:
        «Room»/«Party» no existe en el backend, y el control estuvo ofreciendo un filtro por un
        concepto que no es de nadie.
      -->
      <div class="m-field m-field--preset">
        <span class="m-field__label nf-mono">Modalidad</span>
        <nf-combobox
          [options]="presetOptions"
          [value]="filters().preset"
          (valueChange)="setPreset($event)"
          [clearable]="false"
          placeholder="Todas"
          ariaLabel="Filtrar por modalidad"
        />
      </div>

      <!--
        La temporada, solo donde se puede saber cuáles hay: las ligas se piden por grupo
        (GET /groups/:id/leagues), así que en el historial personal —que cruza grupos— no hay
        lista que ofrecer. Un desplegable vacío sería peor que ninguno.
      -->
      @if (leagueOptions().length > 1) {
        <div class="m-field m-field--league">
          <span class="m-field__label nf-mono">Temporada</span>
          <nf-combobox
            [options]="leagueOptions()"
            [value]="filters().leagueId"
            (valueChange)="setLeague($event)"
            [clearable]="false"
            placeholder="Todas"
            ariaLabel="Filtrar por temporada"
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

      <div class="m-field m-field--sort">
        <span class="m-field__label nf-mono">Orden</span>
        <nf-combobox
          [options]="sortComboboxOptions"
          [value]="filters().sortBy"
          (valueChange)="setSort($event)"
          [clearable]="false"
          placeholder="Más recientes"
          ariaLabel="Ordenar por"
        />
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


