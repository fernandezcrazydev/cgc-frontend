import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfButton, NfSkeleton } from '../../../ui';
import { GroupStore } from '../../../core/group-store';
import { matchesByGroup, kdaRatio, shortGold } from '../../../core/match-history';
import { hash } from '../../../core/group-ranking';
import { GameDataStore } from '../../../core/game-data';

@Component({
  selector: 'app-grupo-historial',
  standalone: true,
  imports: [RouterLink, NfButton, NfAvatar, NfSkeleton],
  template: `
    <div class="view">
      @if (group(); as g) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Historial del grupo</div>
          <h1 class="view__title">{{ g.name }}</h1>
          <p class="view__lead">Partidas disputadas en este grupo. Pulsa una para ver el detalle completo.</p>
        </div>

        @if (matches().length) {
          <div class="mh-list">
            @for (m of matches(); track m.id) {
              <a
                class="mh-row"
                [class.is-win]="m.win"
                [class.is-loss]="!m.win"
                [routerLink]="['/app', 'historial', m.id]"
              >
                <div class="mh-result">
                  <span class="mh-result__label nf-mono">{{ m.win ? 'Victoria' : 'Derrota' }}</span>
                  <span class="mh-result__mode nf-mono">{{ m.mode }}</span>
                  <span class="mh-result__time nf-mono">{{ m.durationMin }} min</span>
                </div>

                <div class="mh-champ" [attr.aria-busy]="champsLoading() ? 'true' : null">
                  <nf-avatar
                    class="mh-champ__icon"
                    [loading]="champsLoading()"
                    [src]="champion(m.championId)?.iconUrl ?? null"
                    [fallback]="championName(m.championId)"
                    [tint]="m.championId"
                    [size]="48"
                    shape="square"
                  />
                  <div class="mh-champ__meta">
                    @if (champsLoading()) {
                      <nf-skeleton width="110px" height="14px" />
                    } @else {
                      <span class="mh-champ__name">{{ championName(m.championId) }}</span>
                    }
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
                  <span class="mh-stat nf-mono"><span class="mh-stat__ico mh-stat__ico--gold">⬣</span>{{ gold(m.gold) }} oro</span>
                </div>

                <div class="mh-items">
                  @for (it of m.items; track $index) {
                    @if (it) {
                      <span class="mh-item" [style.background]="itemTint(it)" [title]="it"></span>
                    } @else {
                      <span class="mh-item mh-item--empty"></span>
                    }
                  }
                </div>

                <div class="mh-when">
                  <span class="mh-when__date nf-mono">{{ m.date }}</span>
                  <span class="mh-when__cta nf-mono">Detalle</span>
                </div>
              </a>
            }
          </div>
        } @else {
          <div class="empty-state">
            <span class="empty-state__icon">🎮</span>
            <p class="empty-state__text nf-mono">Sin partidas todavía</p>
            <p class="empty-state__hint">Este grupo aún no ha disputado ninguna partida.</p>
          </div>
        }
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Grupo no encontrado</h1>
          <p class="view__lead">El grupo que buscas no existe o ya no perteneces a él.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'grupos']">← Volver a grupos</button>
      }
    </div>
  `,
})
export class GrupoHistorial {
  private readonly route = inject(ActivatedRoute);
  readonly groups = inject(GroupStore);
  readonly ratio = kdaRatio;
  readonly gold = shortGold;

  protected readonly gameData = inject(GameDataStore);
  protected readonly champsLoading = computed(() => this.gameData.status() === 'loading');

  constructor() {
    this.gameData.ensureLoaded();
  }

  champion(id: number) {
    return this.gameData.championById().get(id);
  }

  championName(id: number): string {
    return this.champion(id)?.name ?? 'Campeón';
  }

  itemTint(name: string): string {
    const h = hash(name) % 360;
    return `linear-gradient(135deg, hsl(${h},70%,46%), hsl(${h},60%,24%))`;
  }

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly group = computed(() => {
    const id = this.id();
    return id ? this.groups.byId(id) ?? null : null;
  });

  readonly matches = computed(() => {
    const id = this.id();
    return id ? matchesByGroup(id) : [];
  });
}
