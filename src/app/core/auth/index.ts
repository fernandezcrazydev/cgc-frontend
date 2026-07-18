/* Superficie pública del módulo de autenticación. El resto de la app importa de
 * aquí (`core/auth`) y nunca de los ficheros sueltos: así `UserApi` puede cambiar
 * sin arrastrar a nadie. */
export { Auth } from './auth';
export { authGuard } from './auth-guard';
export { adminGuard } from './admin-guard';
export { Session, type SessionStatus } from './session';
export { type CurrentUser, initialsOf } from './current-user';
