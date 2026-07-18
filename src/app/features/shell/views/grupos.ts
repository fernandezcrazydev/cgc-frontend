import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NfAvatarPicker, NfButton, NfSelect, NfSkeleton, NfWindow } from '../../../ui';
import { NfBadge } from '../../../ui';
import { GroupsStore, REGIONS, Region } from '../../../core/groups';
import { ToastService } from '../../../core/toast';
import { errorMessage } from '../../../core/http';
import { initialsOf } from '../../../core/groups';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [RouterLink, FormsModule, NfAvatarPicker, NfBadge, NfButton, NfSelect, NfSkeleton, NfWindow],
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

      @switch (groups.status()) {
        @case ('loading') {
          <div class="group-grid" aria-busy="true">
            @for (s of [0, 1, 2]; track s) {
              <div class="group-card" aria-hidden="true">
                <div class="group-card__banner"><nf-skeleton width="52px" height="52px" radius="14px" /></div>
                <div class="group-card__body">
                  <nf-skeleton width="70%" height="16px" />
                  <nf-skeleton width="40%" height="11px" />
                </div>
              </div>
            }
          </div>
        }
        @case ('error') {
          <div class="empty-state">
            <div class="empty-state__icon">⚠</div>
            <div class="empty-state__text nf-mono">// ERROR AL CARGAR</div>
            <p class="empty-state__hint">No se pudieron cargar tus grupos.</p>
            <button nfButton variant="secondary" size="md" (click)="retry()">REINTENTAR</button>
          </div>
        }
        @default {
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
                  <span class="group-card__avatar">
                    @if (g.avatarUrl) {
                      <img class="group-card__avatar-img" [src]="g.avatarUrl" alt="" />
                    } @else {
                      {{ g.initials }}
                    }
                  </span>
                </div>
                <div class="group-card__body">
                  <div class="group-card__top">
                    <span class="group-card__name">{{ g.name }}</span>
                    <nf-badge [color]="g.role === 'OWNER' ? 'pink' : 'cyan'">{{ g.role }}</nf-badge>
                  </div>
                  <div class="group-card__tag nf-mono">{{ g.region ?? '—' }}</div>
                </div>
              </a>
            }
          </div>
        }
      }
    </div>

    @if (creating()) {
      <div class="modal-overlay" (click)="closeCreate()">
        <div class="modal" (click)="$event.stopPropagation()">
          <nf-window title="nuevo_grupo.exe" accent="cyan" bodyPadding="22px 22px 28px">
            <div class="settings-eyebrow nf-mono">// CREAR NUEVO GRUPO</div>

            <div class="field" style="margin-bottom: 18px">
              <label class="field__label nf-mono">FOTO DEL GRUPO</label>
              <nf-avatar-picker
                [value]="avatar()"
                [initials]="previewInitials()"
                (valueChange)="avatar.set($event)"
              />
            </div>

            <div class="form-grid">
              <div class="field">
                <label class="field__label nf-mono" for="group-name">NOMBRE DEL GRUPO</label>
                <input
                  id="group-name"
                  class="field__input"
                  type="text"
                  placeholder="LAN Challenger S14"
                  autocomplete="off"
                  [ngModel]="name()"
                  (ngModelChange)="name.set($event)"
                  (keydown.enter)="create()"
                />
              </div>

              <div class="field">
                <label class="field__label nf-mono">REGIÓN</label>
                <nf-select [options]="regionOptions" [value]="region()" (valueChange)="setRegion($event)" />
              </div>
            </div>

            <div class="form-foot">
              <button nfButton variant="primary" size="md" [disabled]="!canCreate() || groups.pending()" (click)="create()">
                {{ groups.pending() ? 'CREANDO…' : 'CREAR GRUPO ►' }}
              </button>
              <button nfButton variant="ghost" size="md" [disabled]="groups.pending()" (click)="closeCreate()">CANCELAR</button>
            </div>
          </nf-window>
        </div>
      </div>
    }
  `,
})
export class Grupos {
  readonly groups = inject(GroupsStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly regionOptions = [...REGIONS];

  readonly creating = signal(false);
  readonly name = signal('');
  readonly region = signal<Region>('EUW');
  readonly avatar = signal<string | null>(null);

  readonly canCreate = computed(() => this.name().trim().length > 0);

  /** Live initials for the picker fallback while typing the name. */
  readonly previewInitials = computed(() => initialsOf(this.name() || 'GR'));

  constructor() {
    // Al re-entrar en la ruta refrescamos por si otro cliente cambió los grupos (barato).
    void this.groups.reload();
  }

  retry(): void {
    void this.groups.reload();
  }

  setRegion(value: string): void {
    this.region.set(value as Region);
  }

  openCreate(): void {
    this.name.set('');
    this.region.set('EUW');
    this.avatar.set(null);
    this.creating.set(true);
  }

  closeCreate(): void {
    if (this.groups.pending()) return;
    this.creating.set(false);
  }

  /**
   * Alta real: `GroupsStore.create` hace el doble call (POST /groups y, si hay foto, PUT avatar),
   * es pesimista y no reentrante, y refetch la lista. Solo al confirmar navegamos al detalle real.
   */
  async create(): Promise<void> {
    if (!this.canCreate() || this.groups.pending()) return;
    try {
      const group = await this.groups.create({
        name: this.name(),
        region: this.region(),
        avatarDataUrl: this.avatar(),
      });
      this.creating.set(false);
      this.toasts.success(`Grupo "${group.name}" creado`);
      this.router.navigate(['/app', 'grupos', group.groupId]);
    } catch (e) {
      // El backend manda un `code` estable en el ProblemDetail; `errorMessage` lo traduce a
      // español (con fallback por status). Ver CLAUDE.md § "Formato de error".
      this.toasts.error(errorMessage(e));
    }
  }
}
