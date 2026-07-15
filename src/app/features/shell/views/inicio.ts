import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NfBadge, NfButton } from '../../../ui';
import { Session } from '../../../core/auth';
import { Group, Notification } from '../../../core/lobby';
import { GroupStore } from '../../../core/group-store';
import { MatchRoom, MatchStore, RoomStatus } from '../../../core/match-store';
import { NotificationStore } from '../../../core/notification-store';
import { ToastService } from '../../../core/toast';

/** A resumable room paired with the group it belongs to (for display). */
interface ResumeItem {
  group: Group;
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
 * - "Requiere tu atención": the actionable notifications (group + match invites,
 *   join requests) shared with the header bell via the NotificationStore.
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
                @if (n.groupInvite; as gi) {
                  <span
                    class="attn-card__avatar"
                    [style.--grp-c1]="gi.c1"
                    [style.--grp-c2]="gi.c2"
                  >{{ gi.initials }}</span>
                } @else {
                  <span class="attn-card__glyph">{{ glyph(n) }}</span>
                }
                <div class="attn-card__text">
                  <div class="attn-card__title nf-mono">{{ n.title }}</div>
                  <div class="attn-card__msg">{{ n.message }}</div>
                  @if (n.groupInvite; as gi) {
                    <div class="attn-card__meta nf-mono">◉ {{ gi.members }} MIEMBROS · {{ gi.region }}</div>
                  }
                </div>
                <div class="attn-card__actions">
                  <button nfButton variant="ghost" size="sm" (click)="respond(n, false)">RECHAZAR</button>
                  <button nfButton variant="primary" size="sm" (click)="respond(n, true)">{{ acceptLabel(n) }}</button>
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
  private readonly groups = inject(GroupStore);
  private readonly matches = inject(MatchStore);
  private readonly notifs = inject(NotificationStore);
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

  /** Notifications that still need a yes/no (shared with the header bell). */
  readonly attention = this.notifs.actionable;

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

  glyph(n: Notification): string {
    // Match invite vs. join request — a simple cue without the bell's full map.
    return n.kind === 'join' ? '◉' : '►';
  }

  acceptLabel(n: Notification): string {
    if (n.groupInvite) return 'UNIRME ►';
    return n.kind === 'join' ? 'APROBAR ►' : 'ACEPTAR ►';
  }

  /**
   * Resolve an actionable notification. Group invites run the real join flow;
   * the rest are acknowledged (mock until those endpoints exist). Either way the
   * notification leaves the list — and the bell — since they share the store.
   */
  respond(n: Notification, accept: boolean): void {
    if (n.groupInvite) {
      if (accept) {
        const group = this.notifs.acceptGroupInvite(n);
        if (group) {
          this.toasts.success(`Invitación aceptada · Te uniste a ${group.name}`);
          this.router.navigate(['/app', 'grupos', group.id]);
        }
      } else {
        this.notifs.dismiss(n.id);
        this.toasts.info(`Invitación a ${n.groupInvite.groupName} rechazada`);
      }
      return;
    }

    const kind = n.kind === 'join' ? 'Solicitud' : 'Invitación';
    this.notifs.dismiss(n.id);
    if (accept) this.toasts.success(`${kind} aceptada`);
    else this.toasts.info(`${kind} descartada`);
  }
}
