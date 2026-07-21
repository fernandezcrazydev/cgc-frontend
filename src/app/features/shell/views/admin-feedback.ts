import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FeedbackAdminStore,
  FeedbackKindTag,
  FeedbackListFilters,
  FeedbackStatusTag,
} from '../../../core/feedback';
import { ToastService } from '../../../core/toast';
import { NfBadge, NfBadgeColor, NfPagination, NfSelect } from '../../../ui';

/** Etiquetas legibles y colores del badge para cada tipo/estado. Un único sitio: la vista los pinta. */
const KIND_LABEL: Record<FeedbackKindTag, string> = {
  BUG: 'Bug',
  PROPOSAL: 'Propuesta',
  INCIDENT: 'Incidencia',
};
const KIND_GLYPH: Record<FeedbackKindTag, string> = { BUG: '🐛', PROPOSAL: '💡', INCIDENT: '❓' };
const STATUS_LABEL: Record<FeedbackStatusTag, string> = {
  NEW: 'Nuevo',
  IN_REVIEW: 'En revisión',
  RESOLVED: 'Resuelto',
  REJECTED: 'Rechazado',
};
const STATUS_COLOR: Record<FeedbackStatusTag, NfBadgeColor> = {
  NEW: 'yellow',
  IN_REVIEW: 'cyan',
  RESOLVED: 'green',
  REJECTED: 'red',
};

/** Opción de un filtro: `tag` undefined = "no filtrar por este campo". */
interface FilterOption<T> {
  tag: T | undefined;
  label: string;
}

const STATUS_FILTERS: FilterOption<FeedbackStatusTag>[] = [
  { tag: undefined, label: 'Todos los estados' },
  { tag: 'NEW', label: 'Nuevo' },
  { tag: 'IN_REVIEW', label: 'En revisión' },
  { tag: 'RESOLVED', label: 'Resuelto' },
  { tag: 'REJECTED', label: 'Rechazado' },
];
const KIND_FILTERS: FilterOption<FeedbackKindTag>[] = [
  { tag: undefined, label: 'Todos los tipos' },
  { tag: 'BUG', label: 'Bug' },
  { tag: 'PROPOSAL', label: 'Propuesta' },
  { tag: 'INCIDENT', label: 'Incidencia' },
];

/**
 * Panel de triaje (solo ADMIN, protegido por `adminGuard`): lista paginada de reportes con
 * filtros por estado y tipo. Cada fila abre el detalle. La autorización real la hace el
 * backend; esta vista solo la expone a quien lleva el rol en el token.
 */
@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [RouterLink, DatePipe, NfSelect, NfBadge, NfPagination],
  template: `
    <div class="view">
      <div class="view__head">
        <div class="view__eyebrow nf-mono">// ADMINISTRACIÓN · REPORTES</div>
        <h1 class="view__title">Feedback</h1>
        <p class="view__lead">
          Reportes que envían los usuarios (bugs, propuestas e incidencias). Fíltralos y ábrelos para
          triarlos.
        </p>
      </div>

      <div class="af-filters">
        <label class="af-filter">
          <span class="af-filter__label nf-mono">ESTADO</span>
          <nf-select
            [options]="statusLabels"
            [value]="statusLabel()"
            (valueChange)="onStatus($event)"
          />
        </label>
        <label class="af-filter">
          <span class="af-filter__label nf-mono">TIPO</span>
          <nf-select [options]="kindLabels" [value]="kindLabel()" (valueChange)="onKind($event)" />
        </label>
      </div>

      @if (store.loading() && !store.page()) {
        <div class="af-empty nf-mono">// CARGANDO…</div>
      } @else if (store.page(); as pg) {
        @if (pg.content.length === 0) {
          <div class="af-empty nf-mono">// SIN REPORTES CON ESTOS FILTROS</div>
        } @else {
          <div class="af-list">
            @for (r of pg.content; track r.id) {
              <a class="af-row" [routerLink]="['/app', 'admin', 'feedback', r.id]">
                <span class="af-row__kind" [title]="kindLabel2(r.kind)">{{ glyph(r.kind) }}</span>
                <div class="af-row__main">
                  <span class="af-row__title">{{ r.title }}</span>
                  <span class="af-row__sub nf-mono">
                    {{ kindLabel2(r.kind) }} · {{ r.area }} · {{ r.author.discordUsername }}
                  </span>
                </div>
                <span class="af-row__when nf-mono">{{ r.createdAt | date: 'dd/MM/yy HH:mm' }}</span>
                <nf-badge [color]="statusColor(r.status)">{{ statusLabel2(r.status) }}</nf-badge>
                <span class="af-row__cta nf-mono">DETALLE ►</span>
              </a>
            }
          </div>

          <nf-pagination
            [total]="pg.totalElements"
            [pageSize]="pg.size"
            [page]="pg.page + 1"
            (pageChange)="goToPage($event)"
          />
        }
      }
    </div>
  `,
  styles: [
    `
      .af-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin-bottom: 20px;
      }
      .af-filter {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .af-filter__label {
        font-size: 11px;
        opacity: 0.7;
        letter-spacing: 0.08em;
      }
      .af-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
      }
      .af-row {
        display: grid;
        grid-template-columns: auto 1fr auto auto auto;
        align-items: center;
        gap: 14px;
        padding: 12px 16px;
        border: 1px solid var(--nf-border, rgba(255, 255, 255, 0.12));
        border-radius: 8px;
        text-decoration: none;
        color: inherit;
        transition: border-color 0.15s ease, transform 0.15s ease;
      }
      .af-row:hover {
        border-color: var(--nf-accent, #ff5bb0);
        transform: translateX(2px);
      }
      .af-row__kind {
        font-size: 20px;
      }
      .af-row__main {
        display: flex;
        flex-direction: column;
        min-width: 0;
      }
      .af-row__title {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .af-row__sub {
        font-size: 12px;
        opacity: 0.7;
      }
      .af-row__when {
        font-size: 12px;
        opacity: 0.7;
        white-space: nowrap;
      }
      .af-row__cta {
        font-size: 11px;
        opacity: 0.6;
      }
      .af-empty {
        padding: 40px 0;
        text-align: center;
        opacity: 0.6;
      }
      @media (max-width: 640px) {
        .af-row {
          grid-template-columns: auto 1fr auto;
        }
        .af-row__when,
        .af-row__cta {
          display: none;
        }
      }
    `,
  ],
})
export class AdminFeedback {
  readonly store = inject(FeedbackAdminStore);
  private readonly toasts = inject(ToastService);

  readonly statusLabels = STATUS_FILTERS.map((o) => o.label);
  readonly kindLabels = KIND_FILTERS.map((o) => o.label);

  readonly statusLabel = signal(STATUS_FILTERS[0].label);
  readonly kindLabel = signal(KIND_FILTERS[0].label);

  constructor() {
    void this.reload();
  }

  glyph = (k: FeedbackKindTag) => KIND_GLYPH[k];
  kindLabel2 = (k: FeedbackKindTag) => KIND_LABEL[k];
  statusLabel2 = (s: FeedbackStatusTag) => STATUS_LABEL[s];
  statusColor = (s: FeedbackStatusTag) => STATUS_COLOR[s];

  onStatus(label: string): void {
    this.statusLabel.set(label);
    void this.reload();
  }

  onKind(label: string): void {
    this.kindLabel.set(label);
    void this.reload();
  }

  private readonly filters = computed<FeedbackListFilters>(() => ({
    status: STATUS_FILTERS.find((o) => o.label === this.statusLabel())?.tag,
    kind: KIND_FILTERS.find((o) => o.label === this.kindLabel())?.tag,
  }));

  async goToPage(oneBased: number): Promise<void> {
    try {
      await this.store.loadPage(oneBased - 1);
    } catch {
      this.toasts.error('No se pudo cargar la página de reportes');
    }
  }

  private async reload(): Promise<void> {
    try {
      await this.store.applyFilters(this.filters());
    } catch {
      this.toasts.error('No se pudieron cargar los reportes');
    }
  }
}
