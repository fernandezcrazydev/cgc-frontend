import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameDataStore } from '../../../../core/game-data';
import { PlayerRecentMatch, StreakType, streakLabel } from '../../../../core/player-profile';

/**
 * Tarjeta "Racha" — la cadena de las últimas partidas más el desglose de la que
 * está seleccionada. Al pasar el ratón (hover) o pulsar cada nodo, se actualiza
 * dinámicamente el mini-resumen y hacer clic en el mini-resumen redirige a la
 * vista detallada de esa partida.
 */
@Component({
  selector: 'app-profile-streak-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  styleUrl: './profile-streak-card.component.scss',
  template: `
    <section class="pf-card pf-form-card">
      <div class="pf-card__header">
        <span class="pf-card__title nf-mono">Racha</span>
        <div class="pf-streak-badge nf-mono" [class.pf-streak-badge--lose]="streakType() === 'L'">
          {{ currentStreak() }}{{ streakLetter() }}
        </div>
      </div>

      <div
        class="pf-form-chain"
        role="group"
        aria-label="Últimas partidas, de la más antigua a la más reciente"
      >
        @for (m of matches(); track m.id) {
          <button
            type="button"
            class="pf-match-node"
            [class.pf-match-node--win]="m.won"
            [class.pf-match-node--loss]="!m.won"
            [class.pf-match-node--mvp]="m.isMvp"
            [class.pf-match-node--on]="m.id === selected()?.id"
            [attr.aria-pressed]="m.id === selected()?.id"
            [attr.aria-label]="nodeLabel(m)"
            (click)="selected.set(m)"
            (mouseenter)="selected.set(m)"
            (focus)="selected.set(m)"
          >
            <span class="pf-match-node__text nf-mono" aria-hidden="true">
              {{ m.won ? 'V' : 'D' }}
            </span>
            @if (m.isMvp) {
              <span class="pf-match-node__crown" aria-hidden="true">★</span>
            }
          </button>
        }
      </div>

      <!--
        El desglose es un bloque interactivo que enlaza al análisis completo
        de la partida seleccionada.
      -->
      @if (selected(); as m) {
        <a
          class="pf-streak-summary pf-streak-summary--clickable nf-mono"
          [routerLink]="['/app', 'historial', m.id]"
          [title]="'Ver análisis detallado de la partida'"
          aria-live="polite"
        >
          <div class="pf-streak-summary__row">
            <span [class.pf-pos]="m.won" [class.pf-neg]="!m.won">
              {{ m.won ? 'Victoria' : 'Derrota' }}
              @if (m.isMvp) {
                · MVP
              }
            </span>
            <span class="pf-streak-summary__time">{{ m.dateFormatted }} · {{ m.durationFormatted }} ➔</span>
          </div>
          <div class="pf-streak-summary__row pf-streak-summary__row--sub">
            <span>{{ championName(m.championId) }} ({{ m.role }})</span>
            <span>KDA {{ m.kda }}</span>
            <span [class.pf-pos]="m.lpDelta >= 0" [class.pf-neg]="m.lpDelta < 0">
              {{ m.lpDelta >= 0 ? '+' : '' }}{{ m.lpDelta }} LP
            </span>
          </div>
        </a>
      } @else {
        <div class="empty-state empty-state--compact">
          <span class="empty-state__text nf-mono">Todavía no hay partidas que enseñar</span>
        </div>
      }
    </section>
  `,
})
export class ProfileStreakCard {
  private readonly gameData = inject(GameDataStore);

  /** Últimas partidas, de la más antigua a la más reciente. */
  readonly matches = input.required<readonly PlayerRecentMatch[]>();
  readonly currentStreak = input.required<number>();
  readonly streakType = input.required<StreakType>();

  /**
   * `linkedSignal` y no `signal`: la selección por defecto es la última partida,
   * y si la lista cambia (otro jugador, refetch) tiene que volver a apuntar a la
   * última de la lista NUEVA. Con una signal normal quedaría señalando una
   * partida que ya no está en la cadena.
   */
  protected readonly selected = linkedSignal<readonly PlayerRecentMatch[], PlayerRecentMatch | null>({
    source: this.matches,
    computation: (matches, previous) => {
      const stillThere = previous?.value && matches.find((m) => m.id === previous.value!.id);
      return stillThere ?? matches[matches.length - 1] ?? null;
    },
  });

  protected readonly streakLetter = computed(() => streakLabel(this.streakType()));

  /** El nodo solo pinta una letra: su nombre accesible tiene que decir el resto. */
  protected nodeLabel(m: PlayerRecentMatch): string {
    const outcome = m.won ? 'Victoria' : 'Derrota';
    const mvp = m.isMvp ? ', MVP' : '';
    return `${outcome} con ${this.championName(m.championId)}, ${m.dateFormatted}${mvp}`;
  }

  protected championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? 'Campeón';
  }
}
