import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfSkeleton, NfWindow } from '../../../../ui';
import { Session } from '../../../../core/auth';
import { GroupsStore } from '../../../../core/groups';
import { LobbyDetailStore } from '../../../../core/lobbies';
import { NotificationsStore } from '../../../../core/notifications';
import { lobbyRanksFor } from '../../../../core/lobby-extras';
import { BenchStripComponent } from '../group-board/bench-strip.component';
import { RoomPodComponent } from '../group-board/room-pod.component';

/**
 * La sala: los diez que juegan (`FlujoJuego.md` §2).
 *
 * Es la pantalla donde se pasa la noche, no un paso de cuarenta segundos: §10 dice que
 * una sala **no se cierra al terminar** y juega varias partidas seguidas con la misma
 * gente. Sobre esta base se construye la arena de `Roadmap.md` §5.5.11 —las cartas
 * animadas, el panel del host y `Formar equipos`—, que todavía no existe.
 *
 * Quien no juega en ella la ve igual, en **solo lectura**: la tanda no se cierra hasta
 * que terminan todas sus salas (§6.2), así que al acabar la tuya quieres ver cómo va la
 * otra.
 *
 * BACKEND NOTE: hoy el `:salaId` de la ruta es el id de la convocatoria, porque el
 * backend todavía no crea filas de sala y una convocatoria rinde exactamente una
 * (`FlujoJuego.md` §17.1). La ruta ya tiene su forma final: cuando existan, solo cambia
 * el store que resuelve ese id.
 */
@Component({
  selector: 'app-sala',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton, NfSkeleton, NfWindow, BenchStripComponent, RoomPodComponent],
  styleUrl: './sala.scss',
  templateUrl: './sala.html',
})
export class Sala {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly session = inject(Session);
  private readonly groups = inject(GroupsStore);
  private readonly notifs = inject(NotificationsStore);

  readonly detail = inject(LobbyDetailStore);
  readonly lobby = this.detail.lobby;

  private readonly groupId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  private readonly salaId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('salaId'))),
    { initialValue: this.route.snapshot.paramMap.get('salaId') },
  );

  readonly loading = computed(
    () => this.detail.status() === 'loading' || this.detail.status() === 'idle',
  );

  readonly starters = computed(() => this.detail.confirmedSlot()?.starters ?? []);
  readonly bench = computed(() => this.detail.confirmedSlot()?.bench ?? []);

  /** Una sala existe cuando hay hora cerrada. Sin eso todavía es una convocatoria. */
  readonly isRoom = computed(() => this.detail.confirmedSlot() !== null);

  /** ¿Juego en esta sala? Decide si se ve el aviso de espectador. */
  readonly amIn = computed(() => {
    const user = this.session.user();
    if (!user) return false;
    const me = user.userId;
    const meName = user.discordUsername?.toLowerCase();
    const all = [
      ...this.starters(),
      ...(this.detail.confirmedSlot()?.secondaryStarters ?? []),
      ...this.bench(),
    ];
    return all.some(
      (p) => (me && p.userId === me) || (meName && p.discordUsername?.toLowerCase() === meName),
    );
  });

  readonly kickoff = computed(() => {
    const iso = this.detail.confirmedSlot()?.startsAt;
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  });

  /**
   * Los puestos de todos los de la sala, titulares y banquillo, resueltos de una vez:
   * repartidos uno a uno salían posiciones repetidas en la misma parrilla.
   */
  readonly ranks = computed(() =>
    lobbyRanksFor([...this.starters(), ...this.bench()].map((p) => p.userId)),
  );

  /**
   * Los huecos en orden alterno —impares arriba, pares abajo (§5.5.6)—. Se generan
   * tantos como diga `capacity` y no diez fijos: el número de plazas lo manda el
   * servidor, y darlo por supuesto aquí sería una segunda fuente de verdad.
   */
  readonly pods = computed(() => {
    const capacity = this.lobby()?.capacity ?? 10;
    const starters = this.starters();
    const half = Math.ceil(capacity / 2);

    const order: number[] = [];
    for (let i = 0; i < half; i++) order.push(i * 2 + 1);
    for (let i = 0; i < capacity - half; i++) order.push(i * 2 + 2);

    return order.map((position) => ({
      position,
      player: starters[position - 1] ?? null,
    }));
  });

  retry(): void {
    const id = this.salaId();
    if (id) void this.detail.load(id);
  }

  constructor() {
    effect(() => {
      const id = this.groupId();
      if (id) this.groups.select(id);
    });

    effect(() => {
      const id = this.salaId();
      if (id) void this.detail.load(id);
    });

    // Cuando entra o sale alguien, la parrilla se actualiza sola. `refresh()` no vacía
    // lo que ya está pintado, así que la sala no parpadea.
    effect(() => {
      const nudge = this.notifs.lastNudge();
      if (nudge?.event !== 'lobby') return;
      if (nudge.data['lobbyId'] !== this.detail.showingId) return;
      void this.detail.refresh();
    });

    this.destroyRef.onDestroy(() => this.detail.clear());
  }
}
