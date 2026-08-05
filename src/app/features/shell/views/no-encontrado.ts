import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NfButton } from '../../../ui';

/**
 * 404 dentro del shell.
 *
 * Antes el comodín de `app.routes.ts` redirigía cualquier ruta desconocida a
 * '' — es decir, al login. Un usuario con sesión abierta que seguía un enlace
 * roto acababa en una pantalla de acceso, leyendo eso como "me han echado".
 * Ahora la ruta desconocida se queda dentro de la aplicación, dice lo que ha
 * pasado y ofrece salida: volver atrás (el enlace de vuelta que faltaba en
 * todo el flujo) o ir a inicio.
 */
@Component({
  selector: 'app-no-encontrado',
  standalone: true,
  imports: [NfButton, RouterLink],
  template: `
    <div class="view max-520">
      <section class="nf404">
        <p class="nf404__code nf-mono" aria-hidden="true">404</p>
        <h1 class="nf404__title">Esta página no existe</h1>
        <p class="nf404__lead">
          El enlace que has seguido está roto o la página se movió de sitio.
          Si has llegado desde dentro de la aplicación, cuéntanoslo por el
          botón de feedback.
        </p>
        <div class="nf404__actions">
          <button nfButton variant="primary" type="button" (click)="goBack()">
            Volver atrás
          </button>
          <a class="nf404__home" routerLink="/app/inicio">Ir a inicio</a>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      /* Centrado óptico, no matemático: el bloque se sube un poco respecto
         al centro geométrico porque el ojo busca el centro por encima. */
      .nf404 {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: center;
        min-height: calc(var(--nf-vh) * 62);
        padding-bottom: var(--sp-8);
      }

      .nf404__code {
        margin: 0 0 var(--sp-3);
        font-size: var(--fs-display);
        font-weight: var(--fw-black);
        line-height: 1;
        letter-spacing: var(--ls-display);
        /* La cifra es decorativa: se rebaja a un contorno para que el peso
           visual lo lleve el titular, que es lo que hay que leer. */
        color: transparent;
        -webkit-text-stroke: 1.5px var(--nf-border-strong);
      }

      .nf404__title {
        margin: 0 0 var(--sp-3);
        font-size: var(--fs-h1);
        font-weight: var(--fw-bold);
        letter-spacing: var(--ls-tighter);
        line-height: var(--lh-tight);
        color: var(--nf-text);
      }

      .nf404__lead {
        margin: 0 0 var(--sp-7);
        max-width: var(--measure);
        font-size: var(--fs-body);
        line-height: var(--lh-body);
        text-wrap: pretty;
        color: var(--nf-text-mid);
      }

      /* Un relleno + un enlace de texto, no el par "botón sólido + botón
         fantasma" de siempre: hay una sola acción principal aquí. */
      .nf404__actions {
        display: flex;
        align-items: center;
        gap: var(--sp-5);
        flex-wrap: wrap;
      }

      .nf404__home {
        font-size: var(--fs-body);
        font-weight: var(--fw-medium);
        color: var(--nf-text-mid);
        text-decoration: underline;
        text-underline-offset: 3px;
        text-decoration-color: var(--nf-border-strong);
        transition: color 0.16s ease, text-decoration-color 0.16s ease;
      }
      .nf404__home:hover {
        color: var(--nf-text);
        text-decoration-color: var(--nf-primary);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoEncontrado {
  private readonly location = inject(Location);

  /**
   * Si no hay historial dentro de la app (entrada directa por URL), `back()`
   * sacaría al usuario del sitio. En ese caso el enlace a inicio es la salida
   * y este botón no tiene nada que deshacer, así que se queda en inicio.
   */
  goBack(): void {
    if (history.length > 1) {
      this.location.back();
      return;
    }
    location.assign('/app/inicio');
  }
}
