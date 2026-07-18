import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';
import { NfBadge, NfButton, NfSkeleton, NfWindow } from '../../../ui';
import { Session } from '../../../core/auth';
import {
  GroupDetailStore,
  GroupMemberResponse,
  GroupRole,
  InvitationsStore,
  bannerColors,
  initialsOf,
} from '../../../core/groups';
import { GroupStore } from '../../../core/group-store';
import { UserSearchResult, UsersApi } from '../../../core/users';
import { ToastService } from '../../../core/toast';

/** Peso de cada rol para ordenar el roster: owner primero, luego admins, luego miembros. */
const ROLE_RANK: Record<GroupRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [RouterLink, FormsModule, NfBadge, NfButton, NfSkeleton, NfWindow],
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
          <nf-window title="miembros.exe" accent="cyan" bodyPadding="0">
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
            <div class="empty-state__text nf-mono">// ERROR AL CARGAR</div>
            <p class="empty-state__hint">No se pudo cargar el grupo.</p>
            <button nfButton variant="secondary" size="md" (click)="reload()">REINTENTAR</button>
          </div>
        </div>
      }
      @case ('not-found') {
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">🔍</div>
            <div class="empty-state__text nf-mono">// GRUPO NO ENCONTRADO</div>
            <p class="empty-state__hint">Este grupo no existe o ya no eres miembro.</p>
            <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos']">← TODOS LOS GRUPOS</button>
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
                  <nf-badge [color]="g.role === 'OWNER' ? 'pink' : 'cyan'">{{ g.role }}</nf-badge>
                  <span class="group-hero__count nf-mono">◉ {{ store.roster().length }} MIEMBROS</span>
                </div>
              </div>
            </div>

            <div class="actions">
              <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">CREAR PARTIDA ►</button>
              <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'partidas']">PARTIDAS</button>
              <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'ranking']">RANKING</button>
              <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'estadisticas']">ESTADÍSTICAS</button>
              <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'historial']">HISTORIAL</button>
              @if (store.isOwner()) {
                <button nfButton variant="danger" size="md" [disabled]="store.busy()" (click)="confirmDelete.set(true)">BORRAR GRUPO</button>
              } @else {
                <button nfButton variant="ghost" size="md" [disabled]="store.busy()" (click)="confirmLeave.set(true)">SALIR DEL GRUPO</button>
              }
              <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos']">← TODOS</button>
            </div>

            @if (store.canManage()) {
              <div class="view__label nf-mono">▸ INVITAR</div>
              <nf-window title="invitar.exe" accent="pink" bodyPadding="16px">
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
                    <div class="gd-invite__hint nf-mono">// BUSCANDO…</div>
                  } @else if (query().trim().length >= 2 && !candidates().length) {
                    <div class="gd-invite__hint nf-mono">// SIN RESULTADOS</div>
                  }
                  @for (u of candidates(); track u.userId) {
                    <div class="gd-invite__row">
                      <span
                        class="gd-member__avatar"
                        [style.background]="avatarBg(u.userId)"
                      >
                        @if (u.avatarUrl) {
                          <img class="gd-member__avatar-img" [src]="u.avatarUrl" alt="" />
                        } @else {
                          {{ initials(u.discordUsername) }}
                        }
                      </span>
                      <span class="gd-invite__name nf-mono">{{ u.discordUsername }}</span>
                      <button
                        nfButton
                        variant="primary"
                        size="sm"
                        [disabled]="invitations.inviting() || invitedIds().has(u.userId)"
                        (click)="invite(u)"
                      >{{ invitedIds().has(u.userId) ? 'INVITADO ✓' : 'INVITAR ►' }}</button>
                    </div>
                  }
                </div>
              </nf-window>
            }

            <div class="view__label nf-mono">▸ MIEMBROS</div>
            <nf-window title="miembros.exe" accent="cyan" bodyPadding="0">
              <div class="gd-members">
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
                        {{ m.discordUsername }}@if (isMe(m)) {<span class="gd-member__you nf-mono"> · TÚ</span>}
                      </div>
                      <div class="gd-member__role nf-mono">{{ m.role }}</div>
                    </div>
                    @if (m.role === 'OWNER') {
                      <nf-badge color="pink">OWNER</nf-badge>
                    } @else if (m.role === 'ADMIN') {
                      <nf-badge color="cyan">ADMIN</nf-badge>
                    }
                    <div class="gd-member__actions">
                      @if (canPromote(m)) {
                        <button nfButton variant="ghost" size="sm" [disabled]="store.isActing(m.userId)" (click)="promote(m)">↑ ADMIN</button>
                      }
                      @if (canDemote(m)) {
                        <button nfButton variant="ghost" size="sm" [disabled]="store.isActing(m.userId)" (click)="demote(m)">↓ MIEMBRO</button>
                      }
                      @if (canTransfer(m)) {
                        <button nfButton variant="ghost" size="sm" [disabled]="store.isActing(m.userId)" (click)="transferTo.set(m)">CORONA ♛</button>
                      }
                      @if (canKick(m)) {
                        <button nfButton variant="danger" size="sm" [disabled]="store.isActing(m.userId)" (click)="kick.set(m)">EXPULSAR</button>
                      }
                    </div>
                  </div>
                }
              </div>
            </nf-window>
          </div>
        }
      }
    }

    <!-- confirmaciones -->
    @if (confirmDelete()) {
      <div class="modal-overlay" (click)="confirmDelete.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="borrar_grupo.exe" accent="pink" bodyPadding="24px">
            <p class="gd-confirm">¿Seguro que quieres <strong>borrar</strong> este grupo? Esta acción no se puede deshacer.</p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.busy()" (click)="confirmDelete.set(false)">CANCELAR</button>
              <button nfButton variant="danger" size="md" [disabled]="store.busy()" (click)="doDelete()">BORRAR</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
    @if (confirmLeave()) {
      <div class="modal-overlay" (click)="confirmLeave.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="salir_grupo.exe" accent="pink" bodyPadding="24px">
            <p class="gd-confirm">¿Seguro que quieres <strong>salir</strong> de este grupo?</p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.busy()" (click)="confirmLeave.set(false)">CANCELAR</button>
              <button nfButton variant="danger" size="md" [disabled]="store.busy()" (click)="doLeave()">SALIR</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
    @if (kick(); as m) {
      <div class="modal-overlay" (click)="kick.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="expulsar.exe" accent="pink" bodyPadding="24px">
            <p class="gd-confirm">¿Expulsar a <strong>{{ m.discordUsername }}</strong> del grupo?</p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.isActing(m.userId)" (click)="kick.set(null)">CANCELAR</button>
              <button nfButton variant="danger" size="md" [disabled]="store.isActing(m.userId)" (click)="doKick(m)">EXPULSAR</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
    @if (transferTo(); as m) {
      <div class="modal-overlay" (click)="transferTo.set(null)">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="transferir.exe" accent="pink" bodyPadding="24px">
            <p class="gd-confirm">
              ¿Transferir la <strong>propiedad</strong> a <strong>{{ m.discordUsername }}</strong>?
              Pasarás a ser ADMIN.
            </p>
            <div class="form-foot">
              <button nfButton variant="ghost" size="md" [disabled]="store.isActing(m.userId)" (click)="transferTo.set(null)">CANCELAR</button>
              <button nfButton variant="primary" size="md" [disabled]="store.isActing(m.userId)" (click)="doTransfer(m)">TRANSFERIR ♛</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
  `,
})
export class GrupoDetalle {
  readonly store = inject(GroupDetailStore);
  readonly invitations = inject(InvitationsStore);
  private readonly usersApi = inject(UsersApi);
  private readonly session = inject(Session);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly mockGroups = inject(GroupStore);
  private readonly destroyRef = inject(DestroyRef);

  /** Id del grupo desde la ruta. */
  private readonly routeId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  /** Roster ordenado: owner, luego admins, luego miembros; alfabético dentro de cada grupo. */
  readonly members = computed(() =>
    [...this.store.roster()].sort(
      (a, b) =>
        ROLE_RANK[a.role] - ROLE_RANK[b.role] ||
        a.discordUsername.localeCompare(b.discordUsername),
    ),
  );

  // ── Diálogos de confirmación / estado local de UI ──────────────────
  readonly confirmDelete = signal(false);
  readonly confirmLeave = signal(false);
  readonly kick = signal<GroupMemberResponse | null>(null);
  readonly transferTo = signal<GroupMemberResponse | null>(null);

  // ── Invitar ────────────────────────────────────────────────────────
  readonly query = signal('');
  readonly searching = signal(false);
  private readonly results = signal<UserSearchResult[]>([]);
  /** Ids ya invitados en esta sesión (para pintar "INVITADO ✓"). */
  readonly invitedIds = signal<ReadonlySet<string>>(new Set());
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchSeq = 0;

  /** Candidatos: resultados menos quienes ya están en el roster (por userId). */
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

    // Puente identidad → store mock, para que los sub-views placeholder de matchmaking
    // (crear-partida/sala/partidas/ranking/stats/historial) resuelvan su cabecera.
    effect(() => {
      const g = this.store.group();
      if (!g) return;
      this.mockGroups.ensureStub({
        id: g.id,
        name: g.name,
        tag: g.region ?? 'LAN',
        initials: g.initials,
        role: g.role === 'OWNER' ? 'OWNER' : 'MIEMBRO',
        members: this.store.roster().length,
        c1: g.c1,
        c2: g.c2,
        avatar: g.avatarUrl ?? undefined,
      });
    });

    this.destroyRef.onDestroy(() => {
      if (this.searchTimer !== null) clearTimeout(this.searchTimer);
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

  async invite(u: UserSearchResult): Promise<void> {
    const g = this.store.group();
    if (!g || this.invitations.inviting() || this.invitedIds().has(u.userId)) return;
    try {
      await this.invitations.invite(g.id, u.userId);
      this.invitedIds.update((set) => new Set(set).add(u.userId));
      this.toasts.success(`Invitación enviada a ${u.discordUsername}`);
    } catch {
      this.toasts.error('No se pudo invitar (¿ya es miembro o tiene una invitación pendiente?).');
    }
  }
}
