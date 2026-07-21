import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OidcSecurityService } from 'angular-auth-oidc-client';
import { catchError, firstValueFrom, from, switchMap, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Session } from '../auth/session';
import { ToastService } from '../toast';

/**
 * Un 401 no debe llegar nunca a la vista como "no hay datos".
 *
 * El access token vive minutos y `silentRenew` lo renueva con un temporizador. Ese
 * temporizador NO es fiable: si la pestaña estuvo en segundo plano, dormida o el portátil
 * suspendido, el navegador estrangula los timers y el token caduca sin que nadie lo renueve.
 * La app sigue pintada y con aspecto de sesión viva, así que la siguiente petición —el clic en
 * "gestionar grupos"— sale con un token muerto, el backend responde 401, el store lo trata como
 * un error cualquiera y la lista se queda vacía. Al usuario le desaparecen los grupos y solo un
 * F5 los devuelve (el guard, al arrancar, sí hace `checkAuthIncludingServer()` y refresca).
 *
 * Este interceptor cierra ese hueco: ante un 401 de nuestra API refresca el token y REPITE la
 * petición original, de forma que el clic simplemente funciona (un poco más lento). Solo si el
 * refresh también falla —refresh token caducado o revocado, esto sí es sesión terminada— se
 * limpia `Session` y se vuelve al login.
 */

/** Marca la petición ya reintentada: un 401 tras refrescar es un 401 de verdad, no un bucle. */
const RETRIED_AFTER_REFRESH = new HttpContextToken(() => false);

@Injectable({ providedIn: 'root' })
export class SessionRecovery {
  private readonly oidc = inject(OidcSecurityService);
  private readonly session = inject(Session);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  /** El refresh en vuelo: N peticiones que fallan a la vez comparten UNA renovación. */
  private inFlight: Promise<boolean> | null = null;

  /**
   * Renueva el token contra el Authorization Server. `true` = hay token nuevo y la petición
   * original se puede repetir. `false` = la sesión está muerta y ya se ha cerrado. Nunca lanza.
   */
  refresh(): Promise<boolean> {
    return (this.inFlight ??= this.run());
  }

  private async run(): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        // Mismo motivo que en `Auth.isAuthenticated()`: la rama de refresh token de la librería
        // no trae timeout, y un /oauth2/token que no responde dejaría la petición original
        // colgada para siempre en vez de fallar.
        this.oidc.forceRefreshSession().pipe(timeout(10_000)),
      );
      if (!result?.isAuthenticated) {
        this.expire();
        return false;
      }
      return true;
    } catch {
      this.expire();
      return false;
    } finally {
      // Se libera SIEMPRE: si no, un fallo dejaría cacheada la promesa y ningún 401 posterior
      // volvería a intentar la renovación.
      this.inFlight = null;
    }
  }

  /**
   * Sesión irrecuperable: fuera el perfil en memoria y de vuelta al login. No se toca el candado
   * de auto-login a propósito — si el usuario venía de una sesión buena, el candado está quitado
   * y `Login` relanzará el flujo solo; con la sesión del AS y la cookie de Discord vivas eso es
   * una cadena de redirects invisible y el usuario vuelve a estar dentro sin tocar nada.
   */
  private expire(): void {
    this.session.clear();
    this.toasts.info('Tu sesión había caducado. Reconectando…');
    void this.router.navigateByUrl('/');
  }
}

/**
 * Debe registrarse ANTES de `authInterceptor()`: así el reintento vuelve a pasar por él y
 * recoge el Bearer recién renovado (la librería hace `headers.set`, sobrescribe el viejo).
 */
export const sessionRecoveryInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo nuestra API. Los endpoints del propio OAuth (/oauth2/token) quedan fuera: un 401 ahí
  // es el fallo del refresh, no algo que refrescar.
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const recovery = inject(SessionRecovery);

  return next(req).pipe(
    catchError((error: unknown) => {
      const is401 = error instanceof HttpErrorResponse && error.status === 401;
      if (!is401 || req.context.get(RETRIED_AFTER_REFRESH)) return throwError(() => error);

      return from(recovery.refresh()).pipe(
        switchMap((renewed) => {
          if (!renewed) return throwError(() => error);
          return next(req.clone({ context: req.context.set(RETRIED_AFTER_REFRESH, true) }));
        }),
      );
    }),
  );
};
