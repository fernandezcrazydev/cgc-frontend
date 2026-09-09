import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfIconButton } from '../../../../ui';
import { ProfileGroupRecord } from '../../../../core/player-profile';
import { SharedGroups } from './shared-groups';

/** Grupos visibles a la vez. Fija la altura de la tarjeta y el tamaño de página. */
const PER_PAGE = 4;

/**
 * Tarjeta de grupos del perfil (propio: "Tus grupos"; ajeno: "Grupos en los que
 * participa"), compartida por las dos vistas.
 *
 * **La fila se pinta igual en los tres casos** —perfil propio, grupo que compartes con
 * el jugador que miras, y grupo suyo en el que tú no estás—. Ser o no miembro solo
 * cambia tres cosas, y ninguna es de forma:
 *
 * | | Miembro | Grupo ajeno |
 * |---|---|---|
 * | Enlace | `/app/grupos/:id` (el grupo) | `/app/grupos/:id/perfil` (su ficha pública) |
 * | A la derecha del nombre | `#7 · 239 LP` | etiqueta `Grupo ajeno` |
 * | Pie de la fila | tu rol (`Miembro`, `Capitán`) | `Ver ficha` |
 *
 * Esto es deliberado y se pidió así el 2026-09-09: una fila con botón y otra sin él
 * hacían que la misma lista pareciera dos componentes distintos. Antes vivieron aquí un
 * botón de "Cara a Cara" y otro de "Solicitar unirme" (este último, además, una maqueta:
 * el backend no tiene ninguna ruta de solicitud de ingreso, solo invitaciones). Los dos
 * se retiraron; no volver a meter acciones en la fila sin hablarlo.
 */
@Component({
  selector: 'app-profile-groups-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfIconButton],
  styleUrl: './profile-groups-card.component.scss',
  template: `
    <section class="pf-card pf-group-card">
      <div class="pf-card__header">
        <span class="pf-card__title nf-mono">{{ title() }}</span>

        @if (pageCount() > 1) {
          <div class="pf-group-pager">
            <button
              nfIconButton
              size="sm"
              label="Ver los grupos anteriores"
              [disabled]="page() === 0"
              (click)="prev()"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M10 3 5 8l5 5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <span class="pf-group-pager__count nf-mono" aria-live="polite">
              {{ page() + 1 }}/{{ pageCount() }}
            </span>
            <button
              nfIconButton
              size="sm"
              label="Ver los grupos siguientes"
              [disabled]="page() >= pageCount() - 1"
              (click)="next()"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="m6 3 5 5-5 5"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        }
      </div>

      <div class="pf-group-viewport">
        <div class="pf-group-track" [style.transform]="'translateX(' + -page() * 100 + '%)'">
          @for (chunk of pages(); track $index) {
            <ul class="pf-group-list" [attr.aria-hidden]="$index !== page() ? 'true' : null">
              @for (g of chunk; track g.id) {
                <li class="pf-group-item">
                  <a
                    class="pf-group-item__link"
                    [routerLink]="linkFor(g)"
                    [title]="titleFor(g)"
                  >
                    <span
                      class="pf-group-item__avatar"
                      [style.background]="'linear-gradient(135deg,' + g.c1 + ',' + g.c2 + ')'"
                      aria-hidden="true"
                    >
                      {{ g.initials }}
                    </span>
                    <div class="pf-group-item__info">
                      <div class="pf-group-item__name-row">
                        <span class="pf-group-item__name">{{ g.name }}</span>
                        @if (isMember(g.id)) {
                          <span class="pf-group-item__rank nf-mono">
                            #{{ g.rankPosition }} · {{ g.lp }} LP
                          </span>
                        } @else {
                          <span class="pf-group-item__badge nf-mono">Grupo ajeno</span>
                        }
                      </div>
                      <div class="pf-group-item__sub nf-mono">
                        {{ g.wins }}V {{ g.losses }}D ({{ g.wr }}%) ·
                        {{ isMember(g.id) ? g.role : 'Ver ficha' }}
                      </div>
                    </div>
                    <span class="pf-group-item__arrow nf-mono" aria-hidden="true">›</span>
                  </a>
                </li>
              }
            </ul>
          } @empty {
            <div class="pf-group-list">
              <div class="empty-state empty-state--compact">
                <span class="empty-state__icon" aria-hidden="true">◎</span>
                <span class="empty-state__text nf-mono">{{ emptyText() }}</span>
              </div>
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class ProfileGroupsCard {
  readonly groups = input.required<readonly ProfileGroupRecord[]>();
  readonly title = input('Tus grupos');
  readonly emptyText = input('Sin grupos todavía');

  private readonly shared = inject(SharedGroups);

  /** ¿Estás tú —el usuario en sesión— dentro de este grupo? */
  protected isMember(groupId: string): boolean {
    return this.shared.has(groupId);
  }

  /** Al grupo si eres miembro; a su ficha pública si no. */
  protected linkFor(g: ProfileGroupRecord): unknown[] {
    return this.isMember(g.id)
      ? ['/app', 'grupos', g.id]
      : ['/app', 'grupos', g.id, 'perfil'];
  }

  protected titleFor(g: ProfileGroupRecord): string {
    return this.isMember(g.id) ? 'Ir al grupo ' + g.name : 'Ver la ficha pública de ' + g.name;
  }

  /** Páginas de cuatro. Es lo único que decide el ancho del carril. */
  protected readonly pages = computed(() => {
    const all = this.groups();
    const out: ProfileGroupRecord[][] = [];
    for (let i = 0; i < all.length; i += PER_PAGE) out.push(all.slice(i, i + PER_PAGE));
    return out;
  });

  protected readonly pageCount = computed(() => this.pages().length);

  /**
   * Si la lista encoge (o cambia de jugador) la página actual puede quedar fuera
   * de rango y la tarjeta enseñaría un hueco en blanco; `linkedSignal` la trae de
   * vuelta al último índice válido en lugar de dejarla colgada.
   */
  protected readonly page = linkedSignal<number, number>({
    source: this.pageCount,
    computation: (count, previous) => Math.min(previous?.value ?? 0, Math.max(0, count - 1)),
  });

  protected prev(): void {
    this.page.update((p) => Math.max(0, p - 1));
  }

  protected next(): void {
    this.page.update((p) => Math.min(this.pageCount() - 1, p + 1));
  }
}
