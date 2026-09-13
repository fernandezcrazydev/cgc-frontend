import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ChampionPairing } from '../../../../core/champions';
import { GameDataStore } from '../../../../core/game-data';
import { NfCombobox, NfComboboxOption, NfIconButton } from '../../../../ui';

interface MatchupTileDisplay {
  championId: number;
  name: string;
  iconUrl: string;
  winrate: number;
  games: number;
}

@Component({
  selector: 'app-champion-matchups-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfIconButton, NfCombobox],
  template: `
    <article class="cf-card-inner d-alt4">
      <header class="d-card-header">
        <h2 class="cf-card__title">{{ title() }}</h2>
        <div class="d-card-actions">
          <button
            nfIconButton
            variant="ghost"
            size="sm"
            [label]="searchButtonLabel()"
            class="d-card-search-toggle"
            (click)="toggleSearch()"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </button>
        </div>
      </header>

      @if (isSearchOpen()) {
        <div class="d-card-search-row">
          <nf-combobox
            [options]="comboboxOptions()"
            [value]="selectedChampion()"
            (valueChange)="selectedChampion.set($event)"
            placeholder="Buscar campeón..."
            [ariaLabel]="comboboxAriaLabel()"
          />
        </div>
      }

      <div class="cf-card__content d-alt4__body">
        <div class="d-alt4__tiles">
          @for (item of displayedTiles(); track item.championId) {
            <div class="d-alt4__tile">
              <img
                [src]="item.iconUrl"
                [alt]="item.name"
                [title]="item.name"
                class="d-alt4__icon"
                [class.d-alt4__icon--ally]="kind() === 'ally'"
                [class.d-alt4__icon--rival]="kind() === 'rival'"
              />
              <span
                class="d-alt4__wr nf-mono"
                [class.d-alt4__wr--ally]="kind() === 'ally'"
                [class.d-alt4__wr--rival]="kind() === 'rival'"
              >{{ item.winrate }}%</span>
              <span class="d-alt4__games nf-mono">{{ item.games }}p</span>
            </div>
          } @empty {
            <p class="d-common-empty">{{ emptyText() }}</p>
          }
        </div>
      </div>
    </article>
  `,
  styleUrls: ['./champion-matchups-card.component.scss'],
})
export class ChampionMatchupsCardComponent {
  readonly title = input.required<string>();
  readonly entries = input.required<ChampionPairing[]>();
  readonly kind = input.required<'ally' | 'rival'>();
  readonly isSearchOpen = input<boolean>(false);
  readonly searchToggled = output<boolean>();

  private readonly gameData = inject(GameDataStore);

  readonly selectedChampion = signal<string>('');

  constructor() {
    effect(() => {
      if (!this.isSearchOpen()) {
        this.selectedChampion.set('');
      }
    });
  }

  protected readonly searchButtonLabel = computed(() =>
    this.kind() === 'ally' ? 'Buscar sinergia por campeón' : 'Buscar counter por campeón',
  );

  protected readonly comboboxAriaLabel = computed(() =>
    this.kind() === 'ally' ? 'Filtrar sinergia por campeón' : 'Filtrar counter por campeón',
  );

  protected readonly emptyText = computed(() =>
    this.kind() === 'ally'
      ? 'No hay datos de sinergia registrados.'
      : 'No hay datos de enfrentamientos registrados.',
  );

  protected readonly comboboxOptions = computed<NfComboboxOption[]>(() => {
    const champMap = this.gameData.championById();
    const list = this.entries();
    return list
      .map((entry) => {
        const info = champMap.get(entry.championId);
        const name = info?.name ?? `Campeón ${entry.championId}`;
        const iconUrl = info?.iconUrl ?? '';
        return {
          value: String(entry.championId),
          label: name,
          iconUrl,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  protected readonly displayedTiles = computed<MatchupTileDisplay[]>(() => {
    const champMap = this.gameData.championById();
    const sel = this.selectedChampion();
    const list = this.entries();

    let filtered: ChampionPairing[];
    if (sel) {
      const match = list.find((e) => String(e.championId) === sel);
      filtered = match ? [match] : [];
    } else {
      filtered = list.slice(0, 4);
    }

    return filtered.map((entry) => {
      const info = champMap.get(entry.championId);
      return {
        championId: entry.championId,
        name: info?.name ?? `Campeón ${entry.championId}`,
        iconUrl: info?.iconUrl ?? '',
        winrate: entry.winrate,
        games: entry.games,
      };
    });
  });

  toggleSearch(): void {
    this.searchToggled.emit(!this.isSearchOpen());
  }
}
