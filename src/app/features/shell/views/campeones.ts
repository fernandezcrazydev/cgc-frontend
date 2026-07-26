import { Component, inject } from '@angular/core';
import { NfAvatar, NfSkeleton } from '../../../ui';
import { GameDataStore } from '../../../core/game-data';
import { championTagLabel } from '../../../shared/champion-tags';

/**
 * Ruta huérfana (no está en `app.routes.ts`, ver deuda del CLAUDE.md): se
 * migra el markup a iconos reales igualmente, pero arreglar el routing queda
 * fuera de alcance de esta tarea.
 */
@Component({
  selector: 'app-campeones',
  standalone: true,
  imports: [NfAvatar, NfSkeleton],
  template: `
    <div class="view">
      <p class="view__intro">Pool de campeones disponibles para el draft.</p>
      <div class="champ-grid" [attr.aria-busy]="gameData.status() === 'loading' ? 'true' : null">
        @switch (gameData.status()) {
          @case ('loading') {
            @for (i of skeletonRows; track i) {
              <div class="champ">
                <nf-skeleton width="88px" height="88px" radius="var(--nf-radius)" />
                <div>
                  <nf-skeleton width="70px" height="12.5px" />
                  <nf-skeleton width="46px" height="9px" />
                </div>
              </div>
            }
          }
          @case ('error') {
            <div class="empty-state">
              <div class="empty-state__icon">⚠</div>
              <div class="empty-state__text nf-mono nf-eyebrow">No hemos podido cargar el catálogo de campeones</div>
            </div>
          }
          @default {
            @for (c of gameData.champions(); track c.id) {
              <div class="champ">
                <nf-avatar class="champ__art" [src]="c.iconUrl" [fallback]="c.name" [tint]="c.id" [size]="88" shape="square" />
                <div>
                  <div class="champ__name">{{ c.name }}</div>
                  <div class="champ__role nf-mono">{{ tagLabel(c.tags[0]) }}</div>
                </div>
              </div>
            } @empty {
              <div class="empty-state">
                <div class="empty-state__icon">◎</div>
                <div class="empty-state__text nf-mono nf-eyebrow">Catálogo vacío todavía</div>
              </div>
            }
          }
        }
      </div>
    </div>
  `,
})
export class Campeones {
  protected readonly gameData = inject(GameDataStore);
  /** Filas de relleno mientras carga (misma caja que una fila real). */
  protected readonly skeletonRows = Array.from({ length: 12 }, (_, i) => i);

  constructor() {
    this.gameData.ensureLoaded();
  }

  tagLabel(tag: string | undefined): string {
    return tag ? championTagLabel(tag) : '';
  }
}
