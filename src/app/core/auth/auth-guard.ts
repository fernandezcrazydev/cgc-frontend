import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';
import { Session } from './session';

/**
 * Protege /app. Antes de esto cualquiera podía abrir el lobby escribiendo la URL,
 * y el shell se pintaba con un usuario que no existía.
 *
 * Exige DOS cosas, en orden:
 *   1. Un token válido (si no, ni molestamos al backend: sería un 401 seguro).
 *   2. Un perfil cargado desde `/me`. Sin identidad no hay app que pintar, así
 *      que un 404/500 aquí también devuelve al login en vez de dejar un shell
 *      medio vacío.
 *
 * Al resolverse, `Session` ya tiene el usuario: el shell puede leerlo en el
 * primer render sin parpadeo.
 */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const session = inject(Session);
  const router = inject(Router);

  if (!(await auth.isAuthenticated())) {
    return router.createUrlTree(['/']);
  }

  const user = await session.ensureLoaded();
  return user ? true : router.createUrlTree(['/']);
};
