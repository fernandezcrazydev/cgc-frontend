import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NfButton, NfSkeleton } from '../../../../ui';
import { HistorialCruzado } from '../historial-cruzado';
import { MatchHistoryUiState } from '../match-history/match-history-ui';
import { Synergy } from '../synergy';
import { Versus } from '../versus';
import { CrossActiveTab, CrossHeaderComponent } from './cross-header.component';
import { CrossViewState } from './cross-view-state';

@Component({
  selector: 'app-cross-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [CrossViewState, MatchHistoryUiState],
  imports: [
    RouterLink,
    RouterOutlet,
    NfButton,
    NfSkeleton,
    CrossHeaderComponent,
    Versus,
    Synergy,
    HistorialCruzado,
  ],
  template: `
    <div class="view cx-layout">
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
          <nf-skeleton width="100%" height="42px" radius="10px" />
        </div>
      } @else if (state.status() === 'error') {
        <div class="view__head">
          <div class="view__eyebrow nf-mono">Error de carga</div>
          <h1 class="view__title">No se ha podido cargar</h1>
          <p class="view__lead">
            No hemos podido traer los datos de la partida. Puede ser cosa de la conexión.
          </p>
        </div>
        <button nfButton variant="primary" size="md" (click)="state.reload()">Reintentar</button>
      } @else if (state.player(); as p) {
        <app-cross-header [activeTab]="activeTab()" (tabChange)="setTab($event)" />

        @if (hasChildMatchDetail()) {
          <router-outlet />
        } @else {
          <!-- Conmutación reactiva 100% en cliente sin recargas ni parpadeos -->
          @switch (activeTab()) {
            @case ('contra') {
              <app-versus />
            }
            @case ('juntos') {
              <app-synergy />
            }
            @case ('historial') {
              <app-historial-cruzado />
            }
          }
        }
      } @else {
        <div class="empty-state">
          <p class="empty-state__text nf-mono">Jugador no encontrado</p>
          <p class="empty-state__hint">
            No encontramos a nadie con el tag «{{ state.playerId() }}» en tus grupos.
          </p>
          <button nfButton variant="primary" size="md" [routerLink]="['/app', 'grupos']">
            Ver mis grupos
          </button>
        </div>
      }
    </div>
  `,
  styleUrl: './cross-layout.scss',
})
export class CrossLayout {
  readonly state = inject(CrossViewState);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);

  private readonly urlSignal = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly hasChildMatchDetail = computed(() => {
    const url = this.urlSignal() ?? '';
    return url.includes('/contra/') || url.includes('/juntos/');
  });

  private resolveTabFromUrl(url: string): CrossActiveTab {
    if (url.includes('/juntos')) return 'juntos';
    if (url.includes('/contra')) return 'contra';
    return 'historial';
  }

  readonly activeTab = signal<CrossActiveTab>(this.resolveTabFromUrl(this.router.url));

  setTab(tab: CrossActiveTab): void {
    this.activeTab.set(tab);
    const playerId = this.state.playerId();
    if (!playerId) return;

    const base = `/app/jugador/${encodeURIComponent(playerId)}`;
    const target = tab === 'historial' ? base : `${base}/${tab}`;
    this.location.go(target);
  }
}
