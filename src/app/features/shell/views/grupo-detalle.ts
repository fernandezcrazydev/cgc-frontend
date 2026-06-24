import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatarPicker, NfBadge, NfButton, NfSelect, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { Group, REGION_OPTIONS } from '../../../core/lobby';

const MEMBER_POOL = [
  'Pix3lQueen', 'Cr1msonByte', 'D4rkFl4me', 'V0idWalker', 'NeonRift',
  'GlitchKid', 'St0rmcaller', 'HexHunter', 'AshenWolf', 'LumeCore',
  'Zer0Cool', 'ByteSiren',
];

interface Member {
  name: string;
  initials: string;
  role: string;
  owner: boolean;
  hue: number;
}

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
          <button nfButton variant="primary" size="md" [routerLink]="['/app', 'inicio']">CREAR PARTIDA ►</button>
          @if (g.role === 'OWNER') {
            <button nfButton variant="secondary" size="md" (click)="openEdit()">✎ EDITAR GRUPO</button>
          }
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'ranking']">RANKING</button>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'estadisticas']">ESTADÍSTICAS</button>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'historial']">HISTORIAL</button>
          <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos']">← TODOS LOS GRUPOS</button>
        </div>

        <div class="view__label nf-mono">▸ MIEMBROS</div>
        <nf-window title="miembros.exe" accent="cyan" bodyPadding="0">
          <div class="members">
            @for (m of members(); track m.name) {
              <div class="member">
                <div
                  class="member__avatar"
                  [style.background]="'radial-gradient(circle at 32% 26%, hsl(' + m.hue + ',90%,64%), hsl(' + m.hue + ',78%,30%))'"
                >{{ m.initials }}</div>
                <div class="member__meta">
                  <div class="member__name nf-mono">{{ m.name }}</div>
                  <div class="member__role nf-mono">{{ m.role }}</div>
                </div>
                @if (m.owner) {
                  <nf-badge color="pink">OWNER</nf-badge>
                }
              </div>
            }
          </div>
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
  `,
  styleUrl: './views.scss',
})
export class GrupoDetalle {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  /** Deterministic mock roster sized to the group's member count. */
  readonly members = computed<Member[]>(() => {
    const g = this.group();
    if (!g) return [];
    const roles = ['CAPITÁN', 'TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT', 'SUPLENTE'];
    return Array.from({ length: g.members }, (_, i) => {
      const name = MEMBER_POOL[i % MEMBER_POOL.length];
      return {
        name,
        initials: name.slice(0, 2).toUpperCase(),
        role: i === 0 ? 'CAPITÁN · ' + g.role : roles[i % roles.length],
        owner: i === 0,
        hue: (i * 47) % 360,
      };
    });
  });

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
