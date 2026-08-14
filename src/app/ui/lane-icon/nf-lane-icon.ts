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
 * Cómo se pinta el fichero:
 *
 * - `tinted` (por defecto): se recorta con `mask-image` y se rellena con
 *   `currentColor`, así el icono hereda el color del texto y cada tema lo pinta
 *   solo. Sale una silueta plana: se pierden el dorado y los dos tonos del
 *   original.
 * - `original`: el SVG tal cual, con sus colores de origen — el icono de línea
 *   que se reconoce del cliente de LoL. Ese dorado (`#c8aa6e`) es fijo, así que
 *   quien lo use tiene que comprobar que se lee sobre el fondo donde lo pone
 *   (sobre superficies claras, mejor `tinted`).
 */
export type NfLaneIconMode = 'tinted' | 'original';

/**
 * Lane Icon — el SVG de una línea, teñido con el color de texto heredado
 * (`currentColor`) o con sus colores originales, según `mode`.
 *
 *   <nf-lane-icon lane="JUNGLA" fallbackGlyph="♣" />
 *   <nf-lane-icon lane="JUNGLA" fallbackGlyph="♣" mode="original" />
 *
 * Tamaño: es un glifo más, se dimensiona en `1em` — como el Unicode que
 * sustituye, lo controla el `font-size` del contexto donde se use.
 *
 * Si el SVG no carga (ausente/bloqueado por red), cae al glifo Unicode que
 * pintaban las vistas antes de este componente.
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
    } @else if (mode() === 'original') {
      <!-- Aquí el \`<img>\` ES el icono, así que su propio (error) ya avisa: no hay sonda. -->
      <img class="nf-laneicon__img" [src]="assetPath()" alt="" aria-hidden="true" (error)="onProbeError()" />
    } @else {
      <span
        class="nf-laneicon__mask"
        aria-hidden="true"
        [style.-webkit-mask-image]="maskUrl()"
        [style.mask-image]="maskUrl()"
      ></span>
      <!-- Sonda invisible: una \`mask-image\` rota no dispara ningún evento, así
           que es el único modo fiable de detectar que el SVG no cargó. -->
      <img class="nf-laneicon__probe" [src]="assetPath()" alt="" aria-hidden="true" (error)="onProbeError()" />
    }
  `,
  styleUrl: './nf-lane-icon.scss',
})
export class NfLaneIcon {
  readonly lane = input.required<NfLane>();
  /** Glifo Unicode de reserva (el que pintaban las vistas antes de este componente). */
  readonly fallbackGlyph = input('?');
  readonly mode = input<NfLaneIconMode>('tinted');

  private readonly _failed = signal(false);
  protected readonly failed = this._failed.asReadonly();

  protected readonly assetPath = computed(() => `/lanes/position-${FILE_BY_LANE[this.lane()]}.svg`);
  protected readonly maskUrl = computed(() => `url(${this.assetPath()})`);

  protected onProbeError(): void {
    this._failed.set(true);
  }
}
