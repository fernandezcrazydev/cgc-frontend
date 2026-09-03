import { Component, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfSkeleton, NfWindow } from '../../../ui';
import { GroupDetailStore, groupRoleLabel } from '../../../core/groups';
import { groupProfileFor } from '../../../core/group-hub';

/**
 * Ficha pública del grupo (`/app/grupos/:id/perfil`), a la que lleva el botón «Perfil del grupo»
 * de la cabecera del hub (Roadmap §5.5.4).
 *
 * Es la cara institucional del grupo: banner, `#TAG`, descripción, reglas y estadísticas globales
 * de la comunidad. El hub es para jugar; esto es para saber quién es este grupo.
 */
@Component({
  selector: 'app-grupo-perfil',
  standalone: true,
  styleUrl: './grupo-perfil.scss',
  imports: [RouterLink, NfBadge, NfButton, NfSkeleton, NfWindow],
  template: `
    @switch (store.status()) {
      @case ('loading') {
        <div class="view" aria-busy="true">
          <nf-skeleton width="100%" height="150px" radius="12px" />
          <div class="gp-grid">
            <nf-skeleton width="100%" height="220px" radius="12px" />
            <nf-skeleton width="100%" height="220px" radius="12px" />
          </div>
        </div>
      }
      @case ('error') {
        <div class="view">
          <div class="empty-state">
            <div class="empty-state__icon">⚠</div>
            <div class="empty-state__text nf-mono">Error al cargar</div>
            <p class="empty-state__hint">No se pudo cargar la ficha del grupo.</p>
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
            <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
              <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
            </a>

            <header class="gp-banner" [style.--grp-c1]="g.c1" [style.--grp-c2]="g.c2">
              <span class="gp-banner__avatar">
                @if (g.avatarUrl) {
                  <img class="gp-banner__avatar-img" [src]="g.avatarUrl" alt="" />
                } @else {
                  {{ g.initials }}
                }
              </span>
              <div class="gp-banner__meta">
                <h1 class="gp-banner__name">{{ g.name }}</h1>
                <p class="gp-banner__tagline">{{ profile().tagline }}</p>
                <div class="gp-banner__badges">
                  @if (g.tag) {
                    <nf-badge color="secondary">#{{ g.tag }}</nf-badge>
                  }
                  <nf-badge [color]="g.role === 'OWNER' ? 'primary' : 'secondary'">{{ roleLabel(g.role) }}</nf-badge>
                  <span class="gp-banner__fact nf-mono">{{ g.region ?? 'Sin región' }}</span>
                  <span class="gp-banner__fact nf-mono">{{ store.memberCount() }} {{ store.memberCount() === 1 ? 'miembro' : 'miembros' }}</span>
                  <span class="gp-banner__fact nf-mono">Desde {{ profile().foundedAt }}</span>
                </div>
              </div>
            </header>

            <div class="gp-stats">
              @for (stat of profile().stats; track stat.label) {
                <div class="gp-stat">
                  <span class="gp-stat__value nf-mono">{{ stat.value }}</span>
                  <span class="gp-stat__label nf-mono">{{ stat.label }}</span>
                </div>
              }
            </div>

            <div class="gp-grid">
              <nf-window title="Sobre el grupo">
                <p class="gp-text">{{ profile().description }}</p>
              </nf-window>

              <nf-window title="Reglas de la casa">
                <ul class="gp-rules">
                  @for (rule of profile().rules; track rule) {
                    <li class="gp-rule">{{ rule }}</li>
                  }
                </ul>
              </nf-window>
            </div>

            <div class="gp-foot">
              <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'ranking']">
                Ver la clasificación
              </button>
              <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos', g.id, 'historial']">
                Ver el historial de partidas
              </button>
            </div>
          </div>
        }
      }
    }
  `,
})
export class GrupoPerfil {
  protected readonly roleLabel = groupRoleLabel;
  readonly store = inject(GroupDetailStore);

  private readonly routeId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id') ?? '')),
    { initialValue: '' },
  );

  /**
   * Ficha del grupo. Maqueta determinista mientras el DTO real no traiga descripción, reglas ni
   * fecha de fundación (ver `core/group-hub.ts`).
   */
  readonly profile = computed(() => groupProfileFor(this.routeId(), this.store.memberCount()));

  constructor() {
    // Idempotente: la cabecera del shell pide el mismo grupo al entrar en cualquiera de sus
    // secciones, así que aquí no se repite la petición.
    effect(() => {
      const id = this.routeId();
      if (id) void this.store.ensureLoaded(id);
    });
  }

  reload(): void {
    const id = this.routeId();
    if (id) void this.store.load(id);
  }
}
