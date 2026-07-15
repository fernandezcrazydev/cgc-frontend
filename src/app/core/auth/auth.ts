import { Injectable, inject } from '@angular/core';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { firstValueFrom, timeout } from 'rxjs';
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

  /**
   * ¿Sigues dentro? Con matiz importante en el arranque en frío.
   *
   * `checkAuth()` a secas NO usa el refresh token: si el access token ya caducó
   * (p. ej. cerraste el navegador por la noche y el silent renew por timer dejó de
   * correr), devuelve `false` sin más y el guard te manda al login cada mañana.
   * `checkAuthIncludingServer()` cae a `forceRefreshSession()` con el refresh token
   * guardado —válido 30 días en el backend— y solo entonces te da por fuera. Con
   * tokens aún válidos responde al instante, sin llamada de red extra.
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const { isAuthenticated } = await firstValueFrom(
        // El timeout es red de seguridad: la rama de refresh-token de la librería
        // NO lo lleva de fábrica, así que un /oauth2/token que no responda dejaría
        // la comprobación colgada para siempre.
        this.oidc.checkAuthIncludingServer().pipe(timeout(10_000)),
      );
      return isAuthenticated;
    } catch {
      // A diferencia de checkAuth(), checkAuthIncludingServer() EMITE UN ERROR
      // cuando el refresh falla (sin refresh token, caducado o revocado): dispara
      // forceRefreshSession(), que lanza en vez de devolver false. Sin este catch la
      // promesa se rechaza y el login se queda clavado en "comprobando sesión". Un
      // fallo aquí es, sencillamente, "no autenticado": que se vea el botón de Discord.
      return false;
    }
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
