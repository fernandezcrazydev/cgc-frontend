import { Component, Input, ViewEncapsulation } from '@angular/core';

/**
 * Window — el "panel con título" de la app.
 *
 *   <nf-window title="Acceso" bodyPadding="0">…</nf-window>
 *
 * El título es opcional: sin él queda un panel a secas. Antes esto pintaba una
 * barra de ventana retro (semáforo, título mono, cuadros de control) y era el
 * único primitivo que consultaba el tema activo para decidir si la renderizaba.
 * Ya no: el encabezado es un `<h2>` normal en todos los temas, así que el token
 * NF_THEME desapareció y con él la única dependencia de `ui/` hacia `core/`.
 */
@Component({
  selector: 'nf-window',
  standalone: true,
  template: `
    <div class="nf-window">
      @if (title) {
        <h2 class="nf-window__heading">{{ title }}</h2>
      }
      <div class="nf-window__body" [style.padding]="bodyPadding">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styleUrl: './nf-window.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfWindow {
  @Input() title = '';
  /** CSS padding applied to the body slot. */
  @Input() bodyPadding = '20px';
}
