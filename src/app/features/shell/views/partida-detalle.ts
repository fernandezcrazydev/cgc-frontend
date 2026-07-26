import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfAvatar, NfBadge, NfButton, NfSkeleton, NfWindow } from '../../../ui';
import { matchById, kdaRatio } from '../../../core/match-history';
import { hash } from '../../../core/group-ranking';
import { GameDataStore } from '../../../core/game-data';

@Component({
  selector: 'app-partida-detalle',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfWindow, NfAvatar, NfSkeleton],
  template: `
    <div class="view">
      @if (match(); as m) {
        <div class="md-hero" [class.is-win]="m.win" [class.is-loss]="!m.win" [attr.aria-busy]="champsLoading() ? 'true' : null">
          <nf-avatar
            class="md-hero__icon"
            [loading]="champsLoading()"
            [src]="champion(m.championId)?.iconUrl ?? null"
            [fallback]="championName(m.championId)"
            [tint]="m.championId"
            [size]="68"
            shape="square"
          />
          <div class="md-hero__meta">
            <div class="md-hero__top nf-mono">
              <span class="md-hero__result">{{ m.win ? 'VICTORIA' : 'DERROTA' }}</span>
              <span class="md-hero__dot">·</span>
              <span>{{ m.mode }}</span>
              <span class="md-hero__dot">·</span>
              <span>{{ m.durationMin }} MIN</span>
            </div>
            @if (champsLoading()) {
              <nf-skeleton width="220px" height="clamp(22px, 5vw, 30px)" />
            } @else {
              <h1 class="md-hero__champ">{{ championName(m.championId) }}</h1>
            }
            <div class="md-hero__sub nf-mono">◆ {{ m.groupName }} ▪ {{ m.date }}</div>
          </div>
          <nf-badge [color]="m.win ? 'green' : 'pink'" [dot]="true">{{ m.win ? 'WIN' : 'LOSS' }}</nf-badge>
        </div>

        <div class="md-grid">
          <div class="md-stat">
            <div class="md-stat__val">{{ m.kills }}<span>/</span>{{ m.deaths }}<span>/</span>{{ m.assists }}</div>
            <div class="md-stat__lbl nf-mono">KDA · {{ ratio(m) }}</div>
          </div>
          <div class="md-stat">
            <div class="md-stat__val">{{ m.cs }}</div>
            <div class="md-stat__lbl nf-mono">MINIONS · {{ csPerMin() }}/MIN</div>
          </div>
          <div class="md-stat">
            <div class="md-stat__val">{{ goldFull() }}</div>
            <div class="md-stat__lbl nf-mono">ORO TOTAL</div>
          </div>
        </div>

        <div class="view__label nf-mono">▸ OBJETOS</div>
        <nf-window title="build.exe" accent="cyan" bodyPadding="18px">
          <div class="md-items">
            @for (it of m.items; track $index) {
              @if (it) {
                <div class="md-itemslot">
                  <nf-avatar class="md-itemslot__icon" [fallback]="it" [tint]="itemHue(it)" [size]="40" shape="square" />
                  <span class="md-itemslot__name nf-mono">{{ it }}</span>
                </div>
              } @else {
                <div class="md-itemslot md-itemslot--empty">
                  <span class="md-itemslot__icon--empty"></span>
                  <span class="md-itemslot__name nf-mono">VACÍO</span>
                </div>
              }
            }
          </div>
        </nf-window>

        <div class="actions md-actions">
          <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'historial']">← Volver al historial</button>
        </div>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono nf-eyebrow">Error 404</div>
          <h1 class="view__title">Partida no encontrada</h1>
          <p class="view__lead">Esta partida no existe o ya no está en tu historial.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'historial']">← Volver al historial</button>
      }
    </div>
  `,
})
export class PartidaDetalle {
  private readonly route = inject(ActivatedRoute);
  readonly ratio = kdaRatio;

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

  /** Tinte determinista (no `Math.random`) para el hueco de un objeto sin icono real todavía. */
  itemHue(name: string): number {
    return hash(name) % 360;
  }

  private readonly id = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id'))),
    { initialValue: this.route.snapshot.paramMap.get('id') },
  );

  readonly match = computed(() => {
    const id = this.id();
    return id ? matchById(id) ?? null : null;
  });

  readonly csPerMin = computed(() => {
    const m = this.match();
    return m ? (m.cs / m.durationMin).toFixed(1) : '0';
  });

  readonly goldFull = computed(() => {
    const m = this.match();
    return m ? m.gold.toLocaleString('es-ES') : '0';
  });
}
