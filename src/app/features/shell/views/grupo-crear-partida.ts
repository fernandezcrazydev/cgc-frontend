import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { MatchStore, DraftSnapshot, DraftRaw, RoomTeams, RoomTeamSlot } from '../../../core/match-store';
import { CHAMPIONS, Champion, Member } from '../../../core/lobby';
import { memberDetail } from '../../../core/member-detail';
import { MemberBadge, badgesFor } from '../../../core/group-badges';
import {
  matchmake,
  internalElo,
  MatchmakePlayer,
  MatchmakeRule,
  MatchmakeSlot,
} from '../../../core/matchmaking';

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

/** Step 3 rule types: same team, opposite teams, or a same-lane 1v1. */
type RuleKind = 'together' | 'versus' | 'lane';

/**
 * A player-relationship constraint for the matchmaker (step 3). "together" uses
 * side A only (2-3 players on one team). "versus"/"lane" pit side A against side
 * B on opposite teams (1-3 each for versus, exactly 1 each for a lane duel).
 */
interface MatchRule {
  id: number;
  kind: RuleKind;
  a: string[];
  b: string[];
}

/** One assigned seat in the generated 5v5 preview. */
interface TeamSlot {
  roleKey: string;
  roleLabel: string;
  member: Member;
  champ: Champion | null;
}

/** The generated Blue-vs-Red split shown on the launch step. */
interface GeneratedTeams {
  blue: TeamSlot[];
  red: TeamSlot[];
  /** How many step-3 rules the split satisfies, out of the total. */
  satisfied: number;
  total: number;
}

/**
 * Create-match wizard for a group. Forks on a mode-select screen (Paso 0):
 *
 * - MANUAL: the admin picks exactly 10 players, then configures restrictions
 *   across 5 steps:
 *     1. PARTICIPANTES  — pick the 10 (search + role filters, exact-10 gate).
 *     2. LÍNEAS         — per-player allowed roles; chips pre-filled from profile.
 *                         Live feasibility check (bipartite matching, 2 per role).
 *     3. DUOS/TRÍOS/VS  — together / versus (A-vs-B sides) / lane-duel rules,
 *                         with contradiction + shared-line validation.
 *     4. PERSONAJES     — reserve a champion per player (= OTP + un-bannable).
 *     5. LANZAR         — generated Blue/Red split + elo balance bar, then launch.
 * - OPEN: the admin publishes a room and group members join from their own
 *   accounts; restrictions are configured later, once it fills (the final 10
 *   must be known first).
 *
 * STATE OWNERSHIP (important): the wizard's state is NOT private. As soon as the
 * admin enters manual mode a `drafting` room is created in MatchStore, and an
 * effect() streams a DraftSnapshot of every change into it, so non-admins can
 * follow the configuration live (see grupo-sala's follower view). On launch the
 * SAME room is promoted to `live`. If the admin leaves mid-way the draft is kept
 * for resume (the wizard rehydrates from `draft.raw`); it's auto-pruned after 24h.
 *
 * BACKEND INTEGRATION POINTS (all mocked here):
 * - `generated()` is a stand-in for the real matchmaking algorithm (role assign
 *   + balanced team split); swap its body for the backend result.
 * - `elo()` fakes an internal rating per player (seeded); replace with real data.
 * - the loaders (`generating` / `launching`) fake backend latency via setTimeout.
 * - real cross-user live sync needs a realtime channel behind MatchStore.
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
            <div class="cp-head__actions">
              @if (mode() === 'manual' && !reconfigureRoomId()) {
                <button type="button" class="cp-discard nf-mono" (click)="discarding.set(true)">
                  ✕ DESCARTAR
                </button>
              }
              <a class="view-back cp-back" [routerLink]="['/app', 'grupos', g.id]">
                <span class="view-back__arrow">←</span> VOLVER AL GRUPO
              </a>
            </div>
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
          } @else if (showStepWizard()) {
            <!-- ===== STEP WIZARD · manual, or open mode once the room is full ===== -->
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

                @case (2) {
                  <div class="cp-cover">
                    <div class="cp-cover__head nf-mono">COBERTURA · cada línea necesita 2 jugadores</div>
                    <div class="cp-cover__roles">
                      @for (r of lineRolesList; track r.key) {
                        <div
                          class="cp-cover__role"
                          [class.is-bad]="lineCoverage()[r.key] < 2"
                          [class.is-tight]="lineCoverage()[r.key] === 2"
                        >
                          <span class="cp-cover__rolelabel nf-mono">{{ r.label }}</span>
                          <span class="cp-cover__count nf-mono">
                            {{ lineCoverage()[r.key] }}/2 {{ lineCoverage()[r.key] < 2 ? '✗' : '✓' }}
                          </span>
                        </div>
                      }
                    </div>
                    <div class="cp-cover__legend nf-mono">
                      Cada jugador arranca con sus líneas de <b>perfil</b>. Toca para encender o apagar
                      las que quieras forzar esta partida.
                    </div>
                    <div class="cp-cover__note nf-mono">
                      <span class="cp-cover__note-ico" aria-hidden="true">ℹ</span>
                      Estos cambios solo afectan a <b>esta partida</b>. No modifican las líneas del perfil
                      del jugador en el grupo.
                    </div>
                  </div>

                  @if (lineErrors().length || lineWarnings().length) {
                    <div class="cp-diag">
                      @for (e of lineErrors(); track e) {
                        <div class="cp-diag__item cp-diag__item--err nf-mono">✗ {{ e }}</div>
                      }
                      @for (w of lineWarnings(); track w) {
                        <div class="cp-diag__item cp-diag__item--warn nf-mono">⚠ {{ w }}</div>
                      }
                    </div>
                  }

                  <div class="cp-lines">
                    @for (m of selectedMembers(); track m.tag) {
                      <div class="cp-line" [class.is-bad]="unmatchedTags().includes(m.tag)">
                        <span class="cp-pick__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                        <div class="cp-line__meta">
                          <span class="cp-pick__name nf-mono">{{ m.name }}</span>
                          <span class="cp-line__state nf-mono" [class.is-custom]="isCustom(m.tag)">
                            {{ isCustom(m.tag) ? '◆ PERSONALIZADO' : '○ PERFIL' }}
                          </span>
                        </div>
                        <div class="cp-line__roles">
                          @for (r of lineRolesList; track r.key) {
                            <button
                              type="button"
                              class="cp-rolechip nf-mono"
                              [class.is-on]="isActive(m.tag, r.key)"
                              (click)="toggleLine(m.tag, r.key)"
                            >{{ r.label }}</button>
                          }
                        </div>
                        <button
                          type="button"
                          class="cp-line__reset"
                          [class.is-shown]="isCustom(m.tag)"
                          [disabled]="!isCustom(m.tag)"
                          title="Volver al perfil"
                          (click)="resetLine(m.tag)"
                        >↺</button>
                      </div>
                    }
                  </div>
                }

                @case (3) {
                  <div class="cp-rb">
                    <div class="cp-rb__types">
                      @for (k of ruleKinds; track k.key) {
                        <button
                          type="button"
                          class="cp-rb__type nf-mono"
                          [class.is-active]="builderKind() === k.key"
                          (click)="setBuilderKind(k.key)"
                        >
                          <span class="cp-rb__type-ico" aria-hidden="true">{{ k.icon }}</span>
                          {{ k.label }}
                        </button>
                      }
                    </div>
                    <div class="cp-rb__hint nf-mono">{{ builderHint() }}</div>

                    @if (builderTwoSided()) {
                      <div class="cp-rb__sides nf-mono">
                        <span class="cp-rb__side cp-rb__side--a">BANDO A · {{ builderA().length }}</span>
                        <span class="cp-rb__vs">vs</span>
                        <span class="cp-rb__side cp-rb__side--b">BANDO B · {{ builderB().length }}</span>
                      </div>
                    }

                    <div class="cp-rb__players">
                      @for (m of selectedMembers(); track m.tag) {
                        @if (builderTwoSided()) {
                          <div class="cp-pchip cp-pchip--dual" [attr.data-side]="pickOf(m.tag)">
                            <span class="cp-pchip__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                            <span class="cp-pchip__name nf-mono">{{ m.name }}</span>
                            <span class="cp-pchip__sides">
                              <button
                                type="button"
                                class="cp-side cp-side--a nf-mono"
                                [class.is-on]="pickOf(m.tag) === 'a'"
                                [disabled]="sideFull(m.tag, 'a')"
                                (click)="assignSide(m.tag, 'a')"
                              >A</button>
                              <button
                                type="button"
                                class="cp-side cp-side--b nf-mono"
                                [class.is-on]="pickOf(m.tag) === 'b'"
                                [disabled]="sideFull(m.tag, 'b')"
                                (click)="assignSide(m.tag, 'b')"
                              >B</button>
                            </span>
                          </div>
                        } @else {
                          <button
                            type="button"
                            class="cp-pchip"
                            [attr.data-side]="pickOf(m.tag)"
                            (click)="assignSide(m.tag, 'a')"
                          >
                            <span class="cp-pchip__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                            <span class="cp-pchip__name nf-mono">{{ m.name }}</span>
                            @if (pickOf(m.tag)) {
                              <span class="cp-pchip__side">✓</span>
                            }
                          </button>
                        }
                      }
                    </div>
                    <button
                      type="button"
                      class="cp-rb__add nf-mono"
                      [disabled]="!builderValid()"
                      (click)="addRule()"
                    >＋ AÑADIR REGLA</button>
                  </div>

                  @if (ruleErrors().length || ruleWarnings().length) {
                    <div class="cp-diag">
                      @for (e of ruleErrors(); track e) {
                        <div class="cp-diag__item cp-diag__item--err nf-mono">✗ {{ e }}</div>
                      }
                      @for (w of ruleWarnings(); track w) {
                        <div class="cp-diag__item cp-diag__item--warn nf-mono">⚠ {{ w }}</div>
                      }
                    </div>
                  }

                  <div class="cp-rules">
                    @for (r of rules(); track r.id) {
                      <div class="cp-rule" [attr.data-kind]="r.kind">
                        <span class="cp-rule__ico" aria-hidden="true">{{ ruleMeta(r.kind).icon }}</span>
                        <div class="cp-rule__body">
                          <span class="cp-rule__label nf-mono">
                            {{ ruleMeta(r.kind).label }}@if (r.kind === 'lane') {<span class="cp-rule__tag"> · misma línea</span>}
                          </span>
                          <span class="cp-rule__players">{{ rulePlayers(r) }}</span>
                        </div>
                        <button
                          type="button"
                          class="cp-rule__del"
                          [attr.aria-label]="'Quitar regla'"
                          (click)="removeRule(r.id)"
                        >✕</button>
                      </div>
                    } @empty {
                      <div class="cp-rules__empty nf-mono">
                        Sin reglas. Este paso es opcional — sin reglas, el algoritmo reparte libremente.
                      </div>
                    }
                  </div>
                }

                @case (4) {
                  <div class="cp-cover">
                    <div class="cp-cover__head nf-mono">
                      CAMPEONES RESERVADOS · {{ reservedCount() }}/{{ MAX }}
                    </div>
                    <div class="cp-cover__legend nf-mono">
                      Reserva el campeón que jugará cada uno: queda <b>asegurado para ese jugador</b> y
                      <b>no se podrá banear</b>. Es opcional — déjalo vacío para quien no lo necesite.
                    </div>
                    <div class="cp-cover__note nf-mono">
                      <span class="cp-cover__note-ico" aria-hidden="true">ℹ</span>
                      Solo aplica a <b>esta partida</b>. Lo ideal es que el grupo lo haya acordado antes.
                    </div>
                  </div>

                  @if (champErrors().length || champWarnings().length) {
                    <div class="cp-diag">
                      @for (e of champErrors(); track e) {
                        <div class="cp-diag__item cp-diag__item--err nf-mono">✗ {{ e }}</div>
                      }
                      @for (w of champWarnings(); track w) {
                        <div class="cp-diag__item cp-diag__item--warn nf-mono">⚠ {{ w }}</div>
                      }
                    </div>
                  }

                  <div class="cp-champs">
                    @for (m of selectedMembers(); track m.tag) {
                      <div class="cp-champrow" [class.is-open]="pickerTag() === m.tag">
                        <div class="cp-champrow__head">
                          <span class="cp-pick__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                          <span class="cp-champrow__name nf-mono">{{ m.name }}</span>
                          @if (reservedOf(m.tag); as c) {
                            <button type="button" class="cp-reserved" (click)="togglePicker(m.tag)">
                              <span class="cp-reserved__icon" [style.background]="champGradient(c)">{{ c.initials }}</span>
                              <span class="cp-reserved__name nf-mono">{{ c.name }}</span>
                              <span class="cp-reserved__role nf-mono">{{ c.role }}</span>
                            </button>
                            <button
                              type="button"
                              class="cp-reserved__clear"
                              [attr.aria-label]="'Quitar reserva de ' + m.name"
                              (click)="clearReserve(m.tag)"
                            >✕</button>
                          } @else {
                            <button type="button" class="cp-champrow__add nf-mono" (click)="togglePicker(m.tag)">
                              ＋ Reservar campeón
                            </button>
                          }
                        </div>

                        @if (pickerTag() === m.tag) {
                          <div class="cp-picker">
                            <input
                              class="field__input cp-picker__search"
                              type="text"
                              placeholder="🔍 Buscar campeón por nombre…"
                              autocomplete="off"
                              [ngModel]="champSearch()"
                              (ngModelChange)="champSearch.set($event)"
                            />
                            @if (champSearch()) {
                              <div class="cp-picker__label nf-mono">RESULTADOS</div>
                              <div class="cp-picker__grid">
                                @for (c of champPool(); track c.name) {
                                  <button type="button" class="cp-champ-opt" (click)="reserveChamp(m.tag, c.name)">
                                    <span class="cp-champ-opt__icon" [style.background]="champGradient(c)">{{ c.initials }}</span>
                                    <span class="cp-champ-opt__meta">
                                      <span class="cp-champ-opt__name nf-mono">{{ c.name }}</span>
                                      <span class="cp-champ-opt__role nf-mono">{{ c.role }}</span>
                                    </span>
                                  </button>
                                } @empty {
                                  <div class="cp-empty nf-mono">// sin campeones para esa búsqueda</div>
                                }
                              </div>
                            } @else {
                              @if (mainsOf(m.tag).length) {
                                <div class="cp-picker__label nf-mono">SUS MAINS · RECOMENDADOS</div>
                                <div class="cp-picker__grid">
                                  @for (c of mainsOf(m.tag); track c.name) {
                                    <button type="button" class="cp-champ-opt" (click)="reserveChamp(m.tag, c.name)">
                                      <span class="cp-champ-opt__icon" [style.background]="champGradient(c)">{{ c.initials }}</span>
                                      <span class="cp-champ-opt__meta">
                                        <span class="cp-champ-opt__name nf-mono">{{ c.name }}</span>
                                        <span class="cp-champ-opt__role nf-mono">{{ c.role }}</span>
                                      </span>
                                    </button>
                                  }
                                </div>
                              }
                              <div class="cp-picker__hint nf-mono">
                                ↑ sus campeones más jugados · escribe arriba para buscar entre todos
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

                @case (5) {
                  @if (launching()) {
                    <div class="cp-pad">
                      <div class="cp-loader">
                        <div class="cp-loader__spinner" aria-hidden="true"></div>
                        <div class="cp-loader__title nf-mono">LANZANDO PARTIDA…</div>
                        <div class="cp-loader__log">
                          <div class="cp-loader__line nf-mono" style="--d:0s">› creando la sala</div>
                          <div class="cp-loader__line nf-mono" style="--d:.4s">› asignando equipos azul / rojo</div>
                          <div class="cp-loader__line nf-mono" style="--d:.8s">› notificando a los jugadores</div>
                        </div>
                        <div class="cp-loader__bar"><div class="cp-loader__bar-fill"></div></div>
                      </div>
                    </div>
                  } @else if (generating()) {
                    <div class="cp-pad">
                      <div class="cp-loader">
                        <div class="cp-loader__spinner" aria-hidden="true"></div>
                        <div class="cp-loader__title nf-mono">EMPAREJANDO…</div>
                        <div class="cp-loader__log">
                          <div class="cp-loader__line nf-mono" style="--d:0s">› analizando líneas y roles</div>
                          <div class="cp-loader__line nf-mono" style="--d:.35s">› equilibrando el elo de los equipos</div>
                          <div class="cp-loader__line nf-mono" style="--d:.7s">› aplicando reglas (duos / vs)</div>
                          <div class="cp-loader__line nf-mono" style="--d:1.05s">› generando el reparto</div>
                        </div>
                        <div class="cp-loader__bar"><div class="cp-loader__bar-fill"></div></div>
                      </div>
                    </div>
                  } @else {
                    <div class="cp-summary">
                      <span class="cp-summary__item nf-mono"><b>{{ MAX }}</b> jugadores</span>
                      <span class="cp-summary__item nf-mono"><b>{{ customLineCount() }}</b> líneas fijadas</span>
                      <span class="cp-summary__item nf-mono"><b>{{ rules().length }}</b> reglas</span>
                      <span class="cp-summary__item nf-mono"><b>{{ reservedCount() }}</b> reservados</span>
                    </div>

                    <div class="cp-balance">
                      <div class="cp-balance__head nf-mono">
                        <span class="cp-balance__team cp-balance__team--blue">
                          AZUL <b>{{ teamElo().blue }}</b>
                        </span>
                        <span class="cp-balance__verdict" [attr.data-side]="balanceVerdict().side">
                          @if (balanceVerdict().side === 'even') {
                            ⚖ {{ balanceVerdict().text }}
                          } @else {
                            {{ balanceVerdict().text }} {{ balanceVerdict().side === 'blue' ? 'AZUL ◀' : '▶ ROJO' }}
                          }
                        </span>
                        <span class="cp-balance__team cp-balance__team--red">
                          <b>{{ teamElo().red }}</b> ROJO
                        </span>
                      </div>
                      <div class="cp-balance__bar">
                        <div class="cp-balance__fill" [style.width.%]="teamElo().blueShare * 100"></div>
                        <div class="cp-balance__mid" aria-hidden="true"></div>
                      </div>
                    </div>

                    <div class="cp-teams">
                      <div class="cp-team cp-team--blue">
                        <div class="cp-team__head nf-mono"><span class="cp-team__dot"></span> EQUIPO AZUL</div>
                        @for (s of generated().blue; track s.member.tag) {
                          <div class="cp-slot">
                            <span class="cp-slot__role nf-mono">{{ s.roleLabel }}</span>
                            <span class="cp-pick__avatar" [style.background]="avatarBg(s.member.hue)">{{ s.member.initials }}</span>
                            <div class="cp-slot__main">
                              <div class="cp-slot__line">
                                <span class="cp-slot__name nf-mono">{{ s.member.name }}</span>
                              </div>
                              @if (badgesOf(s.member.name); as bs) {
                                @if (bs.length) {
                                  <span class="mbadges mbadges--inline">
                                    @for (b of bs; track b.id) {
                                      <span class="mbadge" [attr.data-color]="b.color" [title]="b.title + ' · ' + b.detail">{{ b.glyph }}</span>
                                    }
                                  </span>
                                }
                              }
                            </div>
                            <span class="cp-slot__elo nf-mono" title="Elo interno">◆ {{ elo(s.member.tag) }}</span>
                            @if (s.champ; as c) {
                              <span class="cp-slot__champ" title="Campeón reservado para este jugador">
                                <span class="cp-slot__champ-icon" [style.background]="champGradient(c)">{{ c.initials }}</span>
                                <span class="cp-slot__champ-name nf-mono">{{ c.name }}</span>
                              </span>
                            }
                          </div>
                        }
                      </div>

                      <div class="cp-team cp-team--red">
                        <div class="cp-team__head nf-mono"><span class="cp-team__dot"></span> EQUIPO ROJO</div>
                        @for (s of generated().red; track s.member.tag) {
                          <div class="cp-slot">
                            <span class="cp-slot__role nf-mono">{{ s.roleLabel }}</span>
                            <span class="cp-pick__avatar" [style.background]="avatarBg(s.member.hue)">{{ s.member.initials }}</span>
                            <div class="cp-slot__main">
                              <div class="cp-slot__line">
                                <span class="cp-slot__name nf-mono">{{ s.member.name }}</span>
                              </div>
                              @if (badgesOf(s.member.name); as bs) {
                                @if (bs.length) {
                                  <span class="mbadges mbadges--inline">
                                    @for (b of bs; track b.id) {
                                      <span class="mbadge" [attr.data-color]="b.color" [title]="b.title + ' · ' + b.detail">{{ b.glyph }}</span>
                                    }
                                  </span>
                                }
                              }
                            </div>
                            <span class="cp-slot__elo nf-mono" title="Elo interno">◆ {{ elo(s.member.tag) }}</span>
                            @if (s.champ; as c) {
                              <span class="cp-slot__champ" title="Campeón reservado para este jugador">
                                <span class="cp-slot__champ-icon" [style.background]="champGradient(c)">{{ c.initials }}</span>
                                <span class="cp-slot__champ-name nf-mono">{{ c.name }}</span>
                              </span>
                            }
                          </div>
                        }
                      </div>
                    </div>

                    <div class="cp-teams__foot">
                      <button type="button" class="cp-reroll nf-mono" (click)="reroll()">↻ REBALANCEAR</button>
                      @if (generated().total) {
                        <span class="cp-teams__rules nf-mono">
                          reglas respetadas: {{ generated().satisfied }}/{{ generated().total }}
                        </span>
                      }
                    </div>
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

            @if (!launching()) {
              <div class="cp-foot">
                <button nfButton variant="ghost" size="md" (click)="back()">
                  {{ step() === 1 ? '← MODO' : '← ATRÁS' }}
                </button>
                <div class="cp-foot__status nf-mono">
                  <span class="cp-foot__status-text">
                    @if (step() === 1) {
                      {{ count() }}/{{ MAX }} SELECCIONADOS
                    } @else if (step() === 2) {
                      {{ lineMatch().ok ? 'LÍNEAS OK ✓' : 'REVISA LAS LÍNEAS ✗' }}
                    } @else if (step() === 3) {
                      {{ rules().length }} REGLA{{ rules().length === 1 ? '' : 'S' }}{{ ruleErrors().length ? ' · REVISA ✗' : '' }}
                    } @else if (step() === 4) {
                      {{ reservedCount() }} RESERVADO{{ reservedCount() === 1 ? '' : 'S' }}{{ champErrors().length ? ' · REVISA ✗' : '' }}
                    }
                  </span>
                  @if (step() < steps.length && canSkipToLaunch()) {
                    <button
                      type="button"
                      class="cp-foot__skip nf-mono"
                      title="Saltar las restricciones (son opcionales) e ir directo a lanzar"
                      (click)="skipToLaunch()"
                    >⏩ SALTAR Y LANZAR</button>
                  }
                </div>
                <button
                  nfButton
                  variant="primary"
                  size="md"
                  [disabled]="!canStepContinue()"
                  (click)="onPrimary()"
                >{{ step() === steps.length ? 'LANZAR PARTIDA ►' : 'SIGUIENTE ►' }}</button>
              </div>
            }
          } @else {
            <!-- ===== MODO SALA ABIERTA · configurar + sala de espera ===== -->
            <nf-window title="sala_abierta.exe" accent="pink" bodyPadding="0">
              <div class="cp-room__bar">
                <div class="cp-room__barmeta">
                  <div class="cp-room__sub nf-mono">CUALQUIER MIEMBRO DEL GRUPO PUEDE APUNTARSE</div>
                </div>
                <nf-badge [color]="openFull() ? 'green' : 'yellow'">{{ openCount() }}/{{ MAX }}</nf-badge>
              </div>

              <div class="cp-seats" [class.is-complete]="openFull()">
                @for (slot of seatSlots(); track $index) {
                  @if (slot; as m) {
                    <div class="cp-seat" [class.cp-seat--captain]="m.owner">
                      <span class="cp-seat__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                      <span class="cp-seat__meta">
                        <span class="cp-seat__name nf-mono">{{ m.name }}</span>
                        <span class="cp-seat__role nf-mono">{{ m.owner ? 'CAPITÁN · ABRIÓ LA SALA' : 'APUNTADO' }}</span>
                        @if (badgesOf(m.name); as bs) {
                          @if (bs.length) {
                            <div class="mbadges mbadges--tight">
                              @for (b of bs; track b.id) {
                                <span class="mbadge" [attr.data-color]="b.color" [title]="b.title + ' · ' + b.detail">{{ b.glyph }}</span>
                              }
                            </div>
                          }
                        }
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
                  <div class="cp-room__ready nf-mono">
                    <span class="cp-room__ready-glyph">✓</span>
                    SALA COMPLETA · LISTA PARA CONFIGURAR Y LANZAR
                  </div>
                }
              </div>
            </nf-window>

            <div class="cp-foot">
              <button nfButton variant="ghost" size="md" (click)="resetMode()">← MODO</button>
              <div class="cp-foot__status nf-mono">{{ openCount() }}/{{ MAX }} APUNTADOS</div>
              <button
                nfButton
                variant="primary"
                size="md"
                class="cp-cta"
                [class.cp-cta--ready]="openFull()"
                [disabled]="!openFull()"
                (click)="continueToRestrictions()"
              >CONTINUAR A RESTRICCIONES ►</button>
            </div>
          }
        </div>

        @if (discarding()) {
          <div class="modal-overlay" (click)="discarding.set(false)">
            <div class="modal" (click)="$event.stopPropagation()">
              <nf-window title="descartar_borrador.exe" accent="pink" bodyPadding="24px">
                <div class="settings-eyebrow nf-mono">// DESCARTAR BORRADOR</div>
                <p class="remove-msg">¿Seguro que quieres descartar esta partida a medias?</p>
                <div class="remove-warn nf-mono">
                  ⚠ Se borrará la configuración y la sala dejará de aparecer en el grupo.
                  Esto no se puede deshacer. (Si solo quieres seguir luego, sal con “Volver al grupo”.)
                </div>
                <div class="form-foot">
                  <button nfButton variant="ghost" size="md" (click)="discarding.set(false)">CANCELAR</button>
                  <button nfButton variant="danger" size="md" (click)="discardDraft()">DESCARTAR</button>
                </div>
              </nf-window>
            </div>
          </div>
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
export class GrupoCrearPartida {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly groups = inject(GroupStore);
  private readonly matches = inject(MatchStore);

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

  /** The five playable roles (key matches member-detail roles; label is the short chip). */
  readonly lineRolesList: RoleFilter[] = [
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

  /**
   * Reconfigure mode (Vía 2 "con restricciones"): reached from the sala with
   * ?reconfigure=<roomId>. Pre-loads the room's 10 players + reserved champs and
   * jumps to the restriction steps; on launch it UPDATES that room's lineup
   * (setTeams) instead of creating a new draft/match.
   */
  readonly reconfigureRoomId = signal<string | null>(
    this.route.snapshot.queryParamMap.get('reconfigure'),
  );

  /**
   * Open mode has two phases: `filling` (the waiting room collects sign-ups) and
   * `configuring` (once full, the admin runs the SAME restriction steps 2-5 as
   * manual mode, on the 10 players who joined).
   */
  readonly openPhase = signal<'filling' | 'configuring'>('filling');

  /** The step wizard (breadcrumb + steps) renders for manual, or open-configuring. */
  readonly showStepWizard = computed(
    () => this.mode() === 'manual' || (this.mode() === 'open' && this.openPhase() === 'configuring'),
  );

  chooseMode(m: CreateMode): void {
    // Both modes create a persistent room the group can follow: an open room that
    // fills up, or a "drafting" room the admin configures live. Seat 0 = captain.
    const g = this.group();
    const captain = this.roster()[0];
    if (g && captain) {
      const room = m === 'open' ? this.matches.openRoom(g.id, captain) : this.matches.startDraft(g.id, captain);
      this.roomId.set(room.id);
      // Resuming an abandoned draft: rehydrate the wizard from its raw state.
      if (m === 'manual' && room.draft?.raw.selectedTags.length) this.hydrateFromDraft(room.draft.raw);
    }
    if (m === 'open') this.openPhase.set('filling');
    this.mode.set(m);
  }

  /** Once the open room is full, carry its 10 players into the restriction steps. */
  continueToRestrictions(): void {
    if (!this.openFull()) return;
    this.selected.set(new Set(this.seats().map((m) => m.tag)));
    this.step.set(2);
    this.openPhase.set('configuring');
  }

  /** Restore the wizard's signals from a persisted draft (resume after leaving). */
  private hydrateFromDraft(raw: DraftRaw): void {
    this.selected.set(new Set(raw.selectedTags));
    this.lineRoles.set({ ...raw.lineRoles });
    this.rules.set(raw.rules.map((r) => ({ ...r })));
    this.ruleSeq = raw.rules.reduce((max, r) => Math.max(max, r.id), 0);
    this.reserved.set({ ...raw.reserved });
    this.step.set(raw.step || 1);
  }

  resetMode(): void {
    const id = this.roomId();
    // Open rooms are cancelled when you back out. Manual drafts are KEPT so the
    // admin can resume later (auto-pruned after 24h) — see MatchStore.startDraft.
    if (id && this.mode() === 'open') this.matches.remove(id);
    this.roomId.set(null);
    this.mode.set(null);
  }

  // --- Discard the in-progress draft (explicit, vs. leaving to resume later) --
  readonly discarding = signal(false);

  /** Permanently delete the draft room and leave (distinct from "leave & resume"). */
  discardDraft(): void {
    const id = this.roomId();
    const g = this.group();
    if (id) this.matches.remove(id);
    this.roomId.set(null);
    this.discarding.set(false);
    this.router.navigate(['/app', 'grupos', g ? g.id : '']);
  }

  // --- Wizard navigation (manual mode) ---------------------------------------
  readonly step = signal(1);

  readonly currentStep = computed(() => this.steps[this.step() - 1]);
  readonly windowTitle = computed(
    () => `paso_${this.step()}_${this.currentStep().label.toLowerCase().replace(/[^a-z]+/g, '_')}.exe`,
  );

  goStep(n: number): void {
    if (n > this.step()) return;
    // In open mode, "step 1 / participants" is the fill phase, not the picker.
    if (this.mode() === 'open' && this.openPhase() === 'configuring' && n === 1) {
      this.openPhase.set('filling');
      return;
    }
    this.step.set(n);
  }

  next(): void {
    if (!this.canStepContinue() || this.step() >= this.steps.length) return;
    const target = this.step() + 1;
    this.step.set(target);
    if (target === this.steps.length) this.runGeneration(); // matchmaking loader
  }

  /** Footer primary action: advance, or launch on the final step. */
  onPrimary(): void {
    if (this.step() === this.steps.length) this.launch();
    else this.next();
  }

  /**
   * Can the user skip the optional restriction steps and jump straight to LANZAR?
   * Only when the lineup is complete and the config-so-far is launch-valid: lines
   * feasible (defaults to profile roles), and no contradictory rules / duplicate
   * champ reservations. Steps left untouched keep their valid empty defaults.
   */
  readonly canSkipToLaunch = computed(
    () =>
      this.count() === this.MAX &&
      this.lineMatch().ok &&
      this.ruleErrors().length === 0 &&
      this.champErrors().length === 0,
  );

  /** Jump past the (optional) restriction steps directly to the launch step. */
  skipToLaunch(): void {
    if (!this.canSkipToLaunch() || this.step() >= this.steps.length) return;
    this.step.set(this.steps.length);
    this.runGeneration(); // matchmaking loader, same as reaching it via "Siguiente"
  }

  /**
   * "Back": in open-configuring, step 2 returns to the waiting room (fill phase);
   * in manual, step 1 returns to the mode chooser; otherwise the previous step.
   */
  back(): void {
    clearTimeout(this.genTimer);
    this.generating.set(false);
    // Reconfigure: there's no mode chooser/draft — backing out returns to the sala.
    const rc = this.reconfigureRoomId();
    if (rc) {
      if (this.step() <= 2) this.exitReconfigure(rc);
      else this.step.update((s) => s - 1);
      return;
    }
    if (this.mode() === 'open' && this.openPhase() === 'configuring') {
      if (this.step() <= 2) this.openPhase.set('filling');
      else this.step.update((s) => s - 1);
      return;
    }
    if (this.step() === 1) {
      this.resetMode();
      return;
    }
    this.step.update((s) => s - 1);
  }

  private exitReconfigure(roomId: string): void {
    const g = this.group();
    this.router.navigate(['/app', 'grupos', g ? g.id : '', 'partidas', roomId]);
  }

  /** Whether the current step is complete enough to advance. */
  readonly canStepContinue = computed(() => {
    if (this.step() === 1) return this.count() === this.MAX;
    if (this.step() === 2) return this.lineMatch().ok; // can't advance with an impossible 5v5
    if (this.step() === 3) return this.ruleErrors().length === 0; // no contradictory rules
    if (this.step() === 4) return this.champErrors().length === 0; // no duplicate reservations
    if (this.step() === 5) return !this.generating() && !this.launching(); // wait for matchmaking
    return true;
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

  /** Name → accolade badges for this group's roster, shared with ranking/member list. */
  readonly badges = computed(() => {
    const g = this.group();
    return g ? badgesFor(g.id, this.groups.rosterOf(g.id)) : new Map<string, MemberBadge[]>();
  });

  badgesOf(name: string): MemberBadge[] {
    return this.badges().get(name) ?? [];
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

  // --- Step 2: line restrictions ---------------------------------------------
  /**
   * Explicit per-match role selection per player (tag -> role keys). When a player
   * has no entry, their chips are pre-shown from their profile roles and that's
   * what the algorithm uses; the captain only writes here when they tweak it.
   */
  readonly lineRoles = signal<Record<string, string[]>>({});

  /** Short chip label for a role key (JUNGLA -> JG, SUPPORT -> SUP). */
  roleShort(key: string): string {
    return this.lineRolesList.find((r) => r.key === key)?.label ?? key;
  }

  /** Raw profile roles from the member card (may be ['FLEX'] or specific roles). */
  private rawProfile(tag: string): string[] {
    return this.memberRoles().get(tag) ?? [];
  }

  /** Profile roles expanded to concrete role keys (FLEX -> all five). */
  profileRolesOf(tag: string): string[] {
    const raw = this.rawProfile(tag);
    return raw.includes('FLEX') ? this.lineRolesList.map((r) => r.key) : raw;
  }

  /** Active roles for this match — defaults to (and is pre-shown as) the profile. */
  selectionOf(tag: string): string[] {
    return this.lineRoles()[tag] ?? this.profileRolesOf(tag);
  }

  isActive(tag: string, role: string): boolean {
    return this.selectionOf(tag).includes(role);
  }

  /** True once the captain has changed the selection away from the profile default. */
  isCustom(tag: string): boolean {
    const explicit = this.lineRoles()[tag];
    if (!explicit) return false;
    const prof = this.profileRolesOf(tag);
    if (explicit.length !== prof.length) return true;
    const set = new Set(prof);
    return !explicit.every((r) => set.has(r));
  }

  /** The roles the algorithm will actually consider for this player this match. */
  private effectiveRolesOf(tag: string): string[] {
    return this.selectionOf(tag);
  }

  toggleLine(tag: string, role: string): void {
    const cur = this.selectionOf(tag);
    let next: string[];
    if (cur.includes(role)) {
      if (cur.length <= 1) return; // keep at least one playable role
      next = cur.filter((r) => r !== role);
    } else {
      next = [...cur, role];
    }
    this.lineRoles.update((m) => ({ ...m, [tag]: next }));
  }

  /** Drop the explicit selection so the player falls back to their profile roles. */
  resetLine(tag: string): void {
    this.lineRoles.update((m) => {
      const next = { ...m };
      delete next[tag];
      return next;
    });
  }

  /** How many of the 10 players can fill each role (each role needs 2). */
  readonly lineCoverage = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const r of this.lineRolesList) counts[r.key] = 0;
    for (const m of this.selectedMembers()) {
      for (const role of this.effectiveRolesOf(m.tag)) {
        if (role in counts) counts[role]++;
      }
    }
    return counts;
  });

  /**
   * Can the 10 players be assigned to the 5 roles (2 slots each) at all? Uses a
   * small bipartite matching (Kuhn's). Returns which players, if any, are left
   * unmatched so we can name them in the diagnostics.
   */
  readonly lineMatch = computed<{ ok: boolean; unmatched: string[] }>(() => {
    const players = this.selectedMembers().map((m) => ({
      tag: m.tag,
      roles: new Set(this.effectiveRolesOf(m.tag)),
    }));
    // Two slots per role.
    const slots: string[] = [];
    for (const r of this.lineRolesList) {
      slots.push(r.key, r.key);
    }
    const slotToPlayer: (number | null)[] = new Array(slots.length).fill(null);
    const matched: boolean[] = new Array(players.length).fill(false);

    const tryAssign = (pi: number, seen: boolean[]): boolean => {
      for (let s = 0; s < slots.length; s++) {
        if (seen[s] || !players[pi].roles.has(slots[s])) continue;
        seen[s] = true;
        if (slotToPlayer[s] === null || tryAssign(slotToPlayer[s] as number, seen)) {
          slotToPlayer[s] = pi;
          return true;
        }
      }
      return false;
    };

    for (let pi = 0; pi < players.length; pi++) {
      if (tryAssign(pi, new Array(slots.length).fill(false))) matched[pi] = true;
    }
    const unmatched = players.filter((_, i) => !matched[i]).map((p) => p.tag);
    return { ok: unmatched.length === 0, unmatched };
  });

  readonly unmatchedTags = computed(() => this.lineMatch().unmatched);

  private nameOf(tag: string): string {
    return this.selectedMembers().find((m) => m.tag === tag)?.name ?? tag;
  }

  /** Hard problems that make a valid 5v5 impossible (block "Siguiente"). */
  readonly lineErrors = computed<string[]>(() => {
    const errs: string[] = [];
    const cov = this.lineCoverage();
    for (const r of this.lineRolesList) {
      if (cov[r.key] < 2) {
        errs.push(`Falta quién juegue ${r.label}: solo ${cov[r.key]} puede(n), necesitas 2.`);
      }
    }
    // More than 2 players locked to the exact same single role.
    const pinned: Record<string, number> = {};
    for (const m of this.selectedMembers()) {
      const sel = this.selectionOf(m.tag);
      if (sel.length === 1) pinned[sel[0]] = (pinned[sel[0]] ?? 0) + 1;
    }
    for (const r of this.lineRolesList) {
      if ((pinned[r.key] ?? 0) > 2) {
        errs.push(`${pinned[r.key]} jugadores fijados a ${r.label}, pero solo caben 2.`);
      }
    }
    // Anything the matching catches that the coarse checks didn't.
    if (!this.lineMatch().ok && errs.length === 0) {
      for (const tag of this.unmatchedTags()) {
        errs.push(`${this.nameOf(tag)} no encaja en ninguna línea libre con estas restricciones.`);
      }
    }
    return errs;
  });

  /** Soft problems: feasible but likely to hurt match quality (warn, don't block). */
  readonly lineWarnings = computed<string[]>(() => {
    const warns: string[] = [];
    const cov = this.lineCoverage();
    for (const r of this.lineRolesList) {
      if (cov[r.key] === 2) warns.push(`Justo 2 para ${r.label}: el balanceo tendrá poco margen ahí.`);
    }
    const pins = this.selectedMembers().filter((m) => this.selectionOf(m.tag).length === 1).length;
    if (pins >= 6) {
      warns.push(`Muchas líneas fijadas (${pins}/10): el algoritmo tendrá poco margen para equilibrar.`);
    }
    return warns;
  });

  // --- Step 3: player relationship rules -------------------------------------
  readonly ruleKinds: { key: RuleKind; label: string; icon: string; hint: string }[] = [
    {
      key: 'together',
      label: 'JUNTOS',
      icon: '🤝',
      hint: 'Toca 2 o 3 jugadores que irán en el MISMO equipo.',
    },
    {
      key: 'versus',
      label: 'EN CONTRA',
      icon: '⚔',
      hint: 'Forma dos bandos: toca un jugador para A, otra vez para B. Cada bando va a un equipo (1-3 por lado).',
    },
    {
      key: 'lane',
      label: 'DUELO DE LÍNEA',
      icon: '🎯',
      hint: 'Toca 1 jugador para A y 1 para B: se enfrentarán en la MISMA línea.',
    },
  ];

  readonly rules = signal<MatchRule[]>([]);
  private ruleSeq = 0;

  // Inline rule builder. A versus/lane rule has two sides (A vs B); together uses A only.
  readonly builderKind = signal<RuleKind>('together');
  readonly builderPick = signal<Record<string, 'a' | 'b'>>({});

  /** Max players per side for the current kind. */
  private sideMax(kind: RuleKind): { a: number; b: number } {
    if (kind === 'together') return { a: 3, b: 0 };
    if (kind === 'lane') return { a: 1, b: 1 };
    return { a: 3, b: 3 }; // versus
  }

  readonly builderA = computed(() =>
    Object.entries(this.builderPick()).filter(([, s]) => s === 'a').map(([t]) => t),
  );
  readonly builderB = computed(() =>
    Object.entries(this.builderPick()).filter(([, s]) => s === 'b').map(([t]) => t),
  );
  readonly builderHint = computed(() => this.ruleKinds.find((k) => k.key === this.builderKind())?.hint ?? '');
  readonly builderTwoSided = computed(() => this.builderKind() !== 'together');
  readonly builderValid = computed(() => {
    const a = this.builderA().length;
    const b = this.builderB().length;
    switch (this.builderKind()) {
      case 'together':
        return a >= 2 && a <= 3;
      case 'lane':
        return a === 1 && b === 1;
      default:
        return a >= 1 && a <= 3 && b >= 1 && b <= 3; // versus
    }
  });

  setBuilderKind(kind: RuleKind): void {
    this.builderKind.set(kind);
    this.builderPick.set({}); // reset selection when switching type
  }

  readonly sideMaxA = computed(() => this.sideMax(this.builderKind()).a);
  readonly sideMaxB = computed(() => this.sideMax(this.builderKind()).b);

  pickOf(tag: string): 'a' | 'b' | null {
    return this.builderPick()[tag] ?? null;
  }

  /** True when this side is full and the player isn't already on it. */
  sideFull(tag: string, side: 'a' | 'b'): boolean {
    if (this.pickOf(tag) === side) return false;
    const count = side === 'a' ? this.builderA().length : this.builderB().length;
    return count >= this.sideMax(this.builderKind())[side];
  }

  /** One-click side assignment: tap a side to set it, tap the active side to clear. */
  assignSide(tag: string, side: 'a' | 'b'): void {
    if (this.pickOf(tag) === side) {
      this.builderPick.update((m) => {
        const next = { ...m };
        delete next[tag];
        return next;
      });
      return;
    }
    if (this.sideFull(tag, side)) return;
    this.builderPick.update((m) => ({ ...m, [tag]: side }));
  }

  addRule(): void {
    if (!this.builderValid()) return;
    this.rules.update((rs) => [
      ...rs,
      { id: ++this.ruleSeq, kind: this.builderKind(), a: [...this.builderA()], b: [...this.builderB()] },
    ]);
    this.builderPick.set({});
  }

  removeRule(id: number): void {
    this.rules.update((rs) => rs.filter((r) => r.id !== id));
  }

  ruleMeta(kind: RuleKind): { label: string; icon: string } {
    const k = this.ruleKinds.find((x) => x.key === kind);
    return { label: k?.label ?? '', icon: k?.icon ?? '' };
  }

  /** Render a rule's players: "A + B" for together, "A1 + A2 vs B1" for versus/lane. */
  rulePlayers(r: MatchRule): string {
    const names = (tags: string[]) => tags.map((t) => this.nameOf(t)).join(' + ');
    return r.kind === 'together' ? names(r.a) : `${names(r.a)} vs ${names(r.b)}`;
  }

  /** Hard problems with the rule set (block "Siguiente"). */
  readonly ruleErrors = computed<string[]>(() => {
    const rs = this.rules();
    const errs = new Set<string>();

    // Union-find: members of any same-team block share a root. A "together" rule
    // is one block; each side of a versus/lane rule is also a same-team block.
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root) as string;
      parent.set(x, root);
      return root;
    };
    const union = (a: string, b: string) => parent.set(find(a), find(b));

    const sameTeamBlocks: string[][] = [];
    for (const r of rs) {
      if (r.kind === 'together') sameTeamBlocks.push(r.a);
      else {
        sameTeamBlocks.push(r.a);
        sameTeamBlocks.push(r.b);
      }
    }
    for (const block of sameTeamBlocks) {
      for (let i = 1; i < block.length; i++) union(block[0], block[i]);
    }

    // A same-team component bigger than a team (5) can't fit.
    const sizes = new Map<string, number>();
    for (const t of new Set(sameTeamBlocks.flat())) {
      const root = find(t);
      sizes.set(root, (sizes.get(root) ?? 0) + 1);
    }
    for (const size of sizes.values()) {
      if (size > 5) errs.add(`Demasiados jugadores obligados al mismo equipo (${size}): el máximo es 5.`);
    }

    for (const r of rs) {
      if (r.kind === 'together') continue;
      // A player can't be on both sides of the same matchup.
      const overlap = r.a.filter((t) => r.b.includes(t));
      for (const t of overlap) {
        errs.add(`${this.nameOf(t)} no puede estar en los dos bandos del mismo enfrentamiento.`);
      }
      // Every A vs B pairing must end up on opposite teams.
      for (const a of r.a) {
        for (const b of r.b) {
          if (find(a) === find(b)) {
            errs.add(`${this.nameOf(a)} y ${this.nameOf(b)} no pueden ir juntos y en contra a la vez.`);
          }
        }
      }
    }

    // A lane duel (1 vs 1) needs a shared playable line (from step 2).
    for (const r of rs) {
      if (r.kind !== 'lane') continue;
      const a = r.a[0];
      const b = r.b[0];
      const common = this.selectionOf(a).filter((role) => this.selectionOf(b).includes(role));
      if (common.length === 0) {
        errs.add(`${this.nameOf(a)} y ${this.nameOf(b)} no comparten ninguna línea: no pueden enfrentarse en la misma.`);
      }
    }

    return [...errs];
  });

  /** Soft problems: allowed but worth flagging. */
  readonly ruleWarnings = computed<string[]>(() => {
    const warns: string[] = [];
    if (this.rules().length >= 5) {
      warns.push(`Muchas reglas (${this.rules().length}): el algoritmo tendrá poco margen para equilibrar.`);
    }
    return warns;
  });

  // --- Step 4: champion reservations (OTP = protected from bans) --------------
  /** tag -> reserved champion name. Reserving = guaranteed pick + can't be banned. */
  readonly reserved = signal<Record<string, string>>({});
  /** Which player's champion picker is open (one at a time), or null. */
  readonly pickerTag = signal<string | null>(null);
  readonly champSearch = signal('');

  champByName(name: string): Champion | undefined {
    return CHAMPIONS.find((c) => c.name === name);
  }

  reservedOf(tag: string): Champion | null {
    const name = this.reserved()[tag];
    return name ? this.champByName(name) ?? null : null;
  }

  /** Recommended champions = the player's top champs from their profile card. */
  mainsOf(tag: string): Champion[] {
    const m = this.selectedMembers().find((x) => x.tag === tag);
    return m ? memberDetail(m, this.roster()).champions : [];
  }

  /**
   * Champion search results (capped). The pool is huge in the real game, so we
   * only ever render matches for a query — never the whole list at once.
   */
  readonly champPool = computed<Champion[]>(() => {
    const q = this.champSearch().trim().toLowerCase();
    if (!q) return [];
    return CHAMPIONS.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 24);
  });

  champGradient(c: Champion): string {
    return `linear-gradient(135deg, ${c.c1}, ${c.c2})`;
  }

  togglePicker(tag: string): void {
    this.champSearch.set('');
    this.pickerTag.update((t) => (t === tag ? null : tag));
  }

  reserveChamp(tag: string, name: string): void {
    this.reserved.update((m) => ({ ...m, [tag]: name }));
    this.pickerTag.set(null);
  }

  clearReserve(tag: string): void {
    this.reserved.update((m) => {
      const next = { ...m };
      delete next[tag];
      return next;
    });
  }

  readonly reservedCount = computed(() => Object.keys(this.reserved()).length);

  /** Two players can't reserve the same champion (only one pick per game). */
  readonly champErrors = computed<string[]>(() => {
    const byChamp = new Map<string, string[]>();
    for (const [tag, name] of Object.entries(this.reserved())) {
      byChamp.set(name, [...(byChamp.get(name) ?? []), tag]);
    }
    const errs: string[] = [];
    for (const [name, tags] of byChamp) {
      if (tags.length > 1) {
        errs.push(`${tags.map((t) => this.nameOf(t)).join(' y ')} han reservado ${name}: un campeón solo lo puede jugar uno.`);
      }
    }
    return errs;
  });

  readonly champWarnings = computed<string[]>(() => {
    const warns: string[] = [];
    const n = this.reservedCount();
    if (n >= 8) warns.push(`${n} campeones reservados: quedan muy pocos para banear.`);
    return warns;
  });

  // --- Step 5: generated teams + launch --------------------------------------
  /** Bumped by "rebalancear" to reshuffle into a different valid split. */
  readonly teamSeed = signal(1);
  /** Simulated backend latency: matchmaking the split / creating the lobby. */
  readonly generating = signal(false);
  readonly launching = signal(false);
  private genTimer?: ReturnType<typeof setTimeout>;
  private launchTimer?: ReturnType<typeof setTimeout>;

  /** Show the matchmaking loader briefly, as the backend would take a moment. */
  private runGeneration(): void {
    clearTimeout(this.genTimer);
    this.generating.set(true);
    this.genTimer = setTimeout(() => this.generating.set(false), 1300);
  }

  readonly customLineCount = computed(
    () => this.selectedMembers().filter((m) => this.isCustom(m.tag)).length,
  );

  elo(tag: string): number {
    return internalElo(tag);
  }

  /** Build the Blue-vs-Red preview for the current seed (shared matchmaking module). */
  readonly generated = computed<GeneratedTeams>(() => {
    const members = this.selectedMembers();
    const empty: GeneratedTeams = { blue: [], red: [], satisfied: 0, total: this.rules().length };
    if (members.length < this.MAX) return empty;

    const players: MatchmakePlayer[] = members.map((m) => ({
      tag: m.tag,
      roles: this.effectiveRolesOf(m.tag),
      elo: this.elo(m.tag),
    }));
    const rules: MatchmakeRule[] = this.rules().map((r) => ({ kind: r.kind, a: r.a, b: r.b }));
    const res = matchmake(players, rules, this.teamSeed());
    if (!res) return empty;

    const byTag = new Map(members.map((m) => [m.tag, m]));
    const toSlot = (s: MatchmakeSlot): TeamSlot => {
      const m = byTag.get(s.tag) as Member;
      return { roleKey: s.roleKey, roleLabel: this.roleShort(s.roleKey), member: m, champ: this.reservedOf(m.tag) };
    };
    return {
      blue: res.slots.filter((s) => s.team === 'blue').map(toSlot),
      red: res.slots.filter((s) => s.team === 'red').map(toSlot),
      satisfied: res.satisfied,
      total: res.total,
    };
  });

  /** Aggregate elo per team plus the tilt of the scale, for the balance bar. */
  readonly teamElo = computed(() => {
    const g = this.generated();
    const sum = (slots: TeamSlot[]) => slots.reduce((a, s) => a + this.elo(s.member.tag), 0);
    const blue = sum(g.blue);
    const red = sum(g.red);
    const total = blue + red;
    return { blue, red, diff: blue - red, blueShare: total ? blue / total : 0.5 };
  });

  /** Human verdict shown over the bar (balanced, or which side it favours). */
  readonly balanceVerdict = computed(() => {
    const d = this.teamElo().diff;
    if (Math.abs(d) <= 15) return { text: 'EQUILIBRADO', side: 'even' as const };
    return { text: `+${Math.abs(d)}`, side: d > 0 ? ('blue' as const) : ('red' as const) };
  });

  reroll(): void {
    this.teamSeed.update((s) => s + 1);
    this.runGeneration();
  }

  /**
   * Launch the match: simulate a short backend round-trip (creating the lobby),
   * then persist a live manual room and redirect to its lobby placeholder.
   */
  launch(): void {
    if (this.launching()) return;
    const g = this.group();
    if (!g) return;
    const rc = this.reconfigureRoomId();
    // Reconfigure: update the existing room's lineup (no new room), then go back.
    const id = rc ?? this.roomId();
    if (!id) return;
    clearTimeout(this.launchTimer);
    this.launching.set(true);
    this.launchTimer = setTimeout(() => {
      if (rc) {
        this.matches.setTeams(rc, this.toRoomTeams());
      } else {
        // Promote the same drafting room to live with the generated lineup frozen on.
        this.matches.promoteToLive(id, this.toRoomTeams());
      }
      this.router.navigate(['/app', 'grupos', g.id, 'partidas', id]);
    }, 1700);
  }

  /** Convert the generated preview into the display-ready lineup stored on the room. */
  private toRoomTeams(): RoomTeams {
    const g = this.generated();
    const conv = (s: TeamSlot): RoomTeamSlot => ({
      roleKey: s.roleKey,
      roleLabel: s.roleLabel,
      member: s.member,
      elo: this.elo(s.member.tag),
      champ: s.champ
        ? { name: s.champ.name, initials: s.champ.initials, c1: s.champ.c1, c2: s.champ.c2 }
        : null,
    });
    return { blue: g.blue.map(conv), red: g.red.map(conv) };
  }

  // --- Open mode: waiting room (persisted in MatchStore) ---------------------
  /** Id of the open room being filled, or null before "sala abierta" is chosen. */
  readonly roomId = signal<string | null>(null);

  /** Seats taken so far; seat 0 is always the captain who opened the room. */
  readonly seats = computed<Member[]>(() => {
    const id = this.roomId();
    return id ? this.matches.byId(id)?.seats ?? [] : [];
  });
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
    const id = this.roomId();
    const next = this.openPool()[0];
    if (id && next) this.matches.addSeat(id, next);
  }

  /** Free a seat (the captain's seat can't be vacated). */
  leaveSeat(m: Member): void {
    const id = this.roomId();
    if (m.owner || !id) return;
    this.matches.removeSeat(id, m.tag);
  }

  /** Display-ready snapshot of the current config, streamed to followers. */
  private buildSnapshot(): DraftSnapshot {
    const players = this.selectedMembers();
    return {
      step: this.step(),
      participants: players,
      lines: players.map((m) => ({
        tag: m.tag,
        name: m.name,
        initials: m.initials,
        hue: m.hue,
        roles: this.selectionOf(m.tag).map((r) => this.roleShort(r)),
      })),
      rules: this.rules().map((r) => ({
        kind: r.kind,
        aNames: r.a.map((t) => this.nameOf(t)),
        bNames: r.b.map((t) => this.nameOf(t)),
      })),
      reserved: Object.entries(this.reserved()).map(([tag, name]) => {
        const c = this.champByName(name);
        return {
          tag,
          name: this.nameOf(tag),
          champ: name,
          champInitials: c?.initials ?? '',
          champC1: c?.c1 ?? '',
          champC2: c?.c2 ?? '',
        };
      }),
      // Raw editor state so the wizard can resume this draft losslessly later.
      raw: {
        step: this.step(),
        selectedTags: [...this.selected()],
        lineRoles: this.lineRoles(),
        rules: this.rules().map((r) => ({ id: r.id, kind: r.kind, a: r.a, b: r.b })),
        reserved: this.reserved(),
      },
    };
  }

  constructor() {
    // Keep the shell header/sidebar in sync with the active group on deep-link.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });

    // Stream the manual draft live so non-admins can follow it in the room. (Skipped
    // in reconfigure mode, which has no draft room and roomId stays null.)
    effect(() => {
      if (this.mode() !== 'manual') return;
      const id = this.roomId();
      if (id) this.matches.syncDraft(id, this.buildSnapshot());
    });

    this.initReconfigure();
  }

  /**
   * When opened with ?reconfigure=<roomId>, pre-load that room's 10 players and
   * reserved champions, skip the mode chooser and jump straight to the restriction
   * steps. Launch then updates that room (see launch()).
   */
  private initReconfigure(): void {
    const rc = this.reconfigureRoomId();
    if (!rc) return;
    const room = this.matches.byId(rc);
    if (!room?.teams) {
      this.reconfigureRoomId.set(null); // stale link → behave like a normal create
      return;
    }
    const slots = [...room.teams.blue, ...room.teams.red];
    this.selected.set(new Set(slots.map((s) => s.member.tag)));
    const reserved: Record<string, string> = {};
    for (const s of slots) if (s.champ) reserved[s.member.tag] = s.champ.name;
    this.reserved.set(reserved);
    this.mode.set('manual');
    this.step.set(2);
  }
}
