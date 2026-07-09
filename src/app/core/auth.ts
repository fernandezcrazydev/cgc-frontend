import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { environment } from '../../environments/environment';

/** Lo que devuelve GET /api/v1/me. Es el AppUser del backend, no el perfil crudo de Discord. */
export interface CurrentUser {
  id: string;
  discordId: string;
  discordUsername: string;
  email: string | null;
  avatarUrl: string | null;
  globalRole: 'USER' | 'ADMIN';
  createdAt: string;
  lastLoginAt: string | null;
}

/**
 * Autenticación contra NUESTRO Authorization Server (no contra Discord).
 *
 * Flujo (Authorization Code + PKCE, sin cookies):
 *   1. `loginWithDiscord()` → el navegador va a /oauth2/authorize del backend.
 *   2. Al no haber sesión allí, el backend rebota a Discord. El usuario entra.
 *   3. El backend nos devuelve a /callback con un `code`.
 *   4. La librería canjea el code por un JWT nuestro y lo guarda.
 *   5. El interceptor pone ese JWT como Bearer en cada llamada a environment.apiUrl.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly oidc = inject(OidcSecurityService);

  readonly user = signal<CurrentUser | null>(null);

  /** Arranca el flujo OAuth. El nombre se mantiene: para el usuario, "entra con Discord". */
  loginWithDiscord(): void {
    this.oidc.authorize();
  }

  logout(): void {
    this.oidc.logoff().subscribe(() => this.user.set(null));
  }

  /** ¿Hay un token válido guardado? No hace red si ya lo sabe. */
  async isAuthenticated(): Promise<boolean> {
    const { isAuthenticated } = await firstValueFrom(this.oidc.checkAuth());
    return isAuthenticated;
  }

  /** Verifica la sesión actual. Devuelve el usuario o null si no hay token válido. */
  async fetchMe(): Promise<CurrentUser | null> {
    try {
      // El Bearer lo añade authInterceptor: environment.apiUrl está en secureRoutes.
      const user = await firstValueFrom(
        this.http.get<CurrentUser>(`${environment.apiUrl}/me`),
      );
      this.user.set(user ?? null);
      return this.user();
    } catch {
      this.user.set(null);
      return null;
    }
  }

  isAdmin(user: CurrentUser | null = this.user()): boolean {
    return user?.globalRole === 'ADMIN';
  }

  displayName(user: CurrentUser | null = this.user()): string {
    if (!user) return '';
    return user.discordUsername || user.email || 'Jugador';
  }
}
