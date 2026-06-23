import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NfBadge, NfButton, NfSelect, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { REGION_OPTIONS } from '../../../core/lobby';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [RouterLink, FormsModule, NfBadge, NfButton, NfSelect, NfWindow],
  template: `
    <div class="view">
      <div class="view__head view__head--row">
        <div>
          <div class="view__eyebrow nf-mono">// TUS GRUPOS</div>
          <h1 class="view__title">Grupos</h1>
          <p class="view__lead">Equipos a los que perteneces o que gestionas. Selecciona uno para verlo.</p>
        </div>
        <button nfButton variant="primary" size="md" (click)="openCreate()">＋ NUEVO GRUPO</button>
      </div>

      <div class="group-grid">
        <button type="button" class="group-card group-card--new" (click)="openCreate()">
          <span class="group-card__plus">＋</span>
          <span class="group-card__newlabel nf-mono">CREAR GRUPO</span>
        </button>

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
        }
      </div>
    </div>

    @if (creating()) {
      <div class="modal-overlay" (click)="closeCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="nuevo_grupo.exe" accent="cyan" bodyPadding="22px">
            <div class="settings-eyebrow nf-mono">// CREAR NUEVO GRUPO</div>

            <div class="form-grid">
              <div class="field">
                <label class="field__label nf-mono" for="group-name">NOMBRE DEL GRUPO</label>
                <input
                  id="group-name"
                  class="field__input"
                  type="text"
                  placeholder="LAN Challenger S14"
                  autocomplete="off"
                  [(ngModel)]="name"
                  (keydown.enter)="create()"
                />
              </div>

              <div class="field">
                <label class="field__label nf-mono">REGIÓN</label>
                <nf-select [options]="regionOptions" [value]="region()" (valueChange)="region.set($event)" />
              </div>
            </div>

            <div class="form-foot">
              <button nfButton variant="primary" size="md" [disabled]="!canCreate()" (click)="create()">
                CREAR GRUPO ►
              </button>
              <button nfButton variant="ghost" size="md" (click)="closeCreate()">CANCELAR</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
  `,
  styleUrl: './views.scss',
})
export class Grupos {
  readonly groups = inject(GroupStore);
  private readonly router = inject(Router);

  readonly regionOptions = REGION_OPTIONS;

  readonly creating = signal(false);
  name = '';
  readonly region = signal('EUW');

  readonly canCreate = computed(() => this.name.trim().length > 0);

  openCreate(): void {
    this.name = '';
    this.region.set('EUW');
    this.creating.set(true);
  }

  closeCreate(): void {
    this.creating.set(false);
  }

  create(): void {
    if (!this.canCreate()) return;
    const group = this.groups.add({
      name: this.name,
      region: this.region(),
    });
    this.creating.set(false);
    this.router.navigate(['/app', 'grupos', group.id]);
  }
}
