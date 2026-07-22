import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FeedbackAdminStore,
  FeedbackKindTag,
  FeedbackStatusTag,
  allowedNextStatuses,
} from '../../../core/feedback';
import { ToastService } from '../../../core/toast';
import { NfBadge, NfBadgeColor, NfButton, NfSelect } from '../../../ui';

const KIND_LABEL: Record<FeedbackKindTag, string> = {
  BUG: 'Bug',
  PROPOSAL: 'Propuesta',
  INCIDENT: 'Incidencia',
};
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
const FREQUENCY_LABEL: Record<string, string> = {
  ALWAYS: 'Siempre',
  SOMETIMES: 'A veces',
  ONCE: 'Una vez',
};

/**
 * Detalle de un reporte (solo ADMIN): cuerpo completo, autor, contexto de diagnóstico y el
 * triaje. Desde aquí el admin mueve el estado (`NEW → IN_REVIEW → RESOLVED | REJECTED`) y
 * escribe una nota interna, ambos en un único PATCH. El selector solo ofrece transiciones
 * legales; el backend revalida y responde 409 a un salto imposible.
 */
@Component({
  selector: 'app-admin-feedback-detalle',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule, NfBadge, NfButton, NfSelect],
  template: `
    <div class="view">
      <a class="afd-back nf-mono" [routerLink]="['/app', 'admin', 'feedback']">◄ VOLVER A LA LISTA</a>

      @if (store.detailLoading()) {
        <div class="afd-empty nf-mono nf-eyebrow">Cargando…</div>
      } @else if (store.detail(); as f) {
        <div class="view__head">
          <div class="view__eyebrow nf-mono nf-eyebrow nf-eyebrow--asis">{{ kindLabel(f.kind) }} · {{ f.area }}</div>
          <h1 class="view__title">{{ f.title }}</h1>
          <div class="afd-meta nf-mono">
            <nf-badge [color]="statusColor(f.status)">{{ statusLabel(f.status) }}</nf-badge>
            <span>De {{ f.author.discordUsername }}</span>
            <span>· {{ f.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
          </div>
        </div>

        <!-- cuerpo específico del tipo -->
        @if (f.bug; as b) {
          <div class="afd-block">
            <div class="afd-field">
              <span class="afd-field__k nf-mono">QUÉ PASÓ</span>
              <p class="afd-field__v">{{ b.whatHappened }}</p>
            </div>
            <div class="afd-field">
              <span class="afd-field__k nf-mono">PASOS</span>
              <p class="afd-field__v">{{ b.steps }}</p>
            </div>
            <div class="afd-field">
              <span class="afd-field__k nf-mono">ESPERADO</span>
              <p class="afd-field__v">{{ b.expected }}</p>
            </div>
            <div class="afd-field">
              <span class="afd-field__k nf-mono">FRECUENCIA</span>
              <p class="afd-field__v">{{ frequencyLabel(b.frequency) }}</p>
            </div>
          </div>
        } @else if (f.proposal; as p) {
          <div class="afd-block">
            <div class="afd-field">
              <span class="afd-field__k nf-mono">PROBLEMA</span>
              <p class="afd-field__v">{{ p.problem }}</p>
            </div>
            <div class="afd-field">
              <span class="afd-field__k nf-mono">SOLUCIÓN PROPUESTA</span>
              <p class="afd-field__v">{{ p.solution }}</p>
            </div>
            @if (p.alternatives) {
              <div class="afd-field">
                <span class="afd-field__k nf-mono">ALTERNATIVAS</span>
                <p class="afd-field__v">{{ p.alternatives }}</p>
              </div>
            }
          </div>
        } @else if (f.incident; as i) {
          <div class="afd-block">
            <div class="afd-field">
              <span class="afd-field__k nf-mono">OBSERVADO</span>
              <p class="afd-field__v">{{ i.observed }}</p>
            </div>
            @if (i.expected) {
              <div class="afd-field">
                <span class="afd-field__k nf-mono">ESPERADO</span>
                <p class="afd-field__v">{{ i.expected }}</p>
              </div>
            }
            @if (i.whenHappened) {
              <div class="afd-field">
                <span class="afd-field__k nf-mono">CUÁNDO</span>
                <p class="afd-field__v">{{ i.whenHappened }}</p>
              </div>
            }
          </div>
        }

        <!-- contexto técnico -->
        <div class="afd-block afd-block--ctx">
          <div class="afd-ctx nf-mono">
            <span>◆ RUTA · {{ f.context.route }}</span>
            <span>◆ VIEWPORT · {{ f.context.viewport }}</span>
            <span>◆ UA · {{ f.context.userAgent }}</span>
          </div>
        </div>

        <!-- triaje -->
        <div class="afd-block afd-triage">
          <h2 class="afd-triage__title nf-mono nf-eyebrow">Triaje</h2>
          <label class="afd-field">
            <span class="afd-field__k nf-mono">ESTADO</span>
            <nf-select [options]="statusLabels()" [value]="statusLabel(status())" (valueChange)="onStatus($event)" />
          </label>
          <label class="afd-field">
            <span class="afd-field__k nf-mono">NOTA INTERNA (solo admins)</span>
            <textarea
              class="afd-note"
              rows="3"
              [ngModel]="note()"
              (ngModelChange)="note.set($event)"
              placeholder="Contexto para el equipo, decisión de triaje…"
            ></textarea>
          </label>
          <div class="afd-actions">
            <button
              nfButton
              variant="primary"
              size="md"
              [disabled]="store.saving() || !dirty()"
              (click)="save(f.id)"
            >
              {{ store.saving() ? 'GUARDANDO…' : 'GUARDAR CAMBIOS' }}
            </button>
          </div>
          <p class="afd-updated nf-mono">Última actualización: {{ f.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</p>
        </div>
      } @else {
        <div class="afd-empty nf-mono nf-eyebrow">Reporte no encontrado</div>
      }
    </div>
  `,
  styles: [
    `
      .afd-back {
        display: inline-block;
        margin-bottom: 16px;
        font-size: 12px;
        opacity: 0.7;
        text-decoration: none;
        color: inherit;
      }
      .afd-back:hover {
        opacity: 1;
      }
      .afd-meta {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
        font-size: 12px;
        opacity: 0.85;
      }
      .afd-block {
        border: 1px solid var(--nf-border, rgba(255, 255, 255, 0.12));
        border-radius: 8px;
        padding: 16px 18px;
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .afd-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .afd-field__k {
        font-size: 11px;
        opacity: 0.6;
        letter-spacing: 0.08em;
      }
      .afd-field__v {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .afd-block--ctx {
        background: rgba(255, 255, 255, 0.02);
      }
      .afd-ctx {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 12px;
        opacity: 0.75;
        word-break: break-all;
      }
      .afd-triage__title {
        margin: 0;
        font-size: 12px;
        opacity: 0.7;
      }
      .afd-note {
        width: 100%;
        box-sizing: border-box;
        resize: vertical;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid var(--nf-border, rgba(255, 255, 255, 0.15));
        border-radius: 6px;
        color: inherit;
        padding: 10px 12px;
        font-family: inherit;
      }
      .afd-actions {
        display: flex;
        justify-content: flex-end;
      }
      .afd-updated {
        margin: 0;
        font-size: 11px;
        opacity: 0.5;
      }
      .afd-empty {
        padding: 40px 0;
        text-align: center;
        opacity: 0.6;
      }
    `,
  ],
})
export class AdminFeedbackDetalle {
  readonly store = inject(FeedbackAdminStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /** Estado y nota editables, sembrados desde el reporte cargado y tras cada guardado. */
  readonly status = signal<FeedbackStatusTag>('NEW');
  readonly note = signal('');

  /** Transiciones legales desde el estado PERSISTIDO (incluye el propio, para editar solo la nota). */
  readonly statusLabels = computed(() => {
    const current = this.store.detail()?.status ?? 'NEW';
    return allowedNextStatuses(current).map((s) => STATUS_LABEL[s]);
  });

  /** Hay algo que guardar: cambió el estado o la nota respecto a lo persistido. */
  readonly dirty = computed(() => {
    const f = this.store.detail();
    if (!f) return false;
    return this.status() !== f.status || this.note() !== (f.adminNote ?? '');
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
  }

  kindLabel = (k: FeedbackKindTag) => KIND_LABEL[k];
  statusLabel = (s: FeedbackStatusTag) => STATUS_LABEL[s];
  statusColor = (s: FeedbackStatusTag) => STATUS_COLOR[s];
  frequencyLabel = (f: string) => FREQUENCY_LABEL[f] ?? f;

  onStatus(label: string): void {
    const tag = (Object.keys(STATUS_LABEL) as FeedbackStatusTag[]).find((s) => STATUS_LABEL[s] === label);
    if (tag) this.status.set(tag);
  }

  private syncFromDetail(): void {
    const f = this.store.detail();
    if (!f) return;
    this.status.set(f.status);
    this.note.set(f.adminNote ?? '');
  }

  private async load(id: string): Promise<void> {
    try {
      await this.store.loadDetail(id);
      this.syncFromDetail();
    } catch {
      this.toasts.error('No se pudo cargar el reporte');
    }
  }

  async save(id: string): Promise<void> {
    try {
      const ok = await this.store.save(id, { status: this.status(), adminNote: this.note().trim() || null });
      if (ok) {
        this.syncFromDetail();
        this.toasts.success('Reporte actualizado');
      }
    } catch {
      // El backend rechaza una transición ilegal con 409; el resto, error genérico.
      this.toasts.error('No se pudo guardar: la transición de estado no es válida');
    }
  }
}
