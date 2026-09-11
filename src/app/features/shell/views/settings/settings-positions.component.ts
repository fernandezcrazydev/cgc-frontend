import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import {
  NfButton,
  NfLaneIcon,
  NfSkeleton,
  NfToggle,
  NfWindow,
} from '../../../../ui';
import {
  LANE_ROLES,
  LaneRole,
  PreferencesStore,
  RolePreferences,
} from '../../../../core/preferences';
import { ToastService } from '../../../../core/toast';

export interface RoleDef {
  role: LaneRole;
  short: string;
  name: string;
  glyph: string;
}

export const ROLE_DEFS: readonly RoleDef[] = [
  { role: 'TOP', short: 'TOP', name: 'Top', glyph: '◤' },
  { role: 'JUNGLA', short: 'JG', name: 'Jungla', glyph: '♣' },
  { role: 'MID', short: 'MID', name: 'Mid', glyph: '◈' },
  { role: 'ADC', short: 'ADC', name: 'ADC', glyph: '➤' },
  { role: 'SUPPORT', short: 'SUP', name: 'Support', glyph: '✚' },
];

@Component({
  selector: 'app-settings-positions',
  standalone: true,
  imports: [NfWindow, NfSkeleton, NfButton, NfToggle, NfLaneIcon],
  template: `
    <nf-window title="Posiciones" bodyPadding="22px">
      <div class="settings-eyebrow nf-mono">Qué juegas y qué no</div>

      @switch (prefs.status()) {
        @case ('loading') {
          <div aria-busy="true" class="positions-zones">
            <nf-skeleton width="100%" height="60px" radius="8px" />
            <nf-skeleton width="100%" height="60px" radius="8px" />
            <nf-skeleton width="100%" height="60px" radius="8px" />
          </div>
        }
        @case ('error') {
          <div class="setting-row setting-row--last">
            <div class="setting-sub">No se han podido cargar tus posiciones.</div>
            <button nfButton variant="ghost" size="sm" (click)="retry()">Reintentar</button>
          </div>
        }
        @default {
          <div class="positions-zones">
            <!-- 1. ZONA PRINCIPAL -->
            <div class="positions-zone">
              <div class="positions-zone__label nf-mono">PRINCIPAL</div>
              <div class="positions-zone__content">
                @if (primaryRoleDef(); as prim) {
                  <div class="position-pill position-pill--primary">
                    <nf-lane-icon [lane]="prim.role" [fallbackGlyph]="prim.glyph" class="position-pill__icon position-pill__icon--lg" />
                    <span class="position-pill__code nf-mono">{{ prim.short }}</span>
                    <span class="position-pill__name">{{ prim.name }}</span>
                  </div>
                } @else {
                  <div class="positions-slot-empty nf-mono">Elige tu posición principal</div>
                }
              </div>
            </div>

            <!-- 2. ZONA SECUNDARIAS -->
            <div class="positions-zone">
              <div class="positions-zone__label nf-mono">
                SECUNDARIAS · {{ secondaryRoleDefs().length }} de 4
              </div>
              <div class="positions-zone__grid">
                @for (sec of secondaryRoleDefs(); track sec.role) {
                  <div class="position-pill position-pill--secondary">
                    <button
                      type="button"
                      class="position-pill__main-btn"
                      [attr.aria-label]="'Quitar ' + sec.name + ' de posiciones secundarias'"
                      (click)="removeSecondaryRole(sec.role)"
                    >
                      <nf-lane-icon [lane]="sec.role" [fallbackGlyph]="sec.glyph" class="position-pill__icon" />
                      <span class="position-pill__code nf-mono">{{ sec.short }}</span>
                      <span class="position-pill__name">{{ sec.name }}</span>
                    </button>
                    <button
                      type="button"
                      class="position-pill__ascend-btn"
                      [attr.aria-label]="'Hacer ' + sec.name + ' posición principal'"
                      title="Hacer principal"
                      (click)="promoteToPrimary(sec.role)"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            </div>

            <!-- 3. ZONA NO LAS JUEGO -->
            <div class="positions-zone">
              <div class="positions-zone__label nf-mono">NO LAS JUEGO</div>
              <div class="positions-zone__grid">
                @for (off of inactiveRoleDefs(); track off.role) {
                  <button
                    type="button"
                    class="position-pill position-pill--inactive"
                    [attr.aria-label]="'Añadir ' + off.name + ' a posiciones secundarias'"
                    (click)="toggleInactiveRole(off.role)"
                  >
                    <nf-lane-icon [lane]="off.role" [fallbackGlyph]="off.glyph" class="position-pill__icon" />
                    <span class="position-pill__code nf-mono">{{ off.short }}</span>
                    <span class="position-pill__name">{{ off.name }}</span>
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- PIE Y ACCIONES -->
          <div class="positions-foot">
            <div class="positions-flex-row">
              <nf-toggle
                [checked]="isFlex()"
                (checkedChange)="toggleFlex($event)"
                ariaLabel="Soy FLEX (juego cualquier posición)"
              />
              <span class="positions-flex-label">Soy FLEX (juego cualquier posición)</span>
            </div>

            <div class="positions-status-row">
              @if (validationError(); as err) {
                <div class="positions-warn nf-mono">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span>{{ err }}</span>
                </div>
              } @else {
                <span class="positions-hint nf-mono">Elige tu posición principal y al menos una secundaria.</span>
              }

              <div class="positions-actions">
                <button
                  nfButton
                  variant="ghost"
                  size="md"
                  [disabled]="!dirty() || prefs.saving()"
                  (click)="discard()"
                >
                  Descartar
                </button>
                <button
                  nfButton
                  variant="primary"
                  size="md"
                  [disabled]="!canSave()"
                  (click)="save()"
                >
                  {{ prefs.saving() ? 'Guardando…' : 'Guardar posiciones' }}
                </button>
              </div>
            </div>
          </div>
        }
      }
    </nf-window>
  `,
  styleUrl: './settings-positions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPositionsComponent {
  protected readonly prefs = inject(PreferencesStore);
  private readonly toasts = inject(ToastService);

  readonly roleDraft = linkedSignal<RolePreferences>(() => {
    const p = this.prefs.prefs();
    return { roles: [...p.roles], primary: p.primary };
  });

  readonly primaryRoleDef = computed(() => {
    const prim = this.roleDraft().primary;
    return prim ? ROLE_DEFS.find((r) => r.role === prim) ?? null : null;
  });

  readonly secondaryRoleDefs = computed(() => {
    const { roles, primary } = this.roleDraft();
    return ROLE_DEFS.filter((r) => roles.includes(r.role) && r.role !== primary);
  });

  readonly inactiveRoleDefs = computed(() => {
    const { roles } = this.roleDraft();
    return ROLE_DEFS.filter((r) => !roles.includes(r.role));
  });

  readonly isFlex = computed(() => this.secondaryRoleDefs().length === 4);

  readonly dirty = computed(() => {
    const saved = this.prefs.prefs();
    const draft = this.roleDraft();
    if (draft.primary !== saved.primary) return true;
    if (draft.roles.length !== saved.roles.length) return true;
    return !draft.roles.every((r) => saved.roles.includes(r));
  });

  readonly valid = computed(
    () => this.roleDraft().primary !== null && this.secondaryRoleDefs().length >= 1,
  );

  readonly canSave = computed(
    () => this.valid() && this.dirty() && !this.prefs.saving(),
  );

  readonly validationError = computed(() => {
    if (!this.roleDraft().primary) return 'Elige tu posición principal';
    if (this.secondaryRoleDefs().length === 0) return 'Marca al menos una posición secundaria';
    return null;
  });

  constructor() {
    void this.prefs.ensureLoaded();
  }

  retry(): void {
    void this.prefs.reload();
  }

  toggleInactiveRole(role: LaneRole): void {
    this.roleDraft.update((d) => {
      if (d.primary === null) {
        return { roles: [role], primary: role };
      }
      const roles = LANE_ROLES.filter((r) => r === role || d.roles.includes(r));
      return { roles, primary: d.primary };
    });
  }

  removeSecondaryRole(role: LaneRole): void {
    this.roleDraft.update((d) => {
      const roles = d.roles.filter((r) => r !== role);
      return { roles, primary: d.primary };
    });
  }

  promoteToPrimary(role: LaneRole): void {
    this.roleDraft.update((d) => {
      const roles = LANE_ROLES.filter((r) => r === role || d.roles.includes(r));
      return { roles, primary: role };
    });
  }

  toggleFlex(flex: boolean): void {
    this.roleDraft.update((d) => {
      const prim = d.primary ?? 'TOP';
      if (flex) {
        return { roles: [...LANE_ROLES], primary: prim };
      }
      const second = LANE_ROLES.find((r) => r !== prim) ?? 'JUNGLA';
      return { roles: [prim, second], primary: prim };
    });
  }

  discard(): void {
    const saved = this.prefs.prefs();
    this.roleDraft.set({ roles: [...saved.roles], primary: saved.primary });
  }

  async save(): Promise<void> {
    if (!this.canSave()) return;
    const ok = await this.prefs.save(this.roleDraft());
    if (ok) {
      this.toasts.success('Posiciones guardadas.');
    } else {
      this.toasts.error('No se han podido guardar tus posiciones. Inténtalo de nuevo.');
    }
  }
}
