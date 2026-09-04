import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { NfAvatar, NfSkeleton } from '../../../../ui';
import { GameDataStore } from '../../../../core/game-data';
import { MetagameBoard } from '../../../../core/group-stats';

/**
 * Metagame del grupo (§5.5.5, bloque 2): a quién se juega, a quién se banea y con
 * quién se gana.
 *
 * El generador solo manda `championId`: no conoce el catálogo real, así que el
 * nombre y el icono se resuelven aquí con `GameDataStore`, que es quien los tiene.
 * Mientras ese catálogo carga, cada fila pinta su hueco exacto en vez de un nombre
 * de mentira que luego cambie delante del usuario.
 */
@Component({
  selector: 'app-stats-metagame',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfSkeleton],
  template: `
    <section class="st-card" [attr.aria-busy]="busy() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Metagame del grupo</h2>
      </header>

      @if (loading()) {
        <div class="st-grid mg-boards">
          @for (s of [0, 1, 2]; track s) {
            <nf-skeleton width="100%" height="168px" radius="10px" />
          }
        </div>
      } @else if (boards().length) {
        <div class="st-grid mg-boards">
          @for (board of boards(); track board.id) {
            <article class="mg-board">
              <h3 class="mg-board__title">{{ board.title }}</h3>
              <p class="mg-board__note">{{ board.note }}</p>

              <ol class="mg-board__list">
                @for (entry of board.entries; track entry.championId; let i = $index) {
                  <li class="mg-entry">
                    <span class="mg-entry__rank nf-mono">{{ i + 1 }}</span>
                    <nf-avatar
                      [loading]="champsLoading()"
                      [src]="championIcon(entry.championId)"
                      [fallback]="championName(entry.championId)"
                      [tint]="entry.championId"
                      [size]="30"
                      shape="square"
                    />
                    <span class="mg-entry__meta">
                      @if (champsLoading()) {
                        <nf-skeleton width="86px" height="12px" />
                        <nf-skeleton width="112px" height="11px" />
                      } @else {
                        <span class="mg-entry__name">{{ championName(entry.championId) }}</span>
                        <span class="mg-entry__sub nf-mono">{{ entry.sub }}</span>
                      }
                    </span>
                    <span class="mg-entry__value nf-mono">{{ entry.value }}</span>
                  </li>
                }
              </ol>
            </article>
          }
        </div>
      } @else {
        <p class="st-card__empty">
          Todavía no hay partidas suficientes para saber a qué juega este grupo.
        </p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-metagame.component.scss'],
})
export class StatsMetagameComponent {
  readonly boards = input<readonly MetagameBoard[]>([]);
  readonly loading = input(false);

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');
  protected readonly busy = computed(() => this.loading() || this.champsLoading());

  protected championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  protected championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? 'Campeón';
  }
}
