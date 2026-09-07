import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar, NfLane, NfLaneIcon } from '../../../../ui';
import { LobbyParticipantResponse } from '../../../../core/lobbies';
import { hueFromId } from '../../../../shared/avatar-bg';

export type PodState = 'starter' | 'bench' | 'free';

/**
 * Micro-Chip Táctico de jugador en el Tablón (Fase 5.5 - F5.5-06).
 *
 * Altura compacta (~38px) que permite visualizar múltiples salas simultáneas sin scroll.
 * Transmite estado por código de color semántico (--nf-*):
 *   - Verde esmeralda con check SVG: Inscrito voluntariamente.
 *   - Ámbar con tag "Añ": Añadido a mano por el host (no penalizable).
 *   - Dorado con corona SVG: Host de la sala.
 *   - Carmesí con aspa SVG: Inactivo en banquillo.
 *
 * Clic en el chip navega al perfil del usuario sin activar la navegación de la tarjeta de sala.
 */
@Component({
  selector: 'app-room-pod',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfLaneIcon, RouterLink],
  template: `
    @if (player(); as p) {
      <a
        class="pod"
        [attr.data-state]="state()"
        [class.is-host]="p.isHost"
        [class.is-added]="p.isAdded"
        [class.is-inactive]="p.isActive === false"
        [class.team-blue]="p.team === 'BLUE'"
        [class.team-red]="p.team === 'RED'"
        [routerLink]="['/app', 'perfil', p.userId]"
        (click)="onCardClick($event)"
        [attr.aria-label]="'Ver el perfil de ' + (p.discordUsername ?? 'este jugador')"
      >
        <div class="pod__avatar-wrap">
          <nf-avatar
            [src]="p.avatarUrl"
            [fallback]="p.discordUsername ?? ''"
            [tint]="tint()"
            [size]="24"
            shape="round"
          />
          @if (p.isHost) {
            <span class="pod__host-crown" title="Host de la sala" aria-label="Host">
              <svg viewBox="0 0 24 24" fill="currentColor" width="9" height="9">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </span>
          }
        </div>

        <span class="pod__name" [title]="p.discordUsername ?? ''">
          {{ p.discordUsername ?? 'Sin nombre' }}
        </span>

        @if (laneKey(); as lk) {
          <span class="pod__lane" [attr.data-lane]="lk" [title]="'Rol asignado: ' + laneLabel()" [attr.aria-label]="'Rol ' + laneLabel()">
            <nf-lane-icon [lane]="lk" mode="original" class="pod__lane-icon" />
          </span>
        } @else if (rank() > 0) {
          <span class="pod__rank nf-mono">#{{ rank() }}</span>
        }

        @if (p.isActive === false) {
          <span class="pod__tag pod__tag--inactive" title="Inactivo (no sube a titular)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="9" height="9">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </span>
        } @else if (p.isAdded) {
          <span class="pod__tag pod__tag--added" title="Añadido a mano por el host">Añ</span>
        }
      </a>
    } @else if (canJoin()) {
      <button
        type="button"
        class="pod pod--join"
        data-state="free"
        [disabled]="joining()"
        (click)="onJoin($event)"
        aria-label="Entrar a esta sala"
      >
        <span class="pod__plus" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="11" height="11">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span class="pod__name pod__name--free">Entrar a la sala</span>
      </button>
    } @else {
      <div class="pod" data-state="free">
        <span class="pod__plus" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="11" height="11">
            <path d="M12 5v14M5 12h14" />
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
  readonly rank = input(0);
  readonly canJoin = input(false);
  readonly joining = input(false);

  readonly join = output<void>();

  protected readonly tint = computed(() => hueFromId(this.player()?.userId ?? ''));

  protected readonly laneKey = computed<NfLane | null>(() => {
    const lane = this.player()?.assignedLane;
    if (!lane) return null;
    switch (lane) {
      case 'TOP':
        return 'TOP';
      case 'JUNGLE':
        return 'JUNGLA';
      case 'MID':
        return 'MID';
      case 'BOTTOM':
        return 'ADC';
      case 'SUPPORT':
        return 'SUPPORT';
      default:
        return null;
    }
  });

  protected readonly laneLabel = computed<string>(() => {
    const lane = this.player()?.assignedLane;
    if (!lane) return '';
    switch (lane) {
      case 'TOP':
        return 'TOP';
      case 'JUNGLE':
        return 'JGL';
      case 'MID':
        return 'MID';
      case 'BOTTOM':
        return 'ADC';
      case 'SUPPORT':
        return 'SUP';
      default:
        return lane;
    }
  });

  protected onCardClick(event: MouseEvent): void {
    event.stopPropagation();
  }

  protected onJoin(event: MouseEvent): void {
    event.stopPropagation();
    this.join.emit();
  }
}
