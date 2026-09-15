import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ChampionItemStats, ChampionRunePage } from '../../../../core/champions';
import { GameDataStore } from '../../../../core/game-data';

interface RuneDisplayItem {
  id: number;
  name: string;
  iconUrl: string;
}

const STAT_MODS: Record<number, { name: string; file: string }> = {
  5008: { name: 'Fuerza Adaptable', file: 'statmodsadaptiveforceicon.png' },
  5005: { name: 'Velocidad de Ataque', file: 'statmodsattackspeedicon.png' },
  5007: { name: 'Aceleración de Habilidad', file: 'statmodscdrscalingicon.png' },
  5010: { name: 'Velocidad de Movimiento', file: 'statmodsmovementspeed.png' },
  5001: { name: 'Salud', file: 'statmodshealthplusicon.png' },
  5011: { name: 'Salud Progresiva', file: 'statmodshealthscalingicon.png' },
  5013: { name: 'Tenacidad', file: 'statmodstenacityicon.png' },
};

@Component({
  selector: 'app-champion-builds-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="cf-card-inner b-alt4">
      <header class="b-alt4__header">
        <h2 class="cf-card__title">Objetos y runas</h2>
        <p class="b-alt4__subtitle">{{ subtitle() }}</p>
      </header>
      <div class="cf-card__content b-alt4__body">
        <div class="b-alt4__section">
          <div class="b-alt4__items-scroll">
            <div class="b-alt4__items-grid">
              @for (obj of items(); track obj.itemId) {
                <div class="b-alt4__item-tile">
                  @if (itemIcon(obj.itemId); as icon) {
                    <img
                      [src]="icon"
                      [alt]="itemName(obj.itemId)"
                      [title]="itemName(obj.itemId)"
                      class="b-alt4__item-icon"
                    />
                  } @else {
                    <div
                      class="b-alt4__item-icon"
                      [title]="itemName(obj.itemId)"
                      [attr.aria-label]="itemName(obj.itemId)"
                    ></div>
                  }
                  <span class="b-alt4__item-wr nf-mono">{{ obj.winrate }}%</span>
                </div>
              }
            </div>
          </div>
        </div>
        <div class="b-alt4__divider"></div>
        <div class="b-alt4__section">
          @if (runePage(); as page) {
            <div class="b-alt4__runes-scroll">
              <div class="b-alt4__runes-strip">
                <div class="b-alt4__rune-group">
                  @if (keystoneDisplay(); as ks) {
                    <img
                      [src]="ks.iconUrl"
                      [alt]="ks.name"
                      [title]="ks.name"
                      class="b-alt4__keystone"
                    />
                  }
                  @for (r of primaryRunesDisplay(); track r.id) {
                    <img
                      [src]="r.iconUrl"
                      [alt]="r.name"
                      [title]="r.name"
                      class="b-alt4__rune"
                    />
                  }
                </div>
                <div class="b-alt4__rune-group b-alt4__rune-group--bordered">
                  @for (r of secondaryRunesDisplay(); track r.id) {
                    <img
                      [src]="r.iconUrl"
                      [alt]="r.name"
                      [title]="r.name"
                      class="b-alt4__rune"
                    />
                  }
                </div>
                <div class="b-alt4__rune-group b-alt4__rune-group--bordered">
                  @for (s of shardsDisplay(); track $index) {
                    <img
                      [src]="s.iconUrl"
                      [alt]="s.name"
                      [title]="s.name"
                      class="b-alt4__shard"
                    />
                  }
                </div>
              </div>
            </div>
            <p class="b-alt4__record-text nf-mono">
              Página más repetida · {{ page.games }} de {{ totalGames() }} partidas · {{ page.winrate }}% de victorias
            </p>
          } @else {
            <p class="b-alt4__record-text nf-mono">Sin datos de página de runas completa.</p>
          }
        </div>
      </div>
    </article>
  `,
  styleUrls: ['./champion-builds-card.component.scss'],
})
export class ChampionBuildsCardComponent {
  readonly items = input.required<ChampionItemStats[]>();
  readonly runePage = input<ChampionRunePage | null>(null);
  readonly totalGames = input.required<number>();
  readonly championName = input.required<string>();
  readonly hasGroup = input<boolean>(true);

  private readonly gameData = inject(GameDataStore);

  protected readonly subtitle = computed(() => {
    const n = this.totalGames();
    const name = this.championName();
    return this.hasGroup()
      ? `Sobre las ${n} partidas con ${name} registradas en el grupo.`
      : `Sobre las ${n} partidas con ${name} en todos tus grupos.`;
  });

  protected itemIcon(id: number): string {
    const item = this.gameData.item(id)();
    return item?.iconUrl ?? '';
  }

  protected itemName(id: number): string {
    const item = this.gameData.item(id)();
    return item?.name ?? `Objeto #${id}`;
  }

  protected readonly keystoneDisplay = computed<RuneDisplayItem | null>(() => {
    const page = this.runePage();
    if (!page) return null;
    return this.resolveRune(page.keystoneId);
  });

  protected readonly primaryRunesDisplay = computed<RuneDisplayItem[]>(() => {
    const page = this.runePage();
    if (!page) return [];
    return page.primaryRuneIds.map((id) => this.resolveRune(id));
  });

  protected readonly secondaryRunesDisplay = computed<RuneDisplayItem[]>(() => {
    const page = this.runePage();
    if (!page) return [];
    return page.secondaryRuneIds.map((id) => this.resolveRune(id));
  });

  protected readonly shardsDisplay = computed<RuneDisplayItem[]>(() => {
    const page = this.runePage();
    if (!page) return [];
    return page.statShardIds.map((id) => this.resolveShard(id));
  });

  private resolveRune(id: number): RuneDisplayItem {
    const perk = this.gameData.perkById().get(id);
    if (perk) {
      return { id, name: perk.name, iconUrl: perk.iconUrl };
    }
    return {
      id,
      name: `Runa #${id}`,
      iconUrl: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/styles/runes/${id}.png`,
    };
  }

  private resolveShard(id: number): RuneDisplayItem {
    const mod = STAT_MODS[id];
    if (mod) {
      return {
        id,
        name: mod.name,
        iconUrl: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/${mod.file}`,
      };
    }
    const perk = this.gameData.perkById().get(id);
    if (perk) {
      return { id, name: perk.name, iconUrl: perk.iconUrl };
    }
    return {
      id,
      name: `Fragmento #${id}`,
      iconUrl: 'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/statmodshealthplusicon.png',
    };
  }
}
