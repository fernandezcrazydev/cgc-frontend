import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MATCH_HISTORY, kdaRatio, shortGold } from '../../../core/match-history';
import { NfPagination } from '../../../ui';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [RouterLink, NfPagination],
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono nf-eyebrow">Registro de partidas</div>
        <h1 class="view__title">Historial</h1>
        <p class="view__lead">Tus últimas partidas disputadas. Pulsa una para ver el detalle completo.</p>
      </div>

      <div class="scope-note" role="note">
        <span class="scope-note__icon" aria-hidden="true">◆</span>
        <p class="scope-note__text">
          Estás viendo tu <strong>historial personal</strong> de todos los grupos, no el del grupo seleccionado.
          La columna <strong>◆ grupo</strong> indica a qué grupo pertenece cada partida.
        </p>
      </div>

      <div class="mh-list">
        @for (m of pageItems(); track m.id) {
          <a
            class="mh-row"
            [class.is-win]="m.win"
            [class.is-loss]="!m.win"
            [routerLink]="['/app', 'historial', m.id]"
          >
            <div class="mh-result">
              <span class="mh-result__label nf-mono">{{ m.win ? 'VICTORIA' : 'DERROTA' }}</span>
              <span class="mh-result__mode nf-mono">{{ m.mode }}</span>
              <span class="mh-result__time nf-mono">{{ m.durationMin }} MIN</span>
            </div>

            <div class="mh-champ">
              <span
                class="mh-champ__icon"
                [style.background]="'radial-gradient(circle at 32% 26%, ' + m.c1 + ', ' + m.c2 + ')'"
              >{{ m.initials }}</span>
              <div class="mh-champ__meta">
                <span class="mh-champ__name">{{ m.champion }}</span>
                <span class="mh-champ__group nf-mono">◆ {{ m.groupName }}</span>
              </div>
            </div>

            <div class="mh-kda">
              <span class="mh-kda__line">
                <strong>{{ m.kills }}</strong> /
                <strong class="mh-kda__deaths">{{ m.deaths }}</strong> /
                <strong>{{ m.assists }}</strong>
              </span>
              <span class="mh-kda__ratio nf-mono">{{ ratio(m) }} KDA</span>
            </div>

            <div class="mh-stats">
              <span class="mh-stat nf-mono"><span class="mh-stat__ico">◉</span>{{ m.cs }} CS</span>
              <span class="mh-stat nf-mono"><span class="mh-stat__ico mh-stat__ico--gold">⬣</span>{{ gold(m.gold) }} ORO</span>
            </div>

            <div class="mh-items">
              @for (it of m.items; track $index) {
                @if (it) {
                  <span
                    class="mh-item"
                    [style.background]="'linear-gradient(135deg, hsl(' + it.hue + ',70%,46%), hsl(' + it.hue + ',60%,24%))'"
                    [title]="it.name"
                  ></span>
                } @else {
                  <span class="mh-item mh-item--empty"></span>
                }
              }
            </div>

            <div class="mh-when">
              <span class="mh-when__date nf-mono">{{ m.date }}</span>
              <span class="mh-when__cta nf-mono nf-caps nf-go">Detalle</span>
            </div>
          </a>
        }
      </div>

      <nf-pagination
        [total]="matches.length"
        [pageSize]="pageSize"
        [page]="page()"
        (pageChange)="page.set($event)"
      />
    </div>
  `,
})
export class Historial {
  readonly matches = MATCH_HISTORY;
  readonly ratio = kdaRatio;
  readonly gold = shortGold;

  /** Records per page. Small here so the POC paginates with the mock data. */
  readonly pageSize = 4;
  readonly page = signal(1);

  /** Slice of matches shown for the current page. */
  readonly pageItems = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.matches.slice(start, start + this.pageSize);
  });
}
