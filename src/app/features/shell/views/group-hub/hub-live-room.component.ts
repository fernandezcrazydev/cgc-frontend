import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar, NfButton, NfSkeleton } from '../../../../ui';
import { LobbyParticipantResponse, LobbyResponse } from '../../../../core/lobbies';
import { hueFromId } from '../../../../shared/avatar-bg';

/** Un hueco de la parrilla: o hay jugador, o está libre. */
interface RoomSlot {
  index: number;
  player: LobbyParticipantResponse | null;
}

/**
 * Sala en directo del grupo (§5.5.4): los diez huecos en dos filas de cinco con los avatares de
 * Discord, o el acceso a crear partida cuando no hay ninguna sala abierta.
 */
@Component({
  selector: 'app-hub-live-room',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfButton, NfSkeleton],
  template: `
    <section class="hub-card hub-room" [attr.aria-busy]="loading() ? 'true' : null">
      @if (loading()) {
        <header class="hub-card__head">
          <h2 class="hub-card__title nf-mono">Sala en directo</h2>
        </header>
        <nf-skeleton width="100%" height="96px" radius="10px" />
      } @else if (lobby(); as l) {
        <header class="hub-card__head">
          <h2 class="hub-card__title nf-mono">Sala en directo · {{ l.code }}</h2>
          <span class="hub-room__live nf-mono">
            <span class="hub-room__pulse" aria-hidden="true"></span>
            En vivo
          </span>
        </header>

        <div class="hub-room__grid">
          @for (slot of slots(); track slot.index) {
            <div class="hub-room__slot" [class.is-free]="!slot.player">
              @if (slot.player; as p) {
                <nf-avatar
                  [src]="p.avatarUrl"
                  [fallback]="p.discordUsername ?? '?'"
                  [tint]="tintOf(p.userId)"
                  [size]="34"
                  shape="square"
                />
                <span class="hub-room__name nf-mono">{{ p.discordUsername ?? 'Sin nombre' }}</span>
              } @else {
                <span class="hub-room__free-mark" aria-hidden="true"></span>
                <span class="hub-room__name nf-mono">Libre</span>
              }
            </div>
          }
        </div>

        <div class="hub-room__foot">
          <span class="hub-room__count nf-mono">{{ signedUp() }}/{{ l.capacity }} jugadores</span>
          <button
            nfButton
            variant="primary"
            size="sm"
            [routerLink]="['/app', 'grupos', groupId(), 'partidas', l.id]"
          >Entrar a la sala</button>
        </div>
      } @else {
        <a class="hub-room__cta" [routerLink]="['/app', 'grupos', groupId(), 'crear-partida']">
          <span class="hub-room__cta-glyph" aria-hidden="true">＋</span>
          <span class="hub-room__cta-text">
            <span class="hub-room__cta-title">Crear partida</span>
            <span class="hub-room__cta-sub">Convoca a tu grupo y reparte los diez</span>
          </span>
        </a>
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-live-room.component.scss'],
})
export class HubLiveRoomComponent {
  readonly lobby = input<LobbyResponse | null>(null);
  readonly groupId = input.required<string>();
  readonly loading = input(false);

  /**
   * La franja que mejor va: es la que el shell y el hub ya usaban para el "8/10". El reparto
   * titulares/suplentes lo decide el servidor; aquí solo se pinta el que manda.
   */
  private readonly slot = computed(() => {
    const l = this.lobby();
    if (!l) return null;
    const confirmed = l.slots.find((s) => s.id === l.confirmedSlotId);
    if (confirmed) return confirmed;
    return [...l.slots].sort((a, b) => b.signedUp - a.signedUp)[0] ?? null;
  });

  protected readonly signedUp = computed(() => this.slot()?.signedUp ?? 0);

  /** Los diez huecos, ocupados por orden de llegada y libres el resto. */
  protected readonly slots = computed<RoomSlot[]>(() => {
    const capacity = this.lobby()?.capacity ?? 10;
    const starters = this.slot()?.starters ?? [];
    return Array.from({ length: capacity }, (_, index) => ({
      index,
      player: starters[index] ?? null,
    }));
  });

  /** Tinte del avatar de reserva, derivado del id: presentación, no dato de dominio. */
  protected readonly tintOf = hueFromId;
}
