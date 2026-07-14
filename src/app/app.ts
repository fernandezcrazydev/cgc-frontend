import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationError, Router, RouterOutlet } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { ThemeService } from './core/theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('cgc-frontend');

  // Instancia el servicio de tema en el arranque: su effect refleja el tema
  // guardado en <html data-theme> y lo mantiene sincronizado toda la sesión.
  private readonly theme = inject(ThemeService);

  private readonly router = inject(Router);

  /**
   * Arranque en curso: hasta que la PRIMERA navegación termina, la raíz solo tiene
   * un `<router-outlet>` vacío. Entrando directo a /app eso es una pantalla en
   * blanco mientras `authGuard` espera a `GET /me` — de ahí el splash.
   *
   * Solo se escucha `NavigationEnd`/`Error`, no `NavigationCancel`: un guard que
   * redirige cancela la navegación y lanza otra, y el splash debe sobrevivir a ese
   * salto en vez de destapar un blanco intermedio. Después de la primera, `take(1)`
   * lo deja apagado para siempre: las navegaciones internas no tapan la app.
   */
  protected readonly booting = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd || e instanceof NavigationError),
      take(1),
      map(() => false),
    ),
    { initialValue: true },
  );
}
