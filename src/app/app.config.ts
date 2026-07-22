import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
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
import { sessionRecoveryInterceptor } from './core/http';
import { ThemeService } from './core/theme';
import { NF_THEME } from './ui';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // authInterceptor() añade "Authorization: Bearer <token>" solo a las URLs
    // listadas en secureRoutes. Al resto de peticiones no las toca.
    // sessionRecoveryInterceptor va DELANTE a propósito: ante un 401 renueva el token y
    // reintenta, y ese reintento debe volver a pasar por authInterceptor para llevar el
    // Bearer nuevo. Ver core/http/session-recovery.ts.
    provideHttpClient(
      withFetch(),
      withInterceptors([sessionRecoveryInterceptor, authInterceptor()]),
    ),
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
        // No pedimos el userinfo OIDC: nuestra identidad la da GET /api/v1/me (Session),
        // nunca leemos el userData de la librería. Con el default (autoUserInfo: true) la
        // librería llamaba a /userinfo en CADA callback —incluida la renovación silenciosa—,
        // y ese GET fallaba en el arranque en frío. Como el user info es el último paso de
        // la cadena de renovación, su fallo tumbaba TODA la renovación: la sesión se
        // reseteaba y el login caía en authorize() → el rebote visible por Discord "de
        // ayer". En false, la librería usa el id_token decodificado y no toca /userinfo.
        autoUserInfo: false,
        secureRoutes: [environment.apiUrl],
        logLevel: environment.production ? LogLevel.Error : LogLevel.Warn,
      },
    }),
    // Por defecto la librería usa sessionStorage, que se borra al cerrar la pestaña:
    // volver a la app obligaba a pulsar "entrar con Discord" otra vez. Con localStorage
    // la sesión sobrevive al cierre del navegador y se renueva sola con el refresh token.
    { provide: AbstractSecurityStorage, useClass: DefaultLocalStorageService },
    // El UI kit no puede importar de core/ (regla de capas): declara qué necesita
    // (NF_THEME) y aquí se cablea al servicio real. Lo usa NfWindow para no pintar
    // cromo de ventana retro en el tema "original".
    { provide: NF_THEME, useFactory: () => inject(ThemeService).theme },
  ],
};
