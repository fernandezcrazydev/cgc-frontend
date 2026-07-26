import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { NfSkeleton } from '../skeleton/nf-skeleton';

export type NfAvatarShape = 'square' | 'round';

/**
 * Tinte del degradado de la reserva de iniciales: un `hue` (0-360, igual que
 * el `avatarBg(hue)` que hoy calculan las vistas a pelo) o un par de paradas
 * de color ya resueltas (p. ej. los `c1`/`c2` de un grupo). `ui/` no puede
 * importar `shared/avatar-bg.ts` (regla de capas: un primitivo no importa de
 * nadie), así que la fórmula del degradado vive también aquí — es la misma.
 */
export type NfAvatarTint = number | readonly [string, string];

/**
 * NEXUS//FORGE Avatar — la primitiva de icono/avatar que faltaba. Unifica el
 * patrón `@if (avatarUrl) {<img>} @else {iniciales}` que hoy está duplicado en
 * 6+ vistas, y sirve igual para el avatar de un usuario/grupo que para el
 * icono de un campeón/objeto de Data Dragon.
 *
 * Cascada de fallback (el host siempre mide `size` px: cero layout shift al
 * cambiar de estado):
 *   1. `loading()` → `<nf-skeleton>` con la caja exacta del icono final.
 *   2. sin `src` → iniciales (derivadas de `fallback`) sobre un degradado de `tint`.
 *   3. `src` presente pero la imagen falla (`(error)`) → mismo fallback de iniciales.
 *
 *   <nf-avatar [src]="champ.iconUrl" [fallback]="champ.name" [tint]="champ.id" [size]="40" />
 */
@Component({
  selector: 'nf-avatar',
  standalone: true,
  imports: [NfSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'nf-avatar',
    // Tamaño expuesto como custom property (no como width/height inline): así una
    // vista puede sobreescribirlo en una media query. Un inline `[style.width.px]`
    // ganaría siempre a cualquier CSS externo y una `.mh-champ__icon` en móvil no
    // podría volver a los 52px que tenía antes de la migración a `nf-avatar`.
    '[style.--nf-avatar-size.px]': 'size()',
    '[class.nf-avatar--round]': "shape() === 'round'",
  },
  template: `
    @if (loading()) {
      <nf-skeleton width="100%" height="100%" [radius]="radius()" />
    } @else if (!src() || failed()) {
      <span class="nf-avatar__fallback nf-mono" [style.background]="background()" [style.font-size.px]="fallbackFontSize()">{{
        initials()
      }}</span>
    } @else {
      <img
        class="nf-avatar__img"
        [src]="src()"
        [attr.alt]="alt()"
        [width]="size()"
        [height]="size()"
        loading="lazy"
        decoding="async"
        (error)="onError()"
      />
    }
  `,
  styleUrl: './nf-avatar.scss',
})
export class NfAvatar {
  /** URL absoluta ya montada por el backend. `null`/vacío ⇒ fallback de iniciales directo. */
  readonly src = input<string | null>(null);
  /** Texto del que derivar las iniciales de reserva (nombre de usuario, campeón, grupo...). */
  readonly fallback = input('');
  /** Hue o par de stops para el degradado de la reserva. */
  readonly tint = input<NfAvatarTint>(0);
  readonly size = input(40);
  readonly shape = input<NfAvatarShape>('round');
  readonly alt = input('');
  /** El dato aún no ha llegado: pinta el skeleton en vez de decidir un fallback. */
  readonly loading = input(false);

  private readonly _failed = signal(false);
  protected readonly failed = this._failed.asReadonly();

  // Radio por defecto para el `<nf-skeleton>` interno mientras `loading()`. El radio
  // real de la caja lo decide el CSS del host (`nf-avatar.scss` + la clase que ponga
  // la vista, ver más abajo); como el host recorta con `overflow: hidden`, este valor
  // solo importa para el instante de carga y nunca desencaja del recorte final.
  protected readonly radius = computed(() => (this.shape() === 'round' ? '50%' : 'var(--nf-radius)'));
  protected readonly initials = computed(() => initialsOf(this.fallback()));
  /** Escala el tamaño de letra con la caja para que quepan 2 caracteres a cualquier `size`. */
  protected readonly fallbackFontSize = computed(() => Math.max(10, Math.round(this.size() * 0.36)));

  protected readonly background = computed(() => {
    const [c1, c2] = stopsOf(this.tint());
    return `radial-gradient(circle at 32% 26%, ${c1}, ${c2})`;
  });

  constructor() {
    // Si `src` cambia (nueva imagen), se le da otra oportunidad antes de
    // asumir que también fallará.
    effect(() => {
      this.src();
      this._failed.set(false);
    });
  }

  protected onError(): void {
    this._failed.set(true);
  }
}

/** Dos primeras letras/dígitos en mayúsculas; mismo criterio que `core/auth#initialsOf`. */
function initialsOf(text: string): string {
  const alnum = text.replace(/[^\p{L}\p{N}]/gu, '');
  return alnum.slice(0, 2).toUpperCase() || '??';
}

function stopsOf(tint: NfAvatarTint): readonly [string, string] {
  if (Array.isArray(tint)) return tint as readonly [string, string];
  return [`hsl(${tint},90%,64%)`, `hsl(${tint},78%,30%)`];
}
