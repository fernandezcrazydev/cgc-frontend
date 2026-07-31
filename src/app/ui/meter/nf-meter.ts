import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input } from '@angular/core';

/**
 * NEXUS//FORGE Meter — barra de uso sobre un total conocido, que cambia de color al acercarse
 * al límite.
 *
 *   <nf-meter [value]="63" [max]="100" label="RIOT API" />
 *   <nf-meter [value]="63" [max]="100" [compact]="true" />
 *
 * Presentacional puro: no sabe qué mide ni de dónde salen los números. La variante `compact`
 * es la de la cabecera (sin etiqueta, barra estrecha); la normal lleva etiqueta encima.
 *
 * Accesible como `progressbar` de verdad, con `aria-valuetext` en vez del porcentaje crudo:
 * un lector de pantalla dice "63 de 100", que es lo que significa, y no "63%".
 */
@Component({
  selector: 'nf-meter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="nf-meter" [class.nf-meter--compact]="compact()" [attr.data-level]="level()">
      @if (!compact()) {
        <div class="nf-meter__head">
          <span class="nf-meter__label nf-mono nf-caps">{{ label() }}</span>
          <span class="nf-meter__value nf-mono">{{ valueText() }}</span>
        </div>
      }
      <div
        class="nf-meter__track"
        role="progressbar"
        [attr.aria-label]="label()"
        [attr.aria-valuemin]="0"
        [attr.aria-valuemax]="max()"
        [attr.aria-valuenow]="value()"
        [attr.aria-valuetext]="valueText()"
      >
        <div class="nf-meter__fill" [style.width.%]="percent()"></div>
      </div>
      @if (compact()) {
        <span class="nf-meter__value nf-mono">{{ valueText() }}</span>
      }
    </div>
  `,
  styleUrl: './nf-meter.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfMeter {
  readonly value = input(0);
  readonly max = input(100);
  readonly label = input('Uso');
  readonly compact = input(false);
  /** Fracción a partir de la cual la barra avisa (amarillo) y alarma (rojo). */
  readonly warnAt = input(0.6);
  readonly dangerAt = input(0.85);

  /** Se capa a 1: pasarse del máximo es posible y la barra no debe desbordar el carril. */
  private readonly fraction = computed(() => {
    const max = this.max();
    if (max <= 0) return 0;
    return Math.min(Math.max(this.value(), 0) / max, 1);
  });

  readonly percent = computed(() => this.fraction() * 100);

  readonly level = computed<'ok' | 'warn' | 'danger'>(() => {
    const fraction = this.fraction();
    if (fraction >= this.dangerAt()) return 'danger';
    if (fraction >= this.warnAt()) return 'warn';
    return 'ok';
  });

  readonly valueText = computed(() => `${this.value()}/${this.max()}`);
}
