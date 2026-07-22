import { Component, Input, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { NF_THEME } from '../theme-token';

export type NfWindowAccent = 'cyan' | 'pink';

/**
 * NEXUS//FORGE Window — el "panel con título" de la app.
 *
 * En `nexus`/`nocturne` se pinta como la tarjeta retro-OS: barra de título con
 * semáforo, título mono `.exe` y dos cuadros de control.
 *
 *   <nf-window title="acceso.exe" accent="cyan" bodyPadding="0">…</nf-window>
 *
 * En `original` ese cromo no tiene sentido (no es un escritorio retro), así que
 * el componente NO lo renderiza: queda una tarjeta de cristal con el título como
 * encabezado normal. La extensión de pega se cae por código —`config.exe` →
 * `Config`— porque vive en el texto de 30 vistas y ningún CSS puede quitarla.
 * Las vistas no se enteran: siguen pasando el título con `.exe` y decide el
 * primitivo. Es el único sitio del UI kit que conoce el tema activo.
 */
@Component({
  selector: 'nf-window',
  standalone: true,
  template: `
    <div class="nf-window" [class.nf-window--pink]="accent === 'pink'">
      @if (chrome()) {
        <div class="nf-window__bar">
          <div class="nf-window__lights">
            <span class="nf-window__light nf-window__light--red"></span>
            <span class="nf-window__light nf-window__light--yellow"></span>
            <span class="nf-window__light nf-window__light--green"></span>
          </div>
          <span class="nf-window__title nf-mono">{{ title }}</span>
          <div class="nf-window__controls">
            <span class="nf-window__ctrl"></span>
            <span class="nf-window__ctrl"></span>
          </div>
        </div>
      } @else if (plainTitle()) {
        <h2 class="nf-window__heading">{{ plainTitle() }}</h2>
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
  private readonly theme = inject(NF_THEME);

  private readonly _title = signal('window.exe');

  @Input()
  set title(v: string) {
    this._title.set(v);
  }
  get title(): string {
    return this._title();
  }

  @Input() accent: NfWindowAccent = 'cyan';
  /** CSS padding applied to the body slot. */
  @Input() bodyPadding = '20px';

  /** Sólo los temas de escritorio retro pintan la barra de ventana. */
  protected readonly chrome = computed(() => this.theme() !== 'original');

  /**
   * Título sin la extensión de pega y con la inicial en mayúscula:
   * `config.exe` → `Config`. Presentación pura.
   */
  protected readonly plainTitle = computed(() => {
    const t = this._title().replace(/\.[a-z0-9]{2,4}$/i, '').trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  });
}
