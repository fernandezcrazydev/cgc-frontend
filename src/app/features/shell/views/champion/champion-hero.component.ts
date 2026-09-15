import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChampionDetail, ChampionSummary } from '../../../../core/game-data/models';
import { ChampionStats } from '../../../../core/champions';
import { championTagLabel } from '../../../../shared/champion-tags';

@Component({
  selector: 'app-champion-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="c-alt1">
      <div class="c-alt1__splash-box">
        @if (splash()) {
          <img [src]="splash()" [alt]="name()" class="c-alt1__splash-img" />
        }
        <div class="c-alt1__overlay"></div>
        <div class="c-alt1__identity">
          <h2 class="c-alt1__name">{{ name() }}</h2>
          <div class="c-alt1__meta">
            <span class="c-alt1__title">{{ title() }}</span>
            <div class="c-alt1__chips">
              @for (tag of tags(); track tag) {
                <span class="c-alt1__chip">{{ tag }}</span>
              }
              <span class="c-alt1__role nf-mono">{{ role() }}</span>
            </div>
          </div>
        </div>
        <div class="c-alt1__tier nf-mono">{{ tier() }}</div>
      </div>
      <div class="c-alt1__stats">
        <div class="c-alt1__stat">
          <span class="c-alt1__stat-val nf-mono">{{ partidas() }}</span>
          <span class="c-alt1__stat-lbl">PARTIDAS</span>
        </div>
        <div class="c-alt1__stat">
          <span
            class="c-alt1__stat-val nf-mono"
            [class.c-alt1__stat-val--success]="winrateNum() !== null && winrateNum()! >= 50"
            [class.c-alt1__stat-val--danger]="winrateNum() !== null && winrateNum()! < 50"
          >{{ winrateText() }}</span>
          <span class="c-alt1__stat-lbl">{{ recordText() }}</span>
        </div>
        <div class="c-alt1__stat">
          <span class="c-alt1__stat-val nf-mono">{{ presencia() }}</span>
          <span class="c-alt1__stat-lbl">PRESENCIA</span>
        </div>
        <div class="c-alt1__stat">
          <span class="c-alt1__stat-val nf-mono">{{ kda() }}</span>
          <span class="c-alt1__stat-lbl">KDA</span>
        </div>
        <div class="c-alt1__stat">
          <span class="c-alt1__stat-val nf-mono">{{ banrate() }}</span>
          <span class="c-alt1__stat-lbl">BANRATE</span>
        </div>
      </div>
    </article>
  `,
  styleUrls: ['./champion-hero.component.scss'],
})
export class ChampionHeroComponent {
  readonly detail = input<ChampionDetail | null>(null);
  readonly summary = input<ChampionSummary | null>(null);
  readonly stats = input<ChampionStats | null>(null);

  protected readonly splash = computed(() => this.detail()?.splashUrl ?? this.summary()?.loadingUrl ?? '');
  protected readonly name = computed(() => this.detail()?.name ?? this.summary()?.name ?? 'Campeón');
  protected readonly title = computed(() => this.detail()?.title ?? this.summary()?.title ?? '');
  protected readonly tags = computed(() => {
    const raw = this.detail()?.tags ?? this.summary()?.tags ?? [];
    return raw.map(championTagLabel);
  });
  protected readonly role = computed(() => this.stats()?.role ?? '—');
  protected readonly tier = computed(() => this.stats()?.tier ?? '—');

  protected readonly partidas = computed(() => (this.stats() ? String(this.stats()!.games) : '—'));
  protected readonly winrateNum = computed(() => (this.stats() ? this.stats()!.winrate : null));
  protected readonly winrateText = computed(() => (this.stats() ? `${this.stats()!.winrate}%` : '—'));
  protected readonly recordText = computed(() =>
    this.stats() ? `${this.stats()!.wins}V-${this.stats()!.losses}D · WR` : 'V-D · WR',
  );
  protected readonly presencia = computed(() => (this.stats() ? `${this.stats()!.pickrate}%` : '—'));
  protected readonly kda = computed(() => (this.stats() ? this.stats()!.kdaRatio : '—'));
  protected readonly banrate = computed(() => (this.stats() ? `${this.stats()!.banRate}%` : '—'));
}
