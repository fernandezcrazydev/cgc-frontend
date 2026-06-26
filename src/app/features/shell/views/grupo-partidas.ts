import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfBadgeColor, NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { MatchStore, MatchRoom } from '../../../core/match-store';

/**
 * Active matches of a group: every open room still filling up plus every live
 * 5v5 in progress. Lets the captain (or any member) jump straight into a
 * specific room or match. Finished matches live in the group history instead.
 */
@Component({
  selector: 'app-grupo-partidas',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        <div class="cp-head">
          <div class="cp-head__titles">
            <h1 class="view__title">Partidas activas</h1>
          </div>
          <a class="view-back cp-back" [routerLink]="['/app', 'grupos', g.id]">
            <span class="view-back__arrow">←</span> VOLVER AL GRUPO
          </a>
        </div>

        <p class="view__intro">Salas abiertas esperando jugadores y partidas en curso de {{ g.name }}.</p>

        @if (rooms().length) {
          <div class="cards">
            @for (r of rooms(); track r.id) {
              <nf-window [title]="'sala_' + r.code + '.exe'" [accent]="r.status === 'live' ? 'cyan' : 'pink'" bodyPadding="16px">
                <div class="pm-head">
                  <div
                    class="pm-avatar"
                    [style.background]="'radial-gradient(circle at 32% 26%, ' + g.c1 + ', ' + g.c2 + ')'"
                  ></div>
                  <div>
                    <div class="pm-mode">{{ modeLabel(r) }}</div>
                    <div class="pm-players nf-mono">{{ r.seats.length }}/{{ r.capacity }} JUGADORES · ABRIÓ {{ r.openedBy }}</div>
                  </div>
                </div>
                <div class="pm-foot">
                  <nf-badge [color]="statusColor(r)" [dot]="true">{{ statusLabel(r) }}</nf-badge>
                  <button
                    nfButton
                    variant="ghost"
                    size="sm"
                    [routerLink]="['/app', 'grupos', g.id, 'partidas', r.id]"
                  >{{ ctaLabel(r) }}</button>
                </div>
              </nf-window>
            }
          </div>
        } @else {
          <nf-window title="partidas_activas.exe" accent="cyan" bodyPadding="0">
            <div class="cp-pad">
              <div class="empty-state">
                <div class="empty-state__icon">◎</div>
                <div class="empty-state__text">NO HAY PARTIDAS ACTIVAS</div>
                <p class="empty-state__hint">
                  No hay ninguna sala abierta ni partida en curso ahora mismo. Crea una partida
                  para empezar a jugar con tu grupo.
                </p>
                <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos', g.id, 'crear-partida']">
                  CREAR PARTIDA ►
                </button>
              </div>
            </div>
          </nf-window>
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
export class GrupoPartidas {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  private readonly matchStore = inject(MatchStore);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  readonly rooms = computed<MatchRoom[]>(() => {
    const g = this.group();
    return g ? this.matchStore.activeOf(g.id) : [];
  });

  modeLabel(r: MatchRoom): string {
    if (r.status === 'drafting') return 'CONFIGURANDO · 5v5';
    return r.mode === 'open' ? 'SALA ABIERTA · 5v5' : 'PARTIDA MANUAL · 5v5';
  }

  statusLabel(r: MatchRoom): string {
    return r.status === 'live' ? 'EN CURSO' : r.status === 'drafting' ? 'CONFIGURANDO' : 'PENDIENTE';
  }

  statusColor(r: MatchRoom): NfBadgeColor {
    return r.status === 'live' ? 'green' : r.status === 'drafting' ? 'purple' : 'yellow';
  }

  ctaLabel(r: MatchRoom): string {
    return r.status === 'live' ? 'VER PARTIDA ►' : r.status === 'drafting' ? 'VER EN DIRECTO ►' : 'VER SALA ►';
  }

  constructor() {
    // Keep the shell header/sidebar in sync with the active group on deep-link.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });
  }
}
