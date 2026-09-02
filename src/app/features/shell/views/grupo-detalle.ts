import { Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import {
  NfBadge,
  NfButton,
  NfModal,
  NfPagination,
  NfSegmented,
  NfSegmentOption,
  NfSkeleton,
  NfWindow,
} from '../../../ui';
import { Session } from '../../../core/auth';
import {
  GroupBridge,
  GroupDetailStore,
  GroupInvitationResponse,
  GroupInvitationsStore,
  GroupMemberResponse,
  InvitationsStore,
  JoinRequestsStore,
  bannerColors,
  initialsOf,
  groupRoleLabel,
} from '../../../core/groups';
import { UserSearchResult, UsersApi } from '../../../core/users';
import { LeaderboardEntryResponse, LeaguesStore } from '../../../core/leagues';
import { LobbiesStore, LobbyResponse } from '../../../core/lobbies';
import { ToastService } from '../../../core/toast';
import { errorMessage } from '../../../core/http';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  styleUrl: './grupo-detalle.scss',
  // Mismo idioma que el shell para las capas flotantes: Escape y clic fuera cierran el menú de
  // gestión. Se guarda por `.gd-more` para que el propio clic que lo abre no lo cierre.
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'showActions.set(false)',
  },
  imports: [
    RouterLink,
    FormsModule,
    NfBadge,
    NfButton,
    NfModal,
    NfPagination,
    NfSegmented,
    NfSkeleton,
    NfWindow,
  ],
  template: `
    @switch (store.status()) {
      @case ('loading') {
        <div class="view" aria-busy="true">
          <div class="group-hero">
            <nf-skeleton width="72px" height="72px" radius="18px" />
            <div class="group-hero__meta">
              <nf-skeleton width="120px" height="12px" />
              <nf-skeleton width="220px" height="26px" />
              <nf-skeleton width="160px" height="14px" />
            </div>
          </div>
          <nf-window title="Miembros" bodyPadding="0">
            <div class="gd-members">
              @for (s of [0, 1, 2, 3]; track s) {
                <div class="gd-member">
                  <nf-skeleton width="38px" height="38px" radius="11px" />
                  <div class="gd-member__meta">
                    <nf-skeleton width="140px" height="13px" />
                    <nf-skeleton width="70px" height="11px" />
                  </div>
                </div>
              }
            </div>
          </nf-window>
        </div>
      }
      @case ('error') {
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">⚠</div>
            <div class="empty-state__text nf-mono">Error al cargar</div>
            <p class="empty-state__hint">No se pudo cargar el grupo.</p>
            <button nfButton variant="secondary" size="md" (click)="reload()">Reintentar</button>
          </div>
        </div>
      }
      @case ('not-found') {
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <div class="empty-state__text nf-mono">Grupo no encontrado</div>
            <p class="empty-state__hint">Este grupo no existe o ya no eres miembro.</p>
            <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos']">← Todos los grupos</button>
          </div>
        </div>
      }
      @default {
        @if (store.group(); as g) {
          <div class="view">
            <div class="group-hero" [style.--grp-c1]="g.c1" [style.--grp-c2]="g.c2">
              <span class="group-hero__avatar">
                @if (g.avatarUrl) {
                  <img class="group-hero__avatar-img" [src]="g.avatarUrl" alt="" />
                } @else {
                  {{ g.initials }}
                }
              </span>
              <div class="group-hero__meta">
                <div class="group-hero__tag nf-mono">{{ g.region ?? '—' }}</div>
                <h1 class="group-hero__name">{{ g.name }}</h1>
                <div class="group-hero__badges">
                  <nf-badge [color]="g.role === 'OWNER' ? 'primary' : 'secondary'">{{ roleLabel(g.role) }}</nf-badge>
                  <span class="group-hero__count nf-mono">◉ {{ store.memberCount() }} miembros</span>
                </div>
              </div>

              <!-- Gestión del grupo, fuera de la vista principal: invitar y sobre todo borrar o
                   salir no deben compartir fila con lo que se usa a diario. La navegación del
                   grupo NO se repite aquí; vive en la barra lateral desde la Fase 1. -->
              <div class="gd-more">
                <button
                  type="button"
                  class="gd-more__trigger"
                  [class.is-open]="showActions()"
                  aria-haspopup="menu"
                  [attr.aria-expanded]="showActions()"
                  aria-label="Gestionar el grupo"
                  title="Gestionar el grupo"
                  (click)="toggleActions($event)"
                >⋯</button>

                @if (showActions()) {
                  <div class="gd-more__menu" role="menu" aria-label="Gestionar el grupo">
                    @if (store.canManage()) {
                      <button type="button" class="gd-more__item" role="menuitem" (click)="openInvite()">
                        Invitar a alguien
                      </button>
                      <a class="gd-more__item" role="menuitem" [routerLink]="['/app', 'grupos', g.id, 'discord']">
                        Vincular Discord
                      </a>
                    }
                    @if (store.isOwner()) {
                      <button
                        type="button"
                        class="gd-more__item gd-more__item--danger"
                        role="menuitem"
                        [disabled]="store.busy()"
                        (click)="confirmDelete.set(true); showActions.set(false)"
                      >Borrar grupo</button>
                    } @else {
                      <button
                        type="button"
                        class="gd-more__item gd-more__item--danger"
                        role="menuitem"
                        [disabled]="store.busy()"
                        (click)="confirmLeave.set(true); showActions.set(false)"
                      >Salir del grupo</button>
                    }
                  </div>
                }
              </div>
            </div>

            <div class="gd-panel">
              <!-- Acción central de la aplicación (prompt.md §3.A.2): ocupa la mitad del panel y
                   no comparte fila con nada que compita por el clic. -->
              <a class="gd-cta" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">
                <span class="gd-cta__glyph" aria-hidden="true">＋</span>
                <span class="gd-cta__text">
                  <span class="gd-cta__title">Crear partida</span>
                  <span class="gd-cta__sub">Convoca a tu grupo y reparte los diez</span>
                </span>
              </a>

              <!-- Tu estado competitivo. Los cuatro estados van separados: la clasificación se
                   pide al servidor y puede estar cargando, fallar, no existir todavía o no
                   incluirte aún. Ninguno de esos casos pinta un número inventado. -->
              <div class="gd-standing" [attr.aria-busy]="leagues.isLoading() ? 'true' : null">
                <span class="gd-standing__label nf-mono">Tu puesto</span>
                @if (leagues.isLoading()) {
                  <nf-skeleton width="88px" height="30px" />
                  <nf-skeleton width="130px" height="12px" />
                } @else if (leagues.status() === 'error') {
                  <span class="gd-standing__none">No se pudo cargar la clasificación</span>
                  <a class="gd-standing__link nf-mono" [routerLink]="['/app', 'grupos', g.id, 'ranking']">
                    Ir al ranking
                  </a>
                } @else if (myStanding(); as me) {
                  <span class="gd-standing__rank nf-mono">{{ me.rank }}.º</span>
                  <span class="gd-standing__lp nf-mono">{{ me.lp }} LP</span>
                  <span class="gd-standing__sub nf-mono">
                    {{ me.wins }}V {{ me.losses }}D · racha {{ me.streakType === 'WIN' ? 'W' : 'L' }}{{ me.streakCount }}
                  </span>
                } @else {
                  <span class="gd-standing__none">Todavía no has puntuado en esta temporada</span>
                  <a class="gd-standing__link nf-mono" [routerLink]="['/app', 'grupos', g.id, 'ranking']">
                    Ver la clasificación
                  </a>
                }
              </div>
            </div>

            <!-- Solo aparece si hay algo que hacer: una sección vacía titulada "requiere tu
                 atención" es ruido que enseña a ignorarla. -->
            @if (openLobbies().length > 0) {
              <div class="view__label nf-mono">Requiere tu atención</div>
              <div class="gd-attention">
                @for (lobby of openLobbies(); track lobby.id) {
                  <button
                    type="button"
                    class="gd-attention__row"
                    (click)="openLobby(g.id, lobby.id)"
                  >
                    <span class="gd-attention__pulse" aria-hidden="true"></span>
                    <span class="gd-attention__text">
                      <span class="gd-attention__title nf-mono">
                        Sala abierta · {{ signedUp(lobby) }}/{{ lobby.capacity }} apuntados
                      </span>
                      <span class="gd-attention__sub nf-mono">
                        Sala {{ lobby.code }} — di a qué horas puedes
                      </span>
                    </span>
                    <span class="gd-attention__cta nf-mono">Entrar</span>
                  </button>
                }
              </div>
            }

            <!-- Una sola ventana para las dos secciones: las pestañas viven DENTRO, pegadas bajo
                 la barra de título, y el paginador es su barra de estado. Antes el segmented
                 flotaba fuera y el título de la ventana repetía el mismo estado: dos indicadores
                 sueltos de lo mismo. -->
            <nf-window
              [title]="tab() === 'requests' ? 'Solicitudes de ingreso' : tab() === 'invites' ? 'Invitados' : 'Miembros'"
              bodyPadding="0"
            >
              @if (store.canManage()) {
                <nf-segmented
                  variant="tabs"
                  [options]="tabOptions()"
                  [value]="tab()"
                  (valueChange)="setTab($event)"
                  ariaLabel="Miembros, invitados o solicitudes"
                />
              }

              @if (tab() === 'members') {
                <div class="gd-members" [attr.aria-busy]="store.membersLoading() ? 'true' : null">
                  @if (store.membersLoading()) {
                    <!-- Tantos esqueletos como filas tenía la página que se sustituye: la ventana
                         no colapsa ni pega un salto al llegar la nueva. -->
                    @for (s of memberSkeletons(); track s) {
                      <div class="gd-member">
                        <nf-skeleton width="38px" height="38px" radius="11px" />
                        <div class="gd-member__meta">
                          <nf-skeleton width="140px" height="13px" />
                          <nf-skeleton width="70px" height="11px" />
                        </div>
                      </div>
                    }
                  } @else {
                    @for (m of members(); track m.userId) {
                      <div class="gd-member">
                        <span class="gd-member__avatar" [style.background]="avatarBg(m.userId)">
                          @if (m.avatarUrl) {
                            <img class="gd-member__avatar-img" [src]="m.avatarUrl" alt="" />
                          } @else {
                            {{ initials(m.discordUsername) }}
                          }
                        </span>
                        <div class="gd-member__meta">
                          <div class="gd-member__name nf-mono">
                            {{ m.discordUsername }}@if (isMe(m)) {<span class="gd-member__you nf-mono"> · Tú</span>}
                          </div>
                          <div class="gd-member__role nf-mono">{{ m.role }}</div>
                          <div class="gd-member__riot nf-mono" [title]="riotLabel(m)">
                            <span class="gd-member__riot-dot" [class]="'gd-member__riot-dot--' + riotDot(m)"></span>
                            @if (m.riotId) {
                              {{ m.riotId }}
                            } @else {
                              <span class="gd-member__riot-id--none">Sin vincular</span>
                            }
                          </div>
                        </div>
                        @if (m.role === 'OWNER') {
                          <nf-badge color="primary">Owner</nf-badge>
                        } @else if (m.role === 'ADMIN') {
                          <nf-badge color="secondary">Admin</nf-badge>
                        }
                        <div class="gd-member__actions">
                          @if (canPromote(m)) {
                            <button nfButton variant="ghost" size="sm" [disabled]="store.isActing(m.userId)" (click)="promote(m)">↑ Admin</button>
                          }
                          @if (canDemote(m)) {
                            <button nfButton variant="ghost" size="sm" [disabled]="store.isActing(m.userId)" (click)="demote(m)">↓ Miembro</button>
                          }
                          @if (canTransfer(m)) {
                            <button nfButton variant="ghost" size="sm" [disabled]="store.isActing(m.userId)" (click)="transferTo.set(m)">Corona ♛</button>
                          }
                          @if (canKick(m)) {
                            <button nfButton variant="danger" size="sm" [disabled]="store.isActing(m.userId)" (click)="kick.set(m)">Expulsar</button>
                          }
                        </div>
                      </div>
                    }
                  }
                </div>

                @if (store.memberCount() > store.membersPageSize()) {
                  <div class="gd-statusbar">
                    <nf-pagination
                      [total]="store.memberCount()"
                      [pageSize]="store.membersPageSize()"
                      [page]="store.membersPage() + 1"
                      (pageChange)="goToMembersPage($event)"
                    />
                  </div>
                }
              } @else if (tab() === 'invites') {
                @switch (groupInvitations.status()) {
                  @case ('loading') {
                    <div class="gd-members" aria-busy="true">
                      @for (s of [0, 1, 2]; track s) {
                        <div class="gd-member">
                          <nf-skeleton width="38px" height="38px" radius="11px" />
                          <div class="gd-member__meta">
                            <nf-skeleton width="140px" height="13px" />
                            <nf-skeleton width="80px" height="11px" />
                          </div>
                        </div>
                      }
                    </div>
                  }
                  @case ('error') {
                    <div class="gd-invites-empty">
                      <div class="gd-invites-empty__text nf-mono">Error al cargar invitaciones</div>
                      <button nfButton variant="secondary" size="sm" (click)="reloadInvites()">Reintentar</button>
                    </div>
                  }
                  @default {
                    @if (groupInvitations.invitations().length) {
                      <div class="gd-members">
                        @for (inv of groupInvitations.invitations(); track inv.id) {
                          <div class="gd-member">
                            <span class="gd-member__avatar" [style.background]="avatarBg(inv.inviteeUserId)">
                              @if (inv.avatarUrl) {
                                <img class="gd-member__avatar-img" [src]="inv.avatarUrl" alt="" />
                              } @else {
                                {{ initials(inv.discordUsername ?? '?') }}
                              }
                            </span>
                            <div class="gd-member__meta">
                              <div class="gd-member__name nf-mono">{{ inv.discordUsername ?? '—' }}</div>
                              <div class="gd-member__role nf-mono">Invitación pendiente</div>
                            </div>
                            <div class="gd-member__actions">
                              <button
                                nfButton
                                variant="danger"
                                size="sm"
                                [disabled]="groupInvitations.isCancelling(inv.id)"
                                (click)="cancelInvite(inv)"
                              >✕ Cancelar</button>
                            </div>
                          </div>
                        }
                      </div>
                    } @else {
                      <div class="gd-invites-empty">
                        <div class="gd-invites-empty__text nf-mono">Sin invitaciones pendientes</div>
                        <button nfButton variant="secondary" size="sm" (click)="openInvite()">✉ Invitar a alguien</button>
                      </div>
                    }
                  }
                }
              } @else if (tab() === 'requests') {
                <div class="gd-members">
                  @for (req of joinRequests.groupRequests(); track req.id) {
                    <div class="gd-member">
                      <span class="gd-member__avatar" [style.background]="avatarBg(req.userId)">
                        @if (req.userAvatarUrl) {
                          <img class="gd-member__avatar-img" [src]="req.userAvatarUrl" alt="" />
                        } @else {
                          {{ initials(req.username) }}
                        }
                      </span>
                      <div class="gd-member__meta">
                        <div class="gd-member__name nf-mono">{{ req.username }}</div>
                        <div class="gd-member__role nf-mono">Solicitud de ingreso pendiente</div>
                      </div>
                      <div class="gd-member__actions">
                        <button
                          nfButton
                          variant="primary"
                          size="sm"
                          [disabled]="joinRequests.pending()"
                          (click)="acceptRequest(req.id)"
                        >✓ Aceptar</button>
                        <button
                          nfButton
                          variant="danger"
                          size="sm"
                          [disabled]="joinRequests.pending()"
                          (click)="declineRequest(req.id)"
                        >✕ Rechazar</button>
                      </div>
                    </div>
                  } @empty {
                    <div class="gd-invites-empty">
                      <div class="gd-invites-empty__text nf-mono">Sin solicitudes de ingreso pendientes</div>
                      <p class="empty-state__hint">Los jugadores que encuentren este grupo por #TAG podrán solicitar unirse.</p>
                    </div>
                  }
                </div>
              }
            </nf-window>
          </div>
        }
      }
    }

    <!-- confirmaciones -->
    @if (confirmDelete()) {
      <div class="modal-overlay" (click)="confirmDelete.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="Borrar grupo" bodyPadding="24px">
            <p class="gd-confirm">¿Seguro que quieres <strong>borrar</strong> este grupo? Esta acción no se puede deshacer.</p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.busy()" (click)="confirmDelete.set(false)">Cancelar</button>
              <button nfButton variant="danger" size="md" [disabled]="store.busy()" (click)="doDelete()">Borrar</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
    @if (confirmLeave()) {
      <div class="modal-overlay" (click)="confirmLeave.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="Salir del grupo" bodyPadding="24px">
            <p class="gd-confirm">¿Seguro que quieres <strong>salir</strong> de este grupo?</p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.busy()" (click)="confirmLeave.set(false)">Cancelar</button>
              <button nfButton variant="danger" size="md" [disabled]="store.busy()" (click)="doLeave()">Salir</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
    @if (kick(); as m) {
      <div class="modal-overlay" (click)="kick.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="Expulsar" bodyPadding="24px">
            <p class="gd-confirm">¿Expulsar a <strong>{{ m.discordUsername }}</strong> del grupo?</p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.isActing(m.userId)" (click)="kick.set(null)">Cancelar</button>
              <button nfButton variant="danger" size="md" [disabled]="store.isActing(m.userId)" (click)="doKick(m)">Expulsar</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
    @if (transferTo(); as m) {
      <div class="modal-overlay" (click)="transferTo.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="Transferir propiedad" bodyPadding="24px">
            <p class="gd-confirm">
              ¿Transferir la <strong>propiedad</strong> a <strong>{{ m.discordUsername }}</strong>?
              Pasarás a ser admin.
            </p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.isActing(m.userId)" (click)="transferTo.set(null)">Cancelar</button>
              <button nfButton variant="primary" size="md" [disabled]="store.isActing(m.userId)" (click)="doTransfer(m)">Transferir ♛</button>
            </div>
          </nf-window>
        </div>
      </div>
    }

    <!-- invitar: mismo buscador que antes, ahora en un modal disparado desde la fila de acciones -->
    @if (showInvite()) {
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
              <span class="gd-member__avatar" [style.background]="avatarBg(u.userId)">
                @if (u.avatarUrl) {
                  <img class="gd-member__avatar-img" [src]="u.avatarUrl" alt="" />
                } @else {
                  {{ initials(u.discordUsername) }}
                }
              </span>
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
              >{{ isInvited(u.userId) ? 'Invitado ✓' : 'Invitar' }}</button>
            </div>
          }
        </div>
      </nf-modal>
    }
  `,
})
export class GrupoDetalle {
  /** Etiqueta en español del rol del backend (OWNER -> Capitán). */
  protected readonly roleLabel = groupRoleLabel;
  readonly store = inject(GroupDetailStore);
  /** Clasificación del grupo: de aquí sale «tu puesto». Es el MISMO store que usa el ranking. */
  readonly leagues = inject(LeaguesStore);
  /** Convocatorias abiertas: son lo que reclama acción hoy en este grupo. */
  private readonly lobbies = inject(LobbiesStore);
  readonly invitations = inject(InvitationsStore);
  readonly groupInvitations = inject(GroupInvitationsStore);
  readonly joinRequests = inject(JoinRequestsStore);
  private readonly usersApi = inject(UsersApi);
  private readonly session = inject(Session);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly bridge = inject(GroupBridge);
  private readonly destroyRef = inject(DestroyRef);

  /** Id del grupo desde la ruta. */
  private readonly routeId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  /**
   * La página visible del roster, TAL CUAL la manda el backend. No se reordena aquí: con
   * paginación en servidor, ordenar la página en cliente la descolocaría respecto al orden
   * global (owner, admins y miembros, y por antigüedad dentro de cada rango) y la misma persona
   * podría aparecer en dos páginas distintas.
   */
  readonly members = computed(() => this.store.roster());

  /** Filas de esqueleto mientras viaja otra página: tantas como tenía la página que se sustituye. */
  readonly memberSkeletons = computed(() =>
    Array.from({ length: Math.max(1, this.store.roster().length) }, (_, i) => i),
  );

  /** Se está mirando la pestaña de invitados (solo existe para quien gestiona el grupo). */
  readonly showingInvites = computed(() => this.store.canManage() && this.tab() === 'invites');

  // ── Panel de control del grupo ─────────────────────────────────────
  // El hub dejó de ser un lanzador: la navegación del grupo vive en la barra lateral desde la
  // Fase 1, y de los nueve botones que había aquí seis eran duplicados suyos.

  /** Menú de gestión (invitar, Discord, salir/borrar). Estado de UI, no de dominio. */
  readonly showActions = signal(false);

  toggleActions(event: Event): void {
    event.stopPropagation();
    this.showActions.update((open) => !open);
  }

  onDocumentClick(event: MouseEvent): void {
    if (!this.showActions()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.gd-more')) return;
    this.showActions.set(false);
  }

  /**
   * Tu fila en la clasificación, o `null` si todavía no puntúas.
   *
   * Se busca en el podio y en la página cargada, que es lo que el contrato actual entrega. En un
   * grupo grande puedes caer fuera de esa página: entonces devuelve `null` y la tarjeta ofrece ir
   * al ranking en vez de inventar un puesto. El caso lo cierra `GET .../leaderboard/me` (§2.2).
   */
  readonly myStanding = computed<LeaderboardEntryResponse | null>(() => {
    const me = this.session.user()?.userId;
    if (!me) return null;
    return (
      this.leagues.podium().find((e) => e.userId === me) ??
      this.leagues.rows().find((e) => e.userId === me) ??
      null
    );
  });

  /** Convocatorias que siguen esperando gente. Una ya confirmada no reclama nada. */
  readonly openLobbies = computed<LobbyResponse[]>(() =>
    this.lobbies.open().filter((lobby) => lobby.status === 'POLLING'),
  );

  /** Cuánta gente ha juntado la franja que mejor va. Mismo criterio que el banner del shell. */
  signedUp(lobby: LobbyResponse): number {
    return lobby.slots.reduce((best, slot) => Math.max(best, slot.signedUp), 0);
  }

  openLobby(groupId: string, lobbyId: string): void {
    void this.router.navigate(['/app', 'grupos', groupId, 'partidas', lobbyId]);
  }

  // ── Diálogos de confirmación / estado local de UI ──────────────────
  readonly confirmDelete = signal(false);
  readonly confirmLeave = signal(false);
  readonly kick = signal<GroupMemberResponse | null>(null);
  readonly transferTo = signal<GroupMemberResponse | null>(null);

  // ── Tabs miembros / invitados / solicitudes (estado de UI, no de dominio) ──
  readonly tab = signal<'members' | 'invites' | 'requests'>('members');
  setTab(value: string): void {
    this.tab.set(value as 'members' | 'invites' | 'requests');
  }
  readonly tabOptions = computed<NfSegmentOption[]>(() => {
    const invites = this.groupInvitations.invitations().length;
    const requests = this.joinRequests.pendingGroupRequestsCount();
    return [
      // El contador es el total del grupo, no el de la página visible.
      { value: 'members', label: `Miembros · ${this.store.memberCount()}` },
      { value: 'invites', label: invites ? `Invitados · ${invites}` : 'Invitados' },
      { value: 'requests', label: requests ? `Solicitudes · ${requests}` : 'Solicitudes' },
    ];
  });

  async acceptRequest(requestId: string): Promise<void> {
    const groupId = this.routeId();
    if (!groupId) return;
    await this.joinRequests.acceptJoinRequest(groupId, requestId);
    void this.store.reloadRoster();
  }

  async declineRequest(requestId: string): Promise<void> {
    const groupId = this.routeId();
    if (!groupId) return;
    await this.joinRequests.declineJoinRequest(groupId, requestId);
  }

  /** Salta de página en el roster. `<nf-pagination>` es 1-based; el backend, 0-based. */
  goToMembersPage(page: number): void {
    void this.store.goToMembersPage(page - 1);
  }

  // ── Invitar ────────────────────────────────────────────────────────
  /** Abre/cierra el modal de invitar (estado de UI). */
  readonly showInvite = signal(false);
  readonly query = signal('');
  readonly searching = signal(false);
  private readonly results = signal<UserSearchResult[]>([]);
  /** Ids ya invitados en esta sesión (para pintar "INVITADO ✓") además de los del store. */
  readonly invitedIds = signal<ReadonlySet<string>>(new Set());
  /** Qué grupo tiene ya cargadas sus invitaciones, para no recargar en cada tick del effect. */
  private invitesLoadedFor: string | null = null;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchSeq = 0;

  /**
   * Candidatos: resultados menos quienes ya están en el roster (por userId). Con el roster
   * paginado esto solo filtra a los miembros de la página cargada, así que es una comodidad,
   * no una garantía: invitar a alguien que ya es miembro lo rechaza el backend con un 409
   * `ALREADY_MEMBER`, que `errorMessage()` ya traduce.
   */
  readonly candidates = computed(() => {
    const inGroup = new Set(this.store.roster().map((m) => m.userId));
    return this.results().filter((u) => !inGroup.has(u.userId));
  });

  constructor() {
    // Carga (y recarga al cambiar de :id), cancelando lo obsoleto dentro del store.
    effect(() => {
      const id = this.routeId();
      if (id) void this.store.load(id);
    });

    // Datos del panel de control. Ambas son idempotentes y se recargan al cambiar de :id.
    // `ensureLoaded` de ligas puede fallar (hoy el backend da 500 en un grupo sin liga, ver
    // Roadmap §1.1.g): la tarjeta de puesto tiene su propia rama de error y el resto del hub
    // no se entera.
    effect(() => {
      const id = this.routeId();
      if (!id) return;
      // `untracked` no es adorno: `ensureLoaded` LEE los signals de estado del store (`status`,
      // `groupId`) para decidir si hace falta la petición. Sin aislarlo, esos signals entran como
      // dependencias del efecto, y entonces cada cambio de estado lo vuelve a disparar: cargar →
      // error → reintentar → error, en bucle. Lo único que debe reabrir estas cargas es cambiar
      // de :id.
      untracked(() => {
        void this.leagues.ensureLoaded(id);
        void this.lobbies.ensureLoaded(id);
        void this.joinRequests.loadGroupRequests(id);
      });
    });

    // Puente identidad + roster → store mock, para que los sub-views placeholder de matchmaking
    // (crear-partida/sala/partidas/ranking/stats/historial) resuelvan cabecera y jugadores.
    // Se adelanta aquí para que al pulsar "Crear partida" el wizard ya tenga el roster. Es
    // `reload` y no `ensure` a propósito: entrar en el detalle es el momento natural de
    // refrescarlo, porque el roster pudo cambiar sin que este cliente hiciera nada.
    effect(() => {
      const id = this.routeId();
      if (id) void this.bridge.reload(id);
    });

    // Invitaciones pendientes del grupo (pestaña "Invitados"): solo owner/admin las ve. Se cargan una
    // vez por grupo; al cambiar de :id el guard interno del store descarta lo obsoleto. No las pedimos
    // para miembros normales (el endpoint es admin-only → sería un 403).
    effect(() => {
      const g = this.store.group();
      const canManage = this.store.canManage();
      if (g && canManage && this.invitesLoadedFor !== g.id) {
        this.invitesLoadedFor = g.id;
        void this.groupInvitations.load(g.id);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
      this.groupInvitations.clear();
    });
  }

  reload(): void {
    const id = this.routeId();
    if (id) void this.store.load(id);
  }

  // ── Presentación ────────────────────────────────────────────────────
  initials(name: string): string {
    return initialsOf(name);
  }
  avatarBg(seed: string): string {
    const { c1, c2 } = bannerColors(seed);
    return `radial-gradient(circle at 32% 26%, ${c1}, ${c2})`;
  }
  isMe(m: GroupMemberResponse): boolean {
    return m.userId === this.session.user()?.userId;
  }

  /**
   * Color del semáforo de vinculación de Riot, un peldaño más que la escalera del backend
   * (`docs/verificacion-cuenta-riot.md` §1): "sin cuenta" es gris, distinto de DECLARED (rojo),
   * porque para el resto del grupo "no ha hecho nada" y "escribió un nombre sin probarlo" no son
   * lo mismo aunque ninguno de los dos pruebe titularidad.
   */
  riotDot(m: GroupMemberResponse): 'none' | 'declared' | 'paired' | 'verified' {
    switch (m.riotStrength) {
      case 'VERIFIED':
        return 'verified';
      case 'PAIRED':
        return 'paired';
      case 'DECLARED':
        return 'declared';
      default:
        return 'none';
    }
  }
  riotLabel(m: GroupMemberResponse): string {
    switch (m.riotStrength) {
      case 'VERIFIED':
        return 'Cuenta de Riot verificada';
      case 'PAIRED':
        return 'Vinculada desde el cliente, titularidad sin probar';
      case 'DECLARED':
        return 'Riot ID escrito a mano, sin ninguna prueba';
      default:
        return 'Sin cuenta de Riot vinculada';
    }
  }

  // ── Reglas de gestión (solo UX; el backend revalida) ────────────────
  /** El owner puede ascender un MEMBER a ADMIN. */
  canPromote(m: GroupMemberResponse): boolean {
    return this.store.isOwner() && m.role === 'MEMBER';
  }
  /** El owner puede degradar un ADMIN a MEMBER. */
  canDemote(m: GroupMemberResponse): boolean {
    return this.store.isOwner() && m.role === 'ADMIN';
  }
  /** El owner puede transferir a cualquier no-owner. */
  canTransfer(m: GroupMemberResponse): boolean {
    return this.store.isOwner() && m.role !== 'OWNER';
  }
  /** Expulsar exige superar en rango: el owner a admins/miembros; un admin solo a miembros. */
  canKick(m: GroupMemberResponse): boolean {
    if (this.isMe(m) || m.role === 'OWNER') return false;
    if (this.store.isOwner()) return true;
    return this.store.myRole() === 'ADMIN' && m.role === 'MEMBER';
  }

  // ── Acciones de miembro ─────────────────────────────────────────────
  async promote(m: GroupMemberResponse): Promise<void> {
    await this.run(() => this.store.changeRole(m.userId, 'ADMIN'), `${m.discordUsername} ahora es ADMIN`);
  }
  async demote(m: GroupMemberResponse): Promise<void> {
    await this.run(() => this.store.changeRole(m.userId, 'MEMBER'), `${m.discordUsername} ahora es MIEMBRO`);
  }
  async doKick(m: GroupMemberResponse): Promise<void> {
    this.kick.set(null);
    await this.run(() => this.store.removeMember(m.userId), `${m.discordUsername} fue expulsado`);
  }
  async doTransfer(m: GroupMemberResponse): Promise<void> {
    this.transferTo.set(null);
    await this.run(() => this.store.transferOwnership(m.userId), `${m.discordUsername} es el nuevo owner`);
  }

  async doDelete(): Promise<void> {
    try {
      await this.store.deleteGroup();
      this.confirmDelete.set(false);
      this.toasts.success('Grupo borrado');
      this.router.navigate(['/app', 'grupos']);
    } catch {
      this.toasts.error('No se pudo borrar el grupo.');
    }
  }
  async doLeave(): Promise<void> {
    try {
      await this.store.leave();
      this.confirmLeave.set(false);
      this.toasts.success('Has salido del grupo');
      this.router.navigate(['/app', 'grupos']);
    } catch {
      this.toasts.error('No se pudo salir del grupo.');
    }
  }

  /** Envuelve una acción de gestión: toast de éxito, o resync + mensaje ante conflicto. */
  private async run(action: () => Promise<void>, ok: string): Promise<void> {
    try {
      await action();
      this.toasts.success(ok);
      // El roster cambió: que el puente del wizard no se quede con la foto anterior.
      const id = this.routeId();
      if (id) void this.bridge.reload(id);
    } catch {
      await this.store.reloadRoster();
      this.toasts.error('No se pudo completar la acción. Se ha actualizado el grupo.');
    }
  }

  // ── Invitar ─────────────────────────────────────────────────────────
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

  /** Abre el modal de invitar. Al reabrirlo se parte de un buscador limpio. */
  openInvite(): void {
    this.resetSearch();
    this.showInvite.set(true);
  }
  closeInvite(): void {
    this.showInvite.set(false);
    this.resetSearch();
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
    return this.invitedIds().has(userId) || this.groupInvitations.pendingInviteeIds().has(userId);
  }

  async invite(u: UserSearchResult): Promise<void> {
    const g = this.store.group();
    if (!g || this.invitations.inviting() || this.isInvited(u.userId)) return;
    try {
      await this.invitations.invite(g.id, u.userId);
      this.invitedIds.update((set) => new Set(set).add(u.userId));
      this.toasts.success(`Invitación enviada a ${u.discordUsername}`);
      // Refetch de la lista derivada (pestaña "Invitados"); no la recalculamos en cliente.
      void this.groupInvitations.reload();
    } catch (e) {
      this.toasts.error(errorMessage(e));
    }
  }

  // ── Invitados (cancelar) ────────────────────────────────────────────
  reloadInvites(): void {
    void this.groupInvitations.reload();
  }

  async cancelInvite(inv: GroupInvitationResponse): Promise<void> {
    if (this.groupInvitations.isCancelling(inv.id)) return;
    try {
      await this.groupInvitations.cancel(inv.id);
      this.toasts.success(`Invitación de ${inv.discordUsername ?? 'el usuario'} cancelada`);
    } catch (e) {
      await this.groupInvitations.reload();
      this.toasts.error(errorMessage(e));
    }
  }
}
