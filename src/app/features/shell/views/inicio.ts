import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NfBadge, NfButton } from '../../../ui';
import { Session } from '../../../core/auth';
import { GroupsStore, GroupView, InvitationsStore } from '../../../core/groups';
import { MatchRoom, MatchStore, RoomStatus } from '../../../core/match-store';
import { NotificationsStore, NotificationView, notificationView } from '../../../core/notifications';
import { ToastService } from '../../../core/toast';

/** A resumable room paired with the group it belongs to (for display). */
interface ResumeItem {
  group: GroupView;
  room: MatchRoom;
}

/** Per-status presentation for the "Retomar" cards (badge + call to action). */
const STATUS_META: Record<RoomStatus, { label: string; color: 'green' | 'yellow' | 'cyan'; cta: string }> = {
  live: { label: 'EN CURSO', color: 'green', cta: 'VOLVER A LA SALA ►' },
  waiting: { label: 'ESPERANDO', color: 'yellow', cta: 'ENTRAR ►' },
  drafting: { label: 'EN PREPARACIÓN', color: 'cyan', cta: 'SEGUIR EN DIRECTO ►' },
};

/** Sort key so live rooms float above waiting, and waiting above drafts. */
const STATUS_ORDER: Record<RoomStatus, number> = { live: 0, waiting: 1, drafting: 2 };

/**
 * Home / control panel. Deliberately about the PRESENT (what's happening now and
 * the next action), not the past — career aggregates live in the Perfil view.
 *
 * Two live sections:
 * - "Retomar": every active room across the user's groups (real MatchStore state),
 *   so a match in progress / a sala filling up / a draft being built is one tap away.
 * - "Requiere tu atención": las invitaciones a grupo pendientes (backend real),
 *   compartidas con la campana del header vía `NotificationsStore` + `InvitationsStore`.
 */
@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [NfButton, NfBadge],
  template: `
    <div class="view">
      <div class="view__head">
        <h1 class="view__title">Hola, {{ session.displayName() }}</h1>
      </div>

      <div class="actions">
        <button nfButton variant="primary" size="md" (click)="crearPartida()">CREAR PARTIDA ►</button>
      </div>

      <!-- ▸ RETOMAR — active rooms across all your groups (real match state) -->
      @if (resume(); as items) {
        @if (items.length) {
          <div class="view__label nf-mono">▸ RETOMAR</div>

          <!-- the most relevant room (live > waiting > draft) gets the hero -->
          @if (items[0]; as top) {
            <button
              type="button"
              class="resume-hero"
              [attr.data-status]="top.room.status"
              [style.--grp-c1]="top.group.c1"
              [style.--grp-c2]="top.group.c2"
              (click)="open(top)"
            >
              <span class="resume-hero__avatar">{{ top.group.initials }}</span>
              <span class="resume-hero__body">
                <span class="resume-hero__top">
                  <nf-badge [color]="meta(top).color" [dot]="true">{{ meta(top).label }}</nf-badge>
                  <span class="resume-hero__seats nf-mono">{{ top.room.seats.length }}/{{ top.room.capacity }} JUGADORES</span>
                  @if (top.room.status === 'drafting' && top.room.draft) {
                    <span class="resume-hero__seats nf-mono">PASO {{ top.room.draft.step }}/5</span>
                  }
                </span>
                <span class="resume-hero__name">{{ top.group.name }} <span class="resume-hero__code nf-mono">· SALA {{ top.room.code }}</span></span>
                <span class="resume-hero__sub nf-mono">Abierta por {{ top.room.openedBy }}</span>
              </span>
              <span class="resume-hero__cta nf-mono">{{ meta(top).cta }}</span>
            </button>
          }

          <!-- the rest, compact -->
          @if (items.length > 1) {
            <div class="resume-list">
              @for (it of items.slice(1); track it.room.id) {
                <button
                  type="button"
                  class="resume-row"
                  [attr.data-status]="it.room.status"
                  [style.--grp-c1]="it.group.c1"
                  [style.--grp-c2]="it.group.c2"
                  (click)="open(it)"
                >
                  <span class="resume-row__avatar">{{ it.group.initials }}</span>
                  <span class="resume-row__meta">
                    <span class="resume-row__name">{{ it.group.name }} <span class="resume-row__code nf-mono">· {{ it.room.code }}</span></span>
                    <span class="resume-row__sub nf-mono">{{ it.room.seats.length }}/{{ it.room.capacity }} jugadores · abierta por {{ it.room.openedBy }}</span>
                  </span>
                  <nf-badge [color]="meta(it).color" [dot]="true">{{ meta(it).label }}</nf-badge>
                </button>
              }
            </div>
          }
        }
      }

      <!-- ▸ REQUIERE TU ATENCIÓN — actionable notifications (shared with the bell) -->
      @if (attention(); as items) {
        @if (items.length) {
          <div class="view__label-row attn-head">
            <div class="view__label nf-mono">▸ REQUIERE TU ATENCIÓN</div>
            <span class="attn-count nf-mono">{{ items.length }}</span>
          </div>

          <div class="attn-list">
            @for (n of items; track n.id) {
              <div class="attn-card" [style.--attn-accent]="n.accent">
                <span class="attn-card__glyph">{{ n.glyph }}</span>
                <div class="attn-card__text">
                  <div class="attn-card__title nf-mono">{{ n.title }}</div>
                  <div class="attn-card__msg">{{ n.message }}</div>
                </div>
                <div class="attn-card__actions">
                  <button
                    nfButton
                    variant="ghost"
                    size="sm"
                    [disabled]="responding(n)"
                    (click)="respond(n, false)"
                  >RECHAZAR</button>
                  <button
                    nfButton
                    variant="primary"
                    size="sm"
                    [disabled]="responding(n)"
                    (click)="respond(n, true)"
                  >UNIRME ►</button>
                </div>
              </div>
            }
          </div>
        }
      }
    </div>
  `,
})
export class Inicio {
  private readonly groups = inject(GroupsStore);
  private readonly matches = inject(MatchStore);
  private readonly notifs = inject(NotificationsStore);
  private readonly invitations = inject(InvitationsStore);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  /** El usuario logueado (identidad real), no el mock legacy `CURRENT_USER`. */
  readonly session = inject(Session);

  /** Active rooms across every group, ranked so the most pressing one leads. */
  readonly resume = computed<ResumeItem[]>(() => {
    const items: ResumeItem[] = [];
    for (const group of this.groups.groups()) {
      for (const room of this.matches.activeOf(group.id)) items.push({ group, room });
    }
    return items.sort(
      (a, b) =>
        STATUS_ORDER[a.room.status] - STATUS_ORDER[b.room.status] ||
        b.room.createdAt - a.room.createdAt,
    );
  });

  /**
   * Invitaciones que aún piden un sí/no (compartidas con la campana del header). Solo las
   * que siguen pendientes: una ya respondida en otra sesión no debe aparecer aquí.
   */
  readonly attention = computed<NotificationView[]>(() =>
    this.notifs
      .actionable()
      .map((n) => notificationView(n))
      .filter((v) => v.invite !== null && this.canRespond(v.invite.invitationId)),
  );

  meta(it: ResumeItem) {
    return STATUS_META[it.room.status];
  }

  /** Jump into a room's lobby/sala. */
  open(it: ResumeItem): void {
    this.router.navigate(['/app', 'grupos', it.group.id, 'partidas', it.room.id]);
  }

  /**
   * Crear una partida es una acción de grupo: el flujo real vive en
   * `grupos/:id/crear-partida`. Desde el home usamos el grupo activo; si no hay
   * ninguno, mandamos a la lista de grupos a elegir uno. Nunca a `/app/crear`, que
   * no es una ruta registrada y el comodín `**` resolvía como el login.
   */
  crearPartida(): void {
    const g = this.groups.selected() ?? this.groups.groups()[0] ?? null;
    this.router.navigate(g ? ['/app', 'grupos', g.id, 'crear-partida'] : ['/app', 'grupos']);
  }

  /** ¿Sigue viva esta invitación? (misma regla que la campana; ver `Shell.canRespond`). */
  private canRespond(invitationId: string): boolean {
    if (this.invitations.status() !== 'ready') return true;
    return this.invitations.pendingIds().has(invitationId);
  }

  /** Una acción en vuelo sobre esta invitación: deshabilita sus botones. */
  responding(view: NotificationView): boolean {
    return view.invite !== null && this.invitations.isResponding(view.invite.invitationId);
  }

  /**
   * Acepta o rechaza una invitación desde el home. Pesimista: espera la confirmación,
   * marca la notificación leída y avisa. Comparte store con la campana, así que la tarjeta
   * desaparece de ambos sitios. Un 409 (respondida en otro sitio) resincroniza y avisa.
   */
  async respond(view: NotificationView, accept: boolean): Promise<void> {
    const invite = view.invite;
    if (!invite || this.invitations.isResponding(invite.invitationId)) return;
    try {
      if (accept) await this.invitations.accept(invite.invitationId);
      else await this.invitations.decline(invite.invitationId);
      await this.notifs.markRead(view.id);
      this.toasts.success(
        accept ? `Te uniste a ${invite.groupName}` : `Invitación a ${invite.groupName} rechazada`,
      );
    } catch {
      await Promise.all([this.notifs.reload(), this.invitations.reload()]);
      this.toasts.info('Esta invitación ya no está disponible');
    }
  }
}
