import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfBadge, NfButton } from '../../../ui';
import { CURRENT_USER, MATCHES, STATS } from '../../../core/lobby';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [RouterLink, NfButton, NfBadge],
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono">// PANEL DE CONTROL</div>
        <h1 class="view__title">Hola, {{ user.name }}</h1>
        <p class="view__lead">Tu lobby está listo. Crea una partida o retoma un draft reciente.</p>
      </div>

      <div class="stats">
        @for (s of stats; track s.label) {
          <div class="stat">
            <div class="stat__label nf-mono">{{ s.label }}</div>
            <div class="stat__value nf-mono" [style.color]="s.accent">{{ s.value }}</div>
          </div>
        }
      </div>

      <div class="actions">
        <button nfButton variant="primary" size="md" [routerLink]="['/app', 'crear']">CREAR PARTIDA ►</button>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'campeones']">VER CAMPEONES</button>
      </div>

      <div class="view__label nf-mono">▸ PARTIDAS RECIENTES</div>
      <div class="matches">
        @for (m of matches; track m.name) {
          <div class="match">
            <div class="match__avatar" [style.background]="'radial-gradient(circle at 32% 26%, ' + m.c1 + ', ' + m.c2 + ')'"></div>
            <div class="match__meta">
              <div class="match__name nf-mono">{{ m.name }}</div>
              <div class="match__mode nf-mono">{{ m.mode }}</div>
            </div>
            <nf-badge [color]="m.color" [dot]="true">{{ m.status }}</nf-badge>
          </div>
        }
      </div>
    </div>
  `,
})
export class Inicio {
  readonly user = CURRENT_USER;
  readonly stats = STATS;
  readonly matches = MATCHES;
}
