import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChampionPlayerStats } from '../../../../core/champions';
import { NfAvatar } from '../../../../ui';

@Component({
  selector: 'app-champion-specialists-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar],
  template: `
    <article class="cf-card-inner cf-espec-card">
      <h2 class="cf-card__title">{{ title() }}</h2>
      <div class="cf-card__content cf-espec-list">
        @for (esp of topPlayers(); track esp.riotId) {
          <div class="cf-espec-row">
            <div class="cf-espec-top">
              <a
                class="cf-espec-user"
                [routerLink]="['/app', 'jugador', esp.riotId]"
                [attr.title]="'Ver perfil de ' + esp.displayName"
              >
                <nf-avatar [fallback]="esp.displayName" [src]="esp.avatarUrl" [size]="28" shape="square" />
                <span class="cf-espec-name">{{ esp.displayName }}</span>
              </a>
              <div class="cf-espec-top-right nf-mono">
                <span class="cf-espec-record">{{ esp.wins }}V-{{ esp.losses }}D</span>
                <span
                  class="cf-espec-wr"
                  [class.cf-espec-wr--success]="esp.winrate >= 50"
                  [class.cf-espec-wr--danger]="esp.winrate < 50"
                >{{ esp.winrate }}%</span>
              </div>
            </div>
            <div class="cf-espec-bar">
              <div
                class="cf-bar-fill"
                [class.cf-bar-fill--success]="esp.winrate >= 50"
                [class.cf-bar-fill--danger]="esp.winrate < 50"
                [style.width.%]="esp.winrate"
              >
                @if (esp.winrate > 0) {
                  <span class="cf-bubble"></span>
                  <span class="cf-bubble"></span>
                  <span class="cf-bubble"></span>
                  <span class="cf-bubble"></span>
                  <span class="cf-bubble"></span>
                  <span class="cf-bubble"></span>
                }
              </div>
            </div>
            <div class="cf-espec-bottom">
              <span class="cf-espec-kda-line nf-mono">KDA {{ esp.kdaRatio }} · {{ esp.games }} partidas</span>
            </div>
          </div>
        } @empty {
          <p class="cf-espec-empty">No hay especialistas registrados todavía.</p>
        }
      </div>
    </article>
  `,
  styleUrls: ['./champion-specialists-card.component.scss'],
})
export class ChampionSpecialistsCardComponent {
  readonly players = input.required<ChampionPlayerStats[]>();
  readonly hasGroup = input<boolean>(true);

  protected readonly title = computed(() => (this.hasGroup() ? 'Especialistas del grupo' : 'Especialistas'));
  protected readonly topPlayers = computed(() => this.players().slice(0, 3));
}
