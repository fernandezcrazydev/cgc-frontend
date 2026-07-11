import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
}
