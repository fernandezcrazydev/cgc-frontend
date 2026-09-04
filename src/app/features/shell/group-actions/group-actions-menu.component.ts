import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NfAvatar, NfButton, NfModal, NfWindow } from '../../../ui';
import { GroupDetailStore, InvitationsStore, bannerColors } from '../../../core/groups';
import { UserSearchResult, UsersApi } from '../../../core/users';
import { ToastService } from '../../../core/toast';
import { errorMessage } from '../../../core/http';
import { GroupActionsService } from './group-actions.service';

/**
 * Menú de gestión del grupo: invitar, borrar y salir.
 *
 * Vivía en la cabecera del hub, que se retiró por repetir el icono y el nombre que ya pinta la
 * barra superior. Ahora se monta una sola vez en esa barra, así que la gestión está disponible
 * desde cualquier sección del grupo y no solo desde el hub.
 *
 * «Vincular Discord» no está aquí: es una sección más de la navegación del grupo.
 */
@Component({
  selector: 'app-group-actions-menu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NfAvatar, NfButton, NfModal, NfWindow],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'open.set(false)',
  },
  template: `
    @if (store.group(); as g) {
      <div class="ga-more">
        <button
          type="button"
          class="ga-more__trigger"
          [class.is-open]="open()"
          aria-haspopup="menu"
          [attr.aria-expanded]="open()"
          aria-label="Gestionar el grupo"
          title="Gestionar el grupo"
          (click)="toggle($event)"
        >⋯</button>

        @if (open()) {
          <div class="ga-more__menu" role="menu" aria-label="Gestionar el grupo">
            @if (store.canManage()) {
              <button type="button" class="ga-more__item" role="menuitem" (click)="openInvite()">
                Invitar a alguien
              </button>
            }
            @if (store.isOwner()) {
              <button
                type="button"
                class="ga-more__item ga-more__item--danger"
                role="menuitem"
                [disabled]="store.busy()"
                (click)="actions.confirmDelete.set(true); open.set(false)"
              >Borrar grupo</button>
            } @else {
              <button
                type="button"
                class="ga-more__item ga-more__item--danger"
                role="menuitem"
                [disabled]="store.busy()"
                (click)="actions.confirmLeave.set(true); open.set(false)"
              >Salir del grupo</button>
            }
          </div>
        }
      </div>

      @if (actions.confirmDelete()) {
        <div class="modal-overlay" (click)="actions.confirmDelete.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <nf-window title="Borrar grupo" bodyPadding="24px">
              <p class="gd-confirm">
                ¿Seguro que quieres <strong>borrar</strong> {{ g.name }}? Esta acción no se puede deshacer.
              </p>
              <div class="form-foot">
                <button nfButton variant="ghost" size="md" [disabled]="store.busy()" (click)="actions.confirmDelete.set(false)">Cancelar</button>
                <button nfButton variant="danger" size="md" [disabled]="store.busy()" (click)="doDelete()">Borrar</button>
              </div>
            </nf-window>
          </div>
        </div>
      }

      @if (actions.confirmLeave()) {
        <div class="modal-overlay" (click)="actions.confirmLeave.set(false)">
          <div class="modal" (click)="$event.stopPropagation()">
            <nf-window title="Salir del grupo" bodyPadding="24px">
              <p class="gd-confirm">¿Seguro que quieres <strong>salir</strong> de {{ g.name }}?</p>
              <div class="form-foot">
                <button nfButton variant="ghost" size="md" [disabled]="store.busy()" (click)="actions.confirmLeave.set(false)">Cancelar</button>
                <button nfButton variant="danger" size="md" [disabled]="store.busy()" (click)="doLeave()">Salir</button>
              </div>
            </nf-window>
          </div>
        </div>
      }

      @if (actions.showInvite()) {
        <nf-modal title="Invitar" width="480px" (closed)="closeInvite()">
          <div class="gd-invite">
            <input
              class="field__input"
              type="text"
              placeholder="Buscar por nombre de Discord…"
              autocomplete="off"
              [ngModel]="query()"
              (ngModelChange)="onQuery($event)"
            />
            @if (searching()) {
              <div class="gd-invite__hint nf-mono">Buscando…</div>
            } @else if (query().trim().length >= 2 && !candidates().length) {
              <div class="gd-invite__hint nf-mono">Sin resultados</div>
            } @else if (query().trim().length < 2) {
              <div class="gd-invite__hint nf-mono">Escribe al menos 2 caracteres</div>
            }
            @for (u of candidates(); track u.userId) {
              <div class="gd-invite__row">
                <nf-avatar
                  [src]="u.avatarUrl ?? null"
                  [fallback]="u.discordUsername"
                  [tint]="tintOf(u.userId)"
                  [size]="38"
                  shape="square"
                />
                <span class="gd-invite__name nf-mono">
                  {{ u.discordUsername }}
                  @if (!u.acceptsGroupInvites) {
                    <span class="gd-invite__closed nf-mono">No acepta invitaciones</span>
                  }
                </span>
                <button
                  nfButton
                  variant="primary"
                  size="sm"
                  [disabled]="invitations.inviting() || isInvited(u.userId) || !u.acceptsGroupInvites"
                  (click)="invite(u)"
                >{{ isInvited(u.userId) ? 'Invitado' : 'Invitar' }}</button>
              </div>
            }
          </div>
        </nf-modal>
      }
    }
  `,
  styleUrl: './group-actions-menu.component.scss',
})
export class GroupActionsMenuComponent {
  readonly store = inject(GroupDetailStore);
  readonly actions = inject(GroupActionsService);
  readonly invitations = inject(InvitationsStore);
  private readonly usersApi = inject(UsersApi);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  /** El desplegable abierto. Estado de interfaz del propio botón. */
  readonly open = signal(false);

  readonly query = signal('');
  readonly searching = signal(false);
  private readonly results = signal<UserSearchResult[]>([]);
  /** Ids ya invitados en esta sesión (para pintar «Invitado») además de los del store. */
  private readonly invitedIds = signal<ReadonlySet<string>>(new Set());
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchSeq = 0;

  /**
   * Candidatos: resultados menos quienes ya están en el roster cargado. Es una comodidad, no una
   * garantía: invitar a alguien que ya es miembro lo rechaza el backend con un 409
   * `ALREADY_MEMBER`, que `errorMessage()` ya traduce.
   */
  readonly candidates = computed(() => {
    const inGroup = new Set(this.store.roster().map((m) => m.userId));
    return this.results().filter((u) => !inGroup.has(u.userId));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    });
  }

  toggle(event: Event): void {
    event.stopPropagation();
    this.open.update((v) => !v);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.open()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.ga-more')) return;
    this.open.set(false);
  }

  /** Tinte del avatar de reserva, derivado del id. Presentación, no dato de dominio. */
  tintOf(seed: string): readonly [string, string] {
    const { c1, c2 } = bannerColors(seed);
    return [c1, c2];
  }

  // ── Borrar y salir ──────────────────────────────────────────────────
  async doDelete(): Promise<void> {
    try {
      await this.store.deleteGroup();
      this.actions.confirmDelete.set(false);
      this.toasts.success('Grupo borrado');
      void this.router.navigate(['/app', 'grupos']);
    } catch {
      this.toasts.error('No se pudo borrar el grupo.');
    }
  }

  async doLeave(): Promise<void> {
    try {
      await this.store.leave();
      this.actions.confirmLeave.set(false);
      this.toasts.success('Has salido del grupo');
      void this.router.navigate(['/app', 'grupos']);
    } catch {
      this.toasts.error('No se pudo salir del grupo.');
    }
  }

  // ── Invitar ─────────────────────────────────────────────────────────
  openInvite(): void {
    this.resetSearch();
    this.open.set(false);
    this.actions.openInvite();
  }

  closeInvite(): void {
    this.actions.showInvite.set(false);
    this.resetSearch();
  }

  onQuery(value: string): void {
    this.query.set(value);
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    const term = value.trim();
    if (term.length < 2) {
      this.results.set([]);
      this.searching.set(false);
      return;
    }
    this.searching.set(true);
    this.searchTimer = setTimeout(() => void this.search(term), 300);
  }

  private async search(term: string): Promise<void> {
    const seq = ++this.searchSeq;
    try {
      const hits = await firstValueFrom(this.usersApi.search(term));
      if (seq !== this.searchSeq) return; // respuesta obsoleta
      this.results.set(hits);
    } catch {
      if (seq === this.searchSeq) this.results.set([]);
    } finally {
      if (seq === this.searchSeq) this.searching.set(false);
    }
  }

  private resetSearch(): void {
    if (this.searchTimer !== null) clearTimeout(this.searchTimer);
    this.searchSeq++; // invalida cualquier búsqueda en vuelo
    this.query.set('');
    this.results.set([]);
    this.searching.set(false);
  }

  /** Ya invitado: en esta sesión o según la lista de pendientes del grupo. */
  isInvited(userId: string): boolean {
    return this.invitedIds().has(userId);
  }

  async invite(u: UserSearchResult): Promise<void> {
    const g = this.store.group();
    if (!g || this.invitations.inviting() || this.isInvited(u.userId)) return;
    try {
      await this.invitations.invite(g.id, u.userId);
      this.invitedIds.update((set) => new Set(set).add(u.userId));
      this.toasts.success(`Invitación enviada a ${u.discordUsername}`);
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }
}
