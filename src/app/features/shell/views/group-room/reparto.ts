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
import { NfAvatar, NfButton, NfLaneIcon, NfSkeleton, NfWindow } from '../../../../ui';
import { GroupsStore } from '../../../../core/groups';
import {
  BalanceExplanationStore,
  BalanceLane,
  LobbyDetailStore,
  LobbyParticipantResponse,
} from '../../../../core/lobbies';
import { messageForCode } from '../../../../core/http/api-error';
import { laneLabel } from '../../../../core/matches/match-view';
import { hueFromId } from '../../../../shared/avatar-bg';

/** Una cara del duelo, ya resuelta a persona: el DTO solo trae el `app_user.id`. */
interface DuelSide {
  userId: string;
  /** null si esa cuenta ya no está en la convocatoria o perdió su nombre de Discord. */
  name: string | null;
  avatarUrl: string | null;
  hue: number;
  effective: number;
  /**
   * Le tocó esta línea sin pedirla. Es un booleano y no la línea que manda el backend porque
   * un jugador está en un solo duelo: la línea ya la dice la fila, y volcar aquí ese enum en
   * crudo sería copy gritado con vocabulario del servidor.
   */
  autofill: boolean;
}

/** Un duelo de línea puesto ya en el lado que le tocó, que es como se mira una sala. */
interface Duel {
  lane: BalanceLane;
  blue: DuelSide;
  red: DuelSide;
  difference: number;
}

/**
 * Por qué salió ESE reparto y no otro: pantalla de monitoreo de una sala ya repartida.
 *
 * **Solo la ven los admins del grupo.** La entrada se esconde para el resto —incluido el
 * convocante que pulsó el botón— porque aquí se dice lo que vale cada jugador en cada línea,
 * y eso el grupo no ha acordado enseñárselo entre ellos. El backend responde 403 igualmente:
 * el permiso lo decide él, esconder el enlace es solo UX.
 *
 * Tres cosas de aquí no son estilo, vienen del contrato, y romperlas hace daño:
 *
 * 1. `globalDifference` y `uncertainty` se pintan JUNTOS o no se pintan. «7 puntos de
 *    diferencia» a secas, con una suposición dentro, es peor que no dar cifra: la gente se la
 *    cree. Con `ratedPlayers = 0` la barra de error es enorme a propósito, y eso es justo lo
 *    que hay que enseñar.
 * 2. `provisional` va arriba y bien visible: esa sala no se equilibró para customs, se
 *    equilibró con rangos de SoloQ y rellenos.
 * 3. `repetition` y `familiarity` son la mitad que faltaba de la explicación. Sin ellos se
 *    queda en «uno de los N más baratos», que es donde los equipos parecen arbitrarios.
 *
 * BACKEND NOTE: el `:salaId` de la ruta sigue siendo el id de la convocatoria (ver `Sala`), así
 * que el endpoint se llama con ese id. Cuando existan filas de sala, cambia el id que se pasa,
 * no la pantalla.
 */
@Component({
  selector: 'app-reparto',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfButton, NfLaneIcon, NfSkeleton, NfWindow],
  styleUrl: './reparto.scss',
  templateUrl: './reparto.html',
})
export class Reparto {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly groups = inject(GroupsStore);

  readonly balance = inject(BalanceExplanationStore);
  readonly detail = inject(LobbyDetailStore);
  readonly explanation = this.balance.explanation;
  readonly lobby = this.detail.lobby;

  private readonly groupId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  private readonly salaId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('salaId'))),
    { initialValue: this.route.snapshot.paramMap.get('salaId') },
  );

  /**
   * Se espera a los DOS: la explicación trae ids y la convocatoria trae los nombres, así que
   * pintar la primera sin la segunda sería una tabla de UUIDs que luego cambia sola.
   */
  readonly loading = computed(() => isPending(this.balance.status()) || isPending(this.detail.status()));

  /** El texto del catálogo, para que el 404 diga aquí lo mismo que diría en un toast. */
  readonly notRecordedMessage = messageForCode('BALANCE_NOT_RECORDED');

  /** Quién es cada id, sacado de la convocatoria: titulares, segunda sala y banquillo. */
  private readonly peopleById = computed(() => {
    const slot = this.detail.confirmedSlot();
    const everyone: LobbyParticipantResponse[] = [
      ...(slot?.starters ?? []),
      ...(slot?.secondaryStarters ?? []),
      ...(slot?.bench ?? []),
    ];
    return new Map(everyone.map((p) => [p.userId, p]));
  });

  /** Quiénes comieron autofill. */
  private readonly autofilled = computed(
    () => new Set((this.explanation()?.autofills ?? []).map((a) => a.userId)),
  );

  /**
   * Los cinco duelos, cada uno ya con su lado. `blueTeam` dice cuál de los dos equipos del DTO
   * salió en azul; sin aplicarlo, la tabla enseñaría los bandos cambiados justo en la pantalla
   * que existe para explicar el reparto.
   */
  readonly duels = computed<Duel[]>(() => {
    const explanation = this.explanation();
    if (!explanation) return [];
    const aIsBlue = explanation.blueTeam === 'A';

    return explanation.matchups.map((m) => {
      const a = this.sideOf(m.playerA, m.effectiveA);
      const b = this.sideOf(m.playerB, m.effectiveB);
      return {
        lane: m.lane,
        blue: aIsBlue ? a : b,
        red: aIsBlue ? b : a,
        difference: m.difference,
      };
    });
  });

  /**
   * El margen de error se come la diferencia: ese reparto fue una moneda al aire, y decirlo es
   * lo contrario de esconderlo.
   */
  readonly coinFlip = computed(() => {
    const explanation = this.explanation();
    if (!explanation) return false;
    return explanation.uncertainty >= Math.abs(explanation.globalDifference);
  });

  /**
   * El azar puro ronda 0.56, así que la cifra sola no dice nada: lo que se lee es si está por
   * encima o por debajo de ese suelo.
   */
  readonly familiarityHint = computed(() => {
    const value = this.explanation()?.familiarity;
    if (value === undefined) return '';
    if (value < FAMILIARITY_BASELINE) return 'Duelos más frescos de lo normal.';
    if (value > FAMILIARITY_BASELINE) return 'Duelos más repetidos de lo normal.';
    return 'Justo lo que daría el azar.';
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

  /** Ruta de vuelta a la sala, que es de donde se entra aquí. */
  readonly backLink = computed(() => ['/app', 'grupos', this.groupId(), 'sala', this.salaId()]);

  laneLabel(lane: BalanceLane): string {
    return laneLabel(lane);
  }

  /** Cifras en español y sin decimales de más: son puntuaciones, no importes. */
  num(value: number): string {
    return NUMBERS.format(value);
  }

  retry(): void {
    const id = this.salaId();
    if (!id) return;
    void this.balance.load(id);
    void this.detail.load(id);
  }

  private sideOf(userId: string, effective: number): DuelSide {
    const person = this.peopleById().get(userId);
    return {
      userId,
      name: person?.discordUsername ?? null,
      avatarUrl: person?.avatarUrl ?? null,
      hue: hueFromId(userId),
      effective,
      autofill: this.autofilled().has(userId),
    };
  }

  constructor() {
    effect(() => {
      const id = this.groupId();
      if (id) this.groups.select(id);
    });

    effect(() => {
      const id = this.salaId();
      if (!id) return;
      void this.balance.load(id);
      void this.detail.load(id);
    });

    this.destroyRef.onDestroy(() => {
      this.balance.clear();
      this.detail.clear();
    });
  }
}

/** El azar puro deja la familiaridad rondando este valor; por debajo, duelos más frescos. */
const FAMILIARITY_BASELINE = 0.56;

const NUMBERS = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/** `idle` cuenta como cargando: el efecto que dispara la petición todavía no ha corrido. */
function isPending(status: string): boolean {
  return status === 'idle' || status === 'loading';
}
