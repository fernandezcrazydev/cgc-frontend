import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RiotUsageStore } from '../../core/admin';
import { NfMeter, NfSkeleton } from '../../ui';

/**
 * El indicador de rate limit de la API de Riot que va en la cabecera, solo para admins
 * (issue #31).
 *
 * Toda la aplicación depende de una API ajena con un presupuesto de 100 llamadas cada 2
 * minutos. Esta barra es el único aviso que hay antes de que Riot empiece a rechazarnos, así
 * que vive en la cabecera y no en una pantalla: si hay que ir a buscarla, no avisa de nada.
 *
 * **Quién arranca el polling.** Este componente y nadie más. En `shell.html` está dentro de un
 * `@if (isAdmin())`, de modo que para un usuario normal ni siquiera se instancia y su
 * constructor —donde empieza el polling— no llega a ejecutarse nunca. Si aun así llegara un
 * 403, el store se apaga solo.
 *
 * Se pausa con la pestaña oculta: una pestaña de fondo no debe estar pidiendo esto toda la
 * noche.
 */
@Component({
  selector: 'app-riot-usage-indicator',
  standalone: true,
  imports: [RouterLink, NfMeter, NfSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="riot-usage"
      [routerLink]="['/app', 'admin', 'riot-metricas']"
      [attr.title]="tooltip()"
      [attr.aria-label]="tooltip()"
    >
      @if (store.status() === 'idle' || (store.status() === 'loading' && !store.usage())) {
        <nf-skeleton width="64px" height="5px" radius="999px" />
      } @else if (store.status() === 'error' && !store.usage()) {
        <span class="riot-usage__down nf-mono" aria-hidden="true">RIOT ?/?</span>
      } @else {
        <nf-meter
          [value]="store.usage()!.used"
          [max]="store.usage()!.limit"
          label="Riot API"
          [compact]="true"
        />
      }
    </a>
  `,
  styles: [
    `
      .riot-usage {
        display: flex;
        align-items: center;
        padding: 4px 8px;
        border: 1.5px solid var(--nf-border);
        border-radius: 5px;
        text-decoration: none;
        transition: border-color 0.14s, background 0.14s;
      }
      .riot-usage:hover {
        border-color: var(--nf-cyan);
        background: color-mix(in srgb, var(--nf-cyan) 8%, transparent);
      }
      .riot-usage__down {
        font-size: 10.5px;
        color: var(--nf-text-dim);
      }
    `,
  ],
})
export class RiotUsageIndicator {
  readonly store = inject(RiotUsageStore);

  /**
   * Lo que se lee al pasar el ratón. Incluye el número de Riot cuando lo hay porque puede ser
   * MAYOR que el nuestro: compartimos la API key con la app antigua de chiringuicustom, y esa
   * diferencia es justo lo que se está gastando la otra app.
   */
  readonly tooltip = computed(() => {
    const usage = this.store.usage();
    if (!usage) return 'Uso de la API de Riot';

    const parts = [`Nosotros: ${usage.used}/${usage.limit} en ${usage.windowSeconds} s`];
    if (usage.riotCount !== null) parts.push(`Riot dice: ${usage.riotCount}`);
    if (usage.rateLimited > 0) parts.push(`${usage.rateLimited} rechazadas (429)`);

    const seconds = this.store.secondsToNextSlot();
    if (seconds !== null && usage.used > 0) parts.push(`Hueco libre en ${seconds} s`);

    return `${parts.join(' · ')} — ver métricas`;
  });

  constructor() {
    this.store.start();

    // La pestaña oculta no mira la barra; volver a ella la refresca al instante.
    const onVisibility = () => (document.hidden ? this.store.stop() : this.store.start());
    document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      this.store.stop();
    });
  }
}
