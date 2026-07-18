import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';

/**
 * Protege las rutas de administración (`/app/admin/**`). Se apila sobre `authGuard`
 * (que ya vive en el padre `/app`): para cuando esto corre, ya hay token y perfil.
 *
 * Comprueba el claim `roles` del access token. Es una comodidad de UI —esconder lo
 * que un no-admin no debe ver—; la autorización de verdad la hace el backend con
 * `@PreAuthorize('hasRole(ADMIN)')`, así que un token manipulado en el navegador
 * abriría la vista pero no obtendría datos (403 en cada llamada). A un no-admin lo
 * devolvemos a inicio en vez de al login: está autenticado, solo le falta el rol.
 */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  return (await auth.isAdmin()) ? true : router.createUrlTree(['/app', 'inicio']);
};
