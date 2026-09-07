import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar } from '../../../../ui';
import { LobbyParticipantResponse } from '../../../../core/lobbies';
import { hueFromId } from '../../../../shared/avatar-bg';

/**
 * Banquillo de suplentes en el Tablón (Fase 5.5 - F5.5-06).
 *
 * Micro-chips compactos con avatar, nombre, puesto en el ranking, indicador de
 * Deuda de Rotación (Party) o marca de Inactivo tras expulsión (FlujoJuego.md §5.1, §7).
 * Cero emojis: utiliza iconos SVG para Deuda e Inactivo.
 * Clic navega al perfil del jugador con stopPropagation().
 */
@Component({
  selector: 'app-bench-strip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, RouterLink],
  template: `
    @if (players().length) {
      <div class="bench" [class.bench--party]="isParty()">
        <div class="bench__head">
          <span class="bench__icon" aria-hidden="true">
            @if (isParty()) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path d="M4 18v3M20 18v3M2 10h20M4 14h16M4 6v8M20 6v8" />
              </svg>
            }
          </span>
          <span class="bench__label nf-mono">
            @if (isParty()) {
              Rotación ({{ players().length }} en espera)
            } @else {
              Banquillo ({{ players().length }} {{ players().length === 1 ? 'suplente' : 'suplentes' }})
            }
          </span>
        </div>

        <ul class="bench__list">
          @for (p of players(); track p.userId) {
            <li>
              <a
                class="bench__chip bench__card"
                [class.is-inactive]="p.isActive === false"
                [class.has-debt]="(p.rotationDebt ?? 0) > 0 || isParty()"
                [routerLink]="['/app', 'perfil', p.userId]"
                (click)="onChipClick($event)"
                [attr.aria-label]="'Ver el perfil de ' + (p.discordUsername ?? 'este jugador')"
              >
                <nf-avatar
                  [src]="p.avatarUrl"
                  [fallback]="p.discordUsername ?? ''"
                  [tint]="tintOf(p.userId)"
                  [size]="20"
                  shape="round"
                />
                <span class="bench__name" [title]="p.discordUsername ?? ''">{{ p.discordUsername ?? 'Sin nombre' }}</span>

                @if ((p.rotationDebt ?? 0) > 0 || isParty()) {
                  <span class="bench__debt-box" title="Prioridad garantizada por deuda de rotación (+{{ p.rotationDebt || 1 }})">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="11" height="11">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span class="bench__debt-sub">+{{ p.rotationDebt || 1 }}</span>
                  </span>
                } @else if (ranks().get(p.userId); as r) {
                  <span class="bench__rank nf-mono">#{{ r }}</span>
                }
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
  readonly ranks = input<ReadonlyMap<string, number>>(new Map());
  readonly isParty = input(false);

  protected readonly tintOf = hueFromId;

  protected onChipClick(event: MouseEvent): void {
    event.stopPropagation();
  }
}
