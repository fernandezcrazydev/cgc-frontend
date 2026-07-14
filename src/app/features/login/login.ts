import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NfWindow } from '../../ui';
import { Auth, Session } from '../../core/auth';

type LoginStatus = 'checking' | 'idle' | 'connecting' | 'success' | 'error';

/**
 * Sale perso — Login ("Login con Discord").
 * Authorization Code + PKCE contra nuestro backend: al cargar miramos si ya hay un
 * token válido y, si lo hay, confirmamos con GET /api/v1/me y entramos al lobby.
 * Si no, el botón lanza el flujo, que pasa por el backend y de ahí a Discord.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NfWindow],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly session = inject(Session);

  readonly status = signal<LoginStatus>('checking');
  readonly userName = signal('');

  readonly isChecking = computed(() => this.status() === 'checking');
  readonly isConnecting = computed(() => this.status() === 'connecting');
  readonly isSuccess = computed(() => this.status() === 'success');
  readonly isError = computed(() => this.status() === 'error');
  // Bloque de acceso: cuando no estamos comprobando ni ya dentro.
  readonly showAuth = computed(
    () => this.status() === 'idle' || this.isConnecting() || this.isError(),
  );

  private enterTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.checkSession();
  }

  /** Comprueba si ya hay un token válido y, en ese caso, entra al lobby. */
  private async checkSession(): Promise<void> {
    // Sin token no tiene sentido llamar a la API: siempre daría 401.
    if (!(await this.auth.isAuthenticated())) {
      this.status.set('idle');
      return;
    }

    // Precarga el perfil: cuando el authGuard lo pida al entrar en /app ya estará
    // en memoria, así que el shell pinta el nombre real sin un segundo de vacío.
    const user = await this.session.ensureLoaded();
    if (user) {
      this.userName.set(user.discordUsername);
      this.status.set('success');
      this.enterTimer = setTimeout(() => this.enterApp(), 1100);
    } else {
      this.status.set('idle');
    }
  }

  onDiscord(): void {
    if (this.isConnecting()) return;
    this.status.set('connecting');
    this.auth.loginWithDiscord();
  }

  private enterApp(): void {
    void this.router.navigateByUrl('/app');
  }

  ngOnDestroy(): void {
    clearTimeout(this.enterTimer);
  }
}
