import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NfButton, NfSkeleton } from '../../../../ui';
import { HistorialCruzado } from './historial-cruzado';
import { MatchHistoryUiState } from '../match-history/match-history-ui';
import { Synergy } from './synergy';
import { Versus } from './versus';
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
      } @else if (state.profilePrivate()) {
        <!--
          La pantalla que existía dibujada desde antes de que hubiera nada que la disparara: su
          estado era un includes('secret') sobre el Riot ID, o sea que eras privado si tu tag
          llevaba esa palabra. Ahora la dispara un 403 del servidor sobre una preferencia de
          verdad (cgc-backend#98).

          Sin «Reintentar»: no es un fallo, es una respuesta. Y sin el nombre de esa persona, que
          precisamente no se ha servido.
        -->
        <div class="cx-private">
          <svg class="cx-private__lock" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h1Zm2 0h6V7a3 3 0 0 0-6 0v3Z"
              fill="currentColor"
            />
          </svg>
          <h1 class="cx-private__title">Este perfil es privado</h1>
          <p class="cx-private__lead">
            Esta persona ha decidido que sus estadísticas solo las vean los administradores de sus
            grupos. Las partidas que habéis jugado juntos siguen estando en el historial.
          </p>
          <button nfButton variant="primary" size="md" [routerLink]="['/app', 'historial']">
            Ir al historial
          </button>
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
            No hemos podido identificar a ese jugador: ni está en el grupo que tienes abierto,
            ni aparece en ninguna partida vuestra que se haya subido.
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
