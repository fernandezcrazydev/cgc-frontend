import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfSkeleton } from '../../../../ui';
import { MedalBoard } from '../../../../core/group-medals';
import { MedalIconComponent } from '../group-stats/medal-icon.component';

/**
 * Vitrina de trofeos del grupo (§5.5.4, columna del 25%): cuatro hitos comunitarios
 * apilados, cada uno pulsable.
 *
 * Pulsar uno lleva al Hall of Fame con SU medalla ya abierta
 * (`/app/grupos/:id/estadisticas?medalla=<id>`), que es la deuda que §5.5.4 dejó
 * anotada y que §5.5.5 cierra. La tarjeta y la medalla del Hall of Fame salen de la
 * misma fuente (`core/group-medals`) y dibujan el mismo icono: si fueran dos
 * catálogos, un día la vitrina prometería un trofeo que allí se llama de otra forma.
 *
 * El icono se toma prestado de la carpeta de estadísticas en vez de duplicarse. Las
 * dos carpetas son de la misma feature (el shell) y la alternativa —una segunda
 * lista de veinte trazos— es precisamente lo que acaba desalineado.
 */
@Component({
  selector: 'app-hub-trophy-case',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfSkeleton, RouterLink, MedalIconComponent],
  template: `
    <section class="hub-card hub-trophies" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="hub-card__head">
        <h2 class="hub-card__title nf-mono">Trofeos</h2>
      </header>

      @if (loading()) {
        @for (s of [0, 1, 2, 3]; track s) {
          <nf-skeleton width="100%" height="52px" radius="9px" />
        }
      } @else if (trophies().length) {
        <ul class="hub-trophies__list">
          @for (t of trophies(); track t.medal.id) {
            <li>
              <a
                class="hub-trophy"
                [routerLink]="['/app', 'grupos', groupId(), 'estadisticas']"
                [queryParams]="{ medalla: t.medal.id }"
                [attr.aria-label]="'Ver el detalle de ' + t.medal.title + ' en el Hall of Fame'"
              >
                <span class="hub-trophy__icon" aria-hidden="true">
                  <app-medal-icon [icon]="t.medal.icon" />
                </span>
                <span class="hub-trophy__meta">
                  <span class="hub-trophy__title nf-mono">{{ t.medal.title }}</span>
                  @if (t.leader; as leader) {
                    <span class="hub-trophy__holder">{{ leader.member.name }}</span>
                    <span class="hub-trophy__value nf-mono">{{ leader.value }}</span>
                  } @else {
                    <span class="hub-trophy__holder hub-trophy__holder--vacant">
                      Todavía no la tiene nadie
                    </span>
                  }
                </span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <p class="hub-card__empty">Todavía no hay partidas suficientes para repartir trofeos.</p>
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-trophy-case.component.scss'],
})
export class HubTrophyCaseComponent {
  readonly trophies = input<readonly MedalBoard[]>([]);
  readonly groupId = input.required<string>();
  readonly loading = input(false);
}
