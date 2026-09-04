import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NfAvatar, NfSkeleton } from '../../../../ui';
import { HubDuel } from '../../../../core/group-hub';

/**
 * Rivalidades y duelos (§5.5.4, tarjeta gemela izquierda): rota entre *el clásico* del grupo y el
 * *dúo dinámico*.
 *
 * La tarjeta entera es el enlace —al cara a cara o a la sinergia, según lo que se esté mirando—,
 * así que no lleva botón dentro. Solo las flechas de paso frenan la propagación.
 */
@Component({
  selector: 'app-hub-duels',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfAvatar, NfSkeleton],
  template: `
    <section class="hub-card hub-duel" [attr.aria-busy]="loading() ? 'true' : null">
      <header class="hub-card__head">
        <h2 class="hub-card__title nf-mono">Rivalidades y duelos</h2>
        @if (duels().length > 1) {
          <span class="hub-card__nav">
            <span class="hub-duel__pos nf-mono">{{ index() + 1 }}/{{ duels().length }}</span>
            <button type="button" class="hub-card__nav-btn" aria-label="Duelo anterior" (click)="prev($event)">‹</button>
            <button type="button" class="hub-card__nav-btn" aria-label="Duelo siguiente" (click)="next($event)">›</button>
          </span>
        }
      </header>

      @if (loading()) {
        <nf-skeleton width="100%" height="150px" radius="10px" />
      } @else if (current(); as d) {
        <button
          type="button"
          class="hub-duel__card"
          [disabled]="!target() || !d.ctaLabel"
          [attr.aria-label]="d.ctaLabel ? (d.ctaLabel + ': ' + d.a.name + ' y ' + d.b.name) : (d.title + ': ' + d.a.name + ' y ' + d.b.name)"
          (click)="open(d)"
        >
          <span class="hub-duel__title nf-mono">{{ d.title }}</span>

          <span class="hub-duel__versus">
            <span class="hub-duel__side">
              <nf-avatar [src]="d.a.avatar ?? null" [fallback]="d.a.name" [tint]="d.a.hue" [size]="40" shape="round" />
              <span class="hub-duel__name nf-mono">{{ d.a.name }}</span>
            </span>

            <span class="hub-duel__center">
              <span class="hub-duel__score nf-mono">{{ d.centerValue }}</span>
              <span class="hub-duel__score-label nf-mono">{{ d.centerLabel }}</span>
            </span>

            <span class="hub-duel__side">
              <nf-avatar [src]="d.b.avatar ?? null" [fallback]="d.b.name" [tint]="d.b.hue" [size]="40" shape="round" />
              <span class="hub-duel__name nf-mono">{{ d.b.name }}</span>
            </span>
          </span>

          <span class="hub-duel__note">{{ d.note }}</span>

          @if (d.ctaLabel) {
            @if (target()) {
              <span class="hub-duel__cta nf-mono">{{ d.ctaLabel }}</span>
            } @else {
              <span class="hub-duel__cta nf-mono is-off">Sin historial cruzado todavía</span>
            }
          }
        </button>
      } @else {
        <p class="hub-card__empty">Hacen falta más partidas para que haya rivalidades que contar.</p>
      }
    </section>
  `,
  styleUrls: ['./hub-card.scss', './hub-duels.component.scss'],
})
export class HubDuelsComponent {
  readonly duels = input<readonly HubDuel[]>([]);
  readonly loading = input(false);

  private readonly router = inject(Router);

  private readonly _index = signal(0);
  readonly index = this._index.asReadonly();

  readonly current = computed<HubDuel | null>(() => this.duels()[this._index()] ?? null);

  /**
   * El jugador al que apunta la tarjeta. Sin id estable no hay a dónde ir y la tarjeta se queda
   * quieta en vez de llevar a una ruta rota. BACKEND NOTE: el id llega con el roster real.
   */
  readonly target = computed(() => this.current()?.b.playerId ?? null);

  open(duel: HubDuel): void {
    if (!duel.ctaLabel) return;
    const playerId = this.target();
    if (!playerId) return;
    void this.router.navigate([
      '/app',
      'jugador',
      playerId,
      duel.kind === 'clasico' ? 'contra' : 'juntos',
    ]);
  }

  next(event: Event): void {
    event.stopPropagation();
    this._index.update((i) => (i + 1) % Math.max(1, this.duels().length));
  }

  prev(event: Event): void {
    event.stopPropagation();
    const total = Math.max(1, this.duels().length);
    this._index.update((i) => (i - 1 + total) % total);
  }
}
