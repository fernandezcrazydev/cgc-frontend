import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NfAvatar, NfButton } from '../../../../ui';
import { LobbyResponse, LobbySlotResponse } from '../../../../core/lobbies';
import { hueFromId } from '../../../../shared/avatar-bg';

/** Cómo se sitúa el usuario respecto a esta convocatoria. */
export type ScheduleStanding =
  | { kind: 'starter'; position: number; slot: LobbySlotResponse }
  | { kind: 'bench'; position: number; slot: LobbySlotResponse }
  | { kind: 'out' };

/**
 * Una convocatoria de la columna derecha (§5.5.6).
 *
 * El marco cambia según si estás dentro: azul con tu puesto cuando lo estás, neutro
 * cuando no. Eso es lo que permite recorrer la columna sin leer una sola línea.
 *
 * Hay dos formas de convocatoria y se tratan distinto a propósito:
 *   - **Confirmada**: hay una hora y una sola, así que apuntarse y borrarse se hace
 *     aquí mismo, sin salir de la pantalla.
 *   - **Con horas propuestas**: decir a qué horas puedes es elegir entre varias, y
 *     eso es justo lo que hace la pantalla de la convocatoria; la tarjeta lleva allí
 *     en vez de fingir que la decisión cabe en un botón.
 */
@Component({
  selector: 'app-schedule-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfButton],
  template: `
    @if (lobby(); as lb) {
      <article class="sc" [class.is-mine]="standing().kind !== 'out'">
        <header class="sc__head">
          <span class="sc__when">{{ when() }}</span>
          <!-- «Hora confirmada» y no «Confirmada» a secas: lo que se cierra al
               confirmar es el día y la hora, no el cupo. Una convocatoria puede estar
               confirmada con seis apuntados —se llenó y luego se cayeron cuatro— y
               «Confirmada · 6 de 10 plazas» se leía como una contradicción. -->
          <span class="sc__meta nf-mono">
            {{ lb.status === 'CONFIRMED' ? 'Hora confirmada' : 'Recogiendo horas' }} · convocó
            {{ lb.openedBy.discordUsername ?? 'alguien del grupo' }}
          </span>
        </header>

        @if (slot(); as s) {
          <div class="sc__fill">
            <div class="sc__bar">
              <span
                class="sc__bar-fill"
                [style.width.%]="(s.starters.length / lb.capacity) * 100"
              ></span>
            </div>
            <span class="sc__bar-text nf-mono">
              {{ s.starters.length }} de {{ lb.capacity }} plazas
            </span>
          </div>

          <ul class="sc__people" [attr.aria-label]="'Inscritos: ' + s.starters.length">
            @for (p of s.starters; track p.userId) {
              <li>
                <nf-avatar
                  [src]="p.avatarUrl"
                  [fallback]="p.discordUsername ?? ''"
                  [tint]="tintOf(p.userId)"
                  [size]="24"
                  shape="round"
                  [alt]="p.discordUsername ?? 'Jugador inscrito'"
                />
              </li>
            }
          </ul>

          @if (s.bench.length) {
            <div class="sc__bench">
              <ul class="sc__people sc__people--bench">
                @for (p of s.bench; track p.userId) {
                  <li>
                    <nf-avatar
                      [src]="p.avatarUrl"
                      [fallback]="p.discordUsername ?? ''"
                      [tint]="tintOf(p.userId)"
                      [size]="20"
                      shape="round"
                      [alt]="p.discordUsername ?? 'Suplente'"
                    />
                  </li>
                }
              </ul>
              <span class="sc__bench-text nf-mono">{{ benchText() }}</span>
            </div>
          }
        }

        <footer class="sc__foot">
          <!-- Ser titular no se rotula: el marco azul y el botón «Ya no puedo» ya lo
               dicen, y el número de puesto no cambia nada para quien lo lee. Estar en
               el banquillo sí, porque significa que NO juegas salvo que alguien caiga. -->
          @if (standing().kind === 'bench') {
            <span class="sc__badge sc__badge--bench">Estás en el banquillo</span>
          } @else {
            <span></span>
          }

          @if (lb.status === 'CONFIRMED' && slot(); as s) {
            @if (standing().kind === 'out') {
              <button
                nfButton
                variant="primary"
                size="sm"
                [disabled]="acting()"
                (click)="signUp.emit(s.id)"
              >
                Inscribirme
              </button>
            } @else {
              <button
                nfButton
                variant="ghost"
                size="sm"
                [disabled]="acting()"
                (click)="withdraw.emit(s.id)"
              >
                Ya no puedo
              </button>
            }
          } @else {
            <button nfButton variant="secondary" size="sm" (click)="openAvailability.emit()">
              Decir cuándo puedo
            </button>
          }
        </footer>
      </article>
    }
  `,
  styleUrl: './schedule-card.component.scss',
})
export class ScheduleCardComponent {
  readonly lobby = input<LobbyResponse | null>(null);
  /** La franja que representa a esta convocatoria: la confirmada o la más llena. */
  readonly slot = input<LobbySlotResponse | null>(null);
  /** Dónde queda el usuario en esta convocatoria, ya resuelto por la vista. */
  readonly standing = input<ScheduleStanding>({ kind: 'out' });
  /** Cuándo empieza, ya escrito, o cuántas horas hay sobre la mesa. */
  readonly when = input('');
  /** Hay una escritura en vuelo sobre esta franja: el botón se apaga. */
  readonly acting = input(false);

  readonly signUp = output<string>();
  readonly withdraw = output<string>();
  /** Pide abrir el modal de «a qué horas puedo»; decide la vista. */
  readonly openAvailability = output<void>();

  protected readonly tintOf = hueFromId;

  /**
   * Los suplentes cuentan hacia una segunda custom simultánea: con diez de sobra
   * salen dos partidas a la vez, y saber cuánto falta es lo que empuja a llamar a
   * otro más.
   */
  protected readonly benchText = computed(() => {
    const lb = this.lobby();
    const bench = this.slot()?.bench.length ?? 0;
    if (!lb || !bench) return '';
    const missing = lb.capacity - bench;
    if (missing <= 0) return 'Dan para una segunda custom simultánea';
    return `Faltan ${missing} para una segunda custom`;
  });
}
