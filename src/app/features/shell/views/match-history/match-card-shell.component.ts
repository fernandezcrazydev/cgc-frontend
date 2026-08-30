import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Match } from '../../../../core/matches/models';
import { formatMatchDate } from '../../../../shared/date-format';
import { Viewport } from '../../../../shared/viewport';
import { MatchHistoryUiState } from './match-history-ui';
import { MatchLineupComponent } from './match-lineup.component';

let panelSeq = 0;

/**
 * El armazón de una fila del historial: la caja, el acento de color según el resultado, el
 * desplegable y todo el cableado de accesibilidad. El contenido de la fila lo proyecta quien
 * lo use (`<app-personal-match-card>` o `<app-group-match-card>`).
 *
 * Existe porque las dos vistas comparten el comportamiento pero no los datos. Antes había un
 * solo componente con un `@if (mode())` que cambiaba el 90% de la plantilla: dos componentes
 * con un disfraz, imposibles de evolucionar por separado.
 *
 * `accent` no se llama por el color que sale: en el historial personal marca cómo TE fue, y
 * en el de grupo qué bando ganó. Son dos lecturas distintas del mismo sitio de la pantalla.
 *
 * ## Quién despliega, según el ancho
 *
 * En escritorio la fila entera es el control: es un objetivo enorme para el ratón y los
 * enlaces que lleva dentro se resuelven con `stopPropagation`. En móvil eso no funciona —una
 * tarjeta de 150px de alto con cuatro enlaces pequeños dentro convierte cada toque en una
 * apuesta entre desplegar y navegar—, así que el control se muda a una franja propia al pie
 * y la fila se queda inerte. Es la misma decisión que toma el CSS en `$bp-mobile`; las dos
 * consultan el mismo umbral (`Viewport`) para que no exista una banda de anchos en la que
 * una diga una cosa y la otra la contraria.
 */
@Component({
  selector: 'app-match-card-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatchLineupComponent],
  template: `
    <div
      class="m-card"
      [class.is-win]="accent() === 'win'"
      [class.is-loss]="accent() === 'loss'"
      [class.is-neutral]="accent() === 'neutral'"
      [class.is-blue]="accent() === 'blue'"
      [class.is-red]="accent() === 'red'"
      [class.is-expanded]="isExpanded()"
    >
      <div
        class="m-card__main"
        [class.m-card__main--group]="variant() === 'group'"
        [class.m-card__main--cross]="variant() === 'cross'"
        [attr.role]="rowIsControl() ? 'button' : null"
        [attr.tabindex]="rowIsControl() ? 0 : null"
        [attr.aria-expanded]="rowIsControl() ? isExpanded() : null"
        [attr.aria-controls]="rowIsControl() && isExpanded() ? panelId : null"
        [attr.aria-label]="rowIsControl() ? toggleLabel() : null"
        (click)="toggleFromRow()"
        (keydown.enter)="toggleFromRow()"
        (keydown.space)="$event.preventDefault(); toggleFromRow()"
      >
        <ng-content />

        <div class="m-card__end">
          <span class="m-card__date nf-mono">{{ dateLabel() }}</span>
          <div class="m-card__end-extra">
            @if (lpDelta(); as lp) {
              <span
                class="m-card__lp-badge nf-mono"
                [class.is-gain]="lp > 0"
                [class.is-loss]="lp < 0"
              >
                {{ lp > 0 ? '+' : '' }}{{ lp }} LP
              </span>
            }
            @if (rowIsControl()) {
              <!--
                Indicador, no control: quien despliega es la fila entera, y su etiqueta accesible
                ya dice qué hace. El chevron es puramente visual, así que no repite ese nombre ni
                añade una parada de tabulación dentro de otro control.
              -->
              <svg
                class="m-card__chevron"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            }
          </div>
        </div>
      </div>

      @if (!rowIsControl()) {
        <button
          type="button"
          class="m-card__toggle"
          [attr.aria-expanded]="isExpanded()"
          [attr.aria-controls]="isExpanded() ? panelId : null"
          [attr.aria-label]="toggleLabel()"
          (click)="toggle()"
        >
          <span>{{ isExpanded() ? 'Ocultar ' + panelNoun() : 'Ver ' + panelNoun() }}</span>
          <svg
            class="m-card__toggle-chevron"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            focusable="false"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      }

      @if (isExpanded()) {
        <div class="m-card__accordion" [id]="panelId" role="region" [attr.aria-label]="panelLabel()">
          <!--
            Ranura con contenido por defecto: quien no proyecte nada obtiene la alineación de
            siempre —el historial personal y el de grupo no cambian—, y el historial cruzado
            proyecta su comparativa cara a cara, que responde a otra pregunta. Es una ranura y
            no un @if sobre un modo por lo mismo que este componente existe: ese if ya estuvo
            aquí una vez y convertía dos vistas distintas en un solo componente disfrazado.
          -->
          <ng-content select="[matchAccordion]">
            <app-match-lineup [match]="match()" [returnTo]="returnTo()" />
          </ng-content>
        </div>
      }
    </div>
  `,
})
export class MatchCardShellComponent {
  readonly match = input.required<Match>();
  readonly accent = input<'win' | 'loss' | 'neutral' | 'blue' | 'red'>('neutral');
  /**
   * Qué proyecta la fila. Cambia la rejilla: la personal reparte seis columnas medidas para
   * sus datos y la de grupo cuatro bloques mucho más anchos, así que compartir una sola
   * rejilla dejaba el bloque del MVP pegado a la tira de campeones.
   */
  readonly variant = input<'personal' | 'group' | 'cross'>('personal');
  /** Se propaga al enlace del desglose para que «volver» regrese al sitio correcto. */
  readonly returnTo = input<string | null>(null);
  /**
   * Cómo se llama lo que hay dentro del desplegable. Lo dicen el botón de móvil y las
   * etiquetas accesibles, así que no puede quedarse fijo en «alineación» cuando la vista
   * cruzada proyecta una comparativa: un lector de pantalla anunciaría algo que no está.
   */
  readonly panelNoun = input('alineación');

  private readonly ui = inject(MatchHistoryUiState);
  private readonly viewport = inject(Viewport);

  protected readonly panelId = `m-card-panel-${++panelSeq}`;

  /** Con ratón la fila es el control; con el dedo lo es la franja del pie. */
  protected readonly rowIsControl = computed(() => !this.viewport.isMobile());

  protected readonly isExpanded = computed(() => this.ui.isExpanded(this.match().id));

  protected readonly dateLabel = computed(() => formatMatchDate(this.match().decidedAt));

  // El grupo es el único que no lo pinta: ahí la fila es el registro colectivo y los LP son
  // de quien mira, no de la partida.
  protected readonly lpDelta = computed(() =>
    this.variant() === 'group' ? 0 : (this.match().userParticipant?.lpDelta ?? 0),
  );

  protected readonly toggleLabel = computed(() =>
    this.isExpanded()
      ? `Ocultar la ${this.panelNoun()} de la partida del ${this.dateLabel()}`
      : `Ver la ${this.panelNoun()} de la partida del ${this.dateLabel()}`,
  );

  protected readonly panelLabel = computed(
    () => `${capitalize(this.panelNoun())} de la partida del ${this.dateLabel()}`,
  );

  /** En móvil la fila no es un control: un toque en su fondo no debe desplegar nada. */
  protected toggleFromRow(): void {
    if (this.rowIsControl()) this.toggle();
  }

  protected toggle(): void {
    this.ui.toggleExpand(this.match().id);
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
