import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { NfButton, NfSkeleton } from '../../../../ui';
import { Match, MatchTimelineStore, participantShortName, participantsOf } from '../../../../core/matches';

/**
 * El lado del mapa, en unidades del juego.
 *
 * El backend sirve las coordenadas sin normalizar a propósito, y este es el número con el que se
 * dividen. Vive aquí y no allí porque es una constante de la IMAGEN, no del contrato: sobre las
 * exportaciones medidas los valores van de 130 a 14.673, que encaja con el mapa de 14.870 de lado
 * que usa Summoner's Rift. Si algún día la imagen cambia de recorte, se toca esta línea y ninguna
 * otra.
 */
const MAP_SIZE = 14870;

/** Un punto ya colocado sobre la imagen, en porcentaje. */
export interface MapDot {
  userId: string;
  name: string;
  side: 'blue' | 'red' | null;
  /** 0-100 desde el borde izquierdo. */
  left: number;
  /** 0-100 desde el borde SUPERIOR: la `y` del juego crece hacia arriba y aquí hacia abajo. */
  top: number;
  gold: number | null;
}

/**
 * Dónde estaba cada uno, minuto a minuto (`cgc-backend#96`).
 *
 * <h3>Lo que había antes aquí</h3>
 *
 * Un mapa de calor con **36 coordenadas escritas a mano en el front**, iguales en todas las
 * partidas, más un desglose de zonas y unas wards que no salían de ningún dato. Se borró entero al
 * conectar la pantalla, porque una maqueta que se lee como dato es peor que no tener la pantalla.
 * Esto es lo mismo rehecho con las posiciones de verdad.
 *
 * <h3>Y lo que sigue sin poder pintarse</h3>
 *
 * **Las wards no vuelven**, y eso ya no es una tarea pendiente sino una medición: la timeline que el
 * cliente de LoL deja leer trae exactamente tres tipos de evento —muertes, edificios y monstruos
 * grandes— y la visión no es uno. La de `match-v5` de Riot sí los trae, pero esa API no indexa
 * customs. Dibujar wards aquí sería la maqueta otra vez, con otro nombre.
 *
 * <h3>Un punto por jugador, no un mapa de calor</h3>
 *
 * Una foto por minuto son diez puntos, y un mapa de calor sobre diez puntos es una mancha que dice
 * menos que los puntos. El recorrido se ve moviendo el minuto, que además es la pregunta que la
 * gente hace de verdad («¿dónde estaba el jungla en el 12?»).
 */
@Component({
  selector: 'app-match-map',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfButton, NfSkeleton],
  templateUrl: './match-map.component.html',
  styleUrl: './match-map.component.scss',
})
export class MatchMapComponent {
  protected readonly timeline = inject(MatchTimelineStore);

  readonly matchId = input.required<string>();
  /** El marcador, del que salen los nombres: un punto sin nombre no se puede leer. */
  readonly match = input.required<Match>();

  /** El minuto que se está mirando. Arranca en el 0, que es todo el mundo en la fuente. */
  protected readonly minute = signal(0);

  protected readonly frames = computed(() => this.timeline.positions().frames);

  protected readonly lastMinute = computed(() => {
    const frames = this.frames();
    return frames.length === 0 ? 0 : frames[frames.length - 1].minute;
  });

  /**
   * El frame que se pinta.
   *
   * Se busca por `minute` y no por índice: los frames son uno por minuto, pero el día que falte uno
   * —una exportación a medias— un índice pintaría el minuto de al lado sin decirlo.
   */
  protected readonly currentFrame = computed(() =>
    this.frames().find((frame) => frame.minute === this.minute()) ?? null,
  );

  /** Los puntos del minuto activo, ya en porcentaje sobre la imagen. */
  protected readonly dots = computed<MapDot[]>(() => {
    const frame = this.currentFrame();
    if (!frame) return [];

    const names = new Map(
      participantsOf(this.match()).map((p) => [p.userId, participantShortName(p)]),
    );
    const sideOf = new Map(this.match().teams.map((team) => [team.slot, team.side]));

    return frame.positions.map((position) => ({
      userId: position.userId,
      name: names.get(position.userId) ?? 'Sin identificar',
      side: position.teamSlot ? sideOf.get(position.teamSlot) ?? null : null,
      left: round((position.x / MAP_SIZE) * 100),
      // La `y` del juego crece hacia arriba y la de la pantalla hacia abajo: sin este 100 menos, el
      // mapa sale del revés y la base azul aparece arriba. Es el error que no se ve si no conoces
      // el mapa, y se ve enseguida si lo conoces.
      top: round(100 - (position.y / MAP_SIZE) * 100),
      gold: position.totalGold,
    }));
  });

  /** Se pide al montar el bloque, no al abrir la partida: la mitad que pesa no se paga por si acaso. */
  constructor() {
    effect(() => {
      const id = this.matchId();
      if (!id) return;
      untracked(() => void this.timeline.ensurePositions(id));
    });

    // Al llegar los datos, el minuto arranca en el primero que exista. Con un `frames` vacío se
    // queda en 0 y no se pinta nada, que es lo correcto.
    effect(() => {
      const frames = this.frames();
      if (frames.length === 0) return;
      untracked(() => {
        if (!frames.some((frame) => frame.minute === this.minute())) {
          this.minute.set(frames[0].minute);
        }
      });
    });
  }

  protected onMinute(event: Event): void {
    this.minute.set(Number((event.target as HTMLInputElement).value));
  }

  protected retry(): void {
    void this.timeline.reloadPositions(this.matchId());
  }
}

/** Un decimal basta para colocar un punto de diez píxeles, y deja el DOM legible. */
function round(value: number): number {
  return Math.round(value * 10) / 10;
}
