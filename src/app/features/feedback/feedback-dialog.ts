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
  template: `
    <nf-modal title="reportar.exe" accent="cyan" width="580px" (closed)="requestClose()">
      <div class="fb">
        <div class="fb__notice" role="note">
          <span class="fb__notice-glyph" aria-hidden="true">⚠</span>
          <p class="fb__notice-text">
            <strong>Este formulario todavía no funciona: es solo visual.</strong>
            Aún no se envía nada. De momento, cualquier bug o sugerencia mándalo
            <strong>directamente por WhatsApp</strong>.
          </p>
        </div>

        <div class="fb__eyebrow nf-mono">// ¿QUÉ NOS CUENTAS?</div>

        <div class="fb__kinds" role="radiogroup" aria-label="Tipo de reporte">
          @for (k of kinds; track k.value) {
            <button
              type="button"
              role="radio"
              class="fb__kind"
              [attr.data-kind]="k.value"
              [class.is-on]="kind() === k.value"
              [attr.aria-checked]="kind() === k.value"
              (click)="kind.set(k.value)"
            >
              <span class="fb__kind-glyph" aria-hidden="true">{{ k.glyph }}</span>
              <span class="fb__kind-label nf-mono">{{ k.label }}</span>
              <span class="fb__kind-hint">{{ k.hint }}</span>
            </button>
          }
        </div>

        <div class="fb__row">
          <div class="fb__field">
            <label class="fb__label nf-mono" for="fb-title">
              TÍTULO <span class="fb__req">*</span>
              <span class="fb__count">{{ title().length }}/80</span>
            </label>
            <input
              id="fb-title"
              class="fb__input"
              maxlength="80"
              autocomplete="off"
              placeholder="Resumen en una línea"
              [value]="title()"
              (input)="title.set(text($event))"
            />
          </div>

          <div class="fb__field fb__field--area">
            <label class="fb__label nf-mono" for="fb-area">ZONA AFECTADA</label>
            <nf-select
              [options]="areaLabels"
              [value]="areaLabel()"
              (valueChange)="areaLabel.set($event)"
            />
          </div>
        </div>

        @switch (kind()) {
          @case ('bug') {
            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-what">¿QUÉ HA PASADO? <span class="fb__req">*</span></label>
              <textarea
                id="fb-what"
                class="fb__textarea"
                rows="3"
                maxlength="800"
                placeholder="Al pulsar «Crear partida» el modal se queda cargando y no pasa nada."
                [value]="whatHappened()"
                (input)="whatHappened.set(text($event))"
              ></textarea>
            </div>

            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-steps">¿CÓMO SE REPRODUCE? <span class="fb__req">*</span></label>
              <textarea
                id="fb-steps"
                class="fb__textarea"
                rows="3"
                maxlength="800"
                placeholder="1. Entro en el grupo X · 2. Pulso «Crear partida» · 3. Elijo 10 jugadores y genero equipos"
                [value]="steps()"
                (input)="steps.set(text($event))"
              ></textarea>
            </div>

            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-expected">¿CÓMO DEBERÍA COMPORTARSE? <span class="fb__req">*</span></label>
              <textarea
                id="fb-expected"
                class="fb__textarea"
                rows="2"
                maxlength="800"
                placeholder="Debería abrirse la sala con los dos equipos ya formados."
                [value]="bugExpected()"
                (input)="bugExpected.set(text($event))"
              ></textarea>
            </div>

            <div class="fb__field fb__field--inline">
              <label class="fb__label nf-mono">¿CON QUÉ FRECUENCIA?</label>
              <nf-segmented
                [options]="frequencies"
                [value]="frequency()"
                (valueChange)="setFrequency($event)"
                ariaLabel="Frecuencia del bug"
              />
            </div>
          }

          @case ('proposal') {
            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-problem">¿QUÉ PROBLEMA TIENES HOY? <span class="fb__req">*</span></label>
              <textarea
                id="fb-problem"
                class="fb__textarea"
                rows="3"
                maxlength="800"
                placeholder="No hay forma de repetir la última partida con los mismos equipos."
                [value]="problem()"
                (input)="problem.set(text($event))"
              ></textarea>
            </div>

            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-solution">¿QUÉ SOLUCIÓN PROPONES? <span class="fb__req">*</span></label>
              <textarea
                id="fb-solution"
                class="fb__textarea"
                rows="3"
                maxlength="800"
                placeholder="Un botón «Revancha» en el resumen que cree una sala con los mismos 10 jugadores."
                [value]="solution()"
                (input)="solution.set(text($event))"
              ></textarea>
            </div>

            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-alt">
                ¿HAS PENSADO ALTERNATIVAS? <span class="fb__opt">(opcional)</span>
              </label>
              <textarea
                id="fb-alt"
                class="fb__textarea"
                rows="2"
                maxlength="800"
                placeholder="También valdría poder duplicar una partida del historial."
                [value]="alternatives()"
                (input)="alternatives.set(text($event))"
              ></textarea>
            </div>
          }

          @default {
            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-observed">¿QUÉ HAS VISTO? <span class="fb__req">*</span></label>
              <textarea
                id="fb-observed"
                class="fb__textarea"
                rows="3"
                maxlength="800"
                placeholder="Mi MMR bajó después de ganar una partida."
                [value]="observed()"
                (input)="observed.set(text($event))"
              ></textarea>
            </div>

            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-inc-expected">
                ¿QUÉ ESPERABAS VER? <span class="fb__opt">(opcional)</span>
              </label>
              <textarea
                id="fb-inc-expected"
                class="fb__textarea"
                rows="2"
                maxlength="800"
                placeholder="Que subiera, o al menos que se quedara igual."
                [value]="incidentExpected()"
                (input)="incidentExpected.set(text($event))"
              ></textarea>
            </div>

            <div class="fb__field">
              <label class="fb__label nf-mono" for="fb-when">
                ¿CUÁNDO O DÓNDE TE PASÓ? <span class="fb__opt">(opcional)</span>
              </label>
              <textarea
                id="fb-when"
                class="fb__textarea"
                rows="2"
                maxlength="800"
                placeholder="Ayer por la noche, en la sala del grupo Night Owls."
                [value]="whenHappened()"
                (input)="whenHappened.set(text($event))"
              ></textarea>
            </div>
          }
        }

        <details class="fb__ctx">
          <summary class="fb__ctx-sum nf-mono">SE ENVIARÁ TAMBIÉN</summary>
          <ul class="fb__ctx-list nf-mono">
            <li>Ruta: <span>{{ route }}</span></li>
            <li>Pantalla: <span>{{ viewport }}</span></li>
            <li>Navegador: <span class="fb__ctx-ua">{{ userAgent }}</span></li>
            <li>Tu usuario, de tu sesión de Discord</li>
          </ul>
        </details>

        <div class="fb__actions">
          <button nfButton variant="ghost" size="md" [disabled]="store.submitting()" (click)="requestClose()">
            CANCELAR
          </button>
          <button
            nfButton
            variant="primary"
            size="md"
            [disabled]="!canSubmit() || store.submitting()"
            (click)="submit()"
          >
            {{ store.submitting() ? 'ENVIANDO…' : 'ENVIAR ►' }}
          </button>
        </div>

        @if (!canSubmit()) {
          <p class="fb__hint nf-mono">Rellena los campos marcados con *</p>
        }
      </div>
    </nf-modal>
  `,
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
    const ok = await this.store.submit(this.buildReport());
    if (!ok) {
      this.toasts.error('No hemos podido enviar tu reporte. Inténtalo de nuevo.');
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
  if (url.includes('/partidas')) return 'partidas';
  if (url.includes('/draft') || url.includes('/campeones')) return 'draft';
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
