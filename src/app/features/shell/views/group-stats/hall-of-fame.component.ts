import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NfSkeleton } from '../../../../ui';
import { MEDAL_FAMILY_LABELS, MedalBoard, MedalFamily } from '../../../../core/group-medals';
import { MedalIconComponent } from './medal-icon.component';

/** Una familia con sus medallas, tal y como se pinta la rejilla. */
interface MedalGroup {
  family: MedalFamily;
  label: string;
  boards: MedalBoard[];
}

/**
 * Hall of Fame del grupo (§5.5.5, pestaña 2): el catálogo de veinte medallas.
 *
 * Cada tarjeta se ilumina al pasar por encima y abre el detalle de progreso. Las
 * medallas van agrupadas por familia porque veinte tarjetas seguidas se leen como
 * un muro; con los rótulos, se leen como un palmarés.
 *
 * La tarjeta no navega por su cuenta: pide abrir una medalla y decide la vista, que
 * es quien sincroniza el modal con el parámetro `?medalla=` de la URL. Así la misma
 * rejilla vale para la pantalla y para el enlace que llega desde el hub.
 */
@Component({
  selector: 'app-hall-of-fame',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton, MedalIconComponent],
  template: `
    <section class="hof" [attr.aria-busy]="loading() ? 'true' : null">
      @if (loading()) {
        <div class="hof-grid">
          @for (s of [0, 1, 2, 3, 4, 5, 6, 7]; track s) {
            <nf-skeleton width="100%" height="128px" radius="12px" />
          }
        </div>
      } @else if (boards().length) {
        @for (group of groups(); track group.family) {
          <section class="hof-family">
            <h3 class="hof-family__title">{{ group.label }}</h3>

            <ul class="hof-grid">
              @for (board of group.boards; track board.medal.id) {
                <li>
                  <button
                    type="button"
                    class="hof-medal"
                    [class.is-mine]="board.me && board.me.rank === 1"
                    (click)="open.emit(board.medal.id)"
                  >
                    <span class="hof-medal__icon" aria-hidden="true">
                      <app-medal-icon [icon]="board.medal.icon" />
                    </span>

                    <span class="hof-medal__title">{{ board.medal.title }}</span>

                    @if (board.leader; as leader) {
                      <span class="hof-medal__leader">
                        Líder: {{ leader.member.name }}
                        <span class="nf-mono">{{ leader.value }}</span>
                      </span>
                    } @else {
                      <span class="hof-medal__leader hof-medal__leader--vacant">
                        Todavía no la tiene nadie
                      </span>
                    }

                    @if (board.me; as me) {
                      <span class="hof-medal__me nf-mono" [class.is-first]="me.rank === 1">
                        @if (me.rank === 1) {
                          La tienes tú
                        } @else {
                          Tu puesto: {{ me.rank }}.º · {{ me.value }}
                        }
                      </span>
                    }
                  </button>
                </li>
              }
            </ul>
          </section>
        }
      } @else {
        <p class="hof__empty">
          Este grupo todavía no tiene partidas suficientes para repartir medallas.
        </p>
      }
    </section>
  `,
  styleUrls: ['./hall-of-fame.component.scss'],
})
export class HallOfFameComponent {
  readonly boards = input<readonly MedalBoard[]>([]);
  readonly loading = input(false);

  /** Pide abrir el detalle de una medalla por su id. */
  readonly open = output<string>();

  /**
   * Agrupa por familia respetando el orden del catálogo: la primera vez que aparece
   * una familia se abre su bloque, así el orden de `MEDALS` es el de la pantalla y
   * no hay una segunda lista de familias que mantener en sintonía.
   */
  protected readonly groups = computed<MedalGroup[]>(() => {
    const out: MedalGroup[] = [];
    for (const board of this.boards()) {
      const family = board.medal.family;
      let group = out.find((g) => g.family === family);
      if (!group) {
        group = { family, label: MEDAL_FAMILY_LABELS[family], boards: [] };
        out.push(group);
      }
      group.boards.push(board);
    }
    return out;
  });
}
