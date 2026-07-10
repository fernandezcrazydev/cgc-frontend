import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom } from 'rxjs';
import { Session } from './session';

/**
 * Autenticación contra NUESTRO Authorization Server (no contra Discord).
 *
 * Flujo (Authorization Code + PKCE, sin cookies):
 *   1. `loginWithDiscord()` → el navegador va a /oauth2/authorize del backend.
 *   2. Al no haber sesión allí, el backend rebota a Discord. El usuario entra.
 *   3. El backend nos devuelve a /callback con un `code`.
 *   4. La librería canjea el code por un JWT nuestro y lo guarda.
 *   5. El interceptor pone ese JWT como Bearer en cada llamada a environment.apiUrl.
 *
 * Aquí solo vive el token. El PERFIL del usuario vive en `Session`.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly oidc = inject(OidcSecurityService);
  private readonly session = inject(Session);

  /** Arranca el flujo OAuth. El nombre se mantiene: para el usuario, "entra con Discord". */
  loginWithDiscord(): void {
    this.oidc.authorize();
  }

  /**
   * Cierra sesión también en el Authorization Server, no solo en el navegador:
   * si solo borráramos el token, el backend seguiría con su sesión de Discord
   * abierta y el siguiente login entraría solo, sin preguntar.
   *
   * Se limpia `Session` ANTES de `logoff()`, porque `logoff()` normalmente acaba
   * en una redirección del navegador a `/connect/logout` y nada de lo que venga
   * después llega a ejecutarse.
   */
  async logout(): Promise<void> {
    this.session.clear();
    await firstValueFrom(this.oidc.logoff());
  }

  /** ¿Hay un token válido guardado? No hace red si ya lo sabe. */
  async isAuthenticated(): Promise<boolean> {
    const { isAuthenticated } = await firstValueFrom(this.oidc.checkAuth());
    return isAuthenticated;
  }

  /**
   * Roles globales del usuario, leídos del claim `roles` del access token — el
   * backend los mete ahí en `accessTokenCustomizer`. No salen de `/me`: ese
   * endpoint no expone el rol.
   *
   * Es una comodidad para la UI (esconder botones). La autorización de verdad la
   * hace el backend con `@PreAuthorize`; un token manipulado en el navegador no
   * abre nada.
   */
  async roles(): Promise<string[]> {
    const payload = await firstValueFrom(this.oidc.getPayloadFromAccessToken());
    const roles: unknown = payload?.['roles'];
    return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === 'string') : [];
  }

  async isAdmin(): Promise<boolean> {
    return (await this.roles()).includes('ADMIN');
  }
}
