import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatarPicker, NfBadge, NfButton, NfSelect, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { MatchStore } from '../../../core/match-store';
import { ToastService } from '../../../core/toast';
import { Group, Member, REGION_OPTIONS } from '../../../core/lobby';
import { MemberDetail, memberDetail, opggUrl } from '../../../core/member-detail';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [RouterLink, FormsModule, NfAvatarPicker, NfBadge, NfButton, NfSelect, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        <div class="group-hero" [style.--grp-c1]="g.c1" [style.--grp-c2]="g.c2">
          <span class="group-hero__avatar">
            @if (g.avatar) {
              <img class="group-hero__avatar-img" [src]="g.avatar" alt="" />
            } @else {
              {{ g.initials }}
            }
          </span>
          <div class="group-hero__meta">
            <div class="group-hero__tag nf-mono">{{ g.tag }}</div>
            <h1 class="group-hero__name">{{ g.name }}</h1>
            <div class="group-hero__badges">
              <nf-badge [color]="g.role === 'OWNER' ? 'pink' : 'cyan'">{{ g.role }}</nf-badge>
              <span class="group-hero__count nf-mono">◉ {{ g.members }} MIEMBROS</span>
            </div>
          </div>
        </div>

        <div class="actions">
          <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">CREAR PARTIDA ►</button>
          <button
            nfButton
            variant="accent"
            size="md"
            class="actions__matches"
            [class.actions__matches--live]="activeMatches().length"
            [routerLink]="['/app', 'grupos', g.id, 'partidas']"
          >
            ◉ PARTIDAS ACTIVAS@if (activeMatches().length) {<span class="actions__count nf-mono">{{ activeMatches().length }}</span>}
          </button>
          @if (g.role === 'OWNER') {
            <button nfButton variant="accent" size="md" (click)="openEdit()">✎ EDITAR GRUPO</button>
          }
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'ranking']">RANKING</button>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'estadisticas']">ESTADÍSTICAS</button>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'historial']">HISTORIAL</button>
          <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos']">← TODOS LOS GRUPOS</button>
        </div>

        <div class="view__label-row">
          <div class="view__label nf-mono">▸ MIEMBROS</div>
          @if (g.role === 'OWNER') {
            <button nfButton variant="secondary" size="sm" (click)="openInvite()">＋ INVITAR</button>
          }
        </div>
        <nf-window title="miembros.exe" accent="cyan" bodyPadding="0">
          <div class="members">
            @for (m of members(); track m.tag; let last = $last) {
              <div class="member-row" [class.member-row--open]="expandedTag() === m.tag">
                <div
                  class="member"
                  role="button"
                  tabindex="0"
                  [attr.aria-expanded]="expandedTag() === m.tag"
                  (click)="toggleMember(m)"
                  (keydown.enter)="toggleMember(m)"
                  (keydown.space)="$event.preventDefault(); toggleMember(m)"
                >
                  <div
                    class="member__avatar"
                    [style.background]="'radial-gradient(circle at 32% 26%, hsl(' + m.hue + ',90%,64%), hsl(' + m.hue + ',78%,30%))'"
                  >{{ m.initials }}</div>
                  <div class="member__meta">
                    <div class="member__name nf-mono">{{ m.name }}</div>
                    <div class="member__role nf-mono">{{ m.role }}</div>
                  </div>
                  <span class="member__chevron" aria-hidden="true">▾</span>
                  @if (m.owner) {
                    <nf-badge color="pink">OWNER</nf-badge>
                  } @else {
                    @if (m.admin) {
                      <nf-badge color="cyan">ADMIN</nf-badge>
                    }
                    @if (g.role === 'OWNER') {
                      <div class="member__menu-wrap">
                        <button
                          type="button"
                          class="member__menu-btn"
                          [class.member__menu-btn--active]="menuTag() === m.tag"
                          [attr.aria-label]="'Opciones de ' + m.name"
                          [attr.aria-expanded]="menuTag() === m.tag"
                          (click)="$event.stopPropagation(); toggleMenu(m)"
                        >⋮</button>
                        @if (menuTag() === m.tag) {
                          <div
                            class="member__menu"
                            [class.member__menu--up]="last"
                            (click)="$event.stopPropagation()"
                          >
                            <button type="button" class="member__menu-item" (click)="askPromote(m)">
                              {{ m.admin ? '↓ Quitar administrador' : '↑ Ascender a administrador' }}
                            </button>
                            <button
                              type="button"
                              class="member__menu-item member__menu-item--danger"
                              (click)="askRemove(m)"
                            >✕ Eliminar miembro del grupo</button>
                          </div>
                        }
                      </div>
                    }
                  }
                </div>

                @if (expandedTag() === m.tag && expandedDetail(); as d) {
                  <div class="member-detail">
                    <div class="member-detail__head">
                      <div class="member-detail__tag nf-mono">{{ m.tag }}</div>
                      <button
                        nfButton
                        variant="secondary"
                        size="sm"
                        (click)="openOpgg(m.tag, $event)"
                      >Ver en OP.GG ↗</button>
                    </div>

                    <div class="member-detail__tags">
                      <div class="member-detail__group">
                        <span class="member-detail__label nf-mono">Campeones</span>
                        <div class="champ-icons">
                          @for (c of d.champions; track c.name) {
                            <span
                              class="champ-icon"
                              [style.background]="'linear-gradient(135deg, ' + c.c1 + ', ' + c.c2 + ')'"
                              [title]="c.name + ' · ' + c.role"
                            >{{ c.initials }}</span>
                          }
                        </div>
                      </div>
                      <div class="member-detail__group">
                        <span class="member-detail__label nf-mono">Roles</span>
                        @for (r of d.roles; track r) {
                          <nf-badge color="yellow">⚡ {{ r }}</nf-badge>
                        }
                      </div>
                    </div>

                    <div class="matchup-grid">
                      <div class="matchup matchup--duo">
                        <div class="matchup__label nf-mono">🤝 Mejor dúo</div>
                        <div class="matchup__name nf-mono">{{ d.bestDuo.tag }}</div>
                        <div class="matchup__stat nf-mono">
                          {{ d.bestDuo.wr }}% · {{ d.bestDuo.wins }} wins / {{ d.bestDuo.games }} games
                        </div>
                      </div>
                      <div class="matchup matchup--victim">
                        <div class="matchup__label nf-mono">💀 Víctima favorita</div>
                        <div class="matchup__name nf-mono">{{ d.favoriteVictim.tag }}</div>
                        <div class="matchup__stat nf-mono">
                          {{ d.favoriteVictim.wr }}% · {{ d.favoriteVictim.wins }} wins / {{ d.favoriteVictim.games }} games
                        </div>
                      </div>
                      <div class="matchup matchup--nightmare">
                        <div class="matchup__label nf-mono">👹 Su peor pesadilla</div>
                        <div class="matchup__name nf-mono">{{ d.worstNightmare.tag }}</div>
                        <div class="matchup__stat nf-mono">
                          {{ d.worstNightmare.wr }}% · {{ d.worstNightmare.wins }} wins / {{ d.worstNightmare.games }} games
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          @if (pending().length) {
            <div class="members__pending-head nf-mono">// INVITACIONES PENDIENTES</div>
            <div class="members">
              @for (tag of pending(); track tag) {
                <div class="member member--pending">
                  <div class="member__avatar member__avatar--pending">{{ tag.slice(0, 2).toUpperCase() }}</div>
                  <div class="member__meta">
                    <div class="member__name nf-mono">{{ tag }}</div>
                    <div class="member__role nf-mono">ESPERANDO RESPUESTA</div>
                  </div>
                  <nf-badge color="yellow">PENDIENTE</nf-badge>
                  @if (g.role === 'OWNER') {
                    <button
                      type="button"
                      class="member__remove"
                      [attr.aria-label]="'Cancelar invitación a ' + tag"
                      (click)="cancelInvite(tag)"
                    >×</button>
                  }
                </div>
              }
            </div>
          }
        </nf-window>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ERROR 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
          <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← VOLVER A GRUPOS</button>
      }
    </div>

    @if (editing(); as g) {
      <div class="modal-overlay" (click)="closeEdit()">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="editar_grupo.exe" accent="pink" bodyPadding="22px 22px 28px">
            <div class="settings-eyebrow nf-mono">// EDITAR GRUPO</div>

            <div class="field" style="margin-bottom: 18px">
              <label class="field__label nf-mono">FOTO DEL GRUPO</label>
              <nf-avatar-picker
                [value]="editAvatar()"
                [initials]="g.initials"
                [c1]="g.c1"
                [c2]="g.c2"
                (valueChange)="editAvatar.set($event)"
              />
            </div>

            <div class="form-grid">
              <div class="field">
                <label class="field__label nf-mono" for="edit-group-name">NOMBRE DEL GRUPO</label>
                <input
                  id="edit-group-name"
                  class="field__input"
                  type="text"
                  autocomplete="off"
                  [ngModel]="editName()"
                  (ngModelChange)="editName.set($event)"
                  (keydown.enter)="saveEdit()"
                />
              </div>

              <div class="field">
                <label class="field__label nf-mono">REGIÓN</label>
                <nf-select [options]="regionOptions" [value]="editRegion()" (valueChange)="editRegion.set($event)" />
              </div>
            </div>

            <div class="form-foot">
              <button nfButton variant="primary" size="md" [disabled]="!canSaveEdit()" (click)="saveEdit()">
                GUARDAR CAMBIOS ►
              </button>
              <button nfButton variant="ghost" size="md" (click)="closeEdit()">CANCELAR</button>
            </div>
          </nf-window>
        </div>
      </div>
    }

    @if (inviting()) {
      <div class="modal-overlay" (click)="closeInvite()">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="invitar_miembro.exe" accent="cyan" bodyPadding="22px 22px 28px">
            <div class="settings-eyebrow nf-mono">// INVITAR AL GRUPO</div>

            @if (inviteSent()) {
              <div class="invite-result">
                <div class="invite-result__glyph">✓</div>
                <p class="invite-result__msg">
                  Invitación enviada a <strong>{{ inviteTag() }}</strong>.<br />
                  Aparecerá como miembro en cuanto acepte.
                </p>
              </div>
              <div class="form-foot">
                <button nfButton variant="primary" size="md" (click)="closeInvite()">LISTO</button>
                <button nfButton variant="ghost" size="md" (click)="inviteAnother()">INVITAR A OTRO</button>
              </div>
            } @else {
              <div class="field">
                <label class="field__label nf-mono" for="invite-tag">TAG DEL JUGADOR</label>
                <input
                  id="invite-tag"
                  class="field__input"
                  type="text"
                  placeholder="CrazyDragon#EUW"
                  autocomplete="off"
                  [ngModel]="inviteTag()"
                  (ngModelChange)="onInviteInput($event)"
                  (keydown.enter)="sendInvite()"
                />
                @if (inviteError(); as err) {
                  <div class="field__error nf-mono">⚠ {{ err }}</div>
                }
              </div>
              <p class="form-note nf-mono">
                Se enviará una invitación a la campanita del jugador. No formará parte del grupo hasta que la acepte.
              </p>
              <div class="form-foot">
                <button nfButton variant="primary" size="md" [disabled]="!inviteTag().trim()" (click)="sendInvite()">
                  ENVIAR INVITACIÓN ►
                </button>
                <button nfButton variant="ghost" size="md" (click)="closeInvite()">CANCELAR</button>
              </div>
            }
          </nf-window>
        </div>
      </div>
    }

    @if (removing(); as m) {
      <div class="modal-overlay" (click)="cancelRemove()">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="eliminar_miembro.exe" accent="pink" bodyPadding="24px">
            <div class="settings-eyebrow nf-mono">// ELIMINAR MIEMBRO</div>
            <p class="remove-msg">
              ¿Seguro que quieres eliminar a <strong>{{ m.name }}</strong> del grupo?
            </p>
            <div class="remove-warn nf-mono">
              ⚠ Esto borrará <strong>toda su información</strong> en este grupo: estadísticas,
              historial de partidas y posición en el ranking. Esta acción no se puede deshacer.
            </div>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" (click)="cancelRemove()">CANCELAR</button>
              <button nfButton variant="danger" size="md" (click)="confirmRemove()">ELIMINAR MIEMBRO</button>
            </div>
          </nf-window>
        </div>
      </div>
    }

    @if (promoting(); as m) {
      <div class="modal-overlay" (click)="cancelPromote()">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window [title]="m.admin ? 'quitar_admin.exe' : 'ascender_admin.exe'" accent="cyan" bodyPadding="24px">
            <div class="settings-eyebrow nf-mono">
              // {{ m.admin ? 'QUITAR ADMINISTRADOR' : 'ASCENDER A ADMINISTRADOR' }}
            </div>
            <p class="remove-msg">
              @if (m.admin) {
                ¿Seguro que quieres quitarle el rol de administrador a <strong>{{ m.name }}</strong>?
              } @else {
                ¿Seguro que quieres ascender a <strong>{{ m.name }}</strong> a administrador del grupo?
              }
            </p>
            <div class="remove-warn nf-mono">
              @if (m.admin) {
                ⚠ Dejará de poder gestionar a los miembros e invitaciones del grupo.
              } @else {
                ⚠ Podrá gestionar a los miembros e invitaciones del grupo, igual que tú.
              }
            </div>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" (click)="cancelPromote()">CANCELAR</button>
              <button nfButton variant="primary" size="md" (click)="confirmPromote()">
                {{ m.admin ? 'QUITAR ADMINISTRADOR' : 'ASCENDER ►' }}
              </button>
            </div>
          </nf-window>
        </div>
      </div>
    }

    @if (menuTag()) {
      <div class="menu-backdrop" (click)="closeMenu()"></div>
    }
  `,
})
export class GrupoDetalle {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  private readonly matches = inject(MatchStore);
  private readonly toasts = inject(ToastService);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  /** Live roster from the store for the active group. */
  readonly members = computed<Member[]>(() => {
    const g = this.group();
    return g ? this.groups.rosterOf(g.id) : [];
  });

  /** Pending outgoing invite tags for the active group. */
  readonly pending = computed<string[]>(() => {
    const g = this.group();
    return g ? this.groups.pendingOf(g.id) : [];
  });

  /** Active match rooms (waiting + live) for the active group. */
  readonly activeMatches = computed(() => {
    const g = this.group();
    return g ? this.matches.activeOf(g.id) : [];
  });

  // --- Member detail dropdown ----------------------------------------------
  /** Tag of the member whose detail panel is expanded, or null when collapsed. */
  readonly expandedTag = signal<string | null>(null);

  /** Lazily-derived details for the currently expanded member. */
  readonly expandedDetail = computed<MemberDetail | null>(() => {
    const tag = this.expandedTag();
    if (!tag) return null;
    const m = this.members().find((x) => x.tag === tag);
    return m ? memberDetail(m, this.members()) : null;
  });

  /** Toggle a member's detail panel (one open at a time). */
  toggleMember(m: Member): void {
    this.expandedTag.update((t) => (t === m.tag ? null : m.tag));
  }

  /** Open the member's OP.GG profile in a new tab (without toggling the panel). */
  openOpgg(tag: string, ev: Event): void {
    ev.stopPropagation();
    window.open(opggUrl(tag), '_blank', 'noopener');
  }

  // --- Edit modal -----------------------------------------------------------
  readonly regionOptions = REGION_OPTIONS;

  /** The group currently being edited, or null when the modal is closed. */
  readonly editing = signal<Group | null>(null);
  readonly editName = signal('');
  readonly editRegion = signal('');
  readonly editAvatar = signal<string | null>(null);

  readonly canSaveEdit = computed(() => this.editName().trim().length > 0);

  openEdit(): void {
    const g = this.group();
    if (!g) return;
    this.editName.set(g.name);
    // The tag is "<REGION> · <SUFFIX>"; recover the region from the first part.
    this.editRegion.set(g.tag.split('·')[0].trim() || 'EUW');
    this.editAvatar.set(g.avatar ?? null);
    this.editing.set(g);
  }

  closeEdit(): void {
    this.editing.set(null);
  }

  saveEdit(): void {
    const g = this.editing();
    if (!g || !this.canSaveEdit()) return;
    this.groups.update(g.id, {
      name: this.editName(),
      region: this.editRegion(),
      avatar: this.editAvatar(),
    });
    this.editing.set(null);
  }

  // --- Invite modal ---------------------------------------------------------
  readonly inviting = signal(false);
  readonly inviteTag = signal('');
  readonly inviteError = signal<string | null>(null);
  readonly inviteSent = signal(false);

  openInvite(): void {
    this.inviteTag.set('');
    this.inviteError.set(null);
    this.inviteSent.set(false);
    this.inviting.set(true);
  }

  closeInvite(): void {
    this.inviting.set(false);
  }

  /** Clear the error as soon as the user edits the tag again. */
  onInviteInput(value: string): void {
    this.inviteTag.set(value);
    if (this.inviteError()) this.inviteError.set(null);
  }

  sendInvite(): void {
    const g = this.group();
    if (!g) return;
    const result = this.groups.inviteMember(g.id, this.inviteTag());
    if (result.ok) {
      this.inviteSent.set(true);
      this.toasts.success(`Invitación enviada a ${this.inviteTag().trim()}`);
      return;
    }
    this.inviteError.set(this.inviteErrorMessage(result.reason));
  }

  cancelInvite(tag: string): void {
    const g = this.group();
    if (!g) return;
    this.groups.cancelInvite(g.id, tag);
    this.toasts.info(`Invitación a ${tag} cancelada`);
  }

  inviteAnother(): void {
    this.inviteTag.set('');
    this.inviteError.set(null);
    this.inviteSent.set(false);
  }

  private inviteErrorMessage(reason: 'invalid' | 'already-member' | 'already-pending'): string {
    switch (reason) {
      case 'already-member':
        return 'Ese jugador ya es miembro del grupo.';
      case 'already-pending':
        return 'Ese jugador ya tiene una invitación pendiente.';
      default:
        return 'Formato no válido. Usa Nombre#REGIÓN, p. ej. CrazyDragon#EUW.';
    }
  }

  // --- Member actions menu (kebab) ------------------------------------------
  /** Tag of the member whose actions menu is open, or null when closed. */
  readonly menuTag = signal<string | null>(null);

  toggleMenu(m: Member): void {
    this.menuTag.update((t) => (t === m.tag ? null : m.tag));
  }

  closeMenu(): void {
    this.menuTag.set(null);
  }

  // --- Remove member modal --------------------------------------------------
  readonly removing = signal<Member | null>(null);

  askRemove(m: Member): void {
    this.closeMenu();
    this.removing.set(m);
  }

  cancelRemove(): void {
    this.removing.set(null);
  }

  confirmRemove(): void {
    const g = this.group();
    const m = this.removing();
    if (g && m) {
      this.groups.removeMember(g.id, m.name);
      this.toasts.info(`${m.name} fue eliminado del grupo`);
    }
    this.removing.set(null);
  }

  // --- Promote / demote admin modal -----------------------------------------
  readonly promoting = signal<Member | null>(null);

  askPromote(m: Member): void {
    this.closeMenu();
    this.promoting.set(m);
  }

  cancelPromote(): void {
    this.promoting.set(null);
  }

  confirmPromote(): void {
    const g = this.group();
    const m = this.promoting();
    if (g && m) {
      const makeAdmin = !m.admin;
      this.groups.setAdmin(g.id, m.name, makeAdmin);
      this.toasts.success(
        makeAdmin
          ? `${m.name} ahora es administrador del grupo`
          : `${m.name} ya no es administrador del grupo`,
      );
    }
    this.promoting.set(null);
  }

  constructor() {
    // Keep the shell header/sidebar in sync on deep-link or when switching groups.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) {
        this.groups.select(id);
      }
    });
  }
}
