import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { NfAvatar, NfSkeleton } from '../../../../ui';
import { GameDataStore } from '../../../../core/game-data';
import { MemberStats, playerTiles } from '../../../../core/group-stats';

/**
 * Líderes de rendimiento individual (§5.5.5, bloque 4): la tabla completa del grupo,
 * ordenada por la valoración compuesta, con cada fila desplegable.
 *
 * La fila abierta enseña el desglose de `playerTiles()` y el campeón que más juega
 * esa persona. El estado de qué fila está abierta NO vive aquí: es estado de
 * interfaz de la vista, que lo sincroniza con el parámetro `?jugador=` de la URL
 * para que un enlace pueda abrir directamente a alguien.
 */
@Component({
  selector: 'app-stats-leaders',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfSkeleton],
  template: `
    <section class="st-card" [attr.aria-busy]="busy() ? 'true' : null">
      <header class="st-card__head">
        <h2 class="st-card__title">Líderes de rendimiento individual</h2>
      </header>
      <p class="st-card__note">Pulsa cualquier fila para ver su desglose completo.</p>

      @if (loading()) {
        @for (s of [0, 1, 2, 3, 4]; track s) {
          <nf-skeleton width="100%" height="46px" radius="9px" />
        }
      } @else if (rows().length) {
        <div class="ld-table">
          <div class="ld-head" aria-hidden="true">
            <span>Jugador</span>
            <span>KDA medio</span>
            <span>CS por minuto</span>
            <span>Visión</span>
            <span>Daño por partida</span>
            <span>Partidas</span>
            <span></span>
          </div>

          <ul class="ld-rows">
            @for (p of rows(); track p.member.tag; let i = $index) {
              <li class="ld-row" [class.is-open]="expandedTag() === p.member.tag">
                <button
                  type="button"
                  class="ld-row__btn"
                  [attr.aria-expanded]="expandedTag() === p.member.tag"
                  (click)="toggle.emit(p.member.tag)"
                >
                  <span class="ld-row__who">
                    <span class="ld-row__rank nf-mono">{{ i + 1 }}</span>
                    <nf-avatar
                      [src]="p.member.avatar ?? null"
                      [fallback]="p.member.name"
                      [tint]="p.member.hue"
                      [size]="30"
                      shape="square"
                    />
                    <span class="ld-row__name">{{ p.member.name }}</span>
                  </span>

                  <span class="ld-row__cell nf-mono">
                    {{ p.kda }}
                    <small>{{ p.kills }} / {{ p.deaths }} / {{ p.assists }}</small>
                  </span>
                  <span class="ld-row__cell nf-mono">{{ p.csPerMin }}</span>
                  <span class="ld-row__cell nf-mono">{{ p.visionScore }}</span>
                  <span class="ld-row__cell nf-mono">{{ p.dmgK }}k</span>
                  <span class="ld-row__cell nf-mono">
                    {{ p.games }}
                    <small [class.is-low]="p.wr < 50">{{ p.wr }}% de victorias</small>
                  </span>

                  <span class="ld-row__chevron" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                      <path d="M6 9.5l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                  </span>
                </button>

                @if (expandedTag() === p.member.tag) {
                  <div class="ld-detail">
                    <div class="ld-detail__main" [attr.aria-busy]="champsLoading() ? 'true' : null">
                      <nf-avatar
                        [loading]="champsLoading()"
                        [src]="championIcon(p.mainChampionId)"
                        [fallback]="championName(p.mainChampionId)"
                        [tint]="p.mainChampionId"
                        [size]="34"
                        shape="square"
                      />
                      <span class="ld-detail__main-text">
                        @if (champsLoading()) {
                          <nf-skeleton width="150px" height="12px" />
                        } @else {
                          <span class="nf-mono">{{ p.member.tag }}</span>
                          <span class="ld-detail__champ">
                            Juega sobre todo a {{ championName(p.mainChampionId) }}, con
                            {{ p.mainChampWr }}% de victorias
                          </span>
                        }
                      </span>
                    </div>

                    <ul class="ld-tiles">
                      @for (t of tilesOf(p); track t.label) {
                        <li class="ld-tile" [attr.data-accent]="t.accent ?? null">
                          <span class="ld-tile__value nf-mono">{{ t.value }}</span>
                          <span class="ld-tile__label">{{ t.label }}</span>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </li>
            }
          </ul>
        </div>
      } @else {
        <p class="st-card__empty">Este grupo todavía no tiene partidas que analizar.</p>
      }
    </section>
  `,
  styleUrls: ['./stats-card.scss', './stats-leaders.component.scss'],
})
export class StatsLeadersComponent {
  readonly players = input<readonly MemberStats[]>([]);
  readonly loading = input(false);
  /** Tag del jugador cuya fila está desplegada, si hay alguna. */
  readonly expandedTag = input<string | null>(null);

  /** Pide abrir o cerrar la fila de un jugador; decide la vista. */
  readonly toggle = output<string>();

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');
  protected readonly busy = computed(() => this.loading() || this.champsLoading());

  /** Ordenados por la valoración compuesta: la tabla se llama «líderes». */
  protected readonly rows = computed(() =>
    [...this.players()].sort((a, b) => b.rating - a.rating),
  );

  protected readonly tilesOf = playerTiles;

  protected championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  protected championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? 'Campeón';
  }
}
