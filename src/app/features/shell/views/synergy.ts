import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NfButton, NfSkeleton } from '../../../ui';
import { CrossHeaderComponent } from './cross/cross-header.component';
import { CrossStatsComponent } from './cross/cross-stats.component';
import { CrossViewState } from './cross/cross-view-state';

/**
 * Sinergia global con un jugador: las medias acumuladas de TODO lo que habéis jugado en el
 * mismo equipo.
 *
 * Es el destino de «Mejor aliado» en tu perfil y de «Como compañeros» en el ajeno, y la pestaña
 * «Juntos» del conmutador del cruce. Comparte pantalla con `versus.ts` a través de
 * `<app-cross-stats>`: es la misma pregunta sobre el otro lado del cruce.
 */
@Component({
  selector: 'app-synergy',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CrossViewState],
  imports: [RouterLink, NfButton, NfSkeleton, CrossHeaderComponent, CrossStatsComponent],
  template: `
    <div class="view cx-view">
      <!--
        El orden lo fija CLAUDE.md: cargando, error, y solo entonces la entidad o su 404.
        Estaba al revés —se preguntaba primero por el jugador— y por eso un fallo de red se
        colaba pintando contenido a medias, y un 404 podía aparecer antes de tiempo.
      -->
      @if (state.loading()) {
        <div class="cx-boot" aria-busy="true">
          <div class="cx-boot__hero">
            <nf-skeleton width="58px" height="58px" radius="50%" />
            <div class="cx-boot__stack">
              <nf-skeleton width="90px" height="12px" />
              <nf-skeleton width="220px" height="24px" />
              <nf-skeleton width="140px" height="12px" />
            </div>
          </div>
          <nf-skeleton width="100%" height="38px" radius="10px" />
        </div>
      } @else if (state.status() === 'error') {
        <!--
          Un fallo de red no es un 404. Antes los dos caían en la misma rama y el usuario leía
          «jugador no encontrado» cuando lo que había fallado era el catálogo de campeones.
        -->
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error de carga</div>
          <h1 class="view__title">No se ha podido cargar</h1>
          <p class="view__lead">
            No hemos podido traer los datos de la partida. Puede ser cosa de la conexión.
          </p>
        </div>
        <button nfButton variant="primary" size="md" (click)="state.reload()">Reintentar</button>
      } @else if (state.player()) {
        <app-cross-header active="aliados" />
        <app-cross-stats relation="ally" />
      } @else {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error 404</div>
          <h1 class="view__title">Jugador no encontrado</h1>
          <p class="view__lead">Ese jugador no existe o ya no comparte ningún grupo contigo.</p>
        </div>
        <button nfButton variant="secondary" size="md" [routerLink]="['/app', 'perfil']">
          Volver a tu perfil
        </button>
      }
    </div>
  `,
})
export class Synergy {
  protected readonly state = inject(CrossViewState);
}
