import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfBadge } from '../../../ui';
import { GroupStore } from '../../../core/group-store';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [RouterLink, NfBadge],
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono">// TUS GRUPOS</div>
        <h1 class="view__title">Grupos</h1>
        <p class="view__lead">Equipos a los que perteneces o que gestionas. Selecciona uno para verlo.</p>
      </div>

      <div class="group-grid">
        @for (g of groups.groups(); track g.id) {
          <a
            class="group-card"
            [class.is-active]="g.id === groups.selectedId()"
            [style.--grp-c1]="g.c1"
            [style.--grp-c2]="g.c2"
            [routerLink]="['/app', 'grupos', g.id]"
            (click)="groups.select(g.id)"
          >
            <div class="group-card__banner">
              <span class="group-card__avatar">{{ g.initials }}</span>
            </div>
            <div class="group-card__body">
              <div class="group-card__top">
                <span class="group-card__name">{{ g.name }}</span>
                <nf-badge [color]="g.role === 'OWNER' ? 'pink' : 'cyan'">{{ g.role }}</nf-badge>
              </div>
              <div class="group-card__tag nf-mono">{{ g.tag }}</div>
              <div class="group-card__foot nf-mono">◉ {{ g.members }} MIEMBROS</div>
            </div>
          </a>
        } @empty {
          <div class="view__intro nf-mono">// SIN GRUPOS AÚN</div>
        }
      </div>
    </div>
  `,
  styleUrl: './views.scss',
})
export class Grupos {
  readonly groups = inject(GroupStore);
}
