import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import {
  MatchStore,
  DraftRule,
  ImportConflict,
  MatchRoom,
  MatchResult,
  MmrChange,
  RoomTeams,
  RoomTeamSlot,
} from '../../../core/match-store';
import { Member } from '../../../core/lobby';
import { memberDetail } from '../../../core/member-detail';
import { matchmake, internalElo, MatchmakePlayer, MatchmakeSlot } from '../../../core/matchmaking';

/**
 * Detail of a single match room, rendered per status:
 * - `drafting`: a READ-ONLY follower view so non-admins can watch the admin build
 *   the match live (participants/lines/rules/reserves fill in as they're picked).
 *   It reads the room's `draft` snapshot — display-ready, so no logic needed here.
 * - `waiting`: the open-room seat count with the captain's fill/trim tools.
 * - `live`: the locked-in 5v5 lineup.
 *
 * Reached from the group's active-match list or the pending-room banner. The live
 * config is streamed in by the create-match wizard (see grupo-crear-partida).
 * BACKEND NOTE: real cross-user updates need a realtime subscription in MatchStore.
 */
@Component({
  selector: 'app-grupo-sala',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        @if (room(); as r) {
          <div class="cp-head">
            <div class="cp-head__titles">
              <h1 class="view__title">Sala {{ r.code }}</h1>
            </div>
            <a class="view-back cp-back" [routerLink]="['/app', 'grupos', g.id, 'partidas']">
              <span class="view-back__arrow">←</span> PARTIDAS ACTIVAS
            </a>
          </div>

          @if (r.status === 'drafting') {
            <!-- live follower view: non-admins watch the admin configure the match -->
            <nf-window [title]="'sala_' + r.code + '.exe'" accent="pink" bodyPadding="0">
              <div class="cp-room__bar">
                <div class="cp-room__barmeta">
                  <div class="cp-room__sub nf-mono">CONFIGURANDO · {{ r.openedBy }} ESTÁ MONTANDO LA PARTIDA</div>
                </div>
                <nf-badge color="yellow" [dot]="true">PASO {{ r.draft?.step ?? 1 }}/5</nf-badge>
              </div>

              @if (r.draft; as d) {
                <div class="spec">
                  <div class="spec__live nf-mono">
                    <span class="spec__live-dot"></span> EN DIRECTO · {{ stepName(d.step) }}
                  </div>

                  <div class="spec__sec">
                    <div class="spec__label nf-mono">PARTICIPANTES · {{ d.participants.length }}/{{ r.capacity }}</div>
                    @if (d.participants.length) {
                      <div class="spec__players">
                        @for (m of d.participants; track m.tag) {
                          <span class="spec__chip">
                            <span class="spec__chip-av" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                            <span class="spec__chip-name nf-mono">{{ m.name }}</span>
                          </span>
                        }
                      </div>
                    } @else {
                      <div class="spec__muted nf-mono">aún sin elegir jugadores…</div>
                    }
                  </div>

                  <div class="spec__sec">
                    <div class="spec__label nf-mono">LÍNEAS</div>
                    @if (d.lines.length) {
                      @for (l of d.lines; track l.tag) {
                        <div class="spec__row">
                          <span class="spec__chip-av" [style.background]="avatarBg(l.hue)">{{ l.initials }}</span>
                          <span class="spec__row-name nf-mono">{{ l.name }}</span>
                          <span class="spec__row-val nf-mono">{{ l.roles.join(' · ') }}</span>
                        </div>
                      }
                    } @else {
                      <div class="spec__muted nf-mono">—</div>
                    }
                  </div>

                  <div class="spec__sec">
                    <div class="spec__label nf-mono">REGLAS</div>
                    @if (d.rules.length) {
                      @for (rule of d.rules; track $index) {
                        <div class="spec__rule nf-mono">{{ ruleText(rule) }}</div>
                      }
                    } @else {
                      <div class="spec__muted nf-mono">—</div>
                    }
                  </div>

                  <div class="spec__sec">
                    <div class="spec__label nf-mono">CAMPEONES RESERVADOS</div>
                    @if (d.reserved.length) {
                      @for (rv of d.reserved; track rv.tag) {
                        <div class="spec__row">
                          <span class="spec__champ" [style.background]="'linear-gradient(135deg,' + rv.champC1 + ',' + rv.champC2 + ')'">{{ rv.champInitials }}</span>
                          <span class="spec__row-name nf-mono">{{ rv.name }}</span>
                          <span class="spec__row-val nf-mono">→ {{ rv.champ }}</span>
                        </div>
                      }
                    } @else {
                      <div class="spec__muted nf-mono">—</div>
                    }
                  </div>
                </div>
              }
            </nf-window>

            <div class="actions" style="margin-top: 22px">
              <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos', g.id, 'partidas']">
                ← PARTIDAS ACTIVAS
              </button>
            </div>
          } @else {
          <nf-window [title]="'sala_' + r.code + '.exe'" [accent]="r.status === 'live' ? 'cyan' : 'pink'" bodyPadding="0">
            <div class="cp-room__bar">
              <div class="cp-room__barmeta">
                <div class="cp-room__sub nf-mono">
                  {{ r.status === 'live'
                    ? 'PARTIDA EN CURSO · ' + (r.mode === 'open' ? 'SALA ABIERTA' : 'MANUAL')
                    : 'CUALQUIER MIEMBRO DEL GRUPO PUEDE APUNTARSE' }}
                </div>
              </div>
              <nf-badge [color]="r.status === 'live' ? 'green' : full() ? 'green' : 'yellow'" [dot]="true">
                {{ r.seats.length }}/{{ r.capacity }}
              </nf-badge>
            </div>

            @if (liveTeams(r); as t) {
              <!-- DEFINED MATCH: the frozen Blue-vs-Red lineup, laid out by lane -->
              <div class="lm-balance">
                <div class="lm-balance__head nf-mono">
                  <span class="lm-balance__team lm-balance__team--blue">AZUL <b>{{ teamElo(t).blue }}</b></span>
                  <span class="lm-balance__verdict" [attr.data-side]="verdict(t).side">
                    @if (verdict(t).side === 'even') {
                      ⚖ {{ verdict(t).text }}
                    } @else {
                      {{ verdict(t).text }} {{ verdict(t).side === 'blue' ? 'AZUL ◀' : '▶ ROJO' }}
                    }
                  </span>
                  <span class="lm-balance__team lm-balance__team--red"><b>{{ teamElo(t).red }}</b> ROJO</span>
                </div>
                <div class="lm-balance__bar">
                  <div class="lm-balance__fill" [style.width.%]="teamElo(t).blueShare * 100"></div>
                  <div class="lm-balance__mid" aria-hidden="true"></div>
                </div>
              </div>

              <div class="lm-lanes">
                @for (lane of laneRows(t); track lane.role) {
                  <div class="lm-lane">
                    <div class="lm-side lm-side--blue">
                      <span class="lm-av" [style.background]="avatarBg(lane.blue.member.hue)">{{ lane.blue.member.initials }}</span>
                      <div class="lm-meta">
                        <span class="lm-name nf-mono">{{ lane.blue.member.name }} <span class="lm-elo">◆ {{ lane.blue.elo }}</span></span>
                        <span class="lm-champ nf-mono">
                          @if (lane.blue.champ; as c) {
                            <span class="lm-champ-ic" [style.background]="'linear-gradient(135deg,' + c.c1 + ',' + c.c2 + ')'">{{ c.initials }}</span>
                            <span>{{ c.name }}</span>
                          } @else {
                            <span class="lm-champ--none">sin campeón</span>
                          }
                        </span>
                      </div>
                    </div>

                    <div class="lm-role nf-mono">{{ lane.role }}</div>

                    <div class="lm-side lm-side--red">
                      <div class="lm-meta">
                        <span class="lm-name nf-mono"><span class="lm-elo">{{ lane.red.elo }} ◆</span> {{ lane.red.member.name }}</span>
                        <span class="lm-champ nf-mono">
                          @if (lane.red.champ; as c) {
                            <span class="lm-champ-ic" [style.background]="'linear-gradient(135deg,' + c.c1 + ',' + c.c2 + ')'">{{ c.initials }}</span>
                            <span>{{ c.name }}</span>
                          } @else {
                            <span class="lm-champ--none">sin campeón</span>
                          }
                        </span>
                      </div>
                      <span class="lm-av" [style.background]="avatarBg(lane.red.member.hue)">{{ lane.red.member.initials }}</span>
                    </div>
                  </div>
                }
              </div>

              <!-- RESULT: set the winner by hand, or wait for the desktop scraper import -->
              @if (r.result; as res) {
                @if (swapping()) {
                  <!-- Vía 3: swap players in/out, then re-pair the teams -->
                  <div class="res">
                    <div class="conf__head nf-mono">🔀 CAMBIAR JUGADORES · {{ swapRoster().length }}/10</div>
                    <p class="conf__intro">
                      Saca a quien se va y mete a otros del grupo. Al confirmar, los equipos se reemparejan solos.
                    </p>
                    <div class="swap__row">
                      @for (m of swapRoster(); track m.tag) {
                        <button type="button" class="cp-tray__chip" [title]="'Sacar a ' + m.name" (click)="removeSwap(m.tag)">
                          <span class="cp-tray__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                          <span class="cp-tray__name nf-mono">{{ m.name }}</span>
                          <span class="cp-tray__x" aria-hidden="true">✕</span>
                        </button>
                      }
                    </div>
                    <div class="res__next-label nf-mono">DISPONIBLES DEL GRUPO</div>
                    <div class="swap__row">
                      @for (m of availableSwap(); track m.tag) {
                        <button type="button" class="cp-pchip" [disabled]="swapRoster().length >= 10" (click)="addSwap(m)">
                          <span class="cp-pchip__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                          <span class="cp-pchip__name nf-mono">{{ m.name }}</span>
                        </button>
                      } @empty {
                        <span class="res__muted nf-mono">no quedan más miembros en el grupo</span>
                      }
                    </div>
                    <div class="conf__foot">
                      <button type="button" class="res__cancel nf-mono" (click)="swapping.set(false)">cancelar</button>
                      <button
                        type="button"
                        class="res__win res__win--blue nf-mono"
                        [disabled]="swapRoster().length !== 10"
                        (click)="confirmSwap(r)"
                      >REEMPAREJAR Y JUGAR ►</button>
                    </div>
                  </div>
                } @else {
                  <div class="res">
                    <div class="res__decided" [attr.data-side]="res.winner">
                      @if (res.winner === 'cancelled') {
                        <span>✕ PARTIDA CANCELADA · SIN RESULTADO</span>
                      } @else {
                        <span>✓ GANÓ EQUIPO {{ res.winner === 'blue' ? 'AZUL' : 'ROJO' }} · {{ res.source === 'import' ? 'IMPORTADA' : 'MANUAL' }}</span>
                      }
                      <button type="button" class="res__undo" (click)="undoResult(r)">corregir</button>
                    </div>

                    <div class="res__next-label nf-mono">¿SEGUIMOS JUGANDO?</div>
                    <div class="res__paths">
                      <button type="button" class="res__path" (click)="rematchSame(r)">
                        <span class="res__path-ico">🔁</span>
                        <span class="res__path-txt"><b>Revancha</b><small>mismos equipos y posiciones</small></span>
                      </button>
                      <button type="button" class="res__path" (click)="rebalance(r)">
                        <span class="res__path-ico">♻</span>
                        <span class="res__path-txt"><b>Rebalancear</b><small>mismos jugadores, nuevas posiciones</small></span>
                      </button>
                      <button type="button" class="res__path" (click)="openSwap(r)">
                        <span class="res__path-ico">🔀</span>
                        <span class="res__path-txt"><b>Cambiar jugadores</b><small>entran/salen del grupo</small></span>
                      </button>
                    </div>
                    <button type="button" class="res__close nf-mono" (click)="closeRoom(r)">⏹ CERRAR LA SALA</button>
                  </div>
                }
              } @else if (resolvingImport()) {
                <!-- import data didn't match the lineup: resolve every conflict to apply -->
                <div class="res">
                  <div class="conf__head nf-mono">⚠ {{ importConflicts().length }} CONFLICTO(S) EN LA IMPORTACIÓN</div>
                  <p class="conf__intro">
                    La partida subida no cuadra con la sala. Resuelve cada conflicto para poder aplicar
                    el resultado. Una vez en el historial <b>no se podrá modificar, solo eliminar</b>.
                  </p>
                  @for (c of importConflicts(); track c.id) {
                    <div class="conf__item" [class.is-done]="!!c.resolution">
                      <div class="conf__detail nf-mono">
                        <span class="conf__flag">{{ c.resolution ? '✓' : '⚠' }}</span> {{ c.detail }}
                      </div>
                      <div class="conf__opts">
                        @if (c.kind === 'unknown-player') {
                          <button
                            type="button"
                            class="conf__opt"
                            [class.is-sel]="c.resolution === 'replace'"
                            (click)="resolveConflict(c.id, 'replace')"
                          >↔ Reemplazar a un jugador de la sala</button>
                          <button
                            type="button"
                            class="conf__opt"
                            [class.is-sel]="c.resolution === 'guest'"
                            (click)="resolveConflict(c.id, 'guest')"
                          >👻 Meter como invitado (no cuenta para nada)</button>
                        } @else {
                          <button
                            type="button"
                            class="conf__opt"
                            [class.is-sel]="c.resolution === 'accept-position'"
                            (click)="resolveConflict(c.id, 'accept-position')"
                          >✓ Aceptar posición real ({{ c.actualRole }})</button>
                        }
                      </div>
                    </div>
                  }
                  <div class="conf__foot">
                    <button type="button" class="res__cancel nf-mono" (click)="discardImport()">descartar import</button>
                    <button
                      type="button"
                      class="res__win res__win--blue nf-mono"
                      [disabled]="!allResolved()"
                      (click)="applyImport(r)"
                    >RESOLVER Y APLICAR ►</button>
                  </div>
                </div>
              } @else {
                <div class="res">
                  <div class="res__import">
                    <span class="res__import-spin" aria-hidden="true"><span class="cp-spinner"></span></span>
                    <div class="res__import-txt">
                      <div class="res__import-title nf-mono">
                        ESPERANDO DATOS DE LA PARTIDA<span class="cp-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                      </div>
                      <div class="res__import-sub nf-mono">
                        cualquier jugador puede subirla desde la app de escritorio; el ganador se rellena solo
                      </div>
                    </div>
                    <div class="res__import-actions">
                      <button type="button" class="cp-sim nf-mono" (click)="simulateImport(r)">▶ import sin conflictos</button>
                      <button type="button" class="cp-sim nf-mono" (click)="simulateImportConflicts(r)">▶ import con conflictos</button>
                    </div>
                  </div>
                  <div class="res__or nf-mono">— o decide el resultado a mano (solo admin) —</div>
                  <div class="res__buttons">
                    <button type="button" class="res__win res__win--blue nf-mono" (click)="askWin('blue')">🏆 GANÓ AZUL</button>
                    <button type="button" class="res__win res__win--red nf-mono" (click)="askWin('red')">🏆 GANÓ ROJO</button>
                    <button type="button" class="res__cancel nf-mono" (click)="cancelMatch(r)">✕ CANCELAR</button>
                  </div>
                </div>
              }
            } @else {
              <div class="cp-seats" [class.is-complete]="full()">
                @for (slot of seatSlots(); track $index) {
                  @if (slot; as m) {
                    <div class="cp-seat" [class.cp-seat--captain]="m.owner">
                      <span class="cp-seat__avatar" [style.background]="avatarBg(m.hue)">{{ m.initials }}</span>
                      <span class="cp-seat__meta">
                        <span class="cp-seat__name nf-mono">{{ m.name }}</span>
                        <span class="cp-seat__role nf-mono">{{ m.owner ? 'CAPITÁN · ABRIÓ LA SALA' : 'APUNTADO' }}</span>
                      </span>
                      @if (!m.owner && r.status === 'waiting') {
                        <button
                          type="button"
                          class="cp-seat__kick"
                          [attr.aria-label]="'Quitar a ' + m.name"
                          (click)="kick(m)"
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
            }

            @if (!liveTeams(r)) {
              <div class="cp-room__actions">
                @if (r.status === 'live') {
                  <div class="cp-room__ready nf-mono">
                    <span class="cp-room__ready-glyph">▶</span>
                    PARTIDA EN CURSO · 10/10 JUGADORES
                  </div>
                } @else if (!full()) {
                  <button type="button" class="cp-sim nf-mono" [disabled]="!pool().length" (click)="simulateJoin()">
                    ▶ simular que alguien se apunta ({{ pool().length }} disponibles)
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
            }
          </nf-window>

          <div class="actions" style="margin-top: 22px">
            <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'grupos', g.id, 'partidas']">
              ← PARTIDAS ACTIVAS
            </button>
          </div>

          @if (celebrating() && r.result; as res) {
            @if (res.winner !== 'cancelled') {
              <div class="vic" [attr.data-side]="res.winner">
                <div class="vic__inner">
                  <div class="vic__eyebrow nf-mono">// PARTIDA FINALIZADA</div>
                  <div class="vic__title nf-mono">VICTORIA</div>
                  <div class="vic__team nf-mono">EQUIPO {{ res.winner === 'blue' ? 'AZUL' : 'ROJO' }}</div>
                  <div class="vic__winners">
                    @for (w of winners(r); track w.member.tag) {
                      <div class="vic__winner">
                        <span class="vic__av" [style.background]="avatarBg(w.member.hue)">{{ w.member.initials }}</span>
                        <span class="vic__name nf-mono">{{ w.member.name }}</span>
                        <span class="vic__delta nf-mono">{{ mmrOf(res, w.member.tag) }} <small>MMR</small></span>
                      </div>
                    }
                  </div>
                  <button nfButton variant="primary" size="md" (click)="celebrating.set(false)">CONTINUAR ►</button>
                </div>
              </div>
            }
          }

          @if (confirmWin(); as side) {
            <div class="modal-overlay" (click)="confirmWin.set(null)">
              <div class="modal" (click)="$event.stopPropagation()">
                <nf-window [title]="'confirmar_resultado.exe'" [accent]="side === 'blue' ? 'cyan' : 'pink'" bodyPadding="24px">
                  <div class="settings-eyebrow nf-mono">// CONFIRMAR RESULTADO</div>
                  <p class="remove-msg">
                    ¿Seguro que marcas <strong>EQUIPO {{ side === 'blue' ? 'AZUL' : 'ROJO' }}</strong> como ganador?
                  </p>
                  <div class="remove-warn nf-mono">
                    ⚠ Disparará el cálculo de MMR y guardará la partida. Si te equivocas, podrás corregirlo después.
                  </div>
                  <div class="form-foot">
                    <button nfButton variant="ghost" size="md" (click)="confirmWin.set(null)">CANCELAR</button>
                    <button nfButton variant="primary" size="md" (click)="confirmWinNow(r)">CONFIRMAR ►</button>
                  </div>
                </nf-window>
              </div>
            </div>
          }
          }
        } @else {
          <div class="view__head">
            <div class="view__eyebrow nf-mono">// ERROR 404</div>
            <h1 class="view__title">Sala no encontrada</h1>
            <p class="view__lead">Esta sala ya no existe: se canceló o la partida terminó.</p>
          </div>
          <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos', g.id, 'partidas']">
            ← PARTIDAS ACTIVAS
          </button>
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
  styleUrl: './views.scss',
})
export class GrupoSala {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  private readonly matches = inject(MatchStore);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  private readonly roomId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('roomId'))),
    { initialValue: this.route.snapshot.paramMap.get('roomId') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  /** The room, but only when it actually belongs to this group's URL. */
  readonly room = computed(() => {
    const g = this.group();
    const rid = this.roomId();
    if (!g || !rid) return null;
    const r = this.matches.byId(rid);
    return r && r.groupId === g.id ? r : null;
  });

  readonly full = computed(() => {
    const r = this.room();
    return !!r && r.seats.length >= r.capacity;
  });

  /** Exactly `capacity` slots: a member when filled, null when still open. */
  readonly seatSlots = computed<(Member | null)[]>(() => {
    const r = this.room();
    if (!r) return [];
    return Array.from({ length: r.capacity }, (_, i) => r.seats[i] ?? null);
  });

  /** Group members not yet seated (the pool a real join would draw from). */
  readonly pool = computed<Member[]>(() => {
    const g = this.group();
    const r = this.room();
    if (!g || !r) return [];
    return this.groups.rosterOf(g.id).filter((m) => !r.seats.some((s) => s.tag === m.tag));
  });

  avatarBg(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }

  /** The frozen Blue/Red lineup of a live match, or null (waiting/no teams). */
  liveTeams(r: MatchRoom): RoomTeams | null {
    return r.status === 'live' && r.teams ? r.teams : null;
  }

  /** Aggregate elo per team + the blue share, for the match balance bar. */
  teamElo(t: RoomTeams): { blue: number; red: number; blueShare: number } {
    const sum = (a: RoomTeamSlot[]) => a.reduce((s, x) => s + x.elo, 0);
    const blue = sum(t.blue);
    const red = sum(t.red);
    const total = blue + red;
    return { blue, red, blueShare: total ? blue / total : 0.5 };
  }

  /** Which side the scale tips to (or balanced), for the verdict pill. */
  verdict(t: RoomTeams): { text: string; side: 'even' | 'blue' | 'red' } {
    const e = this.teamElo(t);
    const d = e.blue - e.red;
    if (Math.abs(d) <= 15) return { text: 'EQUILIBRADO', side: 'even' };
    return { text: `+${Math.abs(d)}`, side: d > 0 ? 'blue' : 'red' };
  }

  /** Pair Blue[i] vs Red[i] by lane (both lists are ordered by role). */
  laneRows(t: RoomTeams): { role: string; blue: RoomTeamSlot; red: RoomTeamSlot }[] {
    return t.blue.map((b, i) => ({ role: b.roleLabel, blue: b, red: t.red[i] }));
  }

  // --- Result determination (manual / import) + victory + MMR ----------------
  private readonly router = inject(Router);
  /** True while the victory takeover animation is showing. */
  readonly celebrating = signal(false);
  /** Pending manual-win confirmation ('blue'/'red') or null. Manual = ADMIN ONLY. */
  readonly confirmWin = signal<'blue' | 'red' | null>(null);
  /** Import conflicts awaiting resolution (mock of the desktop scraper upload). */
  readonly importConflicts = signal<ImportConflict[]>([]);
  readonly resolvingImport = signal(false);
  /** An import can only be applied once every conflict has a resolution. */
  readonly allResolved = computed(
    () => this.importConflicts().length > 0 && this.importConflicts().every((c) => !!c.resolution),
  );

  /**
   * Per-player internal-MMR change via the Elo expected-score formula: a balanced
   * win is ~±16; beating a stronger team earns more, losing to a weaker one costs
   * more. BACKEND NOTE: the real MMR engine replaces this.
   */
  private computeMmr(t: RoomTeams, winner: 'blue' | 'red'): MmrChange[] {
    const avg = (a: RoomTeamSlot[]) => a.reduce((s, x) => s + x.elo, 0) / (a.length || 1);
    const expBlue = 1 / (1 + Math.pow(10, (avg(t.red) - avg(t.blue)) / 400));
    const K = 32;
    const blueDelta = Math.round(K * ((winner === 'blue' ? 1 : 0) - expBlue));
    const redDelta = Math.round(K * ((winner === 'red' ? 1 : 0) - (1 - expBlue)));
    return [
      ...t.blue.map((s) => ({ tag: s.member.tag, name: s.member.name, delta: blueDelta })),
      ...t.red.map((s) => ({ tag: s.member.tag, name: s.member.name, delta: redDelta })),
    ];
  }

  /** Admin taps a winner → opens the confirm dialog (manual result is admin-only). */
  askWin(side: 'blue' | 'red'): void {
    this.confirmWin.set(side);
  }

  /** Confirm the manual winner: record it, run MMR, celebrate. Undoable afterwards. */
  confirmWinNow(r: MatchRoom): void {
    const side = this.confirmWin();
    this.confirmWin.set(null);
    if (!side || !r.teams) return;
    this.matches.setResult(r.id, {
      winner: side,
      source: 'manual',
      mmr: this.computeMmr(r.teams, side),
      decidedAt: Date.now(),
    });
    this.celebrating.set(true);
  }

  /** Mock a CLEAN scraper upload (no conflicts): winner determined automatically. */
  simulateImport(r: MatchRoom): void {
    if (!r.teams) return;
    const side: 'blue' | 'red' = Math.random() < 0.5 ? 'blue' : 'red';
    this.matches.setResult(r.id, {
      winner: side,
      source: 'import',
      mmr: this.computeMmr(r.teams, side),
      decidedAt: Date.now(),
    });
    this.celebrating.set(true);
  }

  /**
   * Mock a scraper upload that does NOT match the lineup → opens conflict resolution.
   * Conflicts must be settled here (in the sala) before the result is accepted; only
   * a conflict-free import may enter the history.
   */
  simulateImportConflicts(r: MatchRoom): void {
    if (!r.teams) return;
    const p = r.teams.blue[0];
    const alt = p.roleLabel === 'MID' ? 'ADC' : 'MID';
    this.importConflicts.set([
      {
        id: 'c1',
        kind: 'unknown-player',
        detail: '"Ghosty#NA" aparece en la partida importada pero no está en la sala.',
        subjectTag: 'Ghosty#NA',
        subjectName: 'Ghosty',
        resolution: null,
      },
      {
        id: 'c2',
        kind: 'wrong-position',
        detail: `${p.member.name} jugó ${alt} pero estaba asignado a ${p.roleLabel}.`,
        subjectTag: p.member.tag,
        subjectName: p.member.name,
        expectedRole: p.roleLabel,
        actualRole: alt,
        resolution: null,
      },
    ]);
    this.resolvingImport.set(true);
  }

  /** Choose how to fix a single conflict (replace / guest / accept the real position). */
  resolveConflict(id: string, resolution: ImportConflict['resolution']): void {
    this.importConflicts.update((list) => list.map((c) => (c.id === id ? { ...c, resolution } : c)));
  }

  /**
   * Apply a fully-resolved import. BACKEND NOTE: with the conflicts settled, the
   * server reconciles the REAL lineup (guests as ghosts, swapped players, corrected
   * lanes) and recomputes MMR/stats on THAT — not the originally-configured teams.
   */
  applyImport(r: MatchRoom): void {
    if (!this.allResolved() || !r.teams) return;
    const side: 'blue' | 'red' = Math.random() < 0.5 ? 'blue' : 'red';
    this.matches.setResult(r.id, {
      winner: side,
      source: 'import',
      mmr: this.computeMmr(r.teams, side),
      decidedAt: Date.now(),
    });
    this.resolvingImport.set(false);
    this.importConflicts.set([]);
    this.celebrating.set(true);
  }

  /** Abandon the import and return to the result-entry options. */
  discardImport(): void {
    this.resolvingImport.set(false);
    this.importConflicts.set([]);
  }

  // --- Vía 2 / 3: replay in the same room (shared matchmaking) ----------------
  private readonly roleLabels: Record<string, string> = {
    TOP: 'TOP', JUNGLA: 'JG', MID: 'MID', ADC: 'ADC', SUPPORT: 'SUP',
  };
  private roleShort(key: string): string {
    return this.roleLabels[key] ?? key;
  }

  /** A player's profile roles (FLEX -> any). Used since the per-match line pins
   *  aren't stored on the live room — the rebalance falls back to profiles. */
  private profileRoles(m: Member): string[] {
    const g = this.group();
    const roster = g ? this.groups.rosterOf(g.id) : [];
    const raw = memberDetail(m, roster).roles;
    return raw.includes('FLEX') ? ['TOP', 'JUNGLA', 'MID', 'ADC', 'SUPPORT'] : raw;
  }

  /** Re-run matchmaking for a set of players, keeping each one's reserved champ. */
  private rebuildTeams(
    players: Member[],
    champByTag: Map<string, RoomTeamSlot['champ']>,
    seed: number,
  ): RoomTeams | null {
    const mm: MatchmakePlayer[] = players.map((m) => ({
      tag: m.tag,
      roles: this.profileRoles(m),
      elo: internalElo(m.tag),
    }));
    const res = matchmake(mm, [], seed); // no per-match rules stored on the live room
    if (!res) return null;
    const byTag = new Map(players.map((m) => [m.tag, m]));
    const toSlot = (s: MatchmakeSlot): RoomTeamSlot => {
      const m = byTag.get(s.tag) as Member;
      return {
        roleKey: s.roleKey,
        roleLabel: this.roleShort(s.roleKey),
        member: m,
        elo: internalElo(m.tag),
        champ: champByTag.get(s.tag) ?? null,
      };
    };
    return {
      blue: res.slots.filter((s) => s.team === 'blue').map(toSlot),
      red: res.slots.filter((s) => s.team === 'red').map(toSlot),
    };
  }

  private champMap(t: RoomTeams): Map<string, RoomTeamSlot['champ']> {
    return new Map([...t.blue, ...t.red].map((s) => [s.member.tag, s.champ] as const));
  }

  /** Vía 2: same players, NEW positions — re-emparejar automáticamente. */
  rebalance(r: MatchRoom): void {
    const t = r.teams;
    if (!t) return;
    const players = [...t.blue, ...t.red].map((s) => s.member);
    const teams = this.rebuildTeams(players, this.champMap(t), Date.now());
    if (teams) {
      this.celebrating.set(false);
      this.matches.setTeams(r.id, teams);
    }
  }

  // Vía 3: swap players (some leave, others from the group join), then re-pair.
  readonly swapping = signal(false);
  readonly swapRoster = signal<Member[]>([]);
  readonly availableSwap = computed<Member[]>(() => {
    const g = this.group();
    if (!g) return [];
    const inMatch = new Set(this.swapRoster().map((m) => m.tag));
    return this.groups.rosterOf(g.id).filter((m) => !inMatch.has(m.tag));
  });

  openSwap(r: MatchRoom): void {
    const t = r.teams;
    if (!t) return;
    this.swapRoster.set([...t.blue, ...t.red].map((s) => s.member));
    this.swapping.set(true);
  }
  removeSwap(tag: string): void {
    this.swapRoster.update((l) => l.filter((m) => m.tag !== tag));
  }
  addSwap(m: Member): void {
    if (this.swapRoster().length >= 10) return;
    this.swapRoster.update((l) => [...l, m]);
  }
  confirmSwap(r: MatchRoom): void {
    if (this.swapRoster().length !== 10 || !r.teams) return;
    const teams = this.rebuildTeams(this.swapRoster(), this.champMap(r.teams), Date.now());
    if (teams) {
      this.swapping.set(false);
      this.celebrating.set(false);
      this.matches.setTeams(r.id, teams);
    }
  }

  /** Cancelled / remake — no winner, no MMR. */
  cancelMatch(r: MatchRoom): void {
    this.matches.setResult(r.id, { winner: 'cancelled', source: 'manual', mmr: [], decidedAt: Date.now() });
  }

  /**
   * Undo a mistaken result — reverts the match to its previous (undecided) state
   * even though setting it was behind a confirm dialog. BACKEND NOTE: undoing a
   * result must also roll back the MMR it applied.
   */
  undoResult(r: MatchRoom): void {
    this.celebrating.set(false);
    this.matches.clearResult(r.id);
  }

  /** Vía 1: rematch with the same teams and positions. */
  rematchSame(r: MatchRoom): void {
    this.celebrating.set(false);
    this.matches.clearResult(r.id);
  }

  /** Vía 4 (the missing one): end the session and remove the room. */
  closeRoom(r: MatchRoom): void {
    const g = this.group();
    this.matches.remove(r.id);
    this.router.navigate(['/app', 'grupos', g ? g.id : '', 'partidas']);
  }

  /** The winning lineup (for the victory screen), or empty. */
  winners(r: MatchRoom): RoomTeamSlot[] {
    const t = r.teams;
    const w = r.result?.winner;
    if (!t || !w || w === 'cancelled') return [];
    return w === 'blue' ? t.blue : t.red;
  }

  /** Signed MMR delta of a player as a label ("+18" / "-15"). */
  mmrOf(res: MatchResult, tag: string): string {
    const d = res.mmr.find((m) => m.tag === tag)?.delta ?? 0;
    return (d >= 0 ? '+' : '') + d;
  }

  /** Label of the wizard step the admin is on (for the follower view). */
  stepName(step: number): string {
    return (
      ['PARTICIPANTES', 'LÍNEAS', 'DUOS / TRÍOS / VS', 'PERSONAJES', 'LANZAR'][step - 1] ??
      'CONFIGURANDO'
    );
  }

  /** Human one-liner for a draft rule in the follower view. */
  ruleText(rule: DraftRule): string {
    const a = rule.aNames.join(' + ');
    if (rule.kind === 'together') return `🤝 ${a} · juntos`;
    const b = rule.bNames.join(' + ');
    if (rule.kind === 'lane') return `🎯 ${a} vs ${b} · misma línea`;
    return `⚔ ${a} vs ${b}`;
  }

  simulateJoin(): void {
    const r = this.room();
    const next = this.pool()[0];
    if (r && next) this.matches.addSeat(r.id, next);
  }

  kick(m: Member): void {
    const r = this.room();
    if (r && !m.owner) this.matches.removeSeat(r.id, m.tag);
  }

  constructor() {
    // Keep the shell header/sidebar in sync with the active group on deep-link.
    effect(() => {
      const id = this.id();
      if (id && this.groups.byId(id)) this.groups.select(id);
    });
  }
}
