import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar } from '../../../../ui';
import { LobbyParticipantResponse } from '../../../../core/lobbies';
import { hueFromId } from '../../../../shared/avatar-bg';

/**
 * Banquillo de suplentes de la sala en directo (§5.5.6): mini-tarjetas cuadradas con
 * foto, nombre y puesto en el ranking del grupo.
 *
 * Son más pequeñas que las de los titulares a propósito: el banquillo importa, pero
 * no tanto como los diez que van a jugar. El orden lo manda el servidor —quien llegó
 * antes entra antes— y esta vista no lo reordena.
 */
@Component({
  selector: 'app-bench-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, RouterLink],
  template: `
    @if (players().length) {
      <div class="bench">
        <span class="bench__label">
          Banquillo · {{ players().length }}
          {{ players().length === 1 ? 'suplente' : 'suplentes' }}, por orden de llegada
        </span>

        <ul class="bench__list">
          @for (p of players(); track p.userId; let i = $index) {
            <li>
              <a
                class="bench__card"
                [routerLink]="['/app', 'perfil', p.userId]"
                [attr.aria-label]="'Ver el perfil de ' + (p.discordUsername ?? 'este jugador')"
              >
                <nf-avatar
                  [src]="p.avatarUrl"
                  [fallback]="p.discordUsername ?? ''"
                  [tint]="tintOf(p.userId)"
                  [size]="30"
                  shape="square"
                />
                <span class="bench__name">{{ p.discordUsername ?? 'Sin nombre' }}</span>
                <span class="bench__rank nf-mono">{{ ranks().get(p.userId) }}.º del grupo</span>
              </a>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styleUrl: './bench-strip.component.scss',
})
export class BenchStripComponent {
  readonly players = input<readonly LobbyParticipantResponse[]>([]);
  /** Puestos en la clasificación del grupo, resueltos por la sala para todos a la vez. */
  readonly ranks = input<ReadonlyMap<string, number>>(new Map());

  protected readonly tintOf = hueFromId;
}
