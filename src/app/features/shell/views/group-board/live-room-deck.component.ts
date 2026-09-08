import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NfButton, NfSkeleton } from '../../../../ui';
import { LobbyParticipantResponse, LobbyResponse, LobbySlotResponse } from '../../../../core/lobbies';
import { lobbyRanksFor } from '../../../../core/lobby-extras';
import { BenchStripComponent } from './bench-strip.component';
import { PodState, RoomPodComponent } from './room-pod.component';

interface Pod {
  position: number;
  player: LobbyParticipantResponse | null;
  state: PodState;
}

/**
 * Deck de Lobbies Activos en el Tablón (Fase 5.5 - F5.5-06, Opción 4).
 *
 * Visualización compacta de alta densidad (~140-220px) sin scroll vertical.
 * Soporta todos los estados de FlujoJuego.md:
 *   - Sala estándar con banquillo
 *   - Salas contiguas (ej. 23 jugadores repartidos en Sala 1 y Sala 2)
 *   - Party sin generar salas (pool de espera)
 *   - Party con tandas generadas (Sala A y Sala B simultáneas)
 *   - Sala con equipos formados 5v5 (Azul vs Rojo)
 *
 * Cero emojis: iconos vectoriales SVG para modalidades, scraper y estado.
 * Toda la tarjeta es pulsable para navegar a la sala/convocatoria.
 * Sin botón de «Generar partida» en la preview (se gestiona dentro de la sala).
 */
@Component({
  selector: 'app-live-room-deck',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton, NfSkeleton, BenchStripComponent, RoomPodComponent],
  templateUrl: './live-room-deck.component.html',
  styleUrls: ['./board-card.scss', './live-room-deck.component.scss'],
})
export class LiveRoomDeckComponent {
  private readonly router = inject(Router);

  readonly lobby = input<LobbyResponse | null>(null);
  readonly slot = input<LobbySlotResponse | null>(null);
  readonly groupId = input.required<string>();
  readonly loading = input(false);
  readonly kickoff = input('');
  readonly canJoin = input(false);
  readonly joining = input(false);

  readonly join = output<void>();
  readonly schedule = output<void>();

  readonly isAnimating = signal(false);
  readonly secondaryIsAnimating = signal(false);

  private prevHasFormed: boolean | null = null;
  private prevSecondaryHasFormed: boolean | null = null;

  constructor() {
    effect(() => {
      const current = this.hasFormedTeams();
      if (this.prevHasFormed === false && current) {
        this.isAnimating.set(true);
        setTimeout(() => this.isAnimating.set(false), 1800);
      }
      this.prevHasFormed = current;
    });

    effect(() => {
      const current = this.secondaryHasTeams();
      if (this.prevSecondaryHasFormed === false && current) {
        this.secondaryIsAnimating.set(true);
        setTimeout(() => this.secondaryIsAnimating.set(false), 1800);
      }
      this.prevSecondaryHasFormed = current;
    });
  }

  protected readonly modality = computed(() => this.lobby()?.modality ?? 'BALANCED');
  protected readonly isParty = computed(
    () =>
      this.lobby()?.distribution === 'PARTY' ||
      this.isPartyRounds() ||
      this.isPartyPool(),
  );
  protected readonly isPartyRounds = computed(
    () =>
      this.lobby()?.subType === 'PARTY_ROUNDS' ||
      (this.lobby()?.distribution === 'PARTY' &&
        (this.slot()?.secondaryStarters?.length ?? 0) > 0),
  );
  protected readonly isPartyPool = computed(
    () => this.lobby()?.subType === 'PARTY_POOL',
  );
  protected readonly isContiguous = computed(
    () =>
      !this.isParty() &&
      (this.lobby()?.subType === 'CONTIGUOUS_ROOMS' ||
        (this.slot()?.secondaryStarters?.length ?? 0) > 0),
  );
  protected readonly scraperActive = computed(() => this.lobby()?.scraperActive ?? false);

  protected readonly starters = computed(() => this.slot()?.starters ?? []);
  protected readonly secondaryStarters = computed(() => this.slot()?.secondaryStarters ?? []);
  protected readonly bench = computed(() => this.slot()?.bench ?? []);

  protected readonly hasFormedTeams = computed(() => {
    const lb = this.lobby();
    if (!lb) return false;
    return (
      lb.subType === 'TEAMS_GENERATED' ||
      (this.starters().length === 10 && this.starters().some((p) => !!p.team))
    );
  });

  protected readonly ranks = computed(() =>
    lobbyRanksFor([...this.starters(), ...this.secondaryStarters(), ...this.bench()].map((p) => p.userId)),
  );

  protected readonly secondaryHasTeams = computed(() => {
    return this.secondaryStarters().some((p) => !!p.team);
  });

  protected readonly pods = computed<Pod[]>(() => {
    const capacity = this.lobby()?.capacity ?? 10;
    const starters = this.starters();
    const half = Math.ceil(capacity / 2);
    const order: number[] = [];
    if (this.hasFormedTeams()) {
      for (let i = 1; i <= capacity; i++) order.push(i);
    } else {
      for (let i = 0; i < half; i++) order.push(i * 2 + 1);
      for (let i = 0; i < capacity - half; i++) order.push(i * 2 + 2);
    }
    return order.map((position) => {
      const player = starters[position - 1] ?? null;
      return { position, player, state: player ? ('starter' as const) : ('free' as const) };
    });
  });

  protected readonly secondaryPods = computed<Pod[]>(() => {
    const starters = this.secondaryStarters();
    const order = this.secondaryHasTeams()
      ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      : [1, 3, 5, 7, 9, 2, 4, 6, 8, 10];
    return order.map((position) => {
      const player = starters[position - 1] ?? null;
      return { position, player, state: player ? ('starter' as const) : ('free' as const) };
    });
  });

  protected readonly bluePods = computed(() => this.pods().slice(0, 5));
  protected readonly redPods = computed(() => this.pods().slice(5, 10));
  protected readonly secondaryBluePods = computed(() => this.secondaryPods().slice(0, 5));
  protected readonly secondaryRedPods = computed(() => this.secondaryPods().slice(5, 10));

  protected roomHeaderTitle(): string {
    const lb = this.lobby();
    if (!lb) return '';
    return this.isParty() ? `Party · ${lb.code}` : `Room · ${lb.code}`;
  }

  protected subroomOneName(): string {
    return this.isPartyRounds() ? 'Sala A' : (this.slot()?.roomName ?? 'Sala 1');
  }

  protected subroomTwoName(): string {
    return this.isPartyRounds() ? 'Sala B' : (this.slot()?.secondaryRoomName ?? 'Sala 2');
  }

  protected countText(): string {
    const lb = this.lobby();
    if (!lb) return '';
    if (this.hasFormedTeams()) {
      const ko = this.kickoff();
      return `10 de 10 jugadores · Equipos formados (5v5 Azul vs Rojo)${ko ? ' · ' + ko : ''}`;
    }
    if (this.isParty()) {
      if (this.isPartyPool()) {
        return `${this.starters().length} jugadores en el pool · Esperando a generar tandas`;
      }
      return `20 de 20 plazas jugando · ${this.bench().length} esperando en rotación`;
    }
    if (this.isContiguous()) {
      return `20 de 20 plazas jugando · ${this.bench().length} en banquillo`;
    }
    const ko = this.kickoff();
    return `${this.starters().length} de ${lb.capacity} plazas ocupadas${ko ? ' · ' + ko : ''}`;
  }

  protected rankOf(userId?: string | null): number {
    return userId ? (this.ranks().get(userId) ?? 0) : 0;
  }

  protected navigateToLobby(): void {
    const lb = this.lobby();
    if (!lb) return;
    void this.router.navigate(['/app', 'grupos', this.groupId(), 'convocatoria', lb.id]);
  }

  protected navigateToSala(event: MouseEvent): void {
    event.stopPropagation();
    const lb = this.lobby();
    if (!lb) return;
    void this.router.navigate(['/app', 'grupos', this.groupId(), 'sala', lb.id]);
  }
}
