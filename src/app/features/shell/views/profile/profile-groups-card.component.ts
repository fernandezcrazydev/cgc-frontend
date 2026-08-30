import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfButton, NfIconButton } from '../../../../ui';
import { ProfileGroupRecord } from '../../../../core/player-profile';
import { GroupsStore } from '../../../../core/groups';
import { GroupStore } from '../../../../core/group-store';
import { ToastService } from '../../../../core/toast';

/** Grupos visibles a la vez. Fija la altura de la tarjeta y el tamaño de página. */
const PER_PAGE = 4;

/**
 * Tarjeta de grupos del perfil (propio: "Tus grupos"; ajeno: "Grupos en los que
 * participa"), compartida por las dos vistas.
 *
 * Si el usuario en sesión es miembro del grupo, la fila redirige a `/app/grupos/:id`.
 * Si no es miembro (ej. viendo perfil ajeno), ofrece la acción interactiva
 * "Solicitar unirme" con feedback inmediato (toast y estado solicitado).
 */
@Component({
  selector: 'app-profile-groups-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton, NfIconButton],
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
                <li class="pf-group-item" [class.pf-group-item--member]="isMember(g.id)">
                  @if (isMember(g.id)) {
                    <a
                      class="pf-group-item__link"
                      [routerLink]="['/app', 'grupos', g.id]"
                      [title]="'Ir al grupo ' + g.name"
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
                          <span class="pf-group-item__rank nf-mono">#{{ g.rankPosition }} · {{ g.lp }} LP</span>
                        </div>
                        <div class="pf-group-item__sub nf-mono">
                          {{ g.wins }}V {{ g.losses }}D ({{ g.wr }}%) · {{ g.role }}
                        </div>
                      </div>
                      <span class="pf-group-item__arrow nf-mono" aria-hidden="true">›</span>
                    </a>
                  } @else {
                    <div class="pf-group-item__content">
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
                          <span class="pf-group-item__rank nf-mono">#{{ g.rankPosition }} · {{ g.lp }} LP</span>
                        </div>
                        <div class="pf-group-item__sub nf-mono">
                          {{ g.wins }}V {{ g.losses }}D ({{ g.wr }}%) · {{ g.role }}
                        </div>
                      </div>
                      <div class="pf-group-item__action">
                        @if (isRequested(g.id)) {
                          <span class="pf-meta-chip pf-meta-chip--verified nf-mono">✓ Solicitado</span>
                        } @else {
                          <button
                            nfButton
                            variant="secondary"
                            size="xs"
                            (click)="requestJoin(g, $event)"
                            [attr.aria-label]="'Solicitar unirme al grupo ' + g.name"
                          >
                            Solicitar unirme
                          </button>
                        }
                      </div>
                    </div>
                  }
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

  private readonly groupsStore = inject(GroupsStore, { optional: true });
  private readonly groupStore = inject(GroupStore, { optional: true });
  private readonly toasts = inject(ToastService, { optional: true });

  protected readonly requestedGroups = signal<Set<string>>(new Set());

  protected isMember(groupId: string): boolean {
    const inReal = this.groupsStore?.groups().some((g) => g.id === groupId) ?? false;
    const inMock = this.groupStore?.groups().some((g) => g.id === groupId) ?? false;
    return inReal || inMock;
  }

  /**
   * Solicitar entrar en un grupo del que no formas parte.
   *
   * BACKEND NOTE: hoy no manda nada. No existe el endpoint —el flujo de grupos del backend es
   * solo por invitación (`POST /groups/{id}/invitations`), no hay ninguna ruta por la que un
   * usuario pida sitio— y tampoco está diseñado en `docs/`. Esto es la maqueta de esa acción y
   * se borra entera el día que exista.
   *
   * Cuando lo haya, esta escritura tiene que pasar a ser pesimista como el resto del proyecto:
   * señal `pending` por grupo que deshabilite el botón, `await` de la confirmación, y solo
   * entonces el toast; el error, con `errorMessage(e)` de `core/http`. Marcar «Solicitado» sin
   * haber preguntado a nadie, como se hace aquí, es aceptable solo porque no hay nadie a quien
   * preguntar.
   */
  protected requestJoin(g: ProfileGroupRecord, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.requestedGroups.update((set) => new Set(set).add(g.id));
    this.toasts?.success(`Solicitud enviada a ${g.name}`);
  }

  protected isRequested(groupId: string): boolean {
    return this.requestedGroups().has(groupId);
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
