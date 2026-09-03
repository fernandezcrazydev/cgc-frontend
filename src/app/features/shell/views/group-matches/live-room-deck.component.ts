import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfButton, NfSkeleton } from '../../../../ui';
import { LobbyResponse, LobbySlotResponse } from '../../../../core/lobbies';
import { lobbyRanksFor } from '../../../../core/lobby-extras';
import { BenchStripComponent } from './bench-strip.component';
import { PodState, RoomPodComponent } from './room-pod.component';

/** Un hueco de la parrilla: la plaza, quién la ocupa y en qué situación está. */
interface Pod {
  position: number;
  player: LobbyResponse['slots'][number]['starters'][number] | null;
  state: PodState;
}

/**
 * Columna izquierda del panel de convocatorias (§5.5.6): la sala en directo.
 *
 * Los diez huecos se pintan en dos filas de cinco con orden alterno —impares arriba
 * (1, 3, 5, 7, 9) y pares abajo (2, 4, 6, 8, 10)—, que es como se lee un 5v5 de un
 * vistazo. No hay elección de bando ni de línea: eso lo reparte el balanceo al
 * generar la partida.
 *
 * Cuando no hay ninguna sala a punto, la columna se convierte en la llamada a crear
 * una. El paso de una cosa a otra lo decide la vista, no este componente.
 */
@Component({
  selector: 'app-live-room-deck',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton, NfSkeleton, RouterLink, BenchStripComponent, RoomPodComponent],
  template: `
    <section class="mt-card rm" [attr.aria-busy]="loading() ? 'true' : null">
      @if (loading()) {
        <nf-skeleton width="60%" height="18px" />
        <div class="rm-grid">
          @for (s of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; track s) {
            <nf-skeleton width="100%" height="118px" radius="10px" />
          }
        </div>
      } @else if (lobby(); as lb) {
        <header class="mt-card__head">
          <h2 class="mt-card__title">
            Sala en directo · {{ lb.code }}
          </h2>
          <span class="mt-live">
            <span class="mt-live__pulse" aria-hidden="true"></span>
            En vivo
          </span>
        </header>

        <p class="rm__count nf-mono">
          {{ starters().length }} de {{ lb.capacity }} plazas ocupadas@if (kickoff()) {
            · empieza {{ kickoff() }}
          }
        </p>

        <div class="rm-grid">
          @for (pod of pods(); track pod.position) {
            <app-room-pod
              [player]="pod.player"
              [state]="pod.state"
              [rank]="ranks().get(pod.player?.userId ?? '') ?? 0"
              [canJoin]="canJoin()"
              [joining]="joining()"
              (join)="join.emit()"
            />
          }
        </div>

        <app-bench-strip [players]="bench()" [ranks]="ranks()" />

        <footer class="rm__foot">
          <button
            nfButton
            variant="primary"
            size="md"
            [routerLink]="['/app', 'grupos', groupId(), 'partidas', lb.id]"
          >
            Entrar a la sala
          </button>
        </footer>
      } @else {
        <div class="rm-hero">
          <span class="rm-hero__glyph" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            >
              <path d="M12 5.5v13M5.5 12h13" />
            </svg>
          </span>
          <h2 class="rm-hero__title">No hay ninguna sala abierta</h2>
          <p class="rm-hero__sub">
            Convoca a tu grupo y reparte los diez. La sala aparece aquí en cuanto haya una
            partida a media hora de empezar.
          </p>
          <button
            nfButton
            variant="primary"
            size="lg"
            [routerLink]="['/app', 'grupos', groupId(), 'crear-partida']"
          >
            Crear sala en vivo
          </button>
        </div>
      }
    </section>
  `,
  styleUrls: ['./matches-card.scss', './live-room-deck.component.scss'],
})
export class LiveRoomDeckComponent {
  /** La convocatoria que ya se juega o está a punto, o nada si no hay ninguna. */
  readonly lobby = input<LobbyResponse | null>(null);
  /** La franja horaria que manda: la confirmada, o la que más gente ha juntado. */
  readonly slot = input<LobbySlotResponse | null>(null);
  readonly groupId = input.required<string>();
  readonly loading = input(false);
  /** La hora de comienzo ya escrita, o cadena vacía si aún no está cuadrada. */
  readonly kickoff = input('');
  /** Quien mira no está en la sala, así que los huecos libres le dejan apuntarse. */
  readonly canJoin = input(false);
  /** Hay una inscripción en vuelo. */
  readonly joining = input(false);

  /** Pide apuntarse a la franja de esta sala; decide la vista. */
  readonly join = output<void>();

  protected readonly starters = computed(() => this.slot()?.starters ?? []);
  protected readonly bench = computed(() => this.slot()?.bench ?? []);

  /**
   * Los puestos de todos los de la sala, titulares y banquillo, resueltos de una
   * vez: repartidos uno a uno salían posiciones repetidas en la misma parrilla.
   */
  protected readonly ranks = computed(() =>
    lobbyRanksFor([...this.starters(), ...this.bench()].map((p) => p.userId)),
  );

  /**
   * Los diez huecos en orden alterno. Se generan tantos como diga `capacity` y no
   * diez fijos: el número de plazas lo manda el servidor, y darlo por supuesto aquí
   * sería una segunda fuente de verdad.
   */
  protected readonly pods = computed<Pod[]>(() => {
    const capacity = this.lobby()?.capacity ?? 10;
    const starters = this.starters();
    const half = Math.ceil(capacity / 2);

    const order: number[] = [];
    for (let i = 0; i < half; i++) order.push(i * 2 + 1);
    for (let i = 0; i < capacity - half; i++) order.push(i * 2 + 2);

    return order.map((position) => {
      const player = starters[position - 1] ?? null;
      return { position, player, state: player ? ('starter' as const) : ('free' as const) };
    });
  });
}
