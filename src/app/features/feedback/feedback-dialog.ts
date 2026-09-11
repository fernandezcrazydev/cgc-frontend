import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  BUG_FREQUENCIES,
  BugFrequency,
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FeedbackArea,
  FeedbackContext,
  FeedbackKind,
  FeedbackReport,
  FeedbackStore,
} from '../../core/feedback';
import { errorMessage } from '../../core/http';
import { ToastService } from '../../core/toast';
import { NfButton, NfModal, NfSegmented, NfSelect } from '../../ui';

/** Cómo llamamos al reporte en el toast de confirmación. */
const KIND_NOUN: Record<FeedbackKind, string> = {
  bug: 'reporte de bug',
  proposal: 'propuesta',
  incident: 'incidencia',
};

/**
 * Diálogo de reporte, al estilo de las plantillas de issue de GitHub: primero el
 * tipo (bug / propuesta / incidencia) y luego las preguntas propias de ese tipo,
 * en vez de un textarea en blanco que nadie sabe cómo rellenar.
 *
 * Lo abre el shell con `@if`; el diálogo solo pide cerrarse (`closed`). El envío
 * es pesimista: hasta que el servidor no confirma no se cierra ni se felicita a
 * nadie, y si falla el borrador se queda intacto para reintentar.
 */
@Component({
  selector: 'app-feedback-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NfModal, NfButton, NfSelect, NfSegmented],
  templateUrl: './feedback-dialog.html',
  styleUrl: './feedback-dialog.scss',
})
export class FeedbackDialog {
  /** El shell cierra el diálogo; aquí solo se pide (cancelar, backdrop, Escape, éxito). */
  readonly closed = output<void>();

  protected readonly store = inject(FeedbackStore);
  private readonly toasts = inject(ToastService);

  protected readonly kinds = FEEDBACK_KINDS;
  protected readonly frequencies = BUG_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }));
  protected readonly areaLabels = FEEDBACK_AREAS.map((a) => a.label);

  protected readonly kind = signal<FeedbackKind>('bug');
  protected readonly title = signal('');

  // Bug
  protected readonly whatHappened = signal('');
  protected readonly steps = signal('');
  protected readonly bugExpected = signal('');
  protected readonly frequency = signal<BugFrequency>('always');

  // Propuesta
  protected readonly problem = signal('');
  protected readonly solution = signal('');
  protected readonly alternatives = signal('');

  // Incidencia
  protected readonly observed = signal('');
  protected readonly incidentExpected = signal('');
  protected readonly whenHappened = signal('');

  /** Ruta desde la que se abrió el diálogo: es la que el usuario estaba mirando. */
  protected readonly route = inject(Router).url;
  protected readonly userAgent = navigator.userAgent;
  protected readonly viewport = `${window.innerWidth}×${window.innerHeight}`;

  /** La zona se pre-rellena con la del sitio donde estaba: casi siempre acierta. */
  protected readonly areaLabel = signal(labelOf(areaOfRoute(this.route)));

  protected readonly canSubmit = computed(() => {
    if (!this.title().trim()) return false;
    switch (this.kind()) {
      case 'bug':
        return !!(this.whatHappened().trim() && this.steps().trim() && this.bugExpected().trim());
      case 'proposal':
        return !!(this.problem().trim() && this.solution().trim());
      case 'incident':
        return !!this.observed().trim();
    }
  });

  /** Cerrar se ignora mientras hay un envío en vuelo: no se tira lo ya escrito. */
  protected requestClose(): void {
    if (this.store.submitting()) return;
    this.closed.emit();
  }

  protected async submit(): Promise<void> {
    if (!this.canSubmit() || this.store.submitting()) return;

    const kind = this.kind();
    try {
      if (!(await this.store.submit(this.buildReport()))) return;
    } catch (e) {
      // El texto en español lo decide el catálogo `code → mensaje` de `core/http`,
      // nunca el `detail` técnico del backend.
      this.toasts.error(errorMessage(e));
      return;
    }

    this.toasts.success(`¡Gracias! Hemos registrado tu ${KIND_NOUN[kind]}.`);
    this.closed.emit();
  }

  protected setFrequency(value: string): void {
    this.frequency.set(value as BugFrequency);
  }

  /** Valor de un `<input>`/`<textarea>` desde su evento `input`. */
  protected text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  private buildReport(): FeedbackReport {
    const base = {
      title: this.title().trim(),
      area: valueOf(this.areaLabel()),
      context: this.context(),
    };

    switch (this.kind()) {
      case 'bug':
        return {
          ...base,
          kind: 'bug',
          whatHappened: this.whatHappened().trim(),
          steps: this.steps().trim(),
          expected: this.bugExpected().trim(),
          frequency: this.frequency(),
        };
      case 'proposal':
        return {
          ...base,
          kind: 'proposal',
          problem: this.problem().trim(),
          solution: this.solution().trim(),
          alternatives: this.alternatives().trim(),
        };
      case 'incident':
        return {
          ...base,
          kind: 'incident',
          observed: this.observed().trim(),
          expected: this.incidentExpected().trim(),
          whenHappened: this.whenHappened().trim(),
        };
    }
  }

  private context(): FeedbackContext {
    return { route: this.route, userAgent: this.userAgent, viewport: this.viewport };
  }
}

/** Zona que toca la ruta actual. Heurística de UX: el usuario puede corregirla. */
function areaOfRoute(url: string): FeedbackArea {
  if (url.includes('/tablon') || url.includes('/convocatoria') || url.includes('/sala')) return 'partidas';
  if (url.includes('/draft') || url.includes('/tierlist')) return 'draft';
  if (url.includes('/grupos')) return 'grupos';
  if (url.includes('/historial')) return 'historial';
  if (url.includes('/ajustes') || url.includes('/perfil')) return 'ajustes';
  if (url.includes('/inicio')) return 'inicio';
  return 'otra';
}

/**
 * `NfSelect` es una primitiva legacy que trabaja con las etiquetas visibles, no
 * con valores: estas dos funciones traducen entre la etiqueta del desplegable y
 * el valor estable que viaja al backend.
 */
function labelOf(area: FeedbackArea): string {
  return FEEDBACK_AREAS.find((a) => a.value === area)!.label;
}

function valueOf(label: string): FeedbackArea {
  return FEEDBACK_AREAS.find((a) => a.label === label)?.value ?? 'otra';
}
