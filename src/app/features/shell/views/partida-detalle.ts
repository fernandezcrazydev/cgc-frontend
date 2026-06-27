import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfBadge, NfButton, NfWindow } from '../../../ui';
import { matchById, kdaRatio } from '../../../core/match-history';

@Component({
  selector: 'app-partida-detalle',
  standalone: true,
  imports: [RouterLink, NfBadge, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (match(); as m) {
        <div class="md-hero" [class.is-win]="m.win" [class.is-loss]="!m.win">
          <span
            class="md-hero__icon"
            [style.background]="'radial-gradient(circle at 32% 26%, ' + m.c1 + ', ' + m.c2 + ')'"
          >{{ m.initials }}</span>
          <div class="md-hero__meta">
            <div class="md-hero__top nf-mono">
              <span class="md-hero__result">{{ m.win ? 'VICTORIA' : 'DERROTA' }}</span>
              <span class="md-hero__dot">·</span>
              <span>{{ m.mode }}</span>
              <span class="md-hero__dot">·</span>
              <span>{{ m.durationMin }} MIN</span>
            </div>
            <h1 class="md-hero__champ">{{ m.champion }}</h1>
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
                  <span
                    class="md-itemslot__icon"
                    [style.background]="'linear-gradient(135deg, hsl(' + it.hue + ',70%,46%), hsl(' + it.hue + ',60%,24%))'"
                  ></span>
                  <span class="md-itemslot__name nf-mono">{{ it.name }}</span>
                </div>
              } @else {
                <div class="md-itemslot md-itemslot--empty">
                  <span class="md-itemslot__icon"></span>
                  <span class="md-itemslot__name nf-mono">VACÍO</span>
                </div>
              }
            }
          </div>
        </nf-window>

        <div class="actions md-actions">
          <button nfButton variant="ghost" size="md" [routerLink]="['/app', 'historial']">← VOLVER AL HISTORIAL</button>
        </div>
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ERROR 404</div>
          <h1 class="view__title">Partida no encontrada</h1>
          <p class="view__lead">Esta partida no existe o ya no está en tu historial.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'historial']">← VOLVER AL HISTORIAL</button>
      }
    </div>
  `,
})
export class PartidaDetalle {
  private readonly route = inject(ActivatedRoute);
  readonly ratio = kdaRatio;

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
