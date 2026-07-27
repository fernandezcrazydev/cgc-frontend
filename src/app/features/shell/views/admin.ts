import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminActionsApi, RiotProfileIconSyncReport } from '../../../core/admin';
import { errorMessage } from '../../../core/http';
import { ToastService } from '../../../core/toast';
import { NfButton } from '../../../ui';

/** Un item del directorio: o navega a otra vista admin, o dispara una acción aquí mismo. */
interface AdminDirectoryItem {
  id: string;
  label: string;
  description: string;
  glyph: string;
}

/** Hoy solo hay dos tarjetas; el `id` decide qué renderiza el `@switch` del template. */
const ITEMS: AdminDirectoryItem[] = [
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'Triaje de bugs, propuestas e incidencias reportadas por usuarios.',
    glyph: '🛡',
  },
  {
    id: 'riot-profile-icons-sync',
    label: 'Sincronizar iconos de perfil de Riot',
    description:
      'Fuerza ya la sincronización que corre cada noche, sin esperar al cron. Actualiza el icono de invocador guardado de cada cuenta vinculada.',
    glyph: '🔄',
  },
];

/**
 * Directorio de acciones admin (solo ADMIN, protegido por `adminGuard`). Cada tarjeta o
 * enlaza a una vista admin ya existente, o dispara una acción del backend directamente aquí.
 * Pensado para crecer: añadir una tarjeta es añadir un item a `ITEMS` y un caso al `@switch`.
 */
@Component({
  selector: 'app-admin-directory',
  standalone: true,
  imports: [RouterLink, NfButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono nf-eyebrow">Administración</div>
        <h1 class="view__title">Admin</h1>
        <p class="view__lead">Acciones de administración: triaje de reportes y operaciones puntuales sobre datos del servidor.</p>
      </div>

      <div class="ad-grid">
        @for (item of items; track item.id) {
          @switch (item.id) {
            @case ('feedback') {
              <a class="ad-card" [routerLink]="['/app', 'admin', 'feedback']">
                <span class="ad-card__glyph">{{ item.glyph }}</span>
                <span class="ad-card__body">
                  <span class="ad-card__label">{{ item.label }}</span>
                  <span class="ad-card__desc">{{ item.description }}</span>
                </span>
                <span class="ad-card__cta nf-mono nf-caps nf-go">Abrir</span>
              </a>
            }
            @case ('riot-profile-icons-sync') {
              <div class="ad-card">
                <span class="ad-card__glyph">{{ item.glyph }}</span>
                <span class="ad-card__body">
                  <span class="ad-card__label">{{ item.label }}</span>
                  <span class="ad-card__desc">{{ item.description }}</span>
                  @if (syncResult(); as r) {
                    <span class="ad-card__result nf-mono">
                      {{ r.updated }}/{{ r.total }} cuentas actualizadas{{ r.failed ? ', ' + r.failed + ' fallidas' : '' }}
                    </span>
                  }
                </span>
                <button
                  type="button"
                  nfButton
                  variant="primary"
                  size="sm"
                  [disabled]="syncPending()"
                  (click)="syncRiotProfileIcons()"
                >
                  {{ syncPending() ? 'Sincronizando…' : 'Sincronizar ahora' }}
                </button>
              </div>
            }
          }
        }
      </div>
    </div>
  `,
  styles: [
    `
      .ad-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 14px;
      }
      .ad-card {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 18px;
        border: 1px solid var(--nf-border, rgba(255, 255, 255, 0.12));
        border-radius: 10px;
        background: var(--nf-surface-2);
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s ease, transform 0.15s ease;
      }
      a.ad-card:hover {
        border-color: var(--nf-accent, #ff5bb0);
        transform: translateY(-2px);
      }
      .ad-card__glyph {
        font-size: 22px;
        line-height: 1;
      }
      .ad-card__body {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        flex: 1;
      }
      .ad-card__label {
        font-weight: 700;
      }
      .ad-card__desc {
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--nf-text-mid);
      }
      .ad-card__result {
        font-size: 12px;
        color: var(--nf-cyan);
      }
      .ad-card__cta {
        align-self: center;
        font-size: 11px;
        opacity: 0.6;
        white-space: nowrap;
      }
    `,
  ],
})
export class AdminDirectory {
  private readonly api = inject(AdminActionsApi);
  private readonly toasts = inject(ToastService);

  readonly items = ITEMS;

  readonly syncPending = signal(false);
  readonly syncResult = signal<RiotProfileIconSyncReport | null>(null);

  /** No reentrante: el botón se deshabilita mientras la petición está en vuelo. */
  async syncRiotProfileIcons(): Promise<void> {
    if (this.syncPending()) return;
    this.syncPending.set(true);
    try {
      const report = await firstValueFrom(this.api.syncRiotProfileIcons());
      this.syncResult.set(report);
      this.toasts.success(
        `${report.updated}/${report.total} cuentas actualizadas${report.failed ? ', ' + report.failed + ' fallidas' : ''}`,
      );
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.syncPending.set(false);
    }
  }
}
