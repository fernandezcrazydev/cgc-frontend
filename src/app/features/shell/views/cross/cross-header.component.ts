import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar } from '../../../../ui';
import { Session } from '../../../../core/auth';
import { RiotAccountStore } from '../../../../core/riot';
import { CrossViewState } from './cross-view-state';

export type CrossActiveTab = 'contra' | 'juntos' | 'historial';

@Component({
  selector: 'app-cross-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar],
  template: `
    @if (state.player(); as p) {
      <div class="cx-card-hero">
        <!-- Topbar integrada con breadcrumbs y contexto -->
        <div class="cx-topbar">
          <a class="cx-topbar__back nf-mono" [routerLink]="['/app', 'perfil', p.tag]">
            <span class="cx-topbar__arrow" aria-hidden="true">←</span>
            Volver al perfil de {{ p.name }}
          </a>
          <span class="cx-topbar__context nf-mono">Historial Cruzado</span>
        </div>

        <!-- Arena 1v1 Centrada y Simétrica -->
        <div class="cx-arena">
          <!-- Luchador 1: Tú -->
          <div class="cx-fighter cx-fighter--me">
            <a
              class="cx-fighter__avatar-link"
              [routerLink]="['/app', 'perfil']"
              title="Ver mi perfil"
            >
              <nf-avatar
                [src]="session.avatarUrl()"
                [fallback]="session.displayName() || 'Tú'"
                [size]="52"
                shape="round"
                alt="Tu avatar"
              />
            </a>
            <div class="cx-fighter__info cx-fighter__info--me">
              <a
                class="cx-fighter__summoner"
                [routerLink]="['/app', 'perfil']"
                title="Ver mi perfil"
              >
                {{ mySummonerName() }}
              </a>
              <span class="cx-fighter__discord nf-mono">{{ myDiscordName() }}</span>
            </div>
          </div>

          <!-- VS Badge Central -->
          <div class="cx-vs-badge">
            <span class="cx-vs-badge__emblem nf-mono">VS</span>
            <span class="cx-vs-badge__count nf-mono">
              {{ totalMatches() }} {{ totalMatches() === 1 ? 'partida' : 'partidas' }}
            </span>
          </div>

          <!-- Luchador 2: Rival -->
          <div class="cx-fighter cx-fighter--them">
            <div class="cx-fighter__info cx-fighter__info--them">
              <a
                class="cx-fighter__summoner"
                [routerLink]="['/app', 'perfil', p.tag]"
                title="Ver perfil de {{ p.name }}"
              >
                {{ theirSummonerName() }}
              </a>
              <span class="cx-fighter__discord nf-mono">{{ theirDiscordName() }}</span>
            </div>
            <a
              class="cx-fighter__avatar-link"
              [routerLink]="['/app', 'perfil', p.tag]"
              title="Ver perfil de {{ p.name }}"
            >
              <nf-avatar
                [src]="p.avatarUrl"
                [fallback]="p.name"
                [tint]="p.hue"
                [size]="52"
                shape="round"
                [alt]="'Avatar de ' + p.name"
              />
            </a>
          </div>
        </div>
      </div>

      <!-- Pestañas de navegación instantánea full-width sin emojis -->
      <nav class="cx-nav-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          class="cx-nav-tab nf-mono"
          [class.is-active]="activeTab() === 'contra'"
          [attr.aria-selected]="activeTab() === 'contra'"
          (click)="tabChange.emit('contra')"
        >
          <span>Cara a Cara</span>
          <span class="cx-nav-tab__count">({{ enemyAgg().games }})</span>
        </button>
        <button
          type="button"
          role="tab"
          class="cx-nav-tab nf-mono"
          [class.is-active]="activeTab() === 'juntos'"
          [attr.aria-selected]="activeTab() === 'juntos'"
          (click)="tabChange.emit('juntos')"
        >
          <span>Sinergia</span>
          <span class="cx-nav-tab__count">({{ allyAgg().games }})</span>
        </button>
        <button
          type="button"
          role="tab"
          class="cx-nav-tab nf-mono"
          [class.is-active]="activeTab() === 'historial'"
          [attr.aria-selected]="activeTab() === 'historial'"
          (click)="tabChange.emit('historial')"
        >
          <span>Historial Completo</span>
          <span class="cx-nav-tab__count">({{ totalMatches() }})</span>
        </button>
      </nav>
    }
  `,
  styleUrl: './cross-header.component.scss',
})
export class CrossHeaderComponent {
  readonly activeTab = input<CrossActiveTab>('contra');
  readonly tabChange = output<CrossActiveTab>();

  readonly state = inject(CrossViewState);
  readonly session = inject(Session);
  private readonly riot = inject(RiotAccountStore);

  readonly totalMatches = computed(() => this.state.all().length);
  readonly enemyAgg = computed(() => this.state.aggregateEnemies());
  readonly allyAgg = computed(() => this.state.aggregateAllies());

  readonly mySummonerName = computed(
    () => this.riot.account()?.riotId || this.session.displayName() || 'Invocador',
  );
  readonly myDiscordName = computed(() => this.session.displayName() || 'Discord');

  readonly theirSummonerName = computed(
    () => this.state.player()?.tag || this.state.player()?.name || 'Rival',
  );
  readonly theirDiscordName = computed(() => this.state.player()?.name || 'Discord');
}
