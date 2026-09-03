import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminActionsApi, RiotAccountRefreshReport } from '../../../core/admin';
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

/** El `id` decide qué renderiza el `@switch` del template. */
const ITEMS: AdminDirectoryItem[] = [
  {
    id: 'feedback',
    label: 'Feedback',
    description: 'Triaje de bugs, propuestas e incidencias reportadas por usuarios.',
    glyph: '🛡',
  },
  {
    id: 'riot-metrics',
    label: 'Métricas API Riot',
    description:
      'Endpoints más consumidos, horas punta, quién gasta más cuota y la evolución de las llamadas. Toda la app depende de la API de Riot: aquí se ve qué le pedimos.',
    glyph: '📊',
  },
  {
    id: 'security-audit',
    label: 'Registro de seguridad',
    description:
      'Quién intenta entrar, desde qué dirección y con qué cliente. Sirve para detectar a quien machaca el login y sacar los datos que hacen falta para bloquearlo.',
    glyph: '🔐',
  },
  {
    id: 'riot-accounts-refresh',
    label: 'Refrescar cuentas de Riot',
    description:
      'Fuerza ya el barrido que corre cada noche, sin esperar al cron. Actualiza de cada cuenta vinculada el icono de invocador y el rango de SoloQ, que es lo que pinta el escudo del ranking.',
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
        <div class="view__eyebrow nf-mono">Administración</div>
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
                <span class="ad-card__cta nf-mono">Abrir</span>
              </a>
            }
            @case ('riot-metrics') {
              <a class="ad-card" [routerLink]="['/app', 'admin', 'riot-metricas']">
                <span class="ad-card__glyph">{{ item.glyph }}</span>
                <span class="ad-card__body">
                  <span class="ad-card__label">{{ item.label }}</span>
                  <span class="ad-card__desc">{{ item.description }}</span>
                </span>
                <span class="ad-card__cta nf-mono">Abrir</span>
              </a>
            }
            @case ('security-audit') {
              <a class="ad-card" [routerLink]="['/app', 'admin', 'seguridad']">
                <span class="ad-card__glyph">{{ item.glyph }}</span>
                <span class="ad-card__body">
                  <span class="ad-card__label">{{ item.label }}</span>
                  <span class="ad-card__desc">{{ item.description }}</span>
                </span>
                <span class="ad-card__cta nf-mono">Abrir</span>
              </a>
            }
            @case ('riot-accounts-refresh') {
              <div class="ad-card">
                <span class="ad-card__glyph">{{ item.glyph }}</span>
                <span class="ad-card__body">
                  <span class="ad-card__label">{{ item.label }}</span>
                  <span class="ad-card__desc">{{ item.description }}</span>
                  @if (refreshSummary(); as summary) {
                    <span class="ad-card__result nf-mono">{{ summary }}</span>
                  }
                </span>
                <button
                  type="button"
                  nfButton
                  variant="primary"
                  size="sm"
                  [disabled]="refreshPending()"
                  (click)="refreshRiotAccounts()"
                >
                  {{ refreshPending() ? 'Refrescando…' : 'Refrescar ahora' }}
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
        color: var(--nf-secondary);
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

  readonly refreshPending = signal(false);
  readonly refreshResult = signal<RiotAccountRefreshReport | null>(null);

  /**
   * Una sola frase para la tarjeta y para el toast, para que no puedan contar cosas distintas.
   *
   * Se nombran los dos hechos por separado porque fallan por separado, y `anchored` se dice
   * aparte de `seedsUpdated` porque no son lo mismo: un unranked refresca bien y no ancla. Los
   * saltos solo se mencionan si los hay — son lo normal cuando queda poca cuota, no una alarma.
   */
  readonly refreshSummary = computed(() => {
    const r = this.refreshResult();
    if (!r) return null;
    const parts = [
      `${r.iconsUpdated}/${r.total} iconos`,
      `${r.seedsUpdated}/${r.total} rangos (${r.anchored} con elo)`,
    ];
    if (r.failed) parts.push(`${r.failed} fallidas`);
    if (r.skipped) parts.push(`${r.skipped} sin cuota, para esta noche`);
    return parts.join(' · ');
  });

  /** No reentrante: el botón se deshabilita mientras la petición está en vuelo. */
  async refreshRiotAccounts(): Promise<void> {
    if (this.refreshPending()) return;
    this.refreshPending.set(true);
    try {
      this.refreshResult.set(await firstValueFrom(this.api.refreshRiotAccounts()));
      this.toasts.success(this.refreshSummary() ?? 'Cuentas refrescadas');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.refreshPending.set(false);
    }
  }
}
