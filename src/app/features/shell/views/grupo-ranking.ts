import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { rankingFor, sparkPoints, RankEntry } from '../../../core/group-ranking';

@Component({
  selector: 'app-grupo-ranking',
  standalone: true,
  imports: [RouterLink, NfButton],
  template: `
    <div class="view">
      @if (group(); as g) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// RANKING DEL GRUPO</div>
          <p class="view__lead">Clasificación de los miembros del grupo ordenada por rating.</p>
        </div>

        <div class="lb">
          @for (e of ranking(); track e.name) {
            <div class="lb-row" [class.is-top]="e.rank <= 3">
              <div class="lb-rank" [attr.data-rank]="e.rank">
                @if (e.rank <= 3) {
                  <span class="lb-medal" [class]="'lb-medal--' + e.rank">▲</span>
                } @else {
                  <span class="lb-rank__num nf-mono">{{ e.rank }}</span>
                }
              </div>

              <span
                class="lb-avatar"
                [style.background]="'radial-gradient(circle at 32% 26%, hsl(' + e.hue + ',90%,64%), hsl(' + e.hue + ',78%,30%))'"
              >{{ e.initials }}</span>

              <div class="lb-meta">
                <div class="lb-name">
                  {{ e.name }}<span class="lb-name__tag nf-mono">#{{ e.tag }}</span>
                </div>
                <div class="lb-record nf-mono">
                  <span class="lb-record__w">{{ e.wins }}V</span>
                  <span class="lb-record__l">{{ e.losses }}D</span>
                  <span class="lb-record__dot">·</span>
                  <span class="lb-record__wr">{{ e.wr }}% WR</span>
                </div>
              </div>

              <svg class="lb-spark" [class.is-down]="e.trend === 'down'" viewBox="0 0 120 32" preserveAspectRatio="none">
                <polyline [attr.points]="spark(e)" />
              </svg>

              <div class="lb-rating">
                <div class="lb-rating__val">{{ e.rating }}</div>
                <div class="lb-rating__peak nf-mono">pico {{ e.peak }}</div>
              </div>
            </div>
          }
        </div>
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
  styleUrl: './views.scss',
})
export class GrupoRanking {
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

  readonly ranking = computed(() => {
    const g = this.group();
    return g ? rankingFor(g.id, g.members) : [];
  });

  spark(e: RankEntry): string {
    return sparkPoints(e.spark);
  }
}
