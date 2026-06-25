import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { Member } from '../../../core/lobby';
import { memberDetail } from '../../../core/member-detail';

/** A single step in the create-match wizard. */
interface WizardStep {
  n: number;
  label: string;
}

/** Role filter chips for the participant picker (key matches member-detail roles). */
interface RoleFilter {
  key: string;
  label: string;
}

/** How the match is assembled: captain picks everyone, or players sign up. */
type CreateMode = 'manual' | 'open';

/**
 * Create-match wizard for a group. It forks on a mode-select screen:
 *
 * - MANUAL: the captain picks exactly 10 players from the roster, then sets
 *   line/player/champion restrictions (steps 2-5 stubbed).
 * - OPEN: the captain publishes a room that group members join from their own
 *   accounts. Restrictions are configured later, once the room fills, because
 *   per-player rules need the final 10 to be known. The waiting room here is a
 *   mock that fills via a "simulate join" button until launch is enabled.
 *
 * Team split (Blue vs Red) is decided by the internal matchmaking algorithm.
 */
@Component({
  selector: 'app-grupo-crear-partida',
  standalone: true,
  imports: [FormsModule, RouterLink, NfBadge, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        <div class="cp">
          <div class="cp-head">
            <div class="cp-head__titles">
              <h1 class="view__title">Crear partida</h1>
            </div>
            <a class="view-back cp-back" [routerLink]="['/app', 'grupos', g.id]">
              <span class="view-back__arrow">←</span> VOLVER AL GRUPO
            </a>
          </div>

          @if (roster().length < MAX) {
            <!-- shared block: a 5v5 needs 10 group members regardless of mode -->
            <nf-window title="crear_partida.exe" accent="cyan" bodyPadding="0">
              <div class="cp-pad">
                <div class="empty-state">
                  <div class="empty-state__icon">⚠</div>
                  <div class="empty-state__text">FALTAN JUGADORES</div>
                  <p class="empty-state__hint">
                    Necesitas al menos {{ MAX }} miembros en el grupo para crear una partida 5v5.
                    Ahora mismo sois {{ roster().length }}. Invita a más gente y vuelve.
                  </p>
                  <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id]">
                    ＋ IR A INVITAR
                  </button>
                </div>
              </div>
            </nf-window>
          } @else if (mode() === null) {
            <!-- ===== PASO 0 · elección de modo ===== -->
            <p class="cp-modes__lead">¿Cómo quieres montar la partida?</p>
            <div class="cp-modes">
              <button type="button" class="cp-mode" (click)="chooseMode('manual')">
                <div class="cp-mode__glyph">✋</div>
                <div class="cp-mode__title nf-mono">PARTIDA MANUAL</div>
                <p class="cp-mode__desc">
                  Eliges tú a los 10 jugadores ahora y configuras las restricciones de una sentada.
                </p>
                <span class="cp-mode__cta nf-mono">ELEGIR ►</span>
              </button>
              <button type="button" class="cp-mode cp-mode--pink" (click)="chooseMode('open')">
                <div class="cp-mode__glyph">📣</div>
                <div class="cp-mode__title nf-mono">SALA ABIERTA</div>
                <p class="cp-mode__desc">
                  Publicas una sala y los jugadores del grupo se apuntan desde sus cuentas.
                  Configuras las restricciones cuando se llena.
                </p>
                <span class="cp-mode__cta nf-mono">ELEGIR ►</span>
              </button>
            </div>
          } @else if (mode() === 'manual') {
            <!-- ===== MODO MANUAL · wizard ===== -->
            <div class="cp-steps">
              @for (s of steps; track s.n; let last = $last) {
                <button
                  type="button"
                  class="cp-step"
                  [class.is-active]="step() === s.n"
                  [class.is-done]="s.n < step()"
                  [disabled]="s.n > step()"
                  (click)="goStep(s.n)"
                >
                  <span class="cp-step__n">{{ s.n < step() ? '✓' : s.n }}</span>
                  <span class="cp-step__label nf-mono">{{ s.label }}</span>
                </button>
                @if (!last) {
                  <span class="cp-step__sep" aria-hidden="true">►</span>
                }
              }
            </div>

            <nf-window [title]="windowTitle()" accent="cyan" bodyPadding="0">
              @switch (step()) {
                @case (1) {
                  <div class="cp-toolbar">
                    <input
                      class="field__input cp-search"
                      type="text"
                      placeholder="🔍 Buscar jugador por nombre o tag…"
                      autocomplete="off"
                      [ngModel]="search()"
                      (ngModelChange)="search.set($event)"
                    />
                    <div class="cp-chips">
                      @for (rf of roleFilters; track rf.key) {
                        <button
                          type="button"
                          class="cp-chip nf-mono"
                          [class.is-active]="roleFilter() === rf.key"
                          (click)="roleFilter.set(rf.key)"
                        >{{ rf.label }}</button>
                      }
                    </div>
                  </div>

                  <div class="cp-tray">
                    <div class="cp-tray__head nf-mono">
                      SELECCIONADOS · {{ count() }}/{{ MAX }}
                      @if (count() > 0) {
                        <button type="button" class="cp-tray__clear" (click)="clearSelection()">limpiar</button>
                      }
                    </div>
                    <div class="cp-tray__chips">
                      @for (m of selectedMembers(); track m.tag) {
                        <button
                          type="button"
                          class="cp-tray__chip"
                          [title]="'Quitar ' + m.name"
                          (click)="toggle(m)"
                        >
                          <span class="cp-tray__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                          <span class="cp-tray__name nf-mono">{{ m.name }}</span>
                          <span class="cp-tray__x" aria-hidden="true">✕</span>
                        </button>
                      } @empty {
                        <span class="cp-tray__placeholder nf-mono">
                          aún no has elegido a nadie · toca un jugador para añadirlo
                        </span>
                      }
                    </div>
                  </div>

                  <div class="cp-list">
                    @for (m of visible(); track m.tag) {
                      <button
                        type="button"
                        class="cp-pick"
                        [class.is-selected]="isSelected(m.tag)"
                        [disabled]="!isSelected(m.tag) && atMax()"
                        (click)="toggle(m)"
                      >
                        <span class="cp-pick__check" aria-hidden="true">{{ isSelected(m.tag) ? '✓' : '' }}</span>
                        <span class="cp-pick__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                        <span class="cp-pick__meta">
                          <span class="cp-pick__name nf-mono">{{ m.name }}</span>
                          <span class="cp-pick__roles nf-mono">{{ rolesLabel(m) }}</span>
                        </span>
                        @if (m.owner) {
                          <nf-badge color="pink">OWNER</nf-badge>
                        }
                      </button>
                    } @empty {
                      <div class="cp-empty nf-mono">// sin resultados para ese filtro</div>
                    }
                  </div>

                  @if (!atMax() && addableCount() > 0) {
                    <button type="button" class="cp-addall nf-mono" (click)="addAllVisible()">
                      ＋ añadir {{ addableCount() }} visible{{ addableCount() === 1 ? '' : 's' }}
                    </button>
                  }
                }

                @default {
                  <div class="cp-pad">
                    <div class="cp-stub">
                      <div class="cp-stub__glyph">⚙</div>
                      <div class="cp-stub__title nf-mono">PASO {{ step() }} · {{ currentStep().label }}</div>
                      <p class="cp-stub__hint">En construcción. Seguimos debatiendo este paso antes de montarlo.</p>
                      <div class="cp-stub__roster nf-mono">
                        JUGADORES EN LA PARTIDA · {{ count() }}/{{ MAX }}
                      </div>
                      <div class="cp-tray__chips">
                        @for (m of selectedMembers(); track m.tag) {
                          <span class="cp-tray__chip cp-tray__chip--static">
                            <span class="cp-tray__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                            <span class="cp-tray__name nf-mono">{{ m.name }}</span>
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                }
              }
            </nf-window>

            <div class="cp-foot">
              <button nfButton variant="ghost" size="md" (click)="back()">
                {{ step() === 1 ? '← MODO' : '← ATRÁS' }}
              </button>
              <div class="cp-foot__status nf-mono">
                @if (step() === 1) {
                  {{ count() }}/{{ MAX }} SELECCIONADOS
                }
              </div>
              <button
                nfButton
                variant="primary"
                size="md"
                [disabled]="!canStepContinue()"
                (click)="next()"
              >{{ step() === steps.length ? 'LANZAR PARTIDA ►' : 'SIGUIENTE ►' }}</button>
            </div>
          } @else {
            <!-- ===== MODO SALA ABIERTA · configurar + sala de espera ===== -->
            <nf-window title="sala_abierta.exe" accent="pink" bodyPadding="0">
              <div class="cp-room__bar">
                <div class="cp-room__barmeta">
                  <div class="cp-room__sub nf-mono">CUALQUIER MIEMBRO DEL GRUPO PUEDE APUNTARSE</div>
                </div>
                <nf-badge [color]="openFull() ? 'green' : 'yellow'">{{ openCount() }}/{{ MAX }}</nf-badge>
              </div>

              <div class="cp-seats">
                @for (slot of seatSlots(); track $index) {
                  @if (slot; as m) {
                    <div class="cp-seat" [class.cp-seat--captain]="m.owner">
                      <span class="cp-seat__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                      <span class="cp-seat__meta">
                        <span class="cp-seat__name nf-mono">{{ m.name }}</span>
                        <span class="cp-seat__role nf-mono">{{ m.owner ? 'CAPITÁN · ABRIÓ LA SALA' : 'APUNTADO' }}</span>
                      </span>
                      @if (!m.owner) {
                        <button
                          type="button"
                          class="cp-seat__kick"
                          [attr.aria-label]="'Quitar a ' + m.name"
                          (click)="leaveSeat(m)"
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
                @if (!openFull()) {
                  <button type="button" class="cp-sim nf-mono" [disabled]="!openPool().length" (click)="simulateJoin()">
                    ▶ simular que alguien se apunta ({{ openPool().length }} disponibles)
                  </button>
                  <p class="form-note nf-mono" style="margin:0">
                    MAQUETA · EN REAL, LOS MIEMBROS RECIBIRÍAN UNA NOTIFICACIÓN Y SE APUNTARÍAN DESDE SU CUENTA.
                  </p>
                } @else {
                  <div class="cp-room__ready nf-mono">✓ SALA COMPLETA · LISTA PARA CONFIGURAR Y LANZAR</div>
                }
              </div>
            </nf-window>

            <div class="cp-foot">
              <button nfButton variant="ghost" size="md" (click)="resetMode()">← MODO</button>
              <div class="cp-foot__status nf-mono">{{ openCount() }}/{{ MAX }} APUNTADOS</div>
              <button nfButton variant="primary" size="md" [disabled]="!openFull()">
                CONTINUAR A RESTRICCIONES ►
              </button>
            </div>
          }
        </div>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ERROR 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← VOLVER A GRUPOS</button>
      }
    </div>
  `,
  styleUrl: './views.scss',
})
export class GrupoCrearPartida {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);

  readonly MAX = 10;

  readonly steps: WizardStep[] = [
    { n: 1, label: 'PARTICIPANTES' },
    { n: 2, label: 'LÍNEAS' },
    { n: 3, label: 'DUOS / TRÍOS / VS' },
    { n: 4, label: 'PERSONAJES' },
    { n: 5, label: 'LANZAR' },
  ];

  readonly roleFilters: RoleFilter[] = [
    { key: 'ALL', label: 'TODOS' },
    { key: 'TOP', label: 'TOP' },
    { key: 'JUNGLA', label: 'JG' },
    { key: 'MID', label: 'MID' },
    { key: 'ADC', label: 'ADC' },
    { key: 'SUPPORT', label: 'SUP' },
  ];

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  readonly roster = computed<Member[]>(() => {
    const g = this.group();
    return g ? this.groups.rosterOf(g.id) : [];
  });

  /** Stable per-member role tags (TOP/JUNGLA/MID/ADC/SUPPORT or FLEX) for filtering. */
  private readonly memberRoles = computed(() => {
    const r = this.roster();
    const out = new Map<string, string[]>();
    for (const m of r) out.set(m.tag, memberDetail(m, r).roles);
    return out;
  });

  // --- Mode selection (Paso 0) ----------------------------------------------
  readonly mode = signal<CreateMode | null>(null);

  chooseMode(m: CreateMode): void {
    if (m === 'open') {
      // The captain (group owner) opens the room and takes the first seat.
      const captain = this.roster()[0];
      this.seats.set(captain ? [captain] : []);
    }
    this.mode.set(m);
  }

  resetMode(): void {
    this.mode.set(null);
  }

  // --- Wizard navigation (manual mode) ---------------------------------------
  readonly step = signal(1);

  readonly currentStep = computed(() => this.steps[this.step() - 1]);
  readonly windowTitle = computed(
    () => `paso_${this.step()}_${this.currentStep().label.toLowerCase().replace(/[^a-z]+/g, '_')}.exe`,
  );

  goStep(n: number): void {
    if (n <= this.step()) this.step.set(n);
  }

  next(): void {
    if (this.canStepContinue() && this.step() < this.steps.length) this.step.update((s) => s + 1);
  }

  /** On step 1, "back" returns to the mode chooser; otherwise to the previous step. */
  back(): void {
    if (this.step() === 1) this.resetMode();
    else this.step.update((s) => s - 1);
  }

  /** Whether the current step is complete enough to advance. */
  readonly canStepContinue = computed(() => {
    if (this.step() === 1) return this.count() === this.MAX;
    return true; // steps 2-5 are stubs for now
  });

  // --- Manual mode: participant picker ---------------------------------------
  readonly search = signal('');
  readonly roleFilter = signal('ALL');
  readonly selected = signal<Set<string>>(new Set<string>());

  /** Roster filtered by the search box and the active role chip. */
  readonly visible = computed<Member[]>(() => {
    const q = this.search().trim().toLowerCase();
    const f = this.roleFilter();
    const roles = this.memberRoles();
    return this.roster().filter((m) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.tag.toLowerCase().includes(q)) return false;
      if (f !== 'ALL') {
        const rs = roles.get(m.tag) ?? [];
        if (!rs.includes(f) && !rs.includes('FLEX')) return false;
      }
      return true;
    });
  });

  readonly selectedMembers = computed<Member[]>(() =>
    this.roster().filter((m) => this.selected().has(m.tag)),
  );
  readonly count = computed(() => this.selected().size);
  readonly atMax = computed(() => this.count() >= this.MAX);

  /** How many currently-visible rows are still unselected (for the bulk-add label). */
  readonly addableCount = computed(
    () => this.visible().filter((m) => !this.selected().has(m.tag)).length,
  );

  isSelected(tag: string): boolean {
    return this.selected().has(tag);
  }

  rolesLabel(m: Member): string {
    return (this.memberRoles().get(m.tag) ?? []).join(' · ');
  }

  avatarBg(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }

  toggle(m: Member): void {
    const set = new Set(this.selected());
    if (set.has(m.tag)) {
      set.delete(m.tag);
    } else {
      if (set.size >= this.MAX) return;
      set.add(m.tag);
    }
    this.selected.set(set);
  }

  /** Add visible (filtered) players until the roster hits the 10-player cap. */
  addAllVisible(): void {
    const set = new Set(this.selected());
    for (const m of this.visible()) {
      if (set.size >= this.MAX) break;
      set.add(m.tag);
    }
    this.selected.set(set);
  }

  clearSelection(): void {
    this.selected.set(new Set<string>());
  }

  // --- Open mode: waiting room (mock) ----------------------------------------
  /** Seats taken so far; seat 0 is always the captain who opened the room. */
  readonly seats = signal<Member[]>([]);
  readonly openCount = computed(() => this.seats().length);
  readonly openFull = computed(() => this.openCount() >= this.MAX);

  /** Exactly 10 slots: a member when filled, null when still open. */
  readonly seatSlots = computed<(Member | null)[]>(() => {
    const s = this.seats();
    return Array.from({ length: this.MAX }, (_, i) => s[i] ?? null);
  });

  /** Group members not yet seated (the pool a real join would draw from). */
  readonly openPool = computed<Member[]>(() =>
    this.roster().filter((m) => !this.seats().some((x) => x.tag === m.tag)),
  );

  /** Mock: pull the next available member into an open seat. */
  simulateJoin(): void {
    const next = this.openPool()[0];
    if (next) this.seats.update((s) => [...s, next]);
  }

  /** Free a seat (the captain's seat can't be vacated). */
  leaveSeat(m: Member): void {
    if (m.owner) return;
    this.seats.update((s) => s.filter((x) => x.tag !== m.tag));
  }

  constructor() {
    // Keep the shell header/sidebar in sync with the active group on deep-link.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });
  }
}
