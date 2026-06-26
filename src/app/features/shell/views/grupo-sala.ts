import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { MatchStore } from '../../../core/match-store';
import { Member } from '../../../core/lobby';

/**
 * Detail of a single match room. Waiting rooms show the live seat count with the
 * captain's tools to fill or trim it (mock "simulate join"); live matches show
 * the locked-in 5v5 lineup. Reached from the group's active-match list or the
 * pending-room banner in the shell header.
 */
@Component({
  selector: 'app-grupo-sala',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        @if (room(); as r) {
          <div class="cp-head">
            <div class="cp-head__titles">
              <h1 class="view__title">Sala {{ r.code }}</h1>
            </div>
            <a class="view-back cp-back" [routerLink]="['/app', 'grupos', g.id, 'partidas']">
              <span class="view-back__arrow">←</span> PARTIDAS ACTIVAS
            </a>
          </div>

          <nf-window [title]="'sala_' + r.code + '.exe'" [accent]="r.status === 'live' ? 'cyan' : 'pink'" bodyPadding="0">
            <div class="cp-room__bar">
              <div class="cp-room__barmeta">
                <div class="cp-room__sub nf-mono">
                  {{ r.status === 'live'
                    ? 'PARTIDA EN CURSO · ' + (r.mode === 'open' ? 'SALA ABIERTA' : 'MANUAL')
                    : 'CUALQUIER MIEMBRO DEL GRUPO PUEDE APUNTARSE' }}
                </div>
              </div>
              <nf-badge [color]="r.status === 'live' ? 'green' : full() ? 'green' : 'yellow'" [dot]="true">
                {{ r.seats.length }}/{{ r.capacity }}
              </nf-badge>
            </div>

            <div class="cp-seats" [class.is-complete]="full()">
              @for (slot of seatSlots(); track $index) {
                @if (slot; as m) {
                  <div class="cp-seat" [class.cp-seat--captain]="m.owner">
                    <span class="cp-seat__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                    <span class="cp-seat__meta">
                      <span class="cp-seat__name nf-mono">{{ m.name }}</span>
                      <span class="cp-seat__role nf-mono">{{ m.owner ? 'CAPITÁN · ABRIÓ LA SALA' : 'APUNTADO' }}</span>
                    </span>
                    @if (!m.owner && r.status === 'waiting') {
                      <button
                        type="button"
                        class="cp-seat__kick"
                        [attr.aria-label]="'Quitar a ' + m.name"
                        (click)="kick(m)"
                      >✕</button>
                    }
                  </div>
                } @else {
                  <div class="cp-seat cp-seat--open">
                    <span class="cp-seat__slot" aria-hidden="true"><span class="cp-spinner"></span></span>
                    <span class="cp-seat__meta">
                      <span class="cp-seat__name nf-mono">ASIENTO ABIERTO</span>
                      <span class="cp-seat__role nf-mono">
                        ESPERANDO JUGADOR<span class="cp-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                      </span>
                    </span>
                  </div>
                }
              }
            </div>

            <div class="cp-room__actions">
              @if (r.status === 'live') {
                <div class="cp-room__ready nf-mono">
                  <span class="cp-room__ready-glyph">▶</span>
                  PARTIDA EN CURSO · 10/10 JUGADORES
                </div>
              } @else if (!full()) {
                <button type="button" class="cp-sim nf-mono" [disabled]="!pool().length" (click)="simulateJoin()">
                  ▶ simular que alguien se apunta ({{ pool().length }} disponibles)
                </button>
                <p class="form-note nf-mono" style="margin:0">
                  MAQUETA · EN REAL, LOS MIEMBROS RECIBIRÍAN UNA NOTIFICACIÓN Y SE APUNTARÍAN DESDE SU CUENTA.
                </p>
              } @else {
                <div class="cp-room__ready nf-mono">
                  <span class="cp-room__ready-glyph">✓</span>
                  SALA COMPLETA · LISTA PARA CONFIGURAR Y LANZAR
                </div>
              }
            </div>
          </nf-window>

          <div class="actions" style="margin-top: 22px">
            <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos', g.id, 'partidas']">
              ← PARTIDAS ACTIVAS
            </button>
          </div>
        } @else {
          <div class="view__head">
            <div class="view__eyebrow nf-mono">// ERROR 404</div>
            <h1 class="view__title">Sala no encontrada</h1>
            <p class="view__lead">Esta sala ya no existe: se canceló o la partida terminó.</p>
          </div>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'partidas']">
            ← PARTIDAS ACTIVAS
          </button>
        }
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ERROR 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← VOLVER A GRUPOS</button>
      }
    </div>
  `,
})
export class GrupoSala {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  private readonly matches = inject(MatchStore);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  private readonly roomId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('roomId'))),
    { initialValue: this.route.snapshot.paramMap.get('roomId') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  /** The room, but only when it actually belongs to this group's URL. */
  readonly room = computed(() => {
    const g = this.group();
    const rid = this.roomId();
    if (!g || !rid) return null;
    const r = this.matches.byId(rid);
    return r && r.groupId === g.id ? r : null;
  });

  readonly full = computed(() => {
    const r = this.room();
    return !!r && r.seats.length >= r.capacity;
  });

  /** Exactly `capacity` slots: a member when filled, null when still open. */
  readonly seatSlots = computed<(Member | null)[]>(() => {
    const r = this.room();
    if (!r) return [];
    return Array.from({ length: r.capacity }, (_, i) => r.seats[i] ?? null);
  });

  /** Group members not yet seated (the pool a real join would draw from). */
  readonly pool = computed<Member[]>(() => {
    const g = this.group();
    const r = this.room();
    if (!g || !r) return [];
    return this.groups.rosterOf(g.id).filter((m) => !r.seats.some((s) => s.tag === m.tag));
  });

  avatarBg(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }

  simulateJoin(): void {
    const r = this.room();
    const next = this.pool()[0];
    if (r && next) this.matches.addSeat(r.id, next);
  }

  kick(m: Member): void {
    const r = this.room();
    if (r && !m.owner) this.matches.removeSeat(r.id, m.tag);
  }

  constructor() {
    // Keep the shell header/sidebar in sync with the active group on deep-link.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });
  }
}
