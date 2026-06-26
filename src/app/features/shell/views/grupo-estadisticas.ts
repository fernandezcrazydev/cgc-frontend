import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { Member } from '../../../core/lobby';
import { sparkPoints } from '../../../core/group-ranking';
import {
  StatScope,
  SCOPE_OPTIONS,
  StatLeaderboard,
  awardsFor,
  leaderboardsFor,
  playerTiles,
  statsFor,
  summaryFor,
} from '../../../core/group-stats';

type StatTab = 'resumen' | 'jugadores' | 'premios';

@Component({
  selector: 'app-grupo-estadisticas',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ESTADÍSTICAS DEL GRUPO</div>
          <p class="view__lead">Rendimiento y métricas del grupo a lo largo de vuestras customs.</p>
        </div>

        <!-- Scope: every widget below is scaled to this window -->
        <div class="seg" role="tablist" aria-label="Alcance temporal">
          @for (s of scopeOptions; track s.id) {
            <button
              type="button"
              class="seg__btn nf-mono"
              role="tab"
              [class.is-active]="scope() === s.id"
              [attr.aria-selected]="scope() === s.id"
              (click)="scope.set(s.id)"
            >{{ s.label }}</button>
          }
        </div>

        <!-- Section tabs -->
        <div class="tabs" role="tablist" aria-label="Secciones de estadísticas">
          @for (t of tabs; track t.id) {
            <button
              type="button"
              class="tabs__btn nf-mono"
              role="tab"
              [class.is-active]="tab() === t.id"
              [attr.aria-selected]="tab() === t.id"
              (click)="tab.set(t.id)"
            >{{ t.label }}</button>
          }
        </div>

        @switch (tab()) {
          @case ('resumen') {
            @if (summary(); as sm) {
              <div class="hl-grid">
                <!-- MVP -->
                <div class="hl hl--mvp" data-accent="pink">
                  <div class="hl__eyebrow nf-mono">★ MVP · {{ scopeLabel() }}</div>
                  <div class="hl__hero">
                    <span
                      class="hl__avatar"
                      [style.background]="grad(sm.mvp.stats.member.hue)"
                    >{{ sm.mvp.stats.member.initials }}</span>
                    <div class="hl__who">
                      <div class="hl__name">{{ sm.mvp.stats.member.name }}</div>
                      <div class="hl__blurb nf-mono">{{ sm.mvp.blurb }}</div>
                    </div>
                  </div>
                  <div class="hl__score nf-mono">RATING {{ sm.mvp.stats.rating }}</div>
                </div>

                <!-- Best combo -->
                <div class="hl hl--combo" data-accent="cyan">
                  <div class="hl__eyebrow nf-mono">🤝 MEJOR DÚO</div>
                  <div class="hl__duo">
                    <span class="hl__avatar hl__avatar--sm" [style.background]="grad(sm.bestCombo.a.hue)">{{ sm.bestCombo.a.initials }}</span>
                    <span class="hl__plus nf-mono">+</span>
                    <span class="hl__avatar hl__avatar--sm" [style.background]="grad(sm.bestCombo.b.hue)">{{ sm.bestCombo.b.initials }}</span>
                  </div>
                  <div class="hl__name hl__name--sm">{{ sm.bestCombo.a.name }} & {{ sm.bestCombo.b.name }}</div>
                  <div class="hl__blurb nf-mono">{{ sm.bestCombo.wr }}% WR · {{ sm.bestCombo.wins }}/{{ sm.bestCombo.games }} juntos</div>
                </div>

                <!-- Hot streak -->
                <div class="hl hl--streak" data-accent="yellow">
                  <div class="hl__eyebrow nf-mono">🔥 RACHA CALIENTE</div>
                  <div class="hl__big nf-mono">{{ sm.hotStreak.streak }}<span class="hl__big-unit">W</span></div>
                  <div class="hl__name hl__name--sm">{{ sm.hotStreak.member.name }}</div>
                  <div class="hl__blurb nf-mono">victorias seguidas sin perder</div>
                </div>
              </div>

              <!-- Totals strip -->
              <div class="totals">
                <div class="totals__item">
                  <div class="totals__val nf-mono">{{ sm.totals.games }}</div>
                  <div class="totals__lbl nf-mono">PARTIDAS</div>
                </div>
                <div class="totals__item">
                  <div class="totals__val nf-mono">{{ sm.totals.hours }}h</div>
                  <div class="totals__lbl nf-mono">JUGADAS</div>
                </div>
                <div class="totals__item">
                  <div class="totals__val nf-mono">{{ sm.totals.kills }}</div>
                  <div class="totals__lbl nf-mono">KILLS</div>
                </div>
                <div class="totals__item">
                  <div class="totals__val nf-mono">{{ sm.totals.pentas }}</div>
                  <div class="totals__lbl nf-mono">PENTAS</div>
                </div>
              </div>

              <div class="view__label nf-mono">▸ CLASIFICACIONES</div>
              <div class="sc-grid">
                @for (lb of leaderboards(); track lb.id) {
                  <div class="sc" [attr.data-accent]="lb.accent">
                    <div class="sc__head">
                      <span class="sc__glyph">{{ lb.glyph }}</span>
                      <span class="sc__title nf-mono">{{ lb.title }}</span>
                    </div>

                    @if (lb.rows[0]; as top) {
                      <div class="sc__leader">
                        <span class="lb-avatar" [style.background]="grad(top.member.hue)">{{ top.member.initials }}</span>
                        <div class="sc__leader-meta">
                          <div class="sc__leader-name">{{ top.member.name }}</div>
                          <div class="sc__leader-sub nf-mono">{{ top.sub }}</div>
                        </div>
                        <div class="sc__leader-val">{{ top.value }}</div>
                      </div>

                      @if (lb.spark) {
                        <svg class="lb-spark sc__spark" [class.is-down]="lb.trend === 'down'" viewBox="0 0 120 32" preserveAspectRatio="none">
                          <polyline [attr.points]="points(lb)" />
                        </svg>
                      }

                      @for (r of rest(lb); track r.member.tag) {
                        <div class="sc__row">
                          <span class="sc__row-rank nf-mono">{{ r.rank }}</span>
                          <span class="sc__row-name nf-mono">{{ r.member.name }}</span>
                          <span class="sc__row-sub nf-mono">{{ r.sub }}</span>
                          <span class="sc__row-val nf-mono">{{ r.value }}</span>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            }
          }

          @case ('jugadores') {
            <nf-window title="jugadores.exe" accent="cyan" bodyPadding="0">
              <div class="members">
                @for (p of players(); track p.member.tag) {
                  <div class="member-row" [class.member-row--open]="expandedTag() === p.member.tag">
                    <div
                      class="member"
                      role="button"
                      tabindex="0"
                      [attr.aria-expanded]="expandedTag() === p.member.tag"
                      (click)="toggle(p.member)"
                      (keydown.enter)="toggle(p.member)"
                      (keydown.space)="$event.preventDefault(); toggle(p.member)"
                    >
                      <div class="member__avatar" [style.background]="grad(p.member.hue)">{{ p.member.initials }}</div>
                      <div class="member__meta">
                        <div class="member__name nf-mono">{{ p.member.name }}</div>
                        <div class="member__role nf-mono">{{ p.wins }}V {{ p.losses }}D · {{ p.kda }} KDA</div>
                      </div>
                      <span class="player-wr nf-mono" [class.player-wr--lo]="p.wr < 50">{{ p.wr }}%</span>
                      <span class="member__chevron" aria-hidden="true">▾</span>
                    </div>

                    @if (expandedTag() === p.member.tag) {
                      <div class="member-detail">
                        <div class="member-detail__head">
                          <div class="member-detail__tag nf-mono">{{ p.member.tag }}</div>
                          <span class="player-main nf-mono">
                            <span class="champ-icon" [style.background]="'linear-gradient(135deg, ' + p.mainChampion.c1 + ', ' + p.mainChampion.c2 + ')'">{{ p.mainChampion.initials }}</span>
                            Main: {{ p.mainChampion.name }} · {{ p.mainChampWr }}% WR
                          </span>
                        </div>
                        <div class="ptiles">
                          @for (t of tiles(p); track t.label) {
                            <div class="ptile" [attr.data-accent]="t.accent ?? null">
                              <div class="ptile__val nf-mono">{{ t.value }}</div>
                              <div class="ptile__lbl nf-mono">{{ t.label }}</div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </nf-window>
          }

          @case ('premios') {
            <div class="view__label nf-mono">▸ MURO DE TROFEOS · {{ scopeLabel() }}</div>
            <div class="trophy-grid">
              @for (a of awards(); track a.id) {
                <div class="trophy" [attr.data-color]="a.color">
                  <div class="trophy__glyph">{{ a.glyph }}</div>
                  <div class="trophy__title nf-mono">{{ a.title }}</div>
                  <div class="trophy__winner">
                    <span class="trophy__avatar" [style.background]="grad(a.member.hue)">{{ a.member.initials }}</span>
                    <span class="trophy__name nf-mono">{{ a.member.name }}</span>
                  </div>
                  <nf-badge [color]="a.color">{{ a.value }}</nf-badge>
                  <div class="trophy__blurb">{{ a.blurb }}</div>
                </div>
              }
            </div>
          }
        }
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ERROR 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
          <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← VOLVER A GRUPOS</button>
      }
    </div>
  `,
})
export class GrupoEstadisticas {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);

  readonly scopeOptions = SCOPE_OPTIONS;
  readonly tabs: { id: StatTab; label: string }[] = [
    { id: 'resumen', label: 'RESUMEN' },
    { id: 'jugadores', label: 'JUGADORES' },
    { id: 'premios', label: 'PREMIOS' },
  ];

  readonly scope = signal<StatScope>('temporada');
  readonly tab = signal<StatTab>('resumen');
  readonly expandedTag = signal<string | null>(null);

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  /** Base per-member stats for the active group + scope. */
  private readonly stats = computed(() => {
    const g = this.group();
    return g ? statsFor(g.id, this.groups.rosterOf(g.id), this.scope()) : [];
  });

  readonly summary = computed(() => summaryFor(this.stats(), this.scope()));
  readonly leaderboards = computed(() => leaderboardsFor(this.stats()));
  readonly awards = computed(() => awardsFor(this.stats()));
  readonly players = computed(() => this.stats());

  scopeLabel(): string {
    return this.scopeOptions.find((s) => s.id === this.scope())?.label ?? '';
  }

  /** Avatar radial gradient from a member hue, matching the ranking/roster look. */
  grad(hue: number): string {
    return `radial-gradient(circle at 32% 26%, hsl(${hue},90%,64%), hsl(${hue},78%,30%))`;
  }

  points(lb: StatLeaderboard): string {
    return lb.spark ? sparkPoints(lb.spark) : '';
  }

  /** Rows below the leader, shown as the compact list. */
  rest(lb: StatLeaderboard) {
    return lb.rows.slice(1);
  }

  toggle(m: Member): void {
    this.expandedTag.update((t) => (t === m.tag ? null : m.tag));
  }

  tiles = playerTiles;
}
