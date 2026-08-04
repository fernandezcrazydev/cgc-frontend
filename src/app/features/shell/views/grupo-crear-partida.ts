import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfBadge, NfButton, NfSkeleton, NfWindow } from '../../../ui';
import { GroupBridge } from '../../../core/groups';
import { LobbiesStore, MAX_NOTE_LENGTH, MAX_SLOTS } from '../../../core/lobbies';
import { errorMessage } from '../../../core/http';
import { ToastService } from '../../../core/toast';
import { GroupStore } from '../../../core/group-store';
import { MatchStore, DraftSnapshot, DraftRaw, RoomTeams, RoomTeamSlot } from '../../../core/match-store';
import { Member } from '../../../core/lobby';
import { memberDetail } from '../../../core/member-detail';
import { MemberBadge, badgesFor } from '../../../core/group-badges';
import { ChampionSummary, GameDataStore } from '../../../core/game-data';
import { championTagLabel } from '../../../shared/champion-tags';
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
  /** Campeón reservado, o null. BACKEND NOTE: solo el id real de ddragon. */
  champ: { championId: number } | null;
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
  imports: [FormsModule, RouterLink, NfBadge, NfButton, NfWindow, NfAvatar, NfSkeleton],
  template: `
    <div class="view">
      @if (loading()) {
        <!-- El roster llega por HTTP: sin esto parpadearía un "FALTAN JUGADORES" falso. -->
        <div class="cp" aria-busy="true">
          <div class="cp-head">
            <div class="cp-head__titles"><nf-skeleton width="200px" height="30px" /></div>
          </div>
          <nf-window title="Crear partida" bodyPadding="0">
            <div class="cp-pad">
              <div class="cp-modes">
                <nf-skeleton width="100%" height="180px" radius="14px" />
                <nf-skeleton width="100%" height="180px" radius="14px" />
              </div>
            </div>
          </nf-window>
        </div>
      } @else if (bridge.status() === 'error') {
        <div class="empty-state">
          <div class="empty-state__icon">⚠</div>
          <div class="empty-state__text nf-mono">Error al cargar</div>
          <p class="empty-state__hint">No se pudieron cargar los miembros del grupo.</p>
          <button nfButton variant="secondary" size="md" (click)="retry()">Reintentar</button>
        </div>
      } @else if (group(); as g) {
        <div class="cp">
          <div class="cp-head">
            <div class="cp-head__titles">
              <h1 class="view__title">Crear partida</h1>
            </div>
            <div class="cp-head__actions">
              @if (mode() === 'manual' && !reconfigureRoomId()) {
                <button type="button" class="cp-discard nf-mono" (click)="discarding.set(true)">
                  ✕ Descartar
                </button>
              }
              <a class="view-back cp-back" [routerLink]="['/app', 'grupos', g.id]">
                <span class="view-back__arrow">←</span> Volver al grupo
              </a>
            </div>
          </div>

          @if (roster().length < MAX) {
            <!-- shared block: a 5v5 needs 10 group members regardless of mode -->
            <nf-window title="Crear partida" bodyPadding="0">
              <div class="cp-pad">
                <div class="empty-state">
                  <div class="empty-state__icon">⚠</div>
                  <div class="empty-state__text">Faltan jugadores</div>
                  <p class="empty-state__hint">
                    Necesitas al menos {{ MAX }} miembros en el grupo para crear una partida 5v5.
                    Ahora mismo sois {{ roster().length }}. Invita a más gente y vuelve.
                  </p>
                  <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id]">
                    ＋ Ir a invitar
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
                <div class="cp-mode__title nf-mono">Partida manual</div>
                <p class="cp-mode__desc">
                  Eliges tú a los 10 jugadores ahora y configuras las restricciones de una sentada.
                </p>
                <span class="cp-mode__cta nf-mono">Elegir</span>
              </button>
              <button type="button" class="cp-mode cp-mode--primary" (click)="chooseMode('open')">
                <div class="cp-mode__glyph">📣</div>
                <div class="cp-mode__title nf-mono">Sala abierta</div>
                <p class="cp-mode__desc">
                  Publicas una sala y los jugadores del grupo se apuntan desde sus cuentas.
                  Configuras las restricciones cuando se llena.
                </p>
                <span class="cp-mode__cta nf-mono">Elegir</span>
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

            <nf-window [title]="windowTitle()" bodyPadding="0">
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
                      Seleccionados · {{ count() }}/{{ MAX }}
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
                          <nf-badge color="primary">Owner</nf-badge>
                        }
                      </button>
                    } @empty {
                      <div class="cp-empty nf-mono">Sin resultados para ese filtro</div>
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
                    <div class="cp-cover__head nf-mono">Cobertura · cada línea necesita 2 jugadores</div>
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
                            {{ isCustom(m.tag) ? '◆ Personalizado' : '○ Perfil' }}
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
                        <span class="cp-rb__side cp-rb__side--a">Bando A · {{ builderA().length }}</span>
                        <span class="cp-rb__vs">vs</span>
                        <span class="cp-rb__side cp-rb__side--b">Bando B · {{ builderB().length }}</span>
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
                    >＋ Añadir regla</button>
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
                      Campeones reservados · {{ reservedCount() }}/{{ MAX }}
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
                          @if (reservedIdOf(m.tag); as rid) {
                            <button type="button" class="cp-reserved" [attr.aria-busy]="champsLoading() ? 'true' : null" (click)="togglePicker(m.tag)">
                              <nf-avatar
                                class="cp-reserved__icon"
                                [loading]="champsLoading()"
                                [src]="champion(rid)?.iconUrl ?? null"
                                [fallback]="championName(rid)"
                                [tint]="rid"
                                [size]="30"
                                shape="square"
                              />
                              @if (champsLoading()) {
                                <nf-skeleton width="70px" height="11px" />
                              } @else {
                                <span class="cp-reserved__name nf-mono">{{ championName(rid) }}</span>
                                <span class="cp-reserved__role nf-mono">{{ championRole(rid) }}</span>
                              }
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
                              <div class="cp-picker__label nf-mono">Resultados</div>
                              <div class="cp-picker__grid">
                                @for (c of champPool(); track c.id) {
                                  <button type="button" class="cp-champ-opt" (click)="reserveChamp(m.tag, c.id)">
                                    <nf-avatar class="cp-champ-opt__icon" [src]="c.iconUrl" [fallback]="c.name" [tint]="c.id" [size]="38" shape="square" />
                                    <span class="cp-champ-opt__meta">
                                      <span class="cp-champ-opt__name nf-mono">{{ c.name }}</span>
                                      <span class="cp-champ-opt__role nf-mono">{{ tagLabel(c) }}</span>
                                    </span>
                                  </button>
                                } @empty {
                                  <div class="cp-empty nf-mono">Sin campeones para esa búsqueda</div>
                                }
                              </div>
                            } @else {
                              @if (mainsOf(m.tag).length) {
                                <div class="cp-picker__label nf-mono">Sus mains · recomendados</div>
                                <div class="cp-picker__grid">
                                  @for (c of mainsOf(m.tag); track c.id) {
                                    <button type="button" class="cp-champ-opt" (click)="reserveChamp(m.tag, c.id)">
                                      <nf-avatar class="cp-champ-opt__icon" [src]="c.iconUrl" [fallback]="c.name" [tint]="c.id" [size]="38" shape="square" />
                                      <span class="cp-champ-opt__meta">
                                        <span class="cp-champ-opt__name nf-mono">{{ c.name }}</span>
                                        <span class="cp-champ-opt__role nf-mono">{{ tagLabel(c) }}</span>
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
                        <div class="cp-loader__title nf-mono">Lanzando partida…</div>
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
                        <div class="cp-loader__title nf-mono">Emparejando…</div>
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
                          Azul <b>{{ teamElo().blue }}</b>
                        </span>
                        <span class="cp-balance__verdict" [attr.data-side]="balanceVerdict().side">
                          @if (balanceVerdict().side === 'even') {
                            ⚖ {{ balanceVerdict().text }}
                          } @else {
                            {{ balanceVerdict().text }} {{ balanceVerdict().side === 'blue' ? 'Azul ◀' : '▶ Rojo' }}
                          }
                        </span>
                        <span class="cp-balance__team cp-balance__team--red">
                          <b>{{ teamElo().red }}</b> Rojo
                        </span>
                      </div>
                      <div class="cp-balance__bar">
                        <div class="cp-balance__fill" [style.width.%]="teamElo().blueShare * 100"></div>
                        <div class="cp-balance__mid" aria-hidden="true"></div>
                      </div>
                    </div>

                    <div class="cp-teams">
                      <div class="cp-team cp-team--blue">
                        <div class="cp-team__head nf-mono"><span class="cp-team__dot"></span> Equipo azul</div>
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
                              <span class="cp-slot__champ" title="Campeón reservado para este jugador" [attr.aria-busy]="champsLoading() ? 'true' : null">
                                <nf-avatar
                                  class="cp-slot__champ-icon"
                                  [loading]="champsLoading()"
                                  [src]="champion(c.championId)?.iconUrl ?? null"
                                  [fallback]="championName(c.championId)"
                                  [tint]="c.championId"
                                  [size]="26"
                                  shape="square"
                                />
                                @if (!champsLoading()) {
                                  <span class="cp-slot__champ-name nf-mono">{{ championName(c.championId) }}</span>
                                }
                              </span>
                            }
                          </div>
                        }
                      </div>

                      <div class="cp-team cp-team--red">
                        <div class="cp-team__head nf-mono"><span class="cp-team__dot"></span> Equipo rojo</div>
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
                              <span class="cp-slot__champ" title="Campeón reservado para este jugador" [attr.aria-busy]="champsLoading() ? 'true' : null">
                                <nf-avatar
                                  class="cp-slot__champ-icon"
                                  [loading]="champsLoading()"
                                  [src]="champion(c.championId)?.iconUrl ?? null"
                                  [fallback]="championName(c.championId)"
                                  [tint]="c.championId"
                                  [size]="26"
                                  shape="square"
                                />
                                @if (!champsLoading()) {
                                  <span class="cp-slot__champ-name nf-mono">{{ championName(c.championId) }}</span>
                                }
                              </span>
                            }
                          </div>
                        }
                      </div>
                    </div>

                    <div class="cp-teams__foot">
                      <button type="button" class="cp-reroll nf-mono" (click)="reroll()">↻ Rebalancear</button>
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
                      <div class="cp-stub__title nf-mono">Paso {{ step() }} · {{ currentStep().label }}</div>
                      <p class="cp-stub__hint">En construcción. Seguimos debatiendo este paso antes de montarlo.</p>
                      <div class="cp-stub__roster nf-mono">
                        Jugadores en la partida · {{ count() }}/{{ MAX }}
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
                  {{ step() === 1 ? '← Modo' : '← Atrás' }}
                </button>
                <div class="cp-foot__status nf-mono">
                  <span class="cp-foot__status-text">
                    @if (step() === 1) {
                      {{ count() }}/{{ MAX }} seleccionados
                    } @else if (step() === 2) {
                      {{ lineMatch().ok ? 'Líneas OK ✓' : 'Revisa las líneas ✗' }}
                    } @else if (step() === 3) {
                      {{ rules().length }} regla{{ rules().length === 1 ? '' : 's' }}{{ ruleErrors().length ? ' · revisa ✗' : '' }}
                    } @else if (step() === 4) {
                      {{ reservedCount() }} reservado{{ reservedCount() === 1 ? '' : 's' }}{{ champErrors().length ? ' · revisa ✗' : '' }}
                    }
                  </span>
                  @if (step() < steps.length && canSkipToLaunch()) {
                    <button
                      type="button"
                      class="cp-foot__skip nf-mono"
                      title="Saltar las restricciones (son opcionales) e ir directo a lanzar"
                      (click)="skipToLaunch()"
                    >⏩ Saltar y lanzar</button>
                  }
                </div>
                <button
                  nfButton
                  variant="primary"
                  size="md"
                  [disabled]="!canStepContinue()"
                  (click)="onPrimary()"
                >{{ step() === steps.length ? 'Lanzar partida' : 'Siguiente' }}</button>
              </div>
            }
          } @else {
            <!-- ===== MODO SALA ABIERTA · convocar proponiendo horas ===== -->
            <nf-window title="Convocar" bodyPadding="0">
              <div class="cp-room__bar">
                <div class="cp-room__barmeta">
                  <div class="cp-room__sub nf-mono">
                    Propón una o varias horas · el grupo dirá a cuáles puede
                  </div>
                </div>
                <nf-badge [color]="slotDrafts().length ? 'success' : 'warning'">
                  {{ slotDrafts().length }}/{{ MAX_SLOTS }}
                </nf-badge>
              </div>

              <div class="cp-pad">
                <div class="cp-cover__legend nf-mono">
                  La franja que junte {{ MAX }} jugadores se confirma sola y avisa a todos. Del
                  {{ MAX + 1 }} en adelante quedan de <b>suplentes</b>, y si alguien se cae entran ellos.
                </div>

                <!-- Paso 1 · el día. Tira horizontal deslizable: en un móvil se recorren dos
                     semanas con el pulgar sin abrir ningún calendario nativo. -->
                <div class="dp-step__label nf-mono">1 · ¿Qué día?</div>
                <div class="dp-days" role="tablist" aria-label="Elige el día">
                  @for (d of days(); track d.value) {
                    <button
                      type="button"
                      role="tab"
                      class="dp-day"
                      [class.is-active]="selectedDay() === d.value"
                      [class.has-picks]="countForDay(d.value) > 0"
                      [attr.aria-selected]="selectedDay() === d.value"
                      (click)="selectedDay.set(d.value)"
                    >
                      <span class="dp-day__weekday nf-mono">{{ d.weekday }}</span>
                      <span class="dp-day__number">{{ d.dayNumber }}</span>
                      <!-- Cuántas horas llevas elegidas ESE día. Sin esto, al cambiar de día
                           pierdes de vista lo que ya habías marcado en los otros. -->
                      <span class="dp-day__dots" aria-hidden="true">
                        @for (dot of dotsFor(d.value); track $index) {
                          <i></i>
                        }
                      </span>
                    </button>
                  }
                </div>

                <!-- Paso 2 · las horas de ese día. Rejilla que se refluye sola: cuatro por fila
                     en escritorio, dos o tres en un móvil, y todas con altura de dedo. -->
                <div class="dp-step__label nf-mono">2 · ¿A qué hora?</div>
                @if (hoursForSelectedDay().length) {
                  <div class="dp-hours">
                    @for (h of hoursForSelectedDay(); track h.value) {
                      <button
                        type="button"
                        class="dp-hour nf-mono"
                        [class.is-on]="slotDrafts().includes(h.value)"
                        [disabled]="!slotDrafts().includes(h.value) && atSlotLimit()"
                        [attr.aria-pressed]="slotDrafts().includes(h.value)"
                        (click)="toggleQuick(h.value)"
                      >{{ h.label }}</button>
                    }
                  </div>
                } @else {
                  <div class="dp-hours__empty nf-mono">
                    Hoy ya no quedan horas. Elige otro día arriba.
                  </div>
                }

                <details class="dp-custom">
                  <summary class="dp-custom__toggle nf-mono">Otra hora distinta</summary>
                  <div class="dp-custom__row">
                    <input
                      class="field__input dp-custom__time"
                      type="time"
                      step="300"
                      [ngModel]="timeDraft()"
                      (ngModelChange)="timeDraft.set($event)"
                      aria-label="Hora concreta"
                    />
                    <button
                      type="button"
                      class="dp-custom__add nf-mono"
                      [disabled]="!canAddSlot()"
                      (click)="addSlot()"
                    >Añadir a {{ selectedDayLabel() }}</button>
                  </div>
                </details>

                @if (slotError(); as e) {
                  <div class="cp-diag">
                    <div class="cp-diag__item cp-diag__item--err nf-mono">✗ {{ e }}</div>
                  </div>
                }

                <!-- El carrito: lo que se va a publicar, siempre visible y siempre quitable. -->
                <div class="dp-cart">
                  <div class="dp-cart__label nf-mono">
                    Vas a proponer · {{ slotDrafts().length }}/{{ MAX_SLOTS }}
                  </div>
                  <div class="dp-cart__list">
                    @for (slot of slotDrafts(); track slot) {
                      <button
                        type="button"
                        class="dp-cart__item nf-mono"
                        [attr.aria-label]="'Quitar ' + formatSlot(slot)"
                        (click)="removeSlot(slot)"
                      >
                        <span>{{ formatSlot(slot) }}</span>
                        <span class="dp-cart__x" aria-hidden="true">✕</span>
                      </button>
                    } @empty {
                      <span class="dp-cart__empty nf-mono">
                        Todavía nada. Toca una hora de arriba.
                      </span>
                    }
                  </div>
                </div>

                <input
                  class="field__input qh-note"
                  type="text"
                  placeholder="Nota para el grupo (opcional)"
                  [maxlength]="MAX_NOTE_LENGTH"
                  [ngModel]="note()"
                  (ngModelChange)="note.set($event)"
                />
              </div>
            </nf-window>

            <div class="cp-foot">
              <button nfButton variant="ghost" size="md" (click)="resetMode()">← Modo</button>
              <div class="cp-foot__status nf-mono">
                {{ slotDrafts().length }} hora{{ slotDrafts().length === 1 ? '' : 's' }} propuesta{{ slotDrafts().length === 1 ? '' : 's' }}
              </div>
              <button
                nfButton
                variant="primary"
                size="md"
                class="cp-cta"
                [class.cp-cta--ready]="slotDrafts().length > 0"
                [disabled]="!slotDrafts().length || lobbies.creating()"
                (click)="publishLobby()"
              >{{ lobbies.creating() ? 'Convocando…' : 'Convocar partida' }}</button>
            </div>
          }
        </div>

        @if (discarding()) {
          <div class="modal-overlay" (click)="discarding.set(false)">
            <div class="modal" (click)="$event.stopPropagation()">
              <nf-window title="Descartar borrador" bodyPadding="24px">
                <div class="settings-eyebrow nf-mono">Descartar borrador</div>
                <p class="remove-msg">¿Seguro que quieres descartar esta partida a medias?</p>
                <div class="remove-warn nf-mono">
                  ⚠ Se borrará la configuración y la sala dejará de aparecer en el grupo.
                  Esto no se puede deshacer. (Si solo quieres seguir luego, sal con “Volver al grupo”.)
                </div>
                <div class="form-foot">
                  <button nfButton variant="ghost" size="md" (click)="discarding.set(false)">Cancelar</button>
                  <button nfButton variant="danger" size="md" (click)="discardDraft()">Descartar</button>
                </div>
              </nf-window>
            </div>
          </div>
        }
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
        </div>
        <p class="empty-state__hint">Este grupo no existe o ya no eres miembro.</p>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← Volver a grupos</button>
      }
    </div>
  `,
})
export class GrupoCrearPartida {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly groups = inject(GroupStore);
  /** Trae del backend la identidad y el roster reales del grupo (puente temporal al mock). */
  readonly bridge = inject(GroupBridge);
  /** Convocatorias reales: el modo abierto ya no es maqueta. */
  readonly lobbies = inject(LobbiesStore);
  private readonly toasts = inject(ToastService);
  private readonly matches = inject(MatchStore);

  readonly MAX = 10;

  readonly steps: WizardStep[] = [
    { n: 1, label: 'Participantes' },
    { n: 2, label: 'Líneas' },
    { n: 3, label: 'Duos / tríos / vs' },
    { n: 4, label: 'Personajes' },
    { n: 5, label: 'Lanzar' },
  ];

  readonly roleFilters: RoleFilter[] = [
    { key: 'ALL', label: 'Todos' },
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

  /**
   * El grupo y sus miembros aún viajan. Cubre también `idle`: entrar por URL directa (F5) monta
   * esta vista sin pasar por el detalle, así que hasta que el efecto dispara no hay nada cargado
   * y pintar el gate del 5v5 con un roster vacío sería mentir.
   */
  readonly loading = computed(
    () => this.bridge.status() === 'loading' || this.bridge.status() === 'idle',
  );

  retry(): void {
    const id = this.id();
    if (id) void this.bridge.reload(id);
  }

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
   * El wizard de restricciones es solo del modo MANUAL.
   *
   * Antes el modo abierto desembocaba aquí al llenarse la sala. Ya no: una convocatoria vive en
   * el backend y se configura desde su propia sala cuando llegue esa fase. Mezclar las dos cosas
   * significaba que salir del wizard cancelaba una sala en la que había gente apuntada.
   */
  readonly showStepWizard = computed(() => this.mode() === 'manual');

  chooseMode(m: CreateMode): void {
    // Solo el modo MANUAL sigue creando una sala mock: es el wizard, que aún no está migrado.
    // El modo abierto ya no crea nada al entrar — la convocatoria nace en el backend cuando se
    // pulsa "Convocar", así que entrar a mirar el formulario y salirse no deja basura detrás.
    if (m === 'manual') {
      const g = this.group();
      const captain = this.roster()[0];
      if (g && captain) {
        const room = this.matches.startDraft(g.id, captain);
        this.roomId.set(room.id);
        // Resuming an abandoned draft: rehydrate the wizard from its raw state.
        if (room.draft?.raw.selectedTags.length) this.hydrateFromDraft(room.draft.raw);
      }
    }
    this.mode.set(m);
  }

  // --- Modo abierto: convocar proponiendo horas -------------------------------
  readonly MAX_SLOTS = MAX_SLOTS;
  readonly MAX_NOTE_LENGTH = MAX_NOTE_LENGTH;

  /** Horas propuestas, en el formato local de `datetime-local` ("2026-08-07T22:00"). */
  readonly slotDrafts = signal<string[]>([]);
  /** Hora del campo "otra hora distinta", para lo que se salga de la rejilla. */
  readonly timeDraft = signal('22:00');
  readonly note = signal('');
  readonly slotError = signal<string | null>(null);

  /**
   * Los días que se pueden proponer: dos semanas. Se calculan una vez al montar — nadie tiene
   * este formulario abierto el tiempo suficiente para que "hoy" cambie de significado, y hacerlo
   * reactivo al reloj costaría un temporizador a cambio de nada.
   */
  readonly days = signal<DayOption[]>(buildDays(new Date(), DAYS_AHEAD));

  /** El día cuya rejilla de horas se está mirando. Arranca en hoy. */
  readonly selectedDay = signal(this.days()[0].value);

  readonly atSlotLimit = computed(() => this.slotDrafts().length >= MAX_SLOTS);

  readonly canAddSlot = computed(() => !!this.timeDraft() && !this.atSlotLimit());

  /**
   * Las horas ofrecidas para el día elegido. Si es hoy, las que ya han pasado no aparecen:
   * ofrecerlas sería ofrecer un 400 `SLOT_IN_THE_PAST`.
   */
  readonly hoursForSelectedDay = computed(() => buildHours(this.selectedDay(), new Date()));

  /** "hoy" / "mañana" / "jue 6", para el botón de añadir una hora suelta. */
  readonly selectedDayLabel = computed(() => {
    const day = this.days().find((d) => d.value === this.selectedDay());
    return day ? day.longLabel : '';
  });

  /** Cuántas horas llevas elegidas de ese día, para el indicador del chip. */
  countForDay(dayValue: string): number {
    return this.slotDrafts().filter((slot) => slot.startsWith(`${dayValue}T`)).length;
  }

  /** Los puntitos del chip de día, topados para que un día con seis no reviente el diseño. */
  dotsFor(dayValue: string): number[] {
    return Array.from({ length: Math.min(3, this.countForDay(dayValue)) }, (_, i) => i);
  }

  /** Un toque añade la hora; otro la quita. El chip es el estado, no un botón de "añadir". */
  toggleQuick(value: string): void {
    if (this.slotDrafts().includes(value)) {
      this.removeSlot(value);
      return;
    }
    if (this.atSlotLimit()) return;
    this.slotError.set(null);
    this.slotDrafts.update((slots) => [...slots, value].sort());
  }

  addSlot(): void {
    if (!this.canAddSlot()) return;
    // La hora suelta se pega al día que está seleccionado arriba y produce el MISMO formato que
    // la rejilla, así que de aquí en adelante da igual por dónde entró: una sola lista.
    const value = `${this.selectedDay()}T${this.timeDraft()}`;
    if (new Date(value).getTime() <= Date.now()) {
      this.slotError.set('Esa hora ya ha pasado. Elige una futura.');
      return;
    }
    if (this.slotDrafts().includes(value)) {
      this.slotError.set('Ya has propuesto esa hora.');
      return;
    }
    this.slotError.set(null);
    this.slotDrafts.update((slots) => [...slots, value].sort());
  }

  removeSlot(value: string): void {
    this.slotDrafts.update((slots) => slots.filter((slot) => slot !== value));
    this.slotError.set(null);
  }

  /** "2026-08-07T22:00" → "jue 7 ago, 22:00", en la zona de quien mira. */
  formatSlot(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  /**
   * Publica la convocatoria. PESIMISTA: espera la confirmación del backend antes de navegar,
   * así nadie acaba en una sala que no llegó a existir. El botón queda bloqueado mientras
   * (`lobbies.creating()`), de modo que un doble clic no convoca dos partidas.
   */
  async publishLobby(): Promise<void> {
    const g = this.group();
    if (!g || !this.slotDrafts().length || this.lobbies.creating()) return;
    try {
      const created = await this.lobbies.create(g.id, {
        // El selector da hora local sin zona; el backend quiere instantes. La conversión la
        // hace `Date`, que ya sabe en qué zona está este navegador.
        slotStartTimes: this.slotDrafts().map((value) => new Date(value).toISOString()),
        note: this.note().trim() || null,
      });
      this.toasts.success('Partida convocada. Ya puede apuntarse el grupo.');
      this.router.navigate(['/app', 'grupos', g.id, 'partidas', created.id]);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
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
    // El borrador manual se CONSERVA para poder retomarlo (se poda solo a las 24 h, ver
    // MatchStore.startDraft). Del modo abierto no hay nada que deshacer: el formulario aún no
    // ha creado nada en el backend.
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
    () => `Paso ${this.step()} · ${this.currentStep().label}`,
  );

  goStep(n: number): void {
    if (n > this.step()) return;
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
   * "Back": step 1 returns to the mode chooser; otherwise the previous step.
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
      label: 'Juntos',
      icon: '🤝',
      hint: 'Toca 2 o 3 jugadores que irán en el MISMO equipo.',
    },
    {
      key: 'versus',
      label: 'En contra',
      icon: '⚔',
      hint: 'Forma dos bandos: toca un jugador para A, otra vez para B. Cada bando va a un equipo (1-3 por lado).',
    },
    {
      key: 'lane',
      label: 'Duelo de línea',
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
  /**
   * tag -> id real de ddragon reservado. Reserving = guaranteed pick + can't
   * be banned. BACKEND NOTE: forma final del DTO (el backend mandará el id);
   * la vista resuelve `id → ChampionSummary` con `GameDataStore.championById()`.
   */
  readonly reserved = signal<Record<string, number>>({});
  /** Which player's champion picker is open (one at a time), or null. */
  readonly pickerTag = signal<string | null>(null);
  readonly champSearch = signal('');

  private readonly gameData = inject(GameDataStore);
  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  champion(id: number): ChampionSummary | undefined {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  championRole(id: number): string {
    return this.tagLabel(this.champion(id));
  }

  tagLabel(c: ChampionSummary | undefined): string {
    const tag = c?.tags[0];
    return tag ? championTagLabel(tag) : '';
  }

  reservedIdOf(tag: string): number | null {
    return this.reserved()[tag] ?? null;
  }

  /** Recommended champions = the player's top champs from their profile card. */
  mainsOf(tag: string): ChampionSummary[] {
    const m = this.selectedMembers().find((x) => x.tag === tag);
    if (!m) return [];
    const byId = this.gameData.championById();
    return memberDetail(m, this.roster())
      .championIds.map((id) => byId.get(id))
      .filter((c): c is ChampionSummary => !!c);
  }

  /**
   * Champion search results (capped). The pool is huge in the real game, so we
   * only ever render matches for a query — never the whole list at once.
   */
  readonly champPool = computed<ChampionSummary[]>(() => {
    const q = this.champSearch().trim().toLowerCase();
    if (!q) return [];
    return this.gameData
      .champions()
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 24);
  });

  togglePicker(tag: string): void {
    this.champSearch.set('');
    this.pickerTag.update((t) => (t === tag ? null : tag));
  }

  reserveChamp(tag: string, championId: number): void {
    this.reserved.update((m) => ({ ...m, [tag]: championId }));
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
    const byChamp = new Map<number, string[]>();
    for (const [tag, id] of Object.entries(this.reserved())) {
      byChamp.set(id, [...(byChamp.get(id) ?? []), tag]);
    }
    const errs: string[] = [];
    for (const [id, tags] of byChamp) {
      if (tags.length > 1) {
        errs.push(`${tags.map((t) => this.nameOf(t)).join(' y ')} han reservado ${this.championName(id)}: un campeón solo lo puede jugar uno.`);
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
      const rid = this.reservedIdOf(m.tag);
      return {
        roleKey: s.roleKey,
        roleLabel: this.roleShort(s.roleKey),
        member: m,
        champ: rid !== null ? { championId: rid } : null,
      };
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
    if (Math.abs(d) <= 15) return { text: 'Equilibrado', side: 'even' as const };
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
      champ: s.champ ? { championId: s.champ.championId } : null,
    });
    return { blue: g.blue.map(conv), red: g.red.map(conv) };
  }

  // --- Manual mode: the draft room the followers watch ----------------------
  /** Id of the drafting room, or null before "partida manual" is chosen. */
  readonly roomId = signal<string | null>(null);

  /** Players in the draft; mirrors the wizard's selection. */
  readonly seats = computed<Member[]>(() => {
    const id = this.roomId();
    return id ? this.matches.byId(id)?.seats ?? [] : [];
  });

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
      reserved: Object.entries(this.reserved()).map(([tag, championId]) => ({
        tag,
        name: this.nameOf(tag),
        championId,
      })),
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
    this.gameData.ensureLoaded();

    // Trae identidad + roster reales al store mock. Idempotente: al llegar desde el detalle ya
    // están cargados y no se pide nada; entrando por URL directa, esta es la única carga.
    effect(() => {
      const id = this.id();
      if (id) void this.bridge.ensure(id);
    });

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
    const reserved: Record<string, number> = {};
    for (const s of slots) if (s.champ) reserved[s.member.tag] = s.champ.championId;
    this.reserved.set(reserved);
    this.mode.set('manual');
    this.step.set(2);
  }
}

/** Un día de la tira horizontal del selector. */
export interface DayOption {
  /** "2026-08-03". Es el prefijo con el que se agrupan las horas elegidas de ese día. */
  value: string;
  /** "HOY", "MAR"… lo que va arriba del chip. */
  weekday: string;
  /** "3". El número grande. */
  dayNumber: string;
  /** "hoy", "mañana", "jue 6": para frases dentro de un botón. */
  longLabel: string;
}

/** Una hora ofrecida en la rejilla del día elegido. */
export interface HourOption {
  /** "2026-08-03T22:00", ya listo para la lista de propuestas. */
  value: string;
  /** "22:00". */
  label: string;
}

/**
 * Cuántos días se pueden proponer. Dos semanas: cubre "este finde" y "el que viene", que es lo
 * más lejos que un grupo de amigos se organiza de verdad, y cabe en un par de gestos de pulgar.
 */
const DAYS_AHEAD = 14;

/**
 * La franja horaria que se ofrece en la rejilla. De la tarde a medianoche, en tramos de media
 * hora: es cuando se juegan las customs. Lo de fuera existe (un sábado por la mañana) y tiene su
 * campo de hora suelta, pero ofrecer las 24 horas en pastillas obligaría a buscar entre 48.
 */
const HOUR_FROM = 17;
const HOUR_TO = 23;

/** Construye los días seleccionables desde `now`. Puro sobre `now`, para poder probarlo. */
export function buildDays(now: Date, howMany: number): DayOption[] {
  const days: DayOption[] = [];
  for (let offset = 0; offset < howMany; offset++) {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' })
      .format(date)
      .replace('.', '')
      .toUpperCase();
    days.push({
      value: toLocalInputValue(date).slice(0, 10),
      weekday: offset === 0 ? 'HOY' : offset === 1 ? 'MAÑ' : weekday,
      dayNumber: String(date.getDate()),
      longLabel:
        offset === 0
          ? 'hoy'
          : offset === 1
            ? 'mañana'
            : `${weekday.toLowerCase()} ${date.getDate()}`,
    });
  }
  return days;
}

/**
 * Las horas ofrecidas para un día. Si el día es hoy, las que ya han pasado se caen — ofrecerlas
 * sería ofrecer un 400 `SLOT_IN_THE_PAST`, y devolver la lista vacía es lo que hace que la vista
 * pueda decir "hoy ya no quedan horas" en vez de enseñar una rejilla muerta.
 */
export function buildHours(dayValue: string, now: Date): HourOption[] {
  const hours: HourOption[] = [];
  for (let hour = HOUR_FROM; hour <= HOUR_TO; hour++) {
    for (const minute of [0, 30]) {
      const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      const at = new Date(`${dayValue}T${label}`);
      if (Number.isNaN(at.getTime()) || at.getTime() <= now.getTime()) continue;
      hours.push({ value: `${dayValue}T${label}`, label });
    }
  }
  return hours;
}

/**
 * `Date` → el valor que entiende un `<input type="datetime-local">` ("2026-08-07T22:00").
 *
 * A mano y no con `toISOString()`: ese devuelve UTC, y el input interpreta lo que recibe como
 * hora LOCAL. Usarlo desplazaría el mínimo tantas horas como diga la zona del usuario, que en
 * España son una o dos — suficiente para dejar elegir una hora ya pasada.
 */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
