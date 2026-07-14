import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';

/**
 * NEXUS//FORGE Skeleton — hueco con barrido de luz que ocupa el sitio de un dato
 * que aún está cargando.
 *
 *   <nf-skeleton width="220px" height="30px" />
 *
 * Se dimensiona con la MISMA forma que el contenido final: así, cuando el dato
 * llega, nada salta de sitio. Es decorativo (`aria-hidden`); quien anuncia la
 * espera es el contenedor, con `aria-busy="true"`.
 */
@Component({
  selector: 'nf-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="nf-skeleton"
      aria-hidden="true"
      [style.width]="width()"
      [style.height]="height()"
      [style.border-radius]="radius()"
    ></span>
  `,
  styleUrl: './nf-skeleton.scss',
  encapsulation: ViewEncapsulation.None,
})
export class NfSkeleton {
  readonly width = input('100%');
  readonly height = input('1em');
  readonly radius = input('var(--nf-radius)');
}
