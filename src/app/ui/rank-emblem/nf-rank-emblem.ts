import { ChangeDetectionStrategy, Component, ViewEncapsulation, computed, input, signal } from '@angular/core';

/**
 * Los tiers de LoL. Duplicado a propósito de `core/group-ranking#LolTier`:
 * `ui/` no puede importar de `core/` (regla de capas de `CLAUDE.md`), igual
 * que pasa con `NfLane` en `nf-lane-icon.ts`. Si el dominio añade un tier,
 * este tipo y `FILE_BY_TIER` hay que ampliarlos a mano.
 */
export type NfRankTier =
  | 'CHALLENGER' | 'GRANDMASTER' | 'MASTER' | 'DIAMOND'
  | 'EMERALD' | 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'IRON';

/**
 * Tier → nombre de fichero en `public/assets/ranks/` (mini-crests SVG de
 * CommunityDragon vendorizados, con los colores oficiales de cada tier).
 *
 * El mapeo es explícito y NO derivado con `.toLowerCase()`: es exactamente el
 * punto donde se cuela un bug si algún día un tier deja de coincidir con su
 * nombre de fichero (ver el mismo aviso en `FILE_BY_LANE`).
 */
const FILE_BY_TIER: Record<NfRankTier, string> = {
  CHALLENGER: 'challenger',
  GRANDMASTER: 'grandmaster',
  MASTER: 'master',
  DIAMOND: 'diamond',
  EMERALD: 'emerald',
  PLATINUM: 'platinum',
  GOLD: 'gold',
  SILVER: 'silver',
  BRONZE: 'bronze',
  IRON: 'iron',
};

/**
 * Rank Emblem — el escudo de la liga de un jugador.
 *
 *   <nf-rank-emblem tier="MASTER" label="SoloQ: Master" [size]="28" />
 *
 * Los emblemas de rango NO están en Data Dragon (solo en CommunityDragon y en
 * el pack de assets de Riot), así que van vendorizados en `public/`, igual que
 * los iconos de línea. Si el SVG no carga, cae a un glifo de reserva.
 */
@Component({
  selector: 'nf-rank-emblem',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'nf-rankemblem' },
  template: `
    @if (failed()) {
      <span class="nf-rankemblem__glyph" [attr.title]="label()">◆</span>
    } @else {
      <img
        class="nf-rankemblem__img"
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
  styleUrl: './nf-rank-emblem.scss',
})
export class NfRankEmblem {
  readonly tier = input.required<NfRankTier>();
  /** Nombre accesible ("SoloQ: Master"): es el `alt` y el tooltip del escudo. */
  readonly label = input('');
  readonly size = input(24);

  private readonly _failed = signal(false);
  protected readonly failed = this._failed.asReadonly();

  protected readonly assetPath = computed(() => `/assets/ranks/${FILE_BY_TIER[this.tier()]}.svg`);

  protected onError(): void {
    this._failed.set(true);
  }
}
