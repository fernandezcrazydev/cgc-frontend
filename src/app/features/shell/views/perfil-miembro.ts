import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton } from '../../../ui';

@Component({
  selector: 'app-perfil-miembro',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NfButton],
  template: `
    <div class="view">
      <a class="view-back nf-mono" [routerLink]="['/app', 'historial']">
        <span class="view-back__arrow" aria-hidden="true">←</span> Volver
      </a>

      <div class="view__head">
        <div class="view__eyebrow nf-mono">Perfil de jugador</div>
        <h1 class="view__title">Perfil de jugador</h1>
        <p class="view__lead">Me tienen que completar</p>
      </div>

      <div class="empty-state">
        <div class="empty-state__icon">🚧</div>
        <p class="empty-state__text nf-mono">Me tienen que completar</p>
        <p class="empty-state__hint">
          La vista dedicada al perfil detallado de integrantes del grupo se implementará en una próxima feature.
        </p>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'historial']">
          Volver al historial
        </button>
      </div>
    </div>
  `,
})
export class PerfilMiembro {
  private readonly route = inject(ActivatedRoute);

  readonly userId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? 'Jugador')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? 'Jugador' },
  );
}
