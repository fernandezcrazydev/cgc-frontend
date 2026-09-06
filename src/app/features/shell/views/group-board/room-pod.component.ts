import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar, NfRankEmblem } from '../../../../ui';
import { GameDataStore } from '../../../../core/game-data';
import { LobbyParticipantResponse } from '../../../../core/lobbies';
import { lobbyExtrasFor } from '../../../../core/lobby-extras';
import { hueFromId } from '../../../../shared/avatar-bg';

/** En qué situación está el hueco, que es lo que decide el aura de la tarjeta. */
export type PodState = 'starter' | 'bench' | 'free';

/**
 * Una tarjeta táctica de la sala en directo (§5.5.6): avatar de Discord, nombre,
 * puesto en el ranking del grupo, escudo de elo y los campeones que más juega.
 *
 * El aura dice de un vistazo en qué situación está esa persona:
 *   - verde, inscrita — es la única lectura que da el dominio, y por eso el
 *     check-in se descartó (ver `Roadmap.md` §5.5.6): un botón de «estoy listo»
 *     que no todo el mundo pulsa convierte el semáforo en una mentira;
 *   - ámbar, en el banquillo esperando plaza;
 *   - punteada, hueco libre.
 *
 * El hueco libre lleva un `+` siempre, mire quien mire. Solo es pulsable si quien
 * mira no está ya dentro: apuntarse dos veces no significa nada. Y al pulsarlo NO
 * se ocupa ese hueco concreto — la plaza la reparte el servidor por orden de
 * llegada, así que se cae en la primera libre. Fingir aquí que eliges sitio sería
 * prometer algo que el dominio no cumple.
 */
@Component({
  selector: 'app-room-pod',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfRankEmblem, RouterLink],
  template: `
    @if (player(); as p) {
      <a
        class="pod"
        [attr.data-state]="state()"
        [routerLink]="['/app', 'perfil', p.userId]"
        [attr.aria-label]="'Ver el perfil de ' + (p.discordUsername ?? 'este jugador')"
      >
        <span class="pod__top">
          <span class="pod__rank nf-mono">{{ rank() }}.º</span>
        </span>

        <nf-avatar
          [src]="p.avatarUrl"
          [fallback]="p.discordUsername ?? ''"
          [tint]="tint()"
          [size]="38"
          shape="square"
        />

        <span class="pod__name">{{ p.discordUsername ?? 'Sin nombre' }}</span>

        <nf-rank-emblem
          [tier]="extras().lolRank.tier"
          [label]="extras().lolRank.label"
          [size]="20"
        />

        <span class="pod__champs" aria-hidden="true">
          @for (id of extras().recentChampionIds; track id) {
            <nf-avatar
              [loading]="champsLoading()"
              [src]="championIcon(id)"
              [fallback]="championName(id)"
              [tint]="id"
              [size]="18"
              shape="square"
            />
          }
        </span>
      </a>
    } @else if (canJoin()) {
      <button
        type="button"
        class="pod pod--join"
        data-state="free"
        [disabled]="joining()"
        (click)="join.emit()"
        aria-label="Apuntarme a esta sala"
      >
        <span class="pod__plus" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="M12 6v12M6 12h12" />
          </svg>
        </span>
        <span class="pod__name pod__name--free">Apuntarme</span>
      </button>
    } @else {
      <div class="pod" data-state="free">
        <span class="pod__plus" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
          >
            <path d="M12 6v12M6 12h12" />
          </svg>
        </span>
        <span class="pod__name pod__name--free">Hueco libre</span>
      </div>
    }
  `,
  styleUrl: './room-pod.component.scss',
})
export class RoomPodComponent {
  readonly player = input<LobbyParticipantResponse | null>(null);
  readonly state = input<PodState>('free');
  /** Puesto en la clasificación del grupo, ya resuelto por la sala. */
  readonly rank = input(0);
  /** Quien mira puede apuntarse: hay hueco y no está ya dentro. */
  readonly canJoin = input(false);
  /** Hay una inscripción en vuelo: el hueco se apaga para que no salgan dos. */
  readonly joining = input(false);

  readonly join = output<void>();

  private readonly gameData = inject(GameDataStore);

  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  protected readonly extras = computed(() => lobbyExtrasFor(this.player()?.userId ?? ''));

  /** Color de reserva del avatar cuando alguien no tiene foto de Discord. */
  protected readonly tint = computed(() => hueFromId(this.player()?.userId ?? ''));

  protected championIcon(id: number): string | null {
    return this.gameData.championById().get(id)?.iconUrl ?? null;
  }

  protected championName(id: number): string {
    return this.gameData.championById().get(id)?.name ?? 'Campeón';
  }
}
