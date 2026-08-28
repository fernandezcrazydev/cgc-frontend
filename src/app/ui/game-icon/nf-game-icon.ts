import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';

/**
 * Qué carpeta de `public/assets/` sirve el icono. Una sola primitiva para
 * hechizos y runas en vez de dos componentes calcados: lo único que cambia
 * entre ellos es la subcarpeta.
 */
export type NfGameIconSet = 'spell' | 'perk';

const DIR_BY_SET: Record<NfGameIconSet, string> = {
  spell: 'spells',
  perk: 'perks',
};

/**
 * Game Icon — un hechizo de invocador o una runa, por su id real de ddragon.
 *
 *   <nf-game-icon set="spell" [id]="4" label="Destello" [size]="18" />
 *   <nf-game-icon set="perk" [id]="8112" label="Electrocutar" />
 *
 * Los ficheros están vendorizados en `public/assets/{spells,perks}/{id}.png`,
 * así que el id del dominio ES el nombre del fichero y esta primitiva no
 * necesita ninguna tabla de traducción. Si el icono no carga, deja un hueco
 * con el mismo tamaño (nunca un salto de layout) y conserva el tooltip.
 */
@Component({
  selector: 'nf-game-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'nf-gameicon' },
  template: `
    @if (failed()) {
      <span
        class="nf-gameicon__fallback"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [attr.title]="label()"
        [attr.aria-label]="label() || null"
      ></span>
    } @else {
      <img
        class="nf-gameicon__img"
        [src]="assetPath()"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [alt]="label()"
        [attr.title]="label()"
        loading="lazy"
        decoding="async"
        (error)="onError()"
      />
    }
  `,
  styleUrl: './nf-game-icon.scss',
})
export class NfGameIcon {
  readonly set = input.required<NfGameIconSet>();
  /** Id real de ddragon: 4 = Destello, 8112 = Electrocutar… */
  readonly id = input.required<number>();
  /** Nombre en español: es el `alt` y el tooltip. */
  readonly label = input('');
  readonly size = input(18);

  private readonly _failed = signal(false);
  protected readonly failed = this._failed.asReadonly();

  protected readonly assetPath = computed(() => `/assets/${DIR_BY_SET[this.set()]}/${this.id()}.png`);

  protected onError(): void {
    this._failed.set(true);
  }
}
