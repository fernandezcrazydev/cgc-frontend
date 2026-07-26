import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';

/**
 * Los cinco roles jugables, tal y como los conoce `core/preferences#LaneRole`.
 * Duplicado aquí a propósito: `ui/` no puede importar de `core/` (regla de
 * capas de `CLAUDE.md`). Si esas claves cambian en el dominio, este tipo hay
 * que actualizarlo a mano.
 */
export type NfLane = 'TOP' | 'JUNGLA' | 'MID' | 'ADC' | 'SUPPORT';

/**
 * Rol → nombre de fichero en `public/lanes/` (SVG vendorizados de
 * CommunityDragon, monocromos, `fill="#c8aa6e"` fijo en origen). El nombre de
 * fichero NO es el nombre del rol salvo en TOP: este mapeo es el punto exacto
 * donde se cuela un bug si se toca sin mirarlo dos veces.
 *   TOP → top · JUNGLA → jungle · MID → middle · ADC → bottom · SUPPORT → utility
 */
const FILE_BY_LANE: Record<NfLane, string> = {
  TOP: 'top',
  JUNGLA: 'jungle',
  MID: 'middle',
  ADC: 'bottom',
  SUPPORT: 'utility',
};

/**
 * NEXUS//FORGE Lane Icon — el SVG de una línea, teñido con el color de texto
 * heredado (`currentColor`) para que cada tema lo pinte solo.
 *
 * Los ficheros son monocromos con un color fijo en origen, así que NO se
 * pintan con `<img>` (eso congelaría ese color en los tres temas): se
 * recortan con `mask-image` y se rellenan con `background: currentColor`.
 *
 *   <nf-lane-icon lane="JUNGLA" fallbackGlyph="♣" />
 *
 * Tamaño: es un glifo más, se dimensiona en `1em` — como el Unicode que
 * sustituye, lo controla el `font-size` del contexto donde se use.
 *
 * Si la máscara no carga (SVG ausente/bloqueado por red), cae al glifo
 * Unicode que pintaban las vistas antes de este componente.
 */
@Component({
  selector: 'nf-lane-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'nf-laneicon' },
  template: `
    @if (failed()) {
      <span class="nf-laneicon__glyph" aria-hidden="true">{{ fallbackGlyph() }}</span>
    } @else {
      <span
        class="nf-laneicon__mask"
        aria-hidden="true"
        [style.-webkit-mask-image]="maskUrl()"
        [style.mask-image]="maskUrl()"
      ></span>
    }
    <!-- Sonda invisible: una \`mask-image\` rota no dispara ningún evento, así
         que es el único modo fiable de detectar que el SVG no cargó. -->
    <img class="nf-laneicon__probe" [src]="assetPath()" alt="" aria-hidden="true" (error)="onProbeError()" />
  `,
  styleUrl: './nf-lane-icon.scss',
})
export class NfLaneIcon {
  readonly lane = input.required<NfLane>();
  /** Glifo Unicode de reserva (el que pintaban las vistas antes de este componente). */
  readonly fallbackGlyph = input('?');

  private readonly _failed = signal(false);
  protected readonly failed = this._failed.asReadonly();

  protected readonly assetPath = computed(() => `/lanes/position-${FILE_BY_LANE[this.lane()]}.svg`);
  protected readonly maskUrl = computed(() => `url(${this.assetPath()})`);

  protected onProbeError(): void {
    this._failed.set(true);
  }
}
