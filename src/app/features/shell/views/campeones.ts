import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfButton } from '../../../ui';

@Component({
  selector: 'app-campeones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton],
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono">Estadísticas y catálogo</div>
        <h1 class="view__title">Campeones</h1>
        <p class="view__lead">Me tienen que completar</p>
      </div>

      <div class="empty-state">
        <div class="empty-state__icon">⚔</div>
        <p class="empty-state__text nf-mono">Me tienen que completar</p>
        <p class="empty-state__hint">
          La vista de estadísticas de campeones por liga/grupo y catálogo general se implementará en una próxima feature.
        </p>
        <button nfButton variant="primary" size="md" [routerLink]="['/app', 'historial']">
          Volver al historial
        </button>
      </div>
    </div>
  `,
})
export class Campeones {}
