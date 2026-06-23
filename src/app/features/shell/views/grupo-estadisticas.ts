import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { NfButton, NfWindow } from '../../../ui';
import { GroupStore } from '../../../core/group-store';

@Component({
  selector: 'app-grupo-estadisticas',
  standalone: true,
  imports: [RouterLink, NfButton, NfWindow],
  template: `
    <div class="view">
      @if (group(); as g) {
        <a class="view-back nf-mono" [routerLink]="['/app', 'grupos', g.id]">
          <span class="view-back__arrow" aria-hidden="true">←</span> {{ g.name }}
        </a>
        <div class="view__head">
          <div class="view__eyebrow nf-mono">// ESTADÍSTICAS DEL GRUPO</div>
          <h1 class="view__title">{{ g.name }}</h1>
          <p class="view__lead">Rendimiento y métricas del grupo. Próximamente.</p>
        </div>

        <nf-window title="estadisticas.exe" accent="cyan" bodyPadding="40px">
          <div class="empty-state">
            <span class="empty-state__icon">📊</span>
            <p class="empty-state__text nf-mono">// SIN DATOS TODAVÍA</p>
            <p class="empty-state__hint">Aquí aparecerán las estadísticas del grupo cuando estén disponibles.</p>
          </div>
        </nf-window>
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
export class GrupoEstadisticas {
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
}
