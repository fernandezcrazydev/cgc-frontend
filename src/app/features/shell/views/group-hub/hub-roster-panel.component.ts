import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfAvatar, NfBadge, NfButton, NfRankEmblem, NfSegmented, NfSkeleton } from '../../../../ui';
import { GroupMemberResponse } from '../../../../core/groups';
import { RankEntry } from '../../../../core/group-ranking';

export type RosterTab = 'members' | 'ranking';

/** Acción de gestión sobre un miembro, disparada desde su menú de tres puntos. */
export interface RosterAction {
  kind: 'promote' | 'demote' | 'transfer' | 'kick';
  member: GroupMemberResponse;
}

/**
 * Columna lateral del hub (§5.5.4, el 30%): roster del grupo y clasificación rápida en dos
 * pestañas de **altura fija**, para que cambiar de pestaña no mueva ni un pixel del resto.
 *
 * Las acciones de gestión de cada miembro van en su menú de tres puntos, no como botones
 * sueltos en la fila: en una columna estrecha no caben y, sobre todo, expulsar no debe
 * compartir aspecto con nada que se pulse a diario.
 */
@Component({
  selector: 'app-hub-roster-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfAvatar, NfBadge, NfButton, NfRankEmblem, NfSegmented, NfSkeleton],
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'openMenu.set(null)',
  },
  template: `
    <section class="hub-card hub-roster">
      <nf-segmented
        variant="tabs"
        [options]="tabOptions()"
        [value]="tab()"
        (valueChange)="setTab($event)"
        ariaLabel="Miembros o clasificación del grupo"
      />

      @if (tab() === 'members') {
        <label class="hub-roster__search">
          <span class="sr-only">Buscar miembro por nombre</span>
          <input
            class="hub-roster__search-input"
            type="search"
            placeholder="Buscar por nombre o Riot ID"
            autocomplete="off"
            [value]="query()"
            (input)="onQuery($event)"
          />
        </label>

        <div class="hub-roster__list" [attr.aria-busy]="membersLoading() ? 'true' : null">
          @if (membersLoading()) {
            @for (s of skeletons(); track s) {
              <div class="hub-roster__row">
                <nf-skeleton width="32px" height="32px" radius="10px" />
                <div class="hub-roster__row-meta">
                  <nf-skeleton width="120px" height="12px" />
                  <nf-skeleton width="80px" height="10px" />
                </div>
              </div>
            }
          } @else {
            @for (m of visibleMembers(); track m.userId; let i = $index) {
              <div class="hub-roster__row">
                <a
                  class="hub-roster__link"
                  [routerLink]="['/app', 'perfil', m.userId]"
                  [title]="'Ver el perfil de ' + m.discordUsername"
                >
                  <nf-avatar
                    [src]="m.avatarUrl"
                    [fallback]="m.discordUsername"
                    [tint]="tintOf(m.userId)"
                    [size]="32"
                    shape="square"
                  />
                  <span class="hub-roster__row-meta">
                    <span class="hub-roster__name nf-mono">
                      {{ m.discordUsername }}@if (isMe(m)) {<span class="hub-roster__you"> · tú</span>}
                    </span>
                    <span class="hub-roster__sub nf-mono">
                      {{ m.riotId ?? 'Sin cuenta vinculada' }}
                    </span>
                  </span>
                </a>
                @if (m.role === 'OWNER') {
                  <nf-badge color="primary">Owner</nf-badge>
                } @else if (m.role === 'ADMIN') {
                  <nf-badge color="secondary">Admin</nf-badge>
                }
                @if (menuFor(m).length) {
                  <span class="hub-roster__more">
                    <button
                      type="button"
                      class="hub-roster__more-trigger"
                      [class.is-open]="openMenu() === m.userId"
                      aria-haspopup="menu"
                      [attr.aria-expanded]="openMenu() === m.userId"
                      [attr.aria-label]="'Gestionar a ' + m.discordUsername"
                      [disabled]="acting().has(m.userId)"
                      (click)="toggleMenu(m.userId, $event)"
                    >⋯</button>
                    @if (openMenu() === m.userId) {
                      <span
                        class="hub-roster__more-menu"
                        [class.is-up]="isNearBottom(i)"
                        role="menu"
                      >
                        @for (item of menuFor(m); track item.kind) {
                          <button
                            type="button"
                            class="hub-roster__more-item"
                            [class.is-danger]="item.kind === 'kick'"
                            role="menuitem"
                            (click)="run(item.kind, m)"
                          >{{ item.label }}</button>
                        }
                      </span>
                    }
                  </span>
                }
              </div>
            } @empty {
              <p class="hub-card__empty">
                @if (query().trim()) {
                  Ningún miembro coincide con «{{ query() }}».
                } @else {
                  Este grupo todavía no tiene miembros.
                }
              </p>
            }
          }
        </div>

        @if (canManage()) {
          <footer class="hub-roster__foot">
            <div class="hub-roster__foot-actions">
              <button
                type="button"
                class="hub-roster__action-btn"
                (click)="requestsOpen.emit()"
              >
                <span class="hub-roster__action-text">Solicitudes</span>
                @if (pendingRequests(); as reqs) {
                  <span class="hub-roster__action-badge nf-mono">{{ reqs }}</span>
                }
              </button>
              <button
                type="button"
                class="hub-roster__action-btn"
                (click)="invitesOpen.emit()"
              >
                <span class="hub-roster__action-text">Invitaciones</span>
                @if (pendingInvites(); as invs) {
                  <span class="hub-roster__action-badge nf-mono">{{ invs }}</span>
                }
              </button>
            </div>
          </footer>
        }
      } @else {
        <div class="hub-roster__list" [attr.aria-busy]="rankingLoading() ? 'true' : null">
          @if (rankingLoading()) {
            @for (s of skeletons(); track s) {
              <div class="hub-roster__row">
                <nf-skeleton width="32px" height="32px" radius="10px" />
                <div class="hub-roster__row-meta">
                  <nf-skeleton width="110px" height="12px" />
                  <nf-skeleton width="70px" height="10px" />
                </div>
              </div>
            }
          } @else if (rankingError()) {
            <p class="hub-card__empty">No se pudo cargar la clasificación del grupo.</p>
          } @else {
            @for (row of ranking(); track row.playerId) {
              <!-- El atributo data-podium tiñe la fila con el metal del puesto (oro, plata y
                   bronce), los mismos acentos que las tarjetas del podio de la clasificación. -->
              <a
                class="hub-roster__row hub-roster__row--rank"
                [attr.data-podium]="row.rank <= 3 ? row.rank : null"
                [routerLink]="['/app', 'perfil', row.playerId]"
              >
                <span class="hub-roster__pos nf-mono" [class.is-podium]="row.rank <= 3">{{ row.rank }}.º</span>
                <nf-avatar
                  [src]="row.avatar"
                  [fallback]="row.name"
                  [tint]="row.hue"
                  [size]="32"
                  shape="square"
                />
                <span class="hub-roster__row-meta">
                  <span class="hub-roster__name nf-mono">{{ row.name }}</span>
                  <span class="hub-roster__sub nf-mono">{{ row.formattedLp }} · {{ row.wr }}% de victorias</span>
                </span>
                @if (row.lolRank; as rank) {
                  <nf-rank-emblem [tier]="rank.tier" [label]="rank.label" [size]="22" />
                }
                <!-- El trofeo del podio, el mismo que luce la clasificación completa, cierra la
                     fila por la derecha. Solo lo tienen los tres primeros sin sanción. -->
                @if (row.trophyImg; as trophy) {
                  <img
                    class="hub-roster__trophy"
                    [src]="trophy"
                    [alt]="'Trofeo del puesto ' + row.rank"
                  />
                }
              </a>
            } @empty {
              <p class="hub-card__empty">La clasificación todavía no tiene partidas.</p>
            }
          }
        </div>

        <footer class="hub-roster__foot">
          <!-- Pie condicional: quien lidera recibe un mensaje; quien persigue, cuánto le falta;
               quien solo mira el grupo no recibe nada personal. -->
          @if (myStanding(); as me) {
            @if (me.rank === 1) {
              <p class="hub-roster__standing nf-mono is-leader">Lideras la clasificación. Defiende el trono.</p>
            } @else {
              <p class="hub-roster__standing nf-mono">
                Puesto {{ me.rank }}.º con {{ me.lpValue }} LP · a {{ gapToFirst() }} LP del primero
              </p>
            }
          }
          <button nfButton variant="secondary" size="sm" [routerLink]="['/app', 'grupos', groupId(), 'ranking']">
            Ver tabla completa
          </button>
        </footer>
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-roster-panel.component.scss'],
})
export class HubRosterPanelComponent {
  readonly members = input<readonly GroupMemberResponse[]>([]);
  readonly memberCount = input(0);
  readonly pageSize = input(100);
  readonly page = input(0);
  readonly membersLoading = input(false);
  readonly currentUserId = input<string | null>(null);
  readonly canManage = input(false);
  readonly isOwner = input(false);
  readonly myRole = input<string | null>(null);
  readonly acting = input<ReadonlySet<string>>(new Set<string>());
  readonly pendingRequests = input(0);
  readonly pendingInvites = input(0);

  readonly ranking = input<readonly RankEntry[]>([]);
  readonly rankingLoading = input(false);
  readonly rankingError = input(false);
  readonly myStanding = input<RankEntry | null>(null);
  readonly groupId = input.required<string>();

  readonly action = output<RosterAction>();
  readonly pageChange = output<number>();
  readonly requestsOpen = output<void>();
  readonly invitesOpen = output<void>();

  private readonly _tab = signal<RosterTab>('members');
  readonly tab = this._tab.asReadonly();
  readonly query = signal('');
  /** Menú de tres puntos abierto, por `userId`. Estado de interfaz, no de dominio. */
  readonly openMenu = signal<string | null>(null);

  protected readonly tabOptions = computed(() => [
    { value: 'members', label: 'Miembros · ' + this.memberCount() },
    { value: 'ranking', label: 'Ranking top 10' },
  ]);

  /** Tantos esqueletos como filas muestra la vista (10 filas): la columna no cambia de alto al cargar. */
  protected readonly skeletons = computed(() =>
    Array.from({ length: 10 }, (_, i) => i),
  );

  /**
   * Filtro sobre la página cargada. La paginación es del servidor, así que esto acota lo que ya
   * está en pantalla; el vacío lo dice con esas palabras en vez de fingir que no existe nadie.
   * BACKEND NOTE: con `GET /groups/{id}/members?q=` la búsqueda pasa a ser del servidor.
   */
  readonly visibleMembers = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.members();
    return this.members().filter(
      (m) =>
        m.discordUsername.toLowerCase().includes(term) || (m.riotId ?? '').toLowerCase().includes(term),
    );
  });

  protected readonly gapToFirst = computed(() => {
    const me = this.myStanding();
    const first = this.ranking()[0];
    if (!me || !first) return 0;
    return Math.max(0, first.lpValue - me.lpValue);
  });

  setTab(value: string): void {
    this._tab.set(value as RosterTab);
    this.openMenu.set(null);
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected isMe(m: GroupMemberResponse): boolean {
    return m.userId === this.currentUserId();
  }

  protected isNearBottom(index: number): boolean {
    const total = this.visibleMembers().length;
    return total > 1 && index >= total - 2;
  }

  /** Tinte del avatar de reserva, derivado del id: presentación, no dato de dominio. */
  protected tintOf(userId: string): number {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) % 360;
    return h;
  }

  /**
   * Qué puede hacer quien mira sobre esa fila. Es solo interfaz: el backend revalida cada
   * permiso, igual que hacía la fila de botones que esto sustituye.
   */
  menuFor(m: GroupMemberResponse): Array<{ kind: RosterAction['kind']; label: string }> {
    const items: Array<{ kind: RosterAction['kind']; label: string }> = [];
    if (this.isMe(m) || !this.canManage()) return items;
    if (this.isOwner() && m.role === 'MEMBER') items.push({ kind: 'promote', label: 'Hacer admin' });
    if (this.isOwner() && m.role === 'ADMIN') items.push({ kind: 'demote', label: 'Quitar admin' });
    if (this.isOwner() && m.role !== 'OWNER') items.push({ kind: 'transfer', label: 'Transferir propiedad' });
    const canKick = m.role !== 'OWNER' && (this.isOwner() || (this.myRole() === 'ADMIN' && m.role === 'MEMBER'));
    if (canKick) items.push({ kind: 'kick', label: 'Expulsar del grupo' });
    return items;
  }

  protected toggleMenu(userId: string, event: Event): void {
    event.stopPropagation();
    this.openMenu.update((open) => (open === userId ? null : userId));
  }

  run(kind: RosterAction['kind'], member: GroupMemberResponse): void {
    this.openMenu.set(null);
    this.action.emit({ kind, member });
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.openMenu()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.hub-roster__more')) return;
    this.openMenu.set(null);
  }
}
