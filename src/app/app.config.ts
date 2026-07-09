import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  AbstractSecurityStorage,
  DefaultLocalStorageService,
  LogLevel,
  authInterceptor,
  provideAuth,
} from 'angular-auth-oidc-client';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // authInterceptor() añade "Authorization: Bearer <token>" solo a las URLs
    // listadas en secureRoutes. Al resto de peticiones no las toca.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor()])),
    provideAuth({
      config: {
        // El resto de endpoints (authorize, token, jwks) se descubren solos
        // leyendo /.well-known/openid-configuration del backend.
        authority: environment.authority,
        clientId: environment.clientId,
        redirectUrl: `${window.location.origin}/callback`,
        postLogoutRedirectUri: window.location.origin,
        // Authorization Code + PKCE: el flujo obligatorio para una SPA.
        responseType: 'code',
        // Deben existir en el RegisteredClient del backend; pedir uno de más da invalid_scope.
        scope: 'openid profile',
        // El backend emite refresh token al cliente público, así que renovamos
        // sin volver a pasar por Discord.
        silentRenew: true,
        useRefreshToken: true,
        renewTimeBeforeTokenExpiresInSeconds: 30,
        secureRoutes: [environment.apiUrl],
        logLevel: environment.production ? LogLevel.Error : LogLevel.Warn,
      },
    }),
    // Por defecto la librería usa sessionStorage, que se borra al cerrar la pestaña:
    // volver a la app obligaba a pulsar "entrar con Discord" otra vez. Con localStorage
    // la sesión sobrevive al cierre del navegador y se renueva sola con el refresh token.
    { provide: AbstractSecurityStorage, useClass: DefaultLocalStorageService },
  ],
};
