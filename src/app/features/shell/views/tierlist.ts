import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfButton } from '../../../ui';

// BACKEND NOTE: la tierlist está por hacer y depende de que exista el endpoint de partidas:
// el ranking de campeones por liga o grupo (winrate, presencia, prioridad de pick/ban) y el
// detalle individual por campeón —al que ya apuntan los perfiles— se calculan sobre partidas
// disputadas, y hoy no hay ninguna en el sistema. La pantalla dice explícitamente que está
// pendiente en vez de enseñar un ranking sembrado.
@Component({
  selector: 'app-tierlist',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton],
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono">Estadísticas y catálogo</div>
        <h1 class="view__title">Tierlist</h1>
        <p class="view__lead">Me tienen que completar</p>
      </div>

      <div class="empty-state">
        <div class="empty-state__icon">⚔</div>
        <p class="empty-state__text nf-mono">Me tienen que completar</p>
        <p class="empty-state__hint">
          La tierlist de campeones por liga/grupo y el detalle individual de cada campeón se
          implementarán en una próxima feature.
        </p>
        <button nfButton variant="primary" size="md" [routerLink]="['/app', 'historial']">
          Volver al historial
        </button>
      </div>
    </div>
  `,
})
export class Tierlist {}
